import test from "node:test";
import assert from "node:assert/strict";
import {
  planSeaIce,
  seaIceAtPosition,
  seaIceFloe,
  seaIceStrength,
  seaIceSpeed,
  seaIceCoastClear,
} from "../src/core/sea-ice.js";
import { hazardAhead } from "../src/core/maritime-hazards.js";

test("sea ice freezes in the coldest weeks and thaws at the year boundary", () => {
  assert.equal(seaIceStrength(1), 0);
  assert.equal(seaIceStrength(73), 0);
  assert.equal(seaIceStrength(75, "alpine"), 0.2);
  assert.equal(seaIceStrength(83, "alpine"), 1);
  assert.equal(seaIceStrength(83), 0.8);
  assert.equal(seaIceStrength(83, "marsh"), 0.65);
  assert.ok(seaIceStrength(93, "alpine") < seaIceStrength(83, "alpine"));
  assert.equal(seaIceStrength(96), 0);
  assert.equal(seaIceStrength(97), 0);
  assert.equal(seaIceStrength(179), seaIceStrength(83));
  for (const biome of ["tropical", "arid", "volcanic"])
    assert.equal(seaIceStrength(83, biome), 0);
});

test("floe fields are deterministic and omit warm waters, land, coast buffers, and berths", () => {
  const options = {
    world: { w: 600, h: 300 },
    isOnLand: () => false,
    biomeAt: () => "alpine",
  };
  const plan = planSeaIce(options);
  assert.ok(plan.length > 0 && plan.length <= 3);
  assert.deepEqual(planSeaIce(options), plan);
  assert.deepEqual(planSeaIce({ ...options, biomeAt: () => "tropical" }), []);
  assert.deepEqual(planSeaIce({ ...options, isOnLand: () => true }), []);
  const buffered = planSeaIce({
    ...options,
    isOnLand: (x, y) => x > plan[0].x + 60 && Math.abs(y - plan[0].y) < 5,
  });
  assert.ok(!buffered.some((floe) => floe.seed === plan[0].seed));
  const berths = planSeaIce({ ...options, ports: [plan[0]] });
  assert.ok(!berths.some((floe) => floe.seed === plan[0].seed));
  assert.deepEqual(planSeaIce({ ...options, world: { w: 600, h: 0 } }), []);
});

test("deep winter leaves broad open water with sparse patches of smaller floes", () => {
  const options = {
    world: { w: 4800, h: 3200 },
    isOnLand: () => false,
    biomeAt: () => "alpine",
  };
  const plan = planSeaIce(options);
  assert.ok(plan.length > 12, "winter still has occasional ice hazards");
  assert.ok(
    plan.length < 80,
    "at least 85% fewer floes than the previous cold-water grid",
  );
  assert.ok(plan.every((floe) => floe.radius <= 22));
  const groups = new Map();
  for (const floe of plan) {
    const id = Math.floor(floe.seed / 3);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(floe);
  }
  assert.ok([...groups.values()].every((group) => group.length <= 3));
  assert.ok(
    planSeaIce({ ...options, biomeAt: () => "temperate" }).length < plan.length,
  );
  assert.deepEqual(
    planSeaIce({ ...options, world: { w: 600, h: 100 } }),
    [],
    "no floes drift through polar margins",
  );
});

test("visual floes and slow hazards share bounded drift and wrapped longitude", () => {
  const floe = { x: 995, y: 100, radius: 30, biome: "alpine", seed: 1 };
  const sample = seaIceFloe(floe, 83, 1000, 1000);
  assert.ok(sample.x < 20);
  assert.ok(Math.abs(sample.y - floe.y) <= 12);
  assert.equal(sample.radius, 30);
  assert.notEqual(seaIceFloe(floe, 83, 20000, 1000).x, sample.x);
  const hit = seaIceAtPosition(sample, [floe], 83, 1000, 1000);
  assert.equal(hit.exposure, 1);
  assert.ok(Math.abs(hit.speedMultiplier - 0.28) < 1e-9);
  assert.deepEqual(
    seaIceAtPosition({ ...sample, x: sample.x + 1000 }, [floe], 83, 1000, 1000),
    hit,
  );
  assert.deepEqual(seaIceAtPosition(sample, [floe], 1, 1000, 1000), {
    exposure: 0,
    speedMultiplier: 1,
  });
  assert.equal(
    seaIceAtPosition(sample, [{ ...floe, biome: "tropical" }], 83, 1000, 1000)
      .exposure,
    0,
  );
  assert.equal(
    seaIceAtPosition({ x: 400, y: 100 }, [floe], 83, 1000, 1000)
      .speedMultiplier,
    1,
  );
  assert.equal(
    seaIceAtPosition(
      { x: sample.x + 20, y: sample.y },
      [floe, floe],
      83,
      1000,
      1000,
    ).exposure,
    0.5,
  );
});

test("lookouts warn of ice on the current heading and ice disappears after thaw", () => {
  const floes = [{ x: 990, y: 100, radius: 30, biome: "alpine", seed: 0 }];
  const options = {
    position: { x: 880, y: 112 },
    heading: 0,
    distance: 200,
    worldWidth: 1000,
    shoals: [],
    roughSeas: [],
  };
  const iceAt = (point) => seaIceAtPosition(point, floes, 83, 0, 1000);
  const warning = hazardAhead({ ...options, iceAt });
  assert.equal(warning.type, "ice");
  assert.ok(warning.distance > 0);
  assert.equal(hazardAhead({ ...options, heading: Math.PI, iceAt }), null);
  assert.equal(
    hazardAhead({
      ...options,
      iceAt: (point) => seaIceAtPosition(point, floes, 97, 0, 1000),
    }),
    null,
  );
});

test("ice drag is independent of frame rate, limits speed, and leaves open-water sailing unchanged", () => {
  const clear = { exposure: 0, speedMultiplier: 1 };
  const ice = { exposure: 1, speedMultiplier: 0.28 };
  assert.equal(seaIceSpeed(90, 175, clear, 0.05), 90);
  assert.equal(seaIceSpeed(200, 175, clear, 0.05), 175);
  assert.ok(seaIceSpeed(150, 175, ice, 0.05) <= 49.000001);
  assert.ok(seaIceSpeed(30, 175, ice, 0.05) < 30);
  assert.equal(seaIceSpeed(30, 175, ice, -1), 30);
  assert.equal(seaIceSpeed(-1, 175, ice, 0.05), 0);
  const once = seaIceSpeed(30, 175, ice, 0.1);
  const twice = seaIceSpeed(seaIceSpeed(30, 175, ice, 0.05), 175, ice, 0.05);
  assert.ok(Math.abs(once - twice) < 1e-9);
});

test("the entire drifting footprint clears narrow coasts and small islands across the world seam", () => {
  const coast = [
    [990, 50],
    [1010, 50],
    [1010, 150],
    [990, 150],
    [990, 150],
  ];
  assert.equal(seaIceCoastClear(30, 100, [coast], 1000), false);
  assert.equal(seaIceCoastClear(955, 30, [coast], 1000), false);
  assert.equal(seaIceCoastClear(100, 100, [coast], 1000), true);
  assert.equal(seaIceCoastClear(925, 100, [coast], 1000), true);
  assert.equal(seaIceCoastClear(500, 100, [], 1000), true);
  assert.equal(seaIceCoastClear(990, 160, [[[990, 150]]], 1000), false);
  const options = {
    world: { w: 600, h: 300 },
    isOnLand: () => false,
    biomeAt: () => "alpine",
  };
  const sample = planSeaIce(options)[0];
  const tinyIsland = [
    [sample.x + 20, sample.y],
    [sample.x + 25, sample.y],
    [sample.x + 25, sample.y + 5],
  ];
  assert.ok(
    !planSeaIce({ ...options, coastlines: [tinyIsland] }).some(
      (floe) => floe.seed === sample.seed,
    ),
  );
});
