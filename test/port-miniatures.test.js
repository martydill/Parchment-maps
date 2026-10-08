import assert from "node:assert/strict";
import test from "node:test";
import {
  createPortMiniatureCache,
  drawPortActivity,
  drawHarborBoats,
  drawPortMiniature,
  hasPortMiniature,
} from "../src/port-miniatures.js";
import { seasonalAppearance } from "../src/core/seasons.js";
import { PORT_NAMES } from "../src/names.js";

function canvasContext() {
  const fills = [];
  const coordinates = [];
  const context = new Proxy(
    {
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
      seasonalAppearance(1),
    );
    const spring = canvases[0].fills.length;
    cache.draw(
      context,
      PORT_NAMES.velquorin,
      { level: 3 },
      Math.PI,
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
      seasonalAppearance(73),
    );
    assert.ok(
      canvases[0].fills.length > spring,
      "winter refreshes the same plate",
    );
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
      assert.equal(drawPortMiniature(context, name, {}, Math.PI, season), true);
      drawPortActivity(context, name, 14000, 2, 0.3, Math.PI, {}, season);
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
    seasonalAppearance(1),
  );
  drawPortMiniature(
    winter.context,
    PORT_NAMES.orvessaQuay,
    {},
    -0.34,
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
