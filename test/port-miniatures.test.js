import assert from "node:assert/strict";
import test from "node:test";
import {
  createPortMiniatureCache,
  drawPortActivity,
  drawHarborBoats,
  drawDocksideFishingBoats,
  drawPortMiniature,
  drawPortScene,
  hasPortMiniature,
} from "../src/port-miniatures.js";
import { seasonalAppearance } from "../src/core/seasons.js";
import { sceneLighting } from "../src/core/lighting.js";
import { portArrivalFrame } from "../src/core/port-scene.js";
import { PORT_NAMES } from "../src/names.js";

function canvasContext() {
  const fills = [];
  const coordinates = [];
  const context = new Proxy(
    {
      createLinearGradient() {
        return { addColorStop() {} };
      },
      globalAlpha: 1,
      quadraticCurveTo(...values) {
        coordinates.push(values);
      },
      bezierCurveTo(...values) {
        coordinates.push(values);
      },
      ellipse(...values) {
        coordinates.push(values);
      },
      createRadialGradient() {
        return { addColorStop() {} };
      },
      moveTo(...values) {
        coordinates.push(values);
      },
      lineTo(...values) {
        coordinates.push(values);
      },
      arc(...values) {
        coordinates.push(values);
      },
      fillRect(...values) {
        coordinates.push(values);
      },
    },
    {
      get: (target, property) => target[property] ?? (() => {}),
      set(target, property, value) {
        if (property === "fillStyle") fills.push(value);
        target[property] = value;
        return true;
      },
    },
  );
  return { context, fills, coordinates };
}

test("foundry glow, sparks, and smoke use bounded palettes while animating", () => {
  const palettes = new Map([
    ["249,148,68", new Set()],
    ["255,183,86", new Set()],
    ["79,73,65", new Set()],
  ]);
  for (let frame = 0; frame < 150; frame++) {
    const { context, fills } = canvasContext();
    drawPortActivity(context, PORT_NAMES.drazhOvek, frame * 217, 1.5);
    for (const [rgb, colors] of palettes) {
      const matching = fills.filter((style) =>
        style.startsWith(`rgba(${rgb},`),
      );
      assert.equal(
        matching.length,
        rgb === "249,148,68" ? 1 : rgb === "255,183,86" ? 5 : 6,
      );
      matching.forEach((style) => colors.add(style));
    }
  }
  for (const colors of palettes.values())
    assert.ok(colors.size > 20 && colors.size <= 128);
});

test("port activity skips unknown ports and distant miniatures", () => {
  const { context, fills } = canvasContext();
  drawPortActivity(context, "Unknown", 1000, 2);
  drawPortActivity(context, PORT_NAMES.drazhOvek, 1000, 1);
  assert.deepEqual(fills, []);
});

test("all harbor silhouettes and live activity render with finite coordinates", () => {
  for (const name of Object.values(PORT_NAMES)) {
    for (const heading of [-Math.PI, -0.34, Math.PI / 2]) {
      const { context, fills, coordinates } = canvasContext();
      assert.equal(hasPortMiniature(name), true);
      assert.equal(
        drawPortMiniature(
          context,
          name,
          { level: 3, foundries: true },
          heading,
        ),
        true,
      );
      drawPortActivity(context, name, 14000, 2, 0.3, heading, { level: 3 });
      assert.ok(fills.length > 40);
      assert.ok(coordinates.flat().every(Number.isFinite), name);
    }
  }
  assert.equal(drawPortMiniature(canvasContext().context, "Unknown"), false);
});

test("harbor architecture plates reuse artwork and refresh when development or heading changes", () => {
  const oldDocument = globalThis.document;
  const canvases = [];
  globalThis.document = {
    createElement() {
      const recording = canvasContext();
      const canvas = { ...recording, getContext: () => recording.context };
      canvases.push(canvas);
      return canvas;
    },
  };
  try {
    const cache = createPortMiniatureCache();
    const { context } = canvasContext();
    assert.equal(cache.draw(context, "Unknown"), false);
    assert.equal(canvases.length, 0);
    cache.draw(context, PORT_NAMES.velquorin, { level: 0 });
    const first = canvases[0].fills.length;
    cache.draw(context, PORT_NAMES.velquorin, { level: 0 });
    assert.equal(canvases[0].fills.length, first);
    cache.draw(context, PORT_NAMES.velquorin, { level: 3 });
    const developed = canvases[0].fills.length;
    assert.ok(developed - first > first);
    cache.draw(context, PORT_NAMES.velquorin, { level: 3 }, Math.PI);
    assert.ok(canvases[0].fills.length > developed);
    const beforeNight = canvases[0].fills.length;
    cache.draw(
      context,
      PORT_NAMES.velquorin,
      { level: 3 },
      Math.PI,
      sceneLighting(0),
    );
    assert.ok(canvases[0].fills.length > beforeNight);
    assert.ok(canvases[0].fills.includes("rgba(12,24,48,0.48)"));
    const nightFills = canvases[0].fills.length;
    cache.draw(
      context,
      PORT_NAMES.velquorin,
      { level: 3 },
      Math.PI,
      sceneLighting(0.001),
    );
    assert.equal(canvases[0].fills.length, nightFills);
    assert.equal(
      canvases.length,
      1,
      "reuse the allocated plate when a skyline changes",
    );
    cache.draw(context, PORT_NAMES.mirelune);
    assert.equal(canvases.length, 2);
    cache.draw(
      context,
      PORT_NAMES.velquorin,
      { level: 3 },
      Math.PI,
      undefined,
      seasonalAppearance(1),
    );
    const spring = canvases[0].fills.length;
    cache.draw(
      context,
      PORT_NAMES.velquorin,
      { level: 3 },
      Math.PI,
      undefined,
      seasonalAppearance(2),
    );
    assert.equal(
      canvases[0].fills.length,
      spring,
      "reuse artwork within a season",
    );
    cache.draw(
      context,
      PORT_NAMES.velquorin,
      { level: 3 },
      Math.PI,
      undefined,
      seasonalAppearance(73),
    );
    assert.ok(
      canvases[0].fills.length > spring,
      "winter refreshes the same plate",
    );
    const winterDay = canvases[0].fills.length;
    cache.draw(
      context,
      PORT_NAMES.velquorin,
      { level: 3 },
      Math.PI,
      sceneLighting(0),
      seasonalAppearance(73),
    );
    assert.ok(canvases[0].fills.length > winterDay);
    assert.ok(canvases[0].fills.includes("rgba(12,24,48,0.48)"));
    const winterNight = canvases[0].fills.length;
    cache.draw(
      context,
      PORT_NAMES.velquorin,
      { level: 3 },
      Math.PI,
      sceneLighting(0),
      seasonalAppearance(74),
    );
    assert.equal(canvases[0].fills.length, winterNight);
    assert.equal(canvases.length, 2);
  } finally {
    if (oldDocument === undefined) delete globalThis.document;
    else globalThis.document = oldDocument;
  }
});

test("seasonal harbor skylines and drifting foliage render in every climate and orientation", () => {
  for (const name of Object.values(PORT_NAMES)) {
    for (const [day, biome] of [
      [1, "temperate"],
      [25, "tropical"],
      [49, "temperate"],
      [73, "alpine"],
    ]) {
      const { context, fills, coordinates } = canvasContext();
      const season = seasonalAppearance(day, biome);
      assert.equal(
        drawPortMiniature(context, name, {}, Math.PI, undefined, season),
        true,
      );
      drawPortActivity(
        context,
        name,
        14000,
        2,
        0.3,
        Math.PI,
        {},
        undefined,
        season,
      );
      assert.ok(fills.length > 40);
      assert.ok(coordinates.flat().every(Number.isFinite), name);
    }
  }
  const spring = canvasContext();
  const winter = canvasContext();
  drawPortMiniature(
    spring.context,
    PORT_NAMES.orvessaQuay,
    {},
    -0.34,
    undefined,
    seasonalAppearance(1),
  );
  drawPortMiniature(
    winter.context,
    PORT_NAMES.orvessaQuay,
    {},
    -0.34,
    undefined,
    seasonalAppearance(73),
  );
  assert.notDeepEqual(spring.fills, winter.fills);
  assert.ok(
    winter.coordinates.length > spring.coordinates.length,
    "snow ridges follow the roof geometry",
  );
});

test("fishing fleets grow for the autumn run and shelter in winter without moving their harbor anchors", () => {
  const counts = [];
  for (const day of [73, 25, 49]) {
    const { context, coordinates } = canvasContext();
    drawHarborBoats(
      context,
      PORT_NAMES.eoswatch,
      14000,
      2,
      0.3,
      0,
      1,
      Math.PI,
      {},
      undefined,
      seasonalAppearance(day),
    );
    assert.ok(coordinates.flat().every(Number.isFinite));
    counts.push(coordinates.length);
  }
  assert.ok(counts[0] < counts[1] && counts[1] < counts[2]);
  const { context, fills } = canvasContext();
  drawHarborBoats(context, "Unknown", 0, 2, 0, 0, 1);
  drawHarborBoats(context, PORT_NAMES.eoswatch, 0, 1, 0, 0, 1);
  assert.deepEqual(fills, []);
});

test("port scenes pass inherited lighting to architecture and ship with finite depth transforms", () => {
  const light = sceneLighting(0);
  const translations = [];
  const { context, coordinates, fills } = canvasContext();
  context.translate = (...values) => translations.push(values);
  const plates = [];
  const ships = [];
  const options = {
    width: 1440,
    height: 760,
    name: PORT_NAMES.orvessaQuay,
    time: 1500,
    lighting: light,
    season: seasonalAppearance(73),
    pointer: { x: 1, y: -1 },
    architecture: {
      draw(...args) {
        plates.push(args);
      },
    },
    ship: portArrivalFrame(1500).ship,
    drawPlayerShip(...args) {
      ships.push(args);
    },
  };
  assert.equal(drawPortScene(context, options), true);
  assert.equal(plates[0][4], light);
  assert.equal(plates[0][5], options.season);
  assert.equal(ships[0][2], light);
  assert.equal(ships[0][3], 1500);
  assert.ok(ships[0][1].x > 0);
  assert.ok(
    translations.some(
      ([x, y]) => Math.abs(x - 7.2) < 1e-9 && Math.abs(y + 4.2) < 1e-9,
    ),
  );
  assert.ok(translations.some(([x, y]) => x === 24 && y === -14));
  assert.ok(coordinates.flat().every(Number.isFinite));
  assert.ok(fills.includes("#ffd08b"));
  translations.length = 0;
  drawPortScene(context, { ...options, reducedMotion: true });
  assert.equal(ships[1][3], 0);
  assert.ok(translations[0].every((value) => value === 0));
  assert.equal(drawPortScene(context, { ...options, name: "Unknown" }), false);
  drawPortScene(context, {
    ...options,
    ship: undefined,
    lighting: sceneLighting(0.5),
  });
  assert.equal(ships.length, 2);
});

test("miniature light resets between menu and default chart rendering", () => {
  const day = canvasContext();
  const night = canvasContext();
  const restored = canvasContext();
  drawPortMiniature(day.context, PORT_NAMES.orvessaQuay);
  drawPortMiniature(
    night.context,
    PORT_NAMES.orvessaQuay,
    {},
    undefined,
    sceneLighting(0),
  );
  drawPortMiniature(restored.context, PORT_NAMES.orvessaQuay);
  assert.notDeepEqual(day.fills, night.fills);
  assert.deepEqual(
    day.fills.filter((fill) => typeof fill === "string"),
    restored.fills.filter((fill) => typeof fill === "string"),
  );
});

test("each named harbor keeps deterministic, distinct architectural geometry", () => {
  const signatures = new Set();
  for (const name of Object.values(PORT_NAMES)) {
    const first = canvasContext();
    const second = canvasContext();
    drawPortMiniature(first.context, name);
    // Drawing another town between frames must not leak its projection or seed.
    drawPortMiniature(
      canvasContext().context,
      PORT_NAMES.mirravel,
      {},
      Math.PI,
    );
    drawPortMiniature(second.context, name);
    assert.deepEqual(second.coordinates, first.coordinates, name);
    assert.deepEqual(
      second.fills.filter((fill) => typeof fill === "string"),
      first.fills.filter((fill) => typeof fill === "string"),
      name,
    );
    signatures.add(JSON.stringify(first.coordinates));
  }
  assert.equal(signatures.size, Object.values(PORT_NAMES).length);
});

test("inspection artwork can use a sharper plate without enlarging its chart footprint", () => {
  const oldDocument = globalThis.document;
  const canvases = [];
  const images = [];
  globalThis.document = {
    createElement() {
      const canvas = { getContext: () => canvasContext().context };
      canvases.push(canvas);
      return canvas;
    },
  };
  try {
    const context = { drawImage: (...args) => images.push(args.slice(1)) };
    createPortMiniatureCache().draw(context, PORT_NAMES.orvessaQuay);
    createPortMiniatureCache(4).draw(context, PORT_NAMES.orvessaQuay);
    assert.equal(canvases[1].width, canvases[0].width * 2);
    assert.equal(canvases[1].height, canvases[0].height * 2);
    assert.deepEqual(images[0], images[1]);
  } finally {
    if (oldDocument === undefined) delete globalThis.document;
    else globalThis.document = oldDocument;
  }
});

test("all harbor compositions fit banner and mobile surfaces with balanced drawing state", () => {
  for (const name of Object.values(PORT_NAMES)) {
    for (const [width, height] of [
      [1440, 320],
      [390, 240],
    ]) {
      const { context, coordinates } = canvasContext();
      let depth = 0;
      context.save = () => depth++;
      context.restore = () => {
        depth--;
        assert.ok(depth >= 0);
      };
      drawPortScene(context, {
        width,
        height,
        name,
        time: 14000,
        lighting: sceneLighting(0),
        architecture: { draw: drawPortMiniature },
        evolution: { level: 3 },
      });
      assert.equal(depth, 0, name);
      assert.ok(coordinates.flat().every(Number.isFinite), name);
    }
  }
});

test("reduced motion freezes each harbor's focal activity, reflections, and boats", () => {
  for (const name of Object.values(PORT_NAMES)) {
    const draw = (time, reducedMotion) => {
      const recording = canvasContext();
      drawPortScene(recording.context, {
        width: 720,
        height: 380,
        name,
        time,
        reducedMotion,
        lighting: sceneLighting(0),
        architecture: { draw() {} },
      });
      return recording.coordinates;
    };
    assert.deepEqual(draw(2000, true), draw(19000, true), name);
    assert.notDeepEqual(draw(2000, false), draw(19000, false), name);
  }
});

test("painting boat limits bound busy fleets without changing the chart population", () => {
  const render = (limit) => {
    const { context, coordinates } = canvasContext();
    drawHarborBoats(
      context,
      PORT_NAMES.eoswatch,
      14000,
      2,
      0,
      0,
      1,
      undefined,
      { level: 3 },
      undefined,
      seasonalAppearance(49),
      limit,
    );
    return coordinates.length;
  };
  assert.equal(render(0), 0);
  assert.equal(render(2), render(1) * 2);
  assert.ok(render(undefined) > render(2));
});

test("dockside fishing stations use each port's pier and skip other harbor activities", () => {
  const positions = new Set();
  for (const name of [
    PORT_NAMES.mirravel,
    PORT_NAMES.eoswatch,
    PORT_NAMES.ossuwhale,
  ]) {
    const { context, coordinates } = canvasContext();
    drawDocksideFishingBoats(context, name, 14000);
    assert.ok(coordinates.length > 0);
    assert.ok(coordinates.flat().every(Number.isFinite));
    positions.add(JSON.stringify(coordinates));
  }
  assert.equal(positions.size, 3);
  const { context, coordinates } = canvasContext();
  drawDocksideFishingBoats(context, "Unknown", 14000);
  drawDocksideFishingBoats(context, PORT_NAMES.heliovar, 14000);
  assert.deepEqual(coordinates, []);
});
