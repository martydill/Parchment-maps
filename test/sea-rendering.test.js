import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createSeaRendering } from "../src/sea-rendering.js";

function recordingContext() {
  const calls = [];
  const strokes = [];
  const states = [];
  let path = [];
  const context = new Proxy(
    {
      globalAlpha: 1,
      beginPath() {
        calls.push(["beginPath"]);
        path = [];
      },
      moveTo(...args) {
        calls.push(["moveTo", ...args]);
        path.push(["moveTo", ...args]);
      },
      lineTo(...args) {
        calls.push(["lineTo", ...args]);
        path.push(["lineTo", ...args]);
      },
      bezierCurveTo(...args) {
        calls.push(["bezierCurveTo", ...args]);
        path.push(["bezierCurveTo", ...args]);
      },
      stroke(...args) {
        calls.push(["stroke", ...args]);
        strokes.push({
          style: this.strokeStyle,
          width: this.lineWidth,
          alpha: this.globalAlpha,
          path: [...path],
        });
      },
      save() {
        calls.push(["save"]);
        states.push(this.globalAlpha);
      },
      restore() {
        calls.push(["restore"]);
        this.globalAlpha = states.pop();
      },
      createRadialGradient(...args) {
        calls.push(["createRadialGradient", ...args]);
        return {
          addColorStop: (...args) => calls.push(["addColorStop", ...args]),
        };
      },
      createLinearGradient(...args) {
        calls.push(["createLinearGradient", ...args]);
        return {
          addColorStop: (...args) => calls.push(["addColorStop", ...args]),
        };
      },
    },
    {
      get(target, property) {
        if (property in target) return target[property];
        return (...args) => calls.push([property, ...args]);
      },
      set(target, property, value) {
        calls.push([property, typeof value === "object" ? "gradient" : value]);
        target[property] = value;
        return true;
      },
    },
  );
  return { context, calls, strokes };
}

const stampCanvases = [];
const previousDocument = globalThis.document;
globalThis.document = {
  createElement() {
    const recording = recordingContext();
    const canvas = {
      getContext: () => recording.context,
      calls: recording.calls,
    };
    stampCanvases.push(canvas);
    return canvas;
  },
};
after(() => {
  if (previousDocument === undefined) delete globalThis.document;
  else globalThis.document = previousDocument;
});

const options = {
  camera: { x: 500, y: 400, zoom: 1 },
  vw: 300,
  vh: 200,
  time: 0,
  roughness: 0.5,
  windAngle: 0.2,
  reducedMotion: false,
  lighting: { daylight: 1, storm: 0 },
};

test("a focal creature remains surfaced through its encounter camera move", () => {
  const renderer = createSeaRendering({
    WORLD: { w: 1000, h: 800 },
    lands: [],
    creatures: [[500, 400, 1]],
  });
  const submerged = recordingContext();
  const introduced = recordingContext();
  renderer.drawSurface(submerged.context, { ...options, time: 8000 });
  renderer.drawSurface(introduced.context, {
    ...options,
    time: 8000,
    encounterCreature: 0,
  });
  const spout = (calls) =>
    calls.some(
      ([method, x, y]) => method === "moveTo" && x === 13 && y === -10,
    );
  assert.equal(spout(submerged.calls), false);
  assert.equal(spout(introduced.calls), true);
});

test("surface marks reuse bounded palettes across time, weather, and zoom", () => {
  const renderer = createSeaRendering({
    WORLD: { w: 1000, h: 800 },
    lands: [],
  });
  const shadows = new Set();
  const glints = new Set();
  for (let frame = 0; frame < 100; frame++) {
    const { context, calls } = recordingContext();
    renderer.drawSurface(context, {
      ...options,
      camera: { ...options.camera, zoom: [0.7, 1, 2][frame % 3] },
      time: frame * 123,
      roughness: (frame % 11) / 10,
      lighting: { daylight: (frame % 7) / 6, storm: (frame % 5) / 4 },
    });
    for (const [property, style] of calls) {
      if (property !== "strokeStyle") continue;
      if (style.startsWith("rgba(37,81,78,")) shadows.add(style);
      if (style.startsWith("rgba(247,237,197,")) glints.add(style);
    }
  }
  assert.equal(shadows.size, 20);
  assert.ok(glints.size > 20 && glints.size <= 128);
});

test("reduced motion keeps water geometry and colors identical across frames", () => {
  const renderer = createSeaRendering({
    WORLD: { w: 1000, h: 800 },
    lands: [],
  });
  const first = recordingContext();
  const second = recordingContext();
  renderer.drawSurface(first.context, {
    ...options,
    reducedMotion: true,
    time: 1000,
  });
  renderer.drawSurface(second.context, {
    ...options,
    reducedMotion: true,
    time: 99000,
  });
  assert.deepEqual(first.calls, second.calls);
});

test("surface palettes and phases are continuous across the world seam", () => {
  const renderer = createSeaRendering({
    WORLD: { w: 1000, h: 800 },
    lands: [],
  });
  const first = recordingContext();
  const wrapped = recordingContext();
  renderer.drawSurface(first.context, options);
  renderer.drawSurface(wrapped.context, {
    ...options,
    camera: { ...options.camera, x: options.camera.x + 1000 },
  });
  const strokes = ({ calls }) =>
    calls.filter(([property]) => property === "strokeStyle");
  assert.deepEqual(strokes(first), strokes(wrapped));
});

test("current lanes reuse their exact fixed opacities at every phase", () => {
  const renderer = createSeaRendering({
    WORLD: { w: 1000, h: 800 },
    lands: [],
    currents: [[500, 400, 0.2]],
  });
  for (const time of [0, 1000, 99000]) {
    const { context, calls } = recordingContext();
    renderer.drawSurface(context, { ...options, time });
    const styles = calls.filter(
      ([property, style]) =>
        property === "strokeStyle" &&
        (style.startsWith("rgba(38,104,107,") ||
          style.startsWith("rgba(238,236,193,")),
    );
    assert.equal(styles.length, 14);
    for (let lane = -3; lane <= 3; lane++) {
      const index = (lane + 3) * 2;
      assert.equal(
        styles[index][1],
        `rgba(38,104,107,${0.055 + (3 - Math.abs(lane)) * 0.009})`,
      );
      assert.equal(
        styles[index + 1][1],
        `rgba(238,236,193,${0.2 + (3 - Math.abs(lane)) * 0.035})`,
      );
    }
  }
});

test("glitter envelopes reuse bounded textures across motion and wrapping", () => {
  const renderer = createSeaRendering({
    WORLD: { w: 1000, h: 800 },
    lands: [],
  });
  const first = recordingContext();
  first.context.globalAlpha = 0.5;
  renderer.drawSurface(first.context, options);
  const draws = first.calls.filter(([name]) => name === "drawImage");
  assert.ok(draws.length > 0);
  const count = stampCanvases.length;
  assert.equal(new Set(draws.map(([, stamp]) => stamp)).size, 1);
  assert.ok(draws.every(([, , , , width, height]) => width > height));
  const gradient = draws[0][1].calls.find(
    ([name]) => name === "createRadialGradient",
  );
  assert.equal(gradient[3], 0);
  for (let frame = 1; frame <= 60; frame++) {
    const next = recordingContext();
    renderer.drawSurface(next.context, {
      ...options,
      time: frame * 16,
      camera: { ...options.camera, x: options.camera.x + 1000 },
    });
    assert.equal(stampCanvases.length, count);
    assert.ok(!next.calls.some(([name]) => name === "createRadialGradient"));
    assert.deepEqual(
      next.calls
        .filter(([name]) => name === "drawImage")
        .map(([, stamp]) => stamp),
      draws.map(([, stamp]) => stamp),
    );
  }
  assert.equal(first.context.globalAlpha, 0.5);
});

const waveStrokes = ({ strokes }) =>
  strokes.filter(({ style }) => /^rgba\((37,81,78|247,237,197),/.test(style));

test("grouped opacities reduce draw batches while preserving nearby wave geometry", () => {
  const renderer = createSeaRendering({
    WORLD: { w: 4800, h: 3200 },
    lands: [],
  });
  const render = (detail) => {
    const recording = recordingContext();
    renderer.drawSurface(recording.context, {
      ...options,
      camera: { x: 2400, y: 1600, zoom: 0.7 },
      vw: 2000,
      vh: 1400,
      time: 1000,
      lighting: { daylight: 0 },
      focus: { x: 2400, y: 1600, radius: 10000 },
      detail,
    });
    return waveStrokes(recording);
  };
  const full = render(1);
  const grouped = render(0.85);
  assert.ok(grouped.length < full.length * 0.7);
  const geometry = (strokes) =>
    strokes
      .flatMap(({ width, path }) => {
        const segments = [];
        for (let i = 0; i < path.length; i += 2)
          segments.push(JSON.stringify([width, ...path.slice(i, i + 2)]));
        return segments;
      })
      .sort();
  assert.deepEqual(geometry(grouped), geometry(full));
});

test("hundreds of waves share opacity paths and one layer rotation", () => {
  const renderer = createSeaRendering({
    WORLD: { w: 4800, h: 3200 },
    lands: [],
  });
  const recording = recordingContext();
  renderer.drawSurface(recording.context, {
    ...options,
    camera: { x: 2400, y: 1600, zoom: 0.7 },
    vw: 1280,
    vh: 800,
    lighting: { daylight: 0 },
  });
  const waves = waveStrokes(recording);
  const shadows = waves.filter(({ width }) => width === 3.5);
  const glints = waves.filter(
    ({ width, alpha }) => width !== 3.5 && alpha === 1,
  );
  const marks = shadows.reduce((count, { path }) => count + path.length / 2, 0);
  assert.ok(marks > 500);
  assert.ok(waves.length <= 20 + 128 + 128);
  assert.ok(waves.length < marks / 2);
  assert.equal(shadows.length, 20);
  assert.equal(new Set(shadows.map(({ style }) => style)).size, shadows.length);
  assert.ok(glints.some(({ path }) => path.length > 2));
  assert.equal(recording.calls.filter(([name]) => name === "rotate").length, 1);
  assert.ok(
    recording.calls.filter(([name]) => name === "save").length < marks / 10,
  );
  for (const { path } of waves) {
    for (let index = 0; index < path.length; index += 2) {
      assert.equal(
        path[index][0],
        "moveTo",
        "marks must not connect to each other",
      );
      assert.ok(["lineTo", "bezierCurveTo"].includes(path[index + 1][0]));
    }
  }
});

test("batch rotation preserves the original wave geometry and state", () => {
  const renderer = createSeaRendering({
    WORLD: { w: 1000, h: 800 },
    lands: [],
  });
  const recording = recordingContext();
  recording.context.globalAlpha = 0.4;
  const time = 2700;
  const windAngle = 1.2;
  renderer.drawSurface(recording.context, {
    ...options,
    time,
    windAngle,
    lighting: { daylight: 0 },
  });
  const shadows = waveStrokes(recording).filter(({ width }) => width === 3.5);
  const rotation = Math.sin(windAngle) * 0.12;
  const cos = Math.cos(rotation),
    sin = Math.sin(rotation);
  // The row-4, column-2 mark is visible in this viewport. Check its start and
  // control points against the original per-mark translate/rotate geometry.
  const phase = 2 * 2.39 + 4 * 1.73;
  const length = 18 + (Math.sin(phase) + 1) * 15;
  const t = time / 1000;
  const x =
    2 * (1000 / 11) + Math.sin(4 * 12.7) * 25 + Math.cos(t * 0.28 + phase) * 5;
  const y = 4 * 48 + Math.sin(phase * 3) * 16 + Math.sin(t * 0.48 + phase) * 3;
  const expected = [
    [-length, 3],
    [-length * 0.3, -2],
    [length * 0.4, 7],
    [length, 1],
  ].map(([px, py]) => [x + px * cos - py * sin, y + px * sin + py * cos]);
  const points = shadows.flatMap(({ path }) => {
    const curves = [];
    for (let index = 0; index < path.length; index += 2) {
      const coordinates = [
        ...path[index].slice(1),
        ...path[index + 1].slice(1),
      ];
      curves.push(
        Array.from({ length: 4 }, (_, point) => {
          const px = coordinates[point * 2],
            py = coordinates[point * 2 + 1];
          return [px * cos - py * sin, px * sin + py * cos];
        }),
      );
    }
    return curves;
  });
  assert.ok(
    points.some((curve) =>
      curve.every(
        ([px, py], index) =>
          Math.abs(px - expected[index][0]) < 1e-10 &&
          Math.abs(py - expected[index][1]) < 1e-10,
      ),
    ),
  );
  assert.ok(shadows.every(({ alpha }) => alpha === 0.4));
  const crests = waveStrokes(recording).filter(
    ({ path }) => path[1]?.[0] === "lineTo",
  );
  assert.ok(crests.length > 0);
  assert.ok(crests.every(({ alpha }) => alpha === 1));
  assert.equal(recording.context.globalAlpha, 0.4);
});

test("wave buffers discard old marks when the viewport shrinks or becomes empty", () => {
  const renderer = createSeaRendering({
    WORLD: { w: 1000, h: 800 },
    lands: [],
  });
  const render = (overrides) => {
    const recording = recordingContext();
    renderer.drawSurface(recording.context, {
      ...options,
      lighting: { daylight: 0 },
      ...overrides,
    });
    return waveStrokes(recording);
  };
  const large = render({ vw: 1800, vh: 1000 });
  const small = render({ vw: 100, vh: 100 });
  const pointCount = (waves) =>
    waves.reduce((count, { path }) => count + path.length, 0);
  assert.ok(pointCount(small) < pointCount(large));
  assert.equal(render({ camera: { x: 500, y: 4000, zoom: 1 } }).length, 0);
  assert.deepEqual(render({ vw: 100, vh: 100 }), small);
});

const reflectionSources = {
  vessels: [{ x: 500, y: 400, vesselClass: "brig", angle: 0.4, scale: 1.82 }],
  lamps: [{ x: 510, y: 420, index: 2 }],
  lighting: { daylight: 0, night: 1 },
};

test("reflections wrap with their sources and remain still for reduced motion", () => {
  const renderer = createSeaRendering({
    WORLD: { w: 1000, h: 800 },
    lands: [],
  });
  const render = (overrides = {}) => {
    const recording = recordingContext();
    recording.context.globalAlpha = 0.4;
    renderer.drawReflections(recording.context, {
      ...options,
      ...reflectionSources,
      ...overrides,
    });
    assert.equal(recording.context.globalAlpha, 0.4);
    assert.equal(
      recording.calls.filter(([method]) => method === "save").length,
      recording.calls.filter(([method]) => method === "restore").length,
    );
    assert.ok(
      recording.calls
        .flat()
        .filter((value) => typeof value === "number")
        .every(Number.isFinite),
    );
    return recording.calls;
  };
  const first = render({ time: 1000 });
  assert.notDeepEqual(first, render({ time: 2000 }));
  assert.deepEqual(
    render({ time: 1000, reducedMotion: true }),
    render({ time: 99000, reducedMotion: true }),
  );
  const wrapped = render({
    time: 1000,
    camera: { ...options.camera, x: 1500 },
  });
  const firstRegion = first.find(([method]) => method === "rect");
  const wrappedRegion = wrapped.find(([method]) => method === "rect");
  assert.ok(Math.abs(wrappedRegion[1] - firstRegion[1] - 1000) < 1e-10);
  for (let i = 2; i < firstRegion.length; i++)
    assert.ok(Math.abs(firstRegion[i] - wrappedRegion[i]) < 1e-10);
  const geometry = (calls) => {
    const regionIndex = calls.findIndex(([method]) => method === "rect");
    return calls.filter(
      ([method], index) => method !== "translate" && index !== regionIndex,
    );
  };
  assert.deepEqual(geometry(first), geometry(wrapped));
  assert.ok(
    wrapped.some(([method, x]) => method === "translate" && x === 1500),
  );
});

test("reflections cull distant sources and keep harbor light out of daylight", () => {
  const renderer = createSeaRendering({
    WORLD: { w: 1000, h: 800 },
    lands: [],
  });
  const render = (sources) => {
    const recording = recordingContext();
    renderer.drawReflections(recording.context, { ...options, ...sources });
    return recording.calls;
  };
  assert.deepEqual(render({}), []);
  const distant = render({
    ...reflectionSources,
    vessels: [{ x: 500, y: 1400 }],
    lamps: [{ x: 500, y: 1400 }],
  });
  assert.ok(
    !distant.some(([method]) => method === "fill" || method === "stroke"),
  );
  const daylight = render({ lamps: reflectionSources.lamps });
  assert.ok(!daylight.some(([method]) => method === "stroke"));
  assert.ok(
    render({ vessels: [{ x: 500, y: 400, vesselClass: "dhow" }] }).some(
      ([method]) => method === "fill",
    ),
  );
});

test("reflection and wake layers clip out wrapped land and raised cliff faces", () => {
  const previousPath = globalThis.Path2D;
  globalThis.Path2D = class {
    rect() {}
    moveTo() {}
    lineTo() {}
    closePath() {}
  };
  try {
    const renderer = createSeaRendering({
      WORLD: { w: 1000, h: 800 },
      lands: [
        {
          poly: [
            [950, 300],
            [1050, 300],
            [1050, 500],
            [950, 500],
          ],
        },
        {
          poly: [
            [450, 300],
            [550, 300],
            [550, 500],
            [450, 500],
          ],
        },
      ],
    });
    const recording = recordingContext();
    renderer.drawReflections(recording.context, {
      ...options,
      ...reflectionSources,
      camera: { x: 0, y: 400, zoom: 1 },
      vessels: [{ x: 0, y: 400 }],
      lamps: [],
      vw: 2000,
    });
    const masks = recording.calls.filter(
      ([method, , rule]) => method === "clip" && rule === "evenodd",
    );
    assert.equal(masks.length, 2);
    const reflectionRegion = recording.calls.find(
      ([method]) => method === "rect",
    );
    assert.ok(reflectionRegion[1] < 0);
    assert.ok(reflectionRegion[3] < 400);
    assert.ok(
      recording.calls.some(
        ([method, x]) => method === "translate" && x === -1000,
      ),
    );
    const wake = recordingContext();
    renderer.drawWake(
      wake.context,
      [
        { x: 990, y: 520, time: 9500, strength: 1 },
        { x: 10, y: 540, time: 9000, strength: 1 },
      ],
      10000,
      { x: 0, y: 400, zoom: 1 },
      2000,
      200,
    );
    assert.equal(
      wake.calls.filter(
        ([method, , rule]) => method === "clip" && rule === "evenodd",
      ).length,
      2,
    );
    assert.ok(wake.calls.some(([method]) => method === "fill"));
    const wakeRegion = wake.calls.find(([method]) => method === "rect");
    assert.ok(wakeRegion[1] < -10);
    assert.ok(wakeRegion[1] + wakeRegion[3] > 10);
    assert.ok(wakeRegion[3] < 400);
  } finally {
    if (previousPath === undefined) delete globalThis.Path2D;
    else globalThis.Path2D = previousPath;
  }
});

test("buffered glitter follows the viewer while world ripples reuse their anchor", () => {
  const previousPath = globalThis.Path2D;
  globalThis.Path2D = class {
    rect() {}
    moveTo() {}
    lineTo() {}
    closePath() {}
  };
  try {
    const renderer = createSeaRendering({
      WORLD: { w: 1000, h: 800 },
      lands: [
        {
          poly: [
            [480, 380],
            [520, 380],
            [520, 420],
            [480, 420],
          ],
        },
      ],
    });
    const first = recordingContext();
    first.context.globalAlpha = 0.4;
    const frame = {
      ...options,
      vw: 1600,
      vh: 1000,
      camera: { x: 500, y: 400, zoom: 0.7 },
      focus: { x: 500, y: 400, radius: 480 },
      bufferSurface: true,
    };
    renderer.drawSurface(first.context, frame);
    const layers = first.calls.filter(([method]) => method === "drawImage");
    assert.equal(layers.length, 2);
    for (const [, layer] of layers)
      assert.ok(
        layer.calls.some(
          ([method, , rule]) => method === "clip" && rule === "evenodd",
        ),
      );
    assert.ok(
      !first.calls.some(
        ([method, , rule]) => method === "clip" && rule === "evenodd",
      ),
    );
    const counts = layers.map(([, layer]) => layer.calls.length);
    const next = recordingContext();
    next.context.globalAlpha = 0.4;
    renderer.drawSurface(next.context, {
      ...frame,
      time: 16,
      camera: { ...frame.camera, x: 505 },
    });
    const nextLayers = next.calls.filter(([method]) => method === "drawImage");
    assert.equal(nextLayers[0][1], layers[0][1]);
    assert.equal(nextLayers[0][2], layers[0][2] + 5);
    assert.ok(layers[0][1].calls.length > counts[0]);
    assert.deepEqual(nextLayers[1], layers[1]);
    assert.equal(layers[1][1].calls.length, counts[1]);
    assert.equal(first.context.globalAlpha, 0.4);
    assert.equal(next.context.globalAlpha, 0.4);
  } finally {
    if (previousPath === undefined) delete globalThis.Path2D;
    else globalThis.Path2D = previousPath;
  }
});

test("river paths are baked once, culled offscreen, and reused across wrapped views", () => {
  const previousPath = globalThis.Path2D;
  globalThis.Path2D = class {
    commands = [];
    rect(...args) {
      this.commands.push(["rect", ...args]);
    }
    moveTo(...args) {
      this.commands.push(["moveTo", ...args]);
    }
    lineTo(...args) {
      this.commands.push(["lineTo", ...args]);
    }
    quadraticCurveTo(...args) {
      this.commands.push(["quadraticCurveTo", ...args]);
    }
    closePath() {}
  };
  try {
    const renderer = createSeaRendering({
      WORLD: { w: 1000, h: 800 },
      lands: [
        {
          poly: [
            [950, 300],
            [1050, 300],
            [1050, 700],
            [950, 700],
          ],
        },
      ],
    });
    const rivers = [
      [
        [
          { x: 980, y: 380 },
          { x: 990, y: 400 },
          { x: 1010, y: 420 },
        ],
        [
          { x: 980, y: 650 },
          { x: 1010, y: 670 },
        ],
        [{ x: 980, y: 380 }],
      ],
    ];
    renderer.setRivers(rivers);
    const riverStrokes = (x) => {
      const recording = recordingContext();
      renderer.drawSurface(recording.context, {
        ...options,
        camera: { x, y: 400, zoom: 1 },
      });
      return recording.calls.filter(
        ([method, path]) =>
          method === "stroke" &&
          path?.commands?.some(([command]) => command === "quadraticCurveTo"),
      );
    };
    const first = riverStrokes(0);
    assert.equal(first.length, 1);
    assert.deepEqual(first[0][1].commands, [
      ["moveTo", 980, 380],
      ["quadraticCurveTo", 990, 400, 1000, 410],
      ["lineTo", 1010, 420],
    ]);
    assert.equal(riverStrokes(0)[0][1], first[0][1]);
    assert.equal(riverStrokes(1000)[0][1], first[0][1]);
    assert.equal(riverStrokes(500).length, 0);
    renderer.setRivers(rivers);
    assert.notEqual(riverStrokes(0)[0][1], first[0][1]);
  } finally {
    if (previousPath === undefined) delete globalThis.Path2D;
    else globalThis.Path2D = previousPath;
  }
});

test("reduced detail lowers distant wave work while preserving every nearby wave", () => {
  const renderer = createSeaRendering({
    WORLD: { w: 4800, h: 3200 },
    lands: [],
  });
  const state = {
    ...options,
    camera: { x: 2400, y: 1600, zoom: 0.7 },
    vw: 2560,
    vh: 1440,
    lighting: { daylight: 0 },
    windAngle: 0,
    time: 2700,
    focus: { x: 2400, y: 1600, radius: 480 },
  };
  const render = (detail, camera = state.camera, focus = state.focus) => {
    const recording = recordingContext();
    renderer.drawSurface(recording.context, {
      ...state,
      detail,
      camera,
      focus,
    });
    return waveStrokes(recording)
      .filter(({ width }) => width === 3.5)
      .flatMap(({ path }) => {
        const marks = [];
        for (let i = 0; i < path.length; i += 2)
          marks.push([path[i], path[i + 1]]);
        return marks;
      });
  };
  const full = render(1);
  const medium = render(0.7);
  const low = render(0.5);
  assert.ok(medium.length < full.length * 0.65);
  assert.ok(low.length < medium.length);
  for (const reduced of [medium, low]) {
    const retained = new Set(reduced.map((mark) => JSON.stringify(mark)));
    const nearby = full.filter(
      ([a, b]) => Math.hypot((a[1] + b[5]) / 2 - 2400, a[2] - 3 - 1600) <= 480,
    );
    assert.ok(nearby.length > 100);
    assert.ok(nearby.every((mark) => retained.has(JSON.stringify(mark))));
  }
  const shifted = render(
    0.5,
    { ...state.camera, x: state.camera.x - 4800 },
    { ...state.focus, x: state.focus.x - 4800 },
  );
  assert.equal(shifted.length, low.length);
  const normalize = (marks, offset) =>
    marks.map(([a, b]) => [
      ...a.slice(1).map((value, i) => (i % 2 === 0 ? value + offset : value)),
      ...b.slice(1).map((value, i) => (i % 2 === 0 ? value + offset : value)),
    ]);
  const canonicalMarks = normalize(low, 0);
  normalize(shifted, 4800).forEach((mark, index) =>
    mark.forEach((value, coordinate) =>
      assert.ok(Math.abs(value - canonicalMarks[index][coordinate]) < 1e-9),
    ),
  );
});

test("moon glitter uses a cool envelope and restores inherited opacity", () => {
  const renderer = createSeaRendering({
    WORLD: { w: 1000, h: 800 },
    lands: [],
  });
  const night = recordingContext();
  night.context.globalAlpha = 0.4;
  renderer.drawSurface(night.context, {
    ...options,
    lighting: { daylight: 0, night: 1, moon: 1 },
  });
  const draws = night.calls.filter(([name]) => name === "drawImage");
  assert.ok(draws.length > 0);
  assert.ok(
    draws[0][1].calls.some(
      ([name, , color]) =>
        name === "addColorStop" && color === "rgba(196,224,255,1)",
    ),
  );
  assert.equal(night.context.globalAlpha, 0.4);
});

test("caustic lace blends once through shoal masks, caches, and freezes with reduced motion", () => {
  const renderer = createSeaRendering({
    WORLD: { w: 1000, h: 800 },
    lands: [],
  });
  const shelf = {};
  const frame = {
    ...options,
    shoals: [{ sx: 500, sy: 400, rx: 110, ry: 60, shelf }],
  };
  const first = recordingContext();
  first.context.globalAlpha = 0.4;
  renderer.drawCaustics(first.context, frame);
  const blends = first.calls.filter(
    ([name]) => name === "globalCompositeOperation",
  );
  assert.deepEqual(blends, [["globalCompositeOperation", "overlay"]]);
  const draws = first.calls.filter(([name]) => name === "drawImage");
  assert.equal(draws.length, 1);
  const mask = draws[0][1];
  assert.ok(
    mask.calls.some(([name, path]) => name === "clip" && path === shelf),
  );
  assert.ok(
    mask.calls.some(
      ([name, value]) =>
        name === "globalCompositeOperation" && value === "source-in",
    ),
  );
  const web = mask.calls.filter(([name]) => name === "drawImage").at(-1)[1];
  assert.ok(web.calls.some(([name]) => name === "quadraticCurveTo"));
  assert.equal(web.calls.filter(([name]) => name === "stroke").length, 2);
  assert.equal(first.context.globalAlpha, 0.4);
  const count = mask.calls.length;
  renderer.drawCaustics(first.context, { ...frame, time: 16 });
  assert.equal(mask.calls.length, count);
  renderer.drawCaustics(first.context, { ...frame, time: 34 });
  assert.ok(mask.calls.length > count);
  renderer.drawCaustics(first.context, {
    ...frame,
    time: 1000,
    reducedMotion: true,
  });
  const frozen = mask.calls.length;
  renderer.drawCaustics(first.context, {
    ...frame,
    time: 9999,
    reducedMotion: true,
  });
  assert.equal(mask.calls.length, frozen);
  const hidden = recordingContext();
  renderer.drawCaustics(hidden.context, {
    ...frame,
    lighting: { daylight: 0 },
  });
  assert.equal(hidden.calls.length, 0);
});

test("deferred glitter leaves the base sea unlit and composes in its own pass", () => {
  const renderer = createSeaRendering({
    WORLD: { w: 1000, h: 800 },
    lands: [],
  });
  for (const bufferSurface of [false, true]) {
    const base = recordingContext();
    renderer.drawSurface(base.context, {
      ...options,
      bufferSurface,
      deferLighting: true,
    });
    assert.ok(
      !base.calls.some(
        ([name, value]) =>
          name === "globalCompositeOperation" && value === "screen",
      ),
    );
  }
  const lit = recordingContext();
  renderer.drawLighting(lit.context, { ...options, reducedMotion: true });
  const layer = lit.calls.find(([name]) => name === "drawImage")[1];
  const count = layer.calls.length;
  renderer.drawLighting(lit.context, {
    ...options,
    time: 9999,
    reducedMotion: true,
  });
  assert.equal(layer.calls.length, count);
  assert.ok(
    lit.calls.some(
      ([name, value]) =>
        name === "globalCompositeOperation" && value === "screen",
    ),
  );
});

test("deep-water views skip caustic surfaces altogether", () => {
  const renderer = createSeaRendering({
    WORLD: { w: 1000, h: 800 },
    lands: [],
  });
  const target = recordingContext();
  const allocations = stampCanvases.length;
  renderer.drawCaustics(target.context, {
    ...options,
    shoals: [{ sx: 10, sy: 10, rx: 20, ry: 10, shelf: {} }],
  });
  assert.equal(stampCanvases.length, allocations);
  assert.equal(target.calls.length, 0);
});
