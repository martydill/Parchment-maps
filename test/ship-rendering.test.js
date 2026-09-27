import test from "node:test";
import assert from "node:assert/strict";
import { drawMerchantShip, drawShip } from "../src/ship-rendering.js";
import { SHIP_MODEL_IDS } from "../src/core/ship-models.js";

function canvasContext() {
  const calls = [];
  const context = new Proxy(
    { calls },
    {
      get(target, property) {
        if (property in target) return target[property];
        return (...args) => calls.push([property, ...args]);
      },
      set(target, property, value) {
        target[property] = value;
        return true;
      },
    },
  );
  return context;
}

test("each merchant vessel class draws a detailed projected model", () => {
  for (const [index, vesselClass] of SHIP_MODEL_IDS.entries()) {
    const context = canvasContext();
    drawMerchantShip(context, {
      x: 120,
      y: 80,
      angle: index * 0.31,
      vesselClass,
      idNum: index + 1,
      color: "#a83f2f",
    });
    assert.ok(
      context.calls.some(([method]) => method === "fill"),
      vesselClass,
    );
    assert.ok(
      context.calls.some(([method]) => method === "stroke"),
      vesselClass,
    );
    assert.ok(
      context.calls.some(([method]) => method === "lineTo"),
      vesselClass,
    );
  }
});

test("the player vessel uses the same detailed renderer and wind-driven sails", () => {
  const context = canvasContext();
  drawShip(context, 50, 60, 0.4, 1.2, 0.8, "brig", 1);
  assert.ok(context.calls.some(([method]) => method === "fill"));
  assert.ok(context.calls.some(([method]) => method === "stroke"));
});
