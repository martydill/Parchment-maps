import test, { after } from "node:test";
import assert from "node:assert/strict";
import { drawWeatherEffects } from "../src/rendering.js";
import { sampleWeatherFront } from "../src/core/weather.js";

function recordingContext() {
  const draws = [];
  const gradients = [];
  const states = [];
  const strokes = [];
  const fills = [];
  const rects = [];
  const transforms = [];
  const clears = [];
  const context = new Proxy(
    {
      globalAlpha: 1,
      globalCompositeOperation: "source-over",
      setTransform(...args) {
        transforms.push(args);
      },
      clearRect(...args) {
        clears.push(args);
      },
      fillRect(...geometry) {
        rects.push({
          geometry,
          color: this.fillStyle,
          operation: this.globalCompositeOperation,
        });
      },
      stroke() {
        strokes.push(this.strokeStyle);
      },
      fill() {
        fills.push(this.globalCompositeOperation);
      },
      save() {
        states.push(this.globalAlpha);
      },
      restore() {
        this.globalAlpha = states.pop();
      },
      drawImage(stamp, ...geometry) {
        draws.push({ stamp, geometry, alpha: this.globalAlpha });
      },
      createRadialGradient(...geometry) {
        const stops = [];
        gradients.push({ geometry, stops });
        return { addColorStop: (...stop) => stops.push(stop) };
      },
      createLinearGradient() {
        return { addColorStop() {} };
      },
    },
    { get: (target, property) => target[property] ?? (() => {}) },
  );
  return {
    context,
    draws,
    gradients,
    strokes,
    fills,
    rects,
    transforms,
    clears,
  };
}

const stampCanvases = [];
const previousDocument = globalThis.document;
globalThis.document = {
  createElement() {
    const recording = recordingContext();
    const canvas = { getContext: () => recording.context, ...recording };
    stampCanvases.push(canvas);
    return canvas;
  },
};
after(() => {
  if (previousDocument === undefined) delete globalThis.document;
  else globalThis.document = previousDocument;
});

function render(overrides = {}) {
  const recording = recordingContext();
  drawWeatherEffects(recording.context, {
    name: "Overcast",
    roughness: 0.5,
    visibilityKm: 12,
    vw: 800,
    vh: 600,
    time: 0,
    reducedMotion: true,
    ...overrides,
  });
  return recording;
}

const puffs = ({ draws }) =>
  draws.filter(({ stamp }) =>
    stamp.gradients.at(-1).stops.some(([position]) => position === 0.7),
  );

test("reduced motion retains storm atmosphere without a frozen lightning flash", () => {
  const fills = [];
  const c = new Proxy(
    {
      globalAlpha: 1,
      fillRect() {
        fills.push(this.fillStyle);
      },
      createRadialGradient() {
        return { addColorStop() {} };
      },
      createLinearGradient() {
        return { addColorStop() {} };
      },
    },
    {
      get(target, property) {
        return target[property] ?? (() => {});
      },
    },
  );
  const weather = {
    name: "Rain squalls",
    roughness: 0.5,
    visibilityKm: 6,
    vw: 800,
    vh: 600,
    time: 1000000,
  };
  drawWeatherEffects(c, weather);
  assert.ok(fills.some((fill) => String(fill).startsWith("rgba(222,230,255,")));
  fills.length = 0;
  drawWeatherEffects(c, { ...weather, time: 0, reducedMotion: true });
  assert.ok(fills.some((fill) => String(fill).startsWith("rgba(49,72,98,")));
  assert.ok(
    !fills.some((fill) => String(fill).startsWith("rgba(222,230,255,")),
  );
});

test("cloud stamps reuse colors and opacity during motion and refresh when weather changes", () => {
  const first = puffs(render());
  const colors = (draws) =>
    draws.map(({ stamp, alpha }) => [stamp.context.fillStyle, alpha]);
  const originalColors = colors(first);
  const count = stampCanvases.length;
  const moving = puffs(
    render({ time: 1000, vw: 1000, vh: 800, windAngle: 0.8 }),
  );
  assert.equal(first.length, 93);
  assert.equal(stampCanvases.length, count);
  assert.deepEqual(
    moving.map(({ stamp, alpha }) => [stamp, alpha]),
    first.map(({ stamp, alpha }) => [stamp, alpha]),
  );
  const fair = puffs(render({ roughness: 0.25 }));
  assert.notDeepEqual(colors(fair), originalColors);
  assert.deepEqual(colors(puffs(render())), originalColors);
  assert.equal(
    stampCanvases.length,
    count,
    "weather changes reuse the canvases",
  );
  for (const { stamp } of first) {
    const alphas = stamp.gradients
      .at(-1)
      .stops.map(([, color]) =>
        Number(color.slice(color.lastIndexOf(",") + 1, -1)),
      );
    assert.deepEqual(alphas, [1, 0.4, 0]);
  }
});

test("cloud, shadow, and fog bank motion creates no new radial gradients after warming", () => {
  const options = { name: "Fog and overcast", roughness: 0.3, visibilityKm: 2 };
  const first = render(options);
  const count = stampCanvases.length;
  assert.ok(first.draws.length > 20);
  const originalStamps = first.draws.map(({ stamp }) => stamp);
  for (let frame = 1; frame <= 60; frame++) {
    const next = render({
      ...options,
      time: frame * 16,
      windAngle: frame / 60,
    });
    assert.equal(stampCanvases.length, count);
    // The one viewport edge-fog gradient is outside the particle loops.
    assert.equal(next.gradients.length, 1);
    assert.deepEqual(
      next.draws.map(({ stamp }) => stamp),
      originalStamps,
    );
    assert.equal(next.context.globalAlpha, 1);
    assert.ok(next.draws.every(({ alpha }) => alpha > 0 && alpha < 1));
  }
});

const fronts = [
  { name: "Clear", roughness: 0.08, visibilityKm: 24 },
  { name: "Rain squalls", roughness: 0.5, visibilityKm: 6 },
  { name: "Clear", roughness: 0.08, visibilityKm: 24 },
];
const sunlight = ({ draws }) =>
  draws.filter(({ stamp }) =>
    stamp.gradients
      .at(-1)
      .stops.some(([, color]) => /^rgba\(255,(234|241),/.test(color)),
  );

test("structured fronts suppress early rain and produce clearing sunlight only in daylight", () => {
  const approaching = render({ front: sampleWeatherFront(fronts, 0.35) });
  assert.ok(approaching.draws.length > 10);
  assert.equal(approaching.strokes.length, 0);
  assert.ok(
    render({ front: sampleWeatherFront(fronts, 1) }).strokes.length > 0,
  );
  const front = sampleWeatherFront(fronts, 1.65);
  assert.equal(sunlight(render({ front, daylight: 1 })).length, 4);
  assert.equal(sunlight(render({ front, daylight: 0 })).length, 0);
  const squall = render({
    name: "Squall waters",
    front: sampleWeatherFront(fronts, 2.5),
  });
  assert.ok(squall.strokes.length > 0);
  assert.equal(sunlight(squall).length, 0);
});

test("reduced motion freezes front clouds and clearing beams while retaining atmosphere", () => {
  const front = sampleWeatherFront(fronts, 1.65);
  const first = render({ front, time: 1000 });
  const count = stampCanvases.length;
  const later = render({ front, time: 99000 });
  assert.deepEqual(later.draws, first.draws);
  assert.equal(stampCanvases.length, count);
  const moving = render({ front, time: 99000, reducedMotion: false });
  assert.notDeepEqual(
    moving.draws.map(({ geometry }) => geometry),
    first.draws.map(({ geometry }) => geometry),
  );
  assert.equal(stampCanvases.length, count);
});

test("soft weather uses a reusable smaller layer while rain stays on the target", () => {
  const direct = render();
  const first = render({ softLayerScale: 0.5 });
  assert.equal(first.draws.length, 1);
  const layer = first.draws[0].stamp;
  assert.equal(layer.width, 400);
  assert.equal(layer.height, 300);
  assert.deepEqual(first.draws[0].geometry, [0, 0, 800, 600]);
  assert.deepEqual(layer.transforms.at(-1), [0.5, 0, 0, 0.5, 0, 0]);
  assert.ok(layer.draws.length > 0);
  assert.deepEqual(first.strokes, direct.strokes);
  assert.equal(first.context.globalAlpha, 1);
  const before = layer.clears.length;
  const later = render({ softLayerScale: 0.5, time: 5000, vw: 1001, vh: 601 });
  assert.equal(later.draws[0].stamp, layer);
  assert.equal(layer.width, 501);
  assert.equal(layer.height, 301);
  assert.deepEqual(layer.clears.at(-1), [0, 0, 501, 301]);
  assert.equal(layer.clears.length, before + 1);
  assert.deepEqual(layer.transforms.at(-1), [
    501 / 1001,
    0,
    0,
    301 / 601,
    0,
    0,
  ]);
});

test("soft weather culls only cloud puffs whose conservative bounds miss the screen", () => {
  const direct = puffs(render({ windAngle: 0 }));
  const low = render({ windAngle: 0, softLayerScale: 0.5 });
  const layer = low.draws[0].stamp;
  layer.draws.length = 0;
  render({ windAngle: 0, softLayerScale: 0.5 });
  const visible = puffs(layer);
  const expected = direct.filter(
    ({ geometry: [x, y, w, h] }) =>
      x + w >= -1 && x <= 801 && y + h >= -1 && y <= 601,
  );
  assert.ok(visible.length < direct.length);
  assert.deepEqual(visible, expected);
});

test("changing storm colours retints cloud masks without new gradients or textures", () => {
  const first = puffs(
    render({ front: { storm: 1, cloud: 1, rain: 0, fog: 0, lightning: 0 } }),
  );
  const textures = stampCanvases.length;
  const gradients = first.map(({ stamp }) => stamp.gradients.length);
  const paints = first.map(({ stamp }) => stamp.rects.length);
  render({ front: { storm: 0.7, cloud: 1, rain: 0, fog: 0, lightning: 0 } });
  assert.equal(stampCanvases.length, textures);
  first.forEach(({ stamp }, index) => {
    assert.equal(stamp.gradients.length, gradients[index]);
    assert.ok(stamp.rects.length >= paints[index]);
    assert.equal(stamp.rects.at(-1).operation, "source-in");
  });
  assert.ok(
    first.some(({ stamp }, index) => stamp.rects.length > paints[index]),
  );
});

test("the storm arc inks the sky in quantized grades", () => {
  const brewing = render({
    arc: {
      stage: "brewing",
      grade: 2,
      ink: 0.15,
      swell: 0.6,
      birds: 0.3,
      crew: 0.4,
      flicker: 0.5,
      cadence: 8,
      gold: 0,
      rainbow: 0,
      build: 0.5,
    },
  });
  const washes = brewing.rects.filter(({ color }) =>
    String(color).startsWith("rgba(26,35,52,"),
  );
  assert.equal(washes.length, 1);
  assert.equal(washes[0].color, "rgba(26,35,52,0.15)");
  const fair = render({
    arc: {
      stage: "fair",
      grade: 0,
      ink: 0,
      swell: 0,
      birds: 1,
      crew: 0,
      flicker: 0,
      cadence: 8.7,
      gold: 0,
      rainbow: 0,
      build: 0,
    },
  });
  assert.ok(
    !fair.rects.some(({ color }) => String(color).startsWith("rgba(26,35,52,")),
  );
});

test("the rainbow paints a spectral radial wedge only after the break", () => {
  const arc = {
    stage: "afterglow",
    grade: 1,
    ink: 0.075,
    swell: 0.2,
    birds: 0.9,
    crew: 0,
    flicker: 0,
    cadence: 8.7,
    gold: 0.4,
    rainbow: 0.8,
    build: 0.2,
  };
  const afterglow = render({
    front: {
      storm: 0.1,
      cloud: 0.4,
      rain: 0,
      lightning: 0,
      fog: 0,
      sunbreak: 0.9,
    },
    arc,
  });
  const wedges = afterglow.gradients.filter(
    ({ geometry }) => geometry.length === 6,
  );
  // Two offset watercolor passes bleed the band like pigment on wet paper.
  assert.equal(wedges.length, 2);
  const stops = wedges[0].stops;
  assert.deepEqual(
    stops.map(([position]) => position),
    [0, 0.18, 0.34, 0.5, 0.66, 0.82, 1],
  );
  assert.ok(stops.some(([, color]) => color.includes("116,186,150")));
  assert.ok(stops.at(-1)[1].includes("214,92,74"));
  // Both watercolor passes composite as light over the clearing cloud.
  const screenFills = afterglow.rects.filter(
    ({ operation }) => operation === "screen",
  );
  assert.ok(screenFills.length >= 2, `screen fills: ${screenFills.length}`);
  const dry = render({
    front: {
      storm: 0.5,
      cloud: 0.7,
      rain: 0.3,
      lightning: 0.2,
      fog: 0,
      sunbreak: 0,
    },
    arc: { ...arc, rainbow: 0, gold: 0 },
  });
  assert.equal(
    dry.gradients.filter(({ geometry }) => geometry.length === 6).length,
    0,
  );
});

test("storm arc cadence lands the next strike sooner than the legacy interval", () => {
  const front = {
    storm: 1,
    cloud: 1,
    rain: 0.8,
    lightning: 1,
    fog: 0,
    sunbreak: 0,
  };
  const flash = (recording) =>
    recording.rects.some(({ color }) =>
      String(color).startsWith("rgba(222,230,255,"),
    );
  // Legacy cadence: the next strike waits at least ~1.7s.
  const legacyStart = render({ front, time: 8_000_000, reducedMotion: false });
  assert.ok(flash(legacyStart), "the first strike should flash immediately");
  assert.ok(!flash(render({ front, time: 8_001_500, reducedMotion: false })));
  // Arc cadence of one second lands the follow-up strike within 1.5s.
  const arc = {
    stage: "tempest",
    grade: 4,
    ink: 0.34,
    swell: 1,
    birds: 0,
    crew: 1,
    flicker: 0,
    cadence: 1,
    gold: 0,
    rainbow: 0,
    build: 1,
  };
  const start = render({
    front,
    time: 9_000_000,
    reducedMotion: false,
    arc,
  });
  assert.ok(flash(start));
  assert.ok(
    flash(render({ front, time: 9_001_500, reducedMotion: false, arc })),
  );
});

test("sheet lightning flickers inside the cloud while the squall brews", () => {
  const arc = {
    stage: "brewing",
    grade: 3,
    ink: 0.24,
    swell: 0.7,
    birds: 0.1,
    crew: 0.2,
    flicker: 0.8,
    cadence: 8.7,
    gold: 0,
    rainbow: 0,
    build: 0.6,
  };
  const front = {
    storm: 0.2,
    cloud: 0.8,
    rain: 0.05,
    lightning: 0,
    fog: 0,
    sunbreak: 0,
  };
  const brewing = render({
    front,
    time: 12_000_000,
    reducedMotion: false,
    arc,
  });
  const washes = brewing.rects.filter(
    ({ color, operation }) =>
      typeof color === "object" && operation === "source-over",
  );
  assert.ok(washes.length > 0, "no sheet-lightning wash was drawn");
  // A beat later the flicker has faded, and the next one is seconds away.
  const later = render({
    front,
    time: 12_000_400,
    reducedMotion: false,
    arc,
  });
  assert.equal(
    later.rects.filter(
      ({ color, operation }) =>
        typeof color === "object" && operation === "source-over",
    ).length,
    0,
  );
});
