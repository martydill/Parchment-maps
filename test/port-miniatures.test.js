import assert from "node:assert/strict";
import test from "node:test";
import {
  createPortMiniatureCache,
  drawPortActivity,
  drawPortMiniature,
  hasPortMiniature,
} from "../src/port-miniatures.js";
import { PORT_NAMES } from "../src/names.js";

function canvasContext() {
  const fills = [];
  const coordinates = [];
  const context = new Proxy(
    {
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
    assert.equal(
      canvases.length,
      1,
      "reuse the allocated plate when a skyline changes",
    );
    cache.draw(context, PORT_NAMES.mirelune);
    assert.equal(canvases.length, 2);
  } finally {
    if (oldDocument === undefined) delete globalThis.document;
    else globalThis.document = oldDocument;
  }
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
