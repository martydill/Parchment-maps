import assert from "node:assert/strict";
import test from "node:test";
import { coastalExposure, cloudShadowSamples } from "../src/core/sunlight.js";
import { sceneLighting } from "../src/core/lighting.js";

const cove = [
  [0, 0],
  [100, 0],
  [100, 100],
  [70, 100],
  [70, 30],
  [30, 30],
  [30, 100],
  [0, 100],
];
const wall = { a: { x: 70, y: 100 }, b: { x: 70, y: 30 }, nx: -1, ny: 0 };
const westernSun = { shadow: { x: 1, y: 0, length: 4.5 } };

test("headlands occlude low sunlight in coves while open shores catch it", () => {
  const sheltered = coastalExposure(cove, wall, 20, westernSun);
  const exposed = coastalExposure(
    cove,
    { ...wall, a: { x: 0, y: 0 }, b: { x: 0, y: 100 } },
    20,
    westernSun,
  );
  assert.ok(sheltered.shelter > 0.5);
  assert.ok(sheltered.direct < exposed.direct);
  assert.equal(exposed.shelter, 0);
  assert.equal(exposed.direct, 1);
  const highSun = coastalExposure(cove, wall, 20, {
    shadow: { x: 1, y: 0, length: 0.5 },
  });
  assert.equal(highSun.shelter, 0);
  assert.equal(highSun.direct, 1);
  const opposite = coastalExposure(cove, wall, 20, {
    shadow: { x: -1, y: 0, length: 4.5 },
  });
  assert.equal(opposite.direct, 0);
  assert.ok(opposite.shelter > sheltered.shelter);
});

test("coastal exposure is invariant across world copies and handles flat or empty coastlines", () => {
  const base = coastalExposure(cove, wall, 20);
  const moved = coastalExposure(
    cove.map(([x, y]) => [x + 4800, y]),
    {
      ...wall,
      a: { x: wall.a.x + 4800, y: wall.a.y },
      b: { x: wall.b.x + 4800, y: wall.b.y },
    },
    20,
  );
  assert.deepEqual({ ...moved, x: moved.x - 4800 }, base);
  for (const depth of [0, -10]) {
    assert.equal(coastalExposure(cove, wall, depth).shelter, 0);
    assert.equal(coastalExposure(cove, wall, depth).reach, 0);
  }
  assert.equal(coastalExposure([], wall, 20, {}).shelter, 0);
});

test("cloud patches drift smoothly, stay bounded, and fade through occasional clear intervals", () => {
  const options = { world: { w: 4800, h: 3200 } };
  const first = cloudShadowSamples(options);
  assert.deepEqual(first, cloudShadowSamples({ ...options, time: NaN }));
  assert.deepEqual(first, cloudShadowSamples({ ...options, time: -100 }));
  assert.ok(first.some((sample) => sample.alpha === 0));
  assert.ok(first.some((sample) => sample.alpha > 0));
  const later = cloudShadowSamples({ ...options, time: 1000 });
  assert.equal(first.length, later.length);
  assert.ok(later[1].x > first[1].x);
  assert.equal(later[1].y, first[1].y);
  assert.ok(later[0].y < first[0].y);
  assert.ok(later[2].y > first[2].y);
  const cloudy = cloudShadowSamples({ ...options, cloud: 1 });
  const storm = cloudShadowSamples({
    ...options,
    lighting: sceneLighting(0.5, 0.5),
  });
  assert.ok(cloudy[1].alpha > first[1].alpha);
  assert.ok(storm[1].alpha < first[1].alpha);
  for (const time of [0, 35_000, 70_000, 140_000, 1e10]) {
    const samples = cloudShadowSamples({ ...options, time, cloud: 3 });
    assert.ok(samples.length <= 24);
    for (const sample of samples) {
      assert.ok(sample.x >= 0 && sample.x < options.world.w);
      assert.ok(sample.y >= 0 && sample.y < options.world.h);
      assert.ok(sample.alpha >= 0 && sample.alpha <= 0.21);
    }
  }
  const almost = cloudShadowSamples({ ...options, time: 1000.001 });
  assert.ok(Math.abs(almost[1].alpha - later[1].alpha) < 1e-6);
  assert.ok(Math.abs(almost[1].x - later[1].x) < 1e-4);
  assert.equal(cloudShadowSamples({ ...options, detail: 0.5 }).length, 12);
  assert.deepEqual(cloudShadowSamples({ ...options, lighting: {} }), first);
  assert.deepEqual(cloudShadowSamples({ ...options, cloud: NaN }), first);
});

test("cloud shadows disappear at night, with reduced motion, and when detail or world bounds are empty", () => {
  const options = { world: { w: 1000, h: 800 } };
  for (const extra of [
    { lighting: sceneLighting(0) },
    { reducedMotion: true },
    { detail: 0 },
    { detail: -1 },
    { world: { w: 0, h: 800 } },
    { world: { w: 1000, h: 0 } },
  ])
    assert.deepEqual(cloudShadowSamples({ ...options, ...extra }), []);
});
