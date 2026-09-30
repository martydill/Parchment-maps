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
        calls.push([property, value]);
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

test("ship foam uses bounded colors as speed changes and disappears at anchor", () => {
  const palettes = new Map([
    ["35,88,86", new Set()],
    ["255,247,213", new Set()],
    ["255,248,213", new Set()],
    ["255,249,218", new Set()],
  ]);
  for (let sample = 0; sample <= 150; sample++) {
    const context = canvasContext();
    drawMerchantShip(context, {
      x: 120,
      y: 80,
      speed: sample,
      vesselClass: "brig",
      idNum: 1,
    });
    const foam = context.calls.filter(
      ([property, style]) =>
        (property === "fillStyle" || property === "strokeStyle") &&
        [...palettes.keys()].some((rgb) => style.startsWith(`rgba(${rgb},`)),
    );
    if (sample < 3) assert.equal(foam.length, 0);
    else assert.equal(foam.length, 30);
    for (const [, style] of foam) {
      for (const [rgb, colors] of palettes) {
        if (style.startsWith(`rgba(${rgb},`)) colors.add(style);
      }
    }
  }
  for (const colors of palettes.values()) {
    assert.ok(colors.size > 20 && colors.size <= 128);
  }
});

test("the player vessel uses the same detailed renderer and wind-driven sails", () => {
  const context = canvasContext();
  drawShip(context, 50, 60, 0.4, 1.2, 0.8, "brig", 1);
  assert.ok(context.calls.some(([method]) => method === "fill"));
  assert.ok(context.calls.some(([method]) => method === "stroke"));
});

test("swell moves projected geometry without moving the vessel's map origin", () => {
  const first = canvasContext();
  const second = canvasContext();
  const options = { roughness: 1, speed: 100 };
  drawShip(first, 50, 60, 0.4, 1.2, 0.22, "brig", 1, { ...options, time: 1 });
  drawShip(second, 50, 60, 0.4, 1.2, 0.22, "brig", 1, { ...options, time: 2 });
  assert.notDeepEqual(
    first.calls.filter(([method]) => method === "lineTo"),
    second.calls.filter(([method]) => method === "lineTo"),
  );
  assert.deepEqual(
    first.calls.filter(([method]) => method === "translate"),
    second.calls.filter(([method]) => method === "translate"),
  );
  for (const context of [first, second]) {
    assert.equal(
      context.calls.filter(([method]) => method === "save").length,
      context.calls.filter(([method]) => method === "restore").length,
    );
    assert.ok(
      context.calls
        .flat()
        .filter((value) => typeof value === "number")
        .every(Number.isFinite),
    );
  }
});

test("reduced motion keeps projected ships identical across frames", () => {
  const first = canvasContext();
  const second = canvasContext();
  const merchant = {
    x: 10,
    y: 20,
    idNum: 4,
    speed: 40,
    vesselClass: "carrack",
  };
  drawMerchantShip(first, merchant, 1, 1010, {
    time: 1,
    roughness: 1,
    reducedMotion: true,
  });
  drawMerchantShip(second, merchant, 1, 1010, {
    time: 99,
    roughness: 1,
    reducedMotion: true,
  });
  assert.deepEqual(first.calls, second.calls);
});
