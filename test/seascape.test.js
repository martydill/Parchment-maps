import test from "node:test";
import assert from "node:assert/strict";
import {
  sampleShipMotion,
  buildWakeRibbon,
  coastFaceDepth,
  sampleCoastalBird,
  sampleCreatureAppearance,
  coastalFlockSize,
  sampleLighthouse,
  sampleSeaLife,
  sampleShoreAnimal,
  sampleWaterReflection,
} from "../src/core/seascape.js";

test("reflection bands move deterministically and lose coherence in rough water", () => {
  const calm = sampleWaterReflection(2, 3, 0);
  assert.deepEqual(sampleWaterReflection(2, 3, 0), calm);
  assert.notDeepEqual(sampleWaterReflection(3, 3, 0), calm);
  assert.notDeepEqual(sampleWaterReflection(2, 4, 0), calm);
  const rough = sampleWaterReflection(2, 3, 1);
  assert.ok(Math.abs(rough.offset) > Math.abs(calm.offset));
  assert.ok(rough.alpha < calm.alpha);
  for (let index = -5; index < 30; index++) {
    for (const sea of [0, 0.5, 1]) {
      const ripple = sampleWaterReflection(index * 0.73, index, sea);
      assert.ok(ripple.width >= 0.55 && ripple.width <= 0.95);
      assert.ok(ripple.alpha > 0 && ripple.alpha <= 1);
      assert.ok(Math.abs(ripple.offset) <= 5);
    }
  }
});

test("reflection samples normalize invalid values and out-of-range weather", () => {
  const still = sampleWaterReflection();
  assert.deepEqual(sampleWaterReflection(NaN, Infinity, NaN), still);
  assert.deepEqual(sampleWaterReflection(0, 0, -10), still);
  assert.deepEqual(
    sampleWaterReflection(0, 0, 10),
    sampleWaterReflection(0, 0, 1),
  );
});

test("coast faces vary by island and keep small satellites low", () => {
  assert.deepEqual(
    Array.from({ length: 6 }, (_, index) => coastFaceDepth(index)),
    [31, 36, 41, 46, 51, 56],
  );
  assert.equal(coastFaceDepth(6), coastFaceDepth(0));
  assert.equal(coastFaceDepth(3, true), 22);
  assert.ok(coastFaceDepth(3, true) < coastFaceDepth(3));
});

test("coastal birds vary in number and formation while circling", () => {
  const still = sampleCoastalBird(0, 2, 0);
  assert.deepEqual(sampleCoastalBird(0, 2, 0), still);
  assert.notDeepEqual(sampleCoastalBird(1, 2, 0), still);
  assert.ok(
    new Set(Array.from({ length: 12 }, (_, index) => coastalFlockSize(index)))
      .size >= 4,
  );
  assert.ok(coastalFlockSize(0) < coastalFlockSize(7));
  for (let time = -30; time <= 30; time += 0.5) {
    for (let flock = 0; flock < 4; flock++) {
      for (let bird = 0; bird < coastalFlockSize(flock); bird++) {
        const pose = sampleCoastalBird(time, flock, bird);
        assert.ok(Object.values(pose).every(Number.isFinite));
        assert.ok(Math.abs(pose.x) <= 85);
        assert.ok(Math.abs(pose.y) <= 32);
        assert.ok(Math.abs(pose.wing) <= 1);
        assert.ok(pose.size >= 6.6 && pose.size <= 8);
      }
    }
  }
  assert.notDeepEqual(sampleCoastalBird(0, 0, 2), sampleCoastalBird(0, 1, 2));
});

test("beacons have stable individual sweep speeds and ranges", () => {
  const first = sampleLighthouse(0, 0);
  assert.deepEqual(sampleLighthouse(0, 0), first);
  assert.notEqual(sampleLighthouse(0, 1).reach, first.reach);
  assert.notEqual(
    sampleLighthouse(1000, 1).angle - sampleLighthouse(0, 1).angle,
    sampleLighthouse(1000, 0).angle - first.angle,
  );
});

test("sea life and shore animals move deterministically within their locations", () => {
  assert.equal(sampleSeaLife(0, 0).visible, true);
  assert.equal(sampleSeaLife(15, 0).visible, false);
  assert.equal(sampleSeaLife(15, 0).opacity, 0);
  assert.equal(sampleSeaLife(22, 0).visible, sampleSeaLife(0, 0).visible);
  assert.ok(sampleSeaLife(0.5, 0).opacity > 0);
  assert.ok(sampleSeaLife(10.5, 0).opacity > 0);
  for (let index = 0; index < 8; index++) {
    for (let time = -30; time < 30; time += 0.5) {
      const sea = sampleSeaLife(time, index);
      const shore = sampleShoreAnimal(time, index);
      assert.ok(Math.abs(sea.x) <= 34 && Math.abs(sea.y) <= 12);
      assert.ok(sea.opacity >= 0 && sea.opacity <= 1);
      assert.ok(Math.abs(shore.x) <= 15 && Math.abs(shore.y) <= 4);
      assert.ok([-1, 1].includes(shore.facing));
      assert.ok(Math.abs(shore.step) <= 1);
    }
  }
});

test("creatures surface briefly on a repeatable staggered cycle", () => {
  const first = sampleCreatureAppearance(0, 0);
  assert.ok(first.rise > 0 && first.rise <= 1);
  assert.deepEqual(sampleCreatureAppearance(18000, 0), first);
  assert.deepEqual(sampleCreatureAppearance(-18000, 0), first);
  assert.equal(sampleCreatureAppearance(4000, 0).rise, 0);
  assert.notEqual(sampleCreatureAppearance(0, 1).phase, first.phase);
  for (let time = -18000; time <= 18000; time += 250)
    assert.ok(sampleCreatureAppearance(time, 2).rise >= 0);
});

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

test("wake width and foam strength follow vessel speed with safe defaults", () => {
  const trail = [
    { x: 10, y: 0, time: 10000, strength: 1 },
    { x: 8, y: 0, time: 9000, strength: 0.5 },
    { x: 6, y: 0, time: 8000, strength: -1 },
    { x: 4, y: 0, time: 7000, strength: 2 },
    { x: 2, y: 0, time: 6000, strength: Number.NaN },
  ];
  const sections = buildWakeRibbon(trail, 10000, 100);
  assert.equal(sections[0].width, 2);
  assert.deepEqual(
    sections.map(({ seed }) => seed),
    [10, 9, 8, 7, 6],
  );
  assert.ok(sections[1].width < (2 + 5.5) * 1);
  assert.ok(sections[1].alpha < 0.48);
  assert.equal(sections[2].alpha, 0);
  assert.equal(sections[3].width, 2 + 3 * 5.5);
  assert.equal(sections[4].width, 2 + 4 * 5.5);
  assert.ok(sections.every(({ width, alpha }) => width > 0 && alpha >= 0));
});
