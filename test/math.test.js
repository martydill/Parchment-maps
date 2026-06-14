import assert from "node:assert/strict";
import test from "node:test";

import {
  clamp,
  nearestWrapped,
  normalizeAngle,
  wrap,
  wrappedDelta,
  wrappedDistance,
} from "../src/core/math.js";

test("clamp restricts values to an inclusive range", () => {
  assert.equal(clamp(-2, 0, 10), 0);
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(12, 0, 10), 10);
});

test("wrap canonicalizes positive and negative coordinates", () => {
  assert.equal(wrap(12, 10), 2);
  assert.equal(wrap(-2, 10), 8);
  assert.equal(wrap(10, 10), 0);
});

test("wrappedDelta takes the shortest direction across a seam", () => {
  assert.equal(wrappedDelta(1, 9, 10), 2);
  assert.equal(wrappedDelta(9, 1, 10), -2);
  assert.equal(wrappedDelta(4, 1, 10), 3);
});

test("nearestWrapped and wrappedDistance use the closest world copy", () => {
  assert.equal(nearestWrapped(1, 9, 10), 11);
  assert.equal(wrappedDistance(1, 0, 9, 0, 10), 2);
  assert.ok(Math.abs(wrappedDistance(1, 3, 9, 0, 10) - Math.sqrt(13)) < 1e-12);
});

test("normalizeAngle produces an equivalent angle in the signed pi range", () => {
  assert.ok(Math.abs(normalizeAngle(Math.PI * 3) - Math.PI) < 1e-12);
  assert.ok(Math.abs(normalizeAngle(-Math.PI * 3) + Math.PI) < 1e-12);
  assert.equal(normalizeAngle(0.5), 0.5);
});
