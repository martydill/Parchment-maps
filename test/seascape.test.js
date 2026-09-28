import test from "node:test";
import assert from "node:assert/strict";
import { sampleShipMotion, buildWakeRibbon } from "../src/core/seascape.js";

test("ship motion is deterministic, bounded and independent of frame rate", () => {
  assert.deepEqual(sampleShipMotion(), sampleShipMotion({ time: 0 }));
  for (let time = 0; time < 60; time += 0.25) {
    const options = {
      time,
      seed: 4,
      roughness: 1,
      windStrength: 0.22,
      speed: 150,
    };
    const pose = sampleShipMotion(options);
    assert.deepEqual(pose, sampleShipMotion(options));
    assert.ok(Object.values(pose).every(Number.isFinite));
    assert.ok(Math.abs(pose.heave) <= 1.95);
    assert.ok(Math.abs(pose.roll) <= 0.075);
    assert.ok(Math.abs(pose.pitch) <= 0.06);
    assert.ok(pose.billow >= 1.64 && pose.billow <= 2.36);
    assert.equal(pose.wake, 1);
  }
});

test("rough weather increases motion, while an anchored ship has no wake", () => {
  const options = { time: 2, speed: 100, windStrength: 0.1 };
  const calm = sampleShipMotion(options);
  const storm = sampleShipMotion({ ...options, roughness: 1 });
  const anchored = sampleShipMotion({
    ...options,
    roughness: 1,
    anchored: true,
  });
  assert.ok(Math.abs(storm.roll) > Math.abs(calm.roll));
  assert.ok(Math.abs(storm.heave) > Math.abs(calm.heave));
  assert.ok(Math.abs(anchored.heave) < Math.abs(storm.heave));
  assert.equal(anchored.wake, 0);
  assert.notDeepEqual(sampleShipMotion({ ...options, seed: 1 }), calm);
});

test("reduced motion freezes the model and cloth at every time and seed", () => {
  const options = {
    seed: 7,
    roughness: 1,
    windStrength: 0.22,
    speed: 90,
    reducedMotion: true,
  };
  const still = sampleShipMotion(options);
  assert.deepEqual(still, sampleShipMotion({ ...options, time: 99 }));
  for (const key of ["heave", "roll", "pitch", "flutter"])
    assert.equal(Math.abs(still[key]), 0);
  assert.equal(still.billow, 2);
  assert.equal(still.wake, 0.6);
});

test("motion clamps excessive and negative environmental inputs", () => {
  assert.deepEqual(
    sampleShipMotion({ roughness: -2, speed: -100, windStrength: -1 }),
    sampleShipMotion(),
  );
  assert.deepEqual(
    sampleShipMotion({ roughness: 5, speed: 1000, windStrength: 10 }),
    sampleShipMotion({ roughness: 1, speed: 150, windStrength: 0.22 }),
  );
});

test("wake expands and fades, discarding expired and future samples", () => {
  const trail = [
    { x: 15, y: 10, time: 10000 },
    { x: 12, y: 11, time: 9000 },
    { x: 9, y: 12, time: 6000 },
    { x: 6, y: 13, time: 5000 },
    { x: 3, y: 14, time: 11000 },
  ];
  const original = structuredClone(trail);
  const wake = buildWakeRibbon(trail, 10000, 1000);
  assert.equal(wake.length, 3);
  assert.equal(wake[0].width, 2);
  assert.equal(wake[0].alpha, 0.48);
  for (let i = 1; i < wake.length; i++) {
    assert.ok(wake[i].width > wake[i - 1].width);
    assert.ok(wake[i].alpha < wake[i - 1].alpha);
    assert.equal(wake[i].y, trail[i].y);
  }
  assert.deepEqual(trail, original);
  assert.deepEqual(buildWakeRibbon([], 10000, 1000), []);
});

test("wake follows turns through either world seam, including later cycles", () => {
  for (const [coordinates, expected] of [
    [
      [2, 998, 993],
      [2, -2, -7],
    ],
    [
      [998, 2, 7],
      [998, 1002, 1007],
    ],
    [
      [2002, 1998, 1993],
      [2002, 1998, 1993],
    ],
  ]) {
    const trail = coordinates.map((x, i) => ({
      x,
      y: i * 2,
      time: 10000 - i * 100,
    }));
    assert.deepEqual(
      buildWakeRibbon(trail, 10000, 1000).map(({ x }) => x),
      expected,
    );
  }
});
