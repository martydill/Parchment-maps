import test from "node:test";
import assert from "node:assert/strict";
import { drawBowWater } from "../src/bow-water-rendering.js";
import {
  getShipModelProfile,
  SHIP_MODEL_IDS,
} from "../src/core/ship-models.js";
import { sampleShipMotion } from "../src/core/seascape.js";

function render({ vesselClass = "cutter", seed = 0, ...options } = {}) {
  const calls = [];
  const c = new Proxy(
    {},
    {
      get:
        (_, key) =>
        (...args) =>
          calls.push([key, ...args]),
      set: (_, key, value) => {
        calls.push([key, value]);
        return true;
      },
    },
  );
  drawBowWater(
    c,
    getShipModelProfile(vesselClass),
    {
      ...sampleShipMotion({ speed: 100, ...options }),
      time: options.time ?? 0,
      reducedMotion: options.reducedMotion,
    },
    0.6,
    -0.8,
    seed,
  );
  return calls;
}

test("bow foam flows with time, with repeatable phases for each vessel", () => {
  const first = render({ time: 1 });
  assert.deepEqual(render({ time: 1 }), first);
  assert.notDeepEqual(render({ time: 1.2 }), first);
  assert.notDeepEqual(render({ time: 1, seed: 2 }), first);
  // The water plane stays independent of the hull's pitch and heave.
  assert.deepEqual(render({ time: 1, roughness: 1 }), first);
});

test("bow water freezes for reduced motion and disappears at anchor or rest", () => {
  assert.deepEqual(
    render({ reducedMotion: true, time: 1 }),
    render({ reducedMotion: true, time: 99 }),
  );
  assert.deepEqual(render({ anchored: true }), []);
  assert.deepEqual(render({ speed: 0 }), []);
  assert.deepEqual(render({ speed: 2 }), []);
});

test("every hull has bounded water geometry and opacity across sailing speeds", () => {
  for (const vesselClass of SHIP_MODEL_IDS) {
    for (const speed of [3, 30, 150, 1000]) {
      const calls = render({ vesselClass, speed, time: 17.35 });
      assert.ok(calls.length > 0);
      for (const [method, ...args] of calls) {
        for (const value of args.filter((value) => typeof value === "number")) {
          assert.ok(Number.isFinite(value), `${vesselClass}: ${method}`);
        }
        if (method === "ellipse") {
          assert.ok(args[2] > 0 && args[3] > 0);
          assert.ok(args[2] < getShipModelProfile(vesselClass).beam);
        }
        if (method.endsWith("Style")) {
          const alpha = Number(args[0].match(/,([^,]+)\)$/)[1]);
          assert.ok(alpha >= 0 && alpha <= 1);
        }
      }
    }
  }
});
