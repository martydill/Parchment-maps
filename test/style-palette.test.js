import assert from "node:assert/strict";
import test from "node:test";
import { createAlphaPalette } from "../src/style-palette.js";

test("alpha palettes include endpoints and clamp out-of-range opacity", () => {
  const style = createAlphaPalette("37,81,78", 0.035, 0.1);
  assert.equal(style(0.035), "rgba(37,81,78,0.035)");
  assert.equal(style(0.1), "rgba(37,81,78,0.1)");
  assert.equal(style(-1), style(0.035));
  assert.equal(style(2), style(0.1));
  assert.equal(style(-Infinity), style(0.035));
  assert.equal(style(Infinity), style(0.1));
});

test("thousands of opacity samples use only the precomputed palette", () => {
  for (const buckets of [20, 128]) {
    const style = createAlphaPalette("247,237,197", 0, 0.35, buckets);
    const colors = new Set();
    for (let sample = 0; sample <= 10000; sample++) {
      const alpha = (sample / 10000) * 0.35;
      const color = style(alpha);
      const quantizedAlpha = Number(
        color.slice(color.lastIndexOf(",") + 1, -1),
      );
      colors.add(color);
      assert.ok(
        Math.abs(alpha - quantizedAlpha) <= 0.35 / (2 * (buckets - 1)) + 1e-15,
      );
      assert.equal(style(quantizedAlpha), color);
    }
    assert.equal(colors.size, buckets);
  }
});

test("nearest-bucket lookup rounds at opacity midpoints", () => {
  const style = createAlphaPalette("1,2,3", 0, 1, 3);
  assert.equal(style(0.249), "rgba(1,2,3,0)");
  assert.equal(style(0.25), "rgba(1,2,3,0.5)");
  assert.equal(style(0.749), "rgba(1,2,3,0.5)");
  assert.equal(style(0.75), "rgba(1,2,3,1)");
});
