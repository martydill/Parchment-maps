import assert from "node:assert/strict";
import test from "node:test";
import { drawPortActivity } from "../src/port-miniatures.js";
import { PORT_NAMES } from "../src/names.js";

function canvasContext() {
  const fills = [];
  const context = new Proxy(
    {},
    {
      get: (target, property) => target[property] ?? (() => {}),
      set(target, property, value) {
        if (property === "fillStyle") fills.push(value);
        target[property] = value;
        return true;
      },
    },
  );
  return { context, fills };
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
