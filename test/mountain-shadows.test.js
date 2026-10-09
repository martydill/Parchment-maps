import test from "node:test";
import assert from "node:assert/strict";
import {
  mountainShadowBlend,
  mountainShadowSun,
  SHADOW_PHASES,
} from "../src/core/mountain-shadows.js";

test("four sun phases give long opposing dawn and dusk shadows and shorter midday shadows", () => {
  assert.equal(SHADOW_PHASES.length, 4);
  const dawn = mountainShadowSun(SHADOW_PHASES[0]);
  const dusk = mountainShadowSun(SHADOW_PHASES[3]);
  assert.ok(dawn.x < 0 && dusk.x > 0);
  assert.ok(dawn.length > mountainShadowSun(0.5).length);
  assert.ok(dusk.length > mountainShadowSun(0.5).length);
  assert.equal(dawn.y, dusk.y);
});

test("shadow buckets blend continuously through the day, fade at night, and soften in storms", () => {
  for (const time of [0, 0.23, 0.3, 0.4, 0.5, 0.6, 0.77, 0.9, 1]) {
    const samples = mountainShadowBlend(time);
    assert.ok(
      Math.abs(samples.reduce((sum, sample) => sum + sample.alpha, 0) - 1) <
        1e-9,
    );
    assert.ok(
      samples.every(
        (sample) =>
          sample.bucket >= 0 && sample.bucket <= 3 && sample.alpha >= 0,
      ),
    );
  }
  assert.deepEqual(mountainShadowBlend(0.5), [
    { bucket: 1, alpha: 0.5 },
    { bucket: 2, alpha: 0.5 },
  ]);
  assert.ok(
    mountainShadowBlend(0.5, 1, 1).every((sample) => sample.alpha === 0.125),
  );
  assert.ok(mountainShadowBlend(0, 0).every((sample) => sample.alpha === 0));
  assert.deepEqual(mountainShadowBlend(NaN), mountainShadowBlend(0.5));
  assert.deepEqual(mountainShadowBlend(0.5, 2, -1), mountainShadowBlend(0.5));
  for (const phase of [0.4, 0.6]) {
    const before = mountainShadowBlend(phase - 1e-6).find(
      (sample) => sample.bucket === (phase === 0.4 ? 1 : 2),
    ).alpha;
    const after = mountainShadowBlend(phase + 1e-6).find(
      (sample) => sample.bucket === (phase === 0.4 ? 1 : 2),
    ).alpha;
    assert.ok(Math.abs(before - after) < 1e-5);
  }
});
