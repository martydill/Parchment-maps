import test from "node:test";
import assert from "node:assert/strict";
import {
  drawHullReflection,
  drawMerchantShip,
  drawShip,
} from "../src/ship-rendering.js";
import {
  getShipModelProfile,
  SHIP_MODEL_IDS,
} from "../src/core/ship-models.js";
import { MAP_TILT_TAN } from "../src/core/projection.js";
import { sampleWaterReflection } from "../src/core/seascape.js";

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

test("hull reflections mirror model height across the water for every heading", () => {
  for (const vesselClass of SHIP_MODEL_IDS) {
    const profile = getShipModelProfile(vesselClass);
    for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const context = canvasContext();
      drawHullReflection(context, profile, heading, { reducedMotion: true });
      const x = profile.beam * 0.05;
      const y = -profile.length / 2;
      const height = profile.deckHeight + profile.bowRise;
      const expectedX = x * Math.cos(heading) - y * Math.sin(heading);
      const expectedY =
        x * Math.sin(heading) + y * Math.cos(heading) + height * MAP_TILT_TAN;
      assert.ok(
        context.calls.some(
          ([method, px, py]) =>
            (method === "moveTo" || method === "lineTo") &&
            Math.abs(px - expectedX) < 1e-10 &&
            Math.abs(py - expectedY) < 1e-10,
        ),
        `${vesselClass} at ${heading}`,
      );
      assert.ok(
        context.calls
          .flat()
          .filter((value) => typeof value === "number")
          .every(Number.isFinite),
      );
    }
  }
});

test("eight separate reflection slices shift the ink after clipping and fade out", () => {
  const context = canvasContext();
  drawHullReflection(context, getShipModelProfile("brig"), Math.PI / 2, {
    time: 2,
    roughness: 0.5,
    anchored: true,
  });
  const slices = context.calls.filter(([method]) => method === "rect");
  const offsets = context.calls.filter(([method]) => method === "translate");
  assert.equal(slices.length, 8);
  assert.equal(offsets.length, 8);
  assert.equal(context.calls.filter(([method]) => method === "fill").length, 8);
  for (let row = 0; row < 8; row++) {
    assert.deepEqual(offsets[row], [
      "translate",
      sampleWaterReflection(2, row, 0.5).offset,
      0,
    ]);
    assert.ok(slices[row][3] > 0 && slices[row][4] > 0);
    if (row > 0)
      assert.ok(slices[row - 1][2] + slices[row - 1][4] < slices[row][2]);
  }
  const firstClip = context.calls.findIndex(([method]) => method === "clip");
  assert.equal(context.calls[firstClip + 1][0], "translate");
  const opacities = context.calls
    .filter(([property]) => property === "fillStyle")
    .map(([, style]) => Number(style.slice(style.lastIndexOf(",") + 1, -1)));
  assert.ok(opacities.every((alpha) => alpha > 0 && alpha <= 0.34));
  assert.ok(opacities.at(-1) < opacities[0]);
  assert.equal(
    context.calls.filter(([method]) => method === "save").length,
    context.calls.filter(([method]) => method === "restore").length,
  );
});

test("reflected hull motion freezes with reduced motion and responds to rough seas", () => {
  const render = (environment) => {
    const context = canvasContext();
    drawHullReflection(
      context,
      getShipModelProfile("carrack"),
      0.4,
      environment,
    );
    return context.calls;
  };
  assert.notDeepEqual(render({ time: 1 }), render({ time: 2 }));
  assert.notDeepEqual(render({ roughness: 0 }), render({ roughness: 1 }));
  assert.deepEqual(
    render({ time: 1, roughness: 1, reducedMotion: true }),
    render({ time: 99, roughness: 1, reducedMotion: true }),
  );
});
