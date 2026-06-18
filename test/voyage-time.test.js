import assert from "node:assert/strict";
import test from "node:test";

import {
  estimateVoyageDays,
  SAILING_SECONDS_PER_DAY,
} from "../src/core/voyage-time.js";

test("voyage day estimates use the active sailing clock", () => {
  assert.equal(SAILING_SECONDS_PER_DAY, 12);
  assert.equal(estimateVoyageDays(0), 1);
  assert.equal(estimateVoyageDays(621), 1);
  assert.equal(estimateVoyageDays(2500), 3);
});

test("voyage day estimates account for ship speed and route plan effects", () => {
  const balanced = estimateVoyageDays(2500, {
    maxSpeed: 175,
    daysMultiplier: 1,
    speedMultiplier: 1,
  });
  const fast = estimateVoyageDays(2500, {
    maxSpeed: 175,
    daysMultiplier: 0.78,
    speedMultiplier: 1.08,
  });
  const cautious = estimateVoyageDays(2500, {
    maxSpeed: 175,
    daysMultiplier: 1.28,
    speedMultiplier: 0.92,
  });

  assert.equal(balanced, 3);
  assert.ok(fast < balanced);
  assert.ok(cautious > balanced);
  assert.equal(estimateVoyageDays(2500, { maxSpeed: 350 }), 2);
});
