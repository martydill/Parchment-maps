import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceChartSpray,
  chartSprayAppearance,
  createChartSpray,
  SPRAY_DRY_SECONDS,
  SPRAY_MARK_SECONDS,
} from "../src/core/chart-spray.js";

test("spray is deterministic, bounded, and restricted to all four frame edges", () => {
  const beads = createChartSpray();
  assert.equal(beads.length, 40);
  assert.deepEqual(beads, createChartSpray());
  assert.deepEqual(createChartSpray(0), []);
  for (const bead of beads) {
    assert.ok(bead.x > 0 && bead.x < 1 && bead.y > 0 && bead.y < 1);
    assert.ok(Math.min(bead.x, 1 - bead.x, bead.y, 1 - bead.y) < 0.1);
    assert.equal(chartSprayAppearance(bead.age).mark, 0);
  }
});

test("tempests wet the chart and beads dry into tidemarks after weather clears", () => {
  const beads = createChartSpray(4);
  assert.equal(advanceChartSpray(beads, 1, true), beads);
  assert.ok(beads.every((bead) => bead.age === 0));
  assert.deepEqual(chartSprayAppearance(0), {
    wet: 1,
    mark: 0,
    radiusScale: 1,
  });
  advanceChartSpray(beads, SPRAY_DRY_SECONDS / 2, false);
  assert.equal(chartSprayAppearance(beads[0].age).wet, 0.5);
  assert.ok(chartSprayAppearance(beads[0].age).mark > 0);
  advanceChartSpray(beads, SPRAY_DRY_SECONDS / 2, false);
  assert.equal(chartSprayAppearance(beads[0].age).wet, 0);
  assert.ok(chartSprayAppearance(beads[0].age).mark > 0.8);
  advanceChartSpray(beads, SPRAY_MARK_SECONDS, false);
  assert.equal(beads[0].age, SPRAY_MARK_SECONDS);
  assert.equal(chartSprayAppearance(beads[0].age).mark, 0);
  const original = structuredClone(beads);
  advanceChartSpray(beads, NaN, false);
  advanceChartSpray(beads, -1, false);
  assert.deepEqual(beads, original);
  advanceChartSpray(beads, 1, true);
  assert.ok(beads.every((bead) => bead.age === 0));
});

test("a sustained tempest refreshes a fixed set without spawning unbounded water", () => {
  const beads = createChartSpray(3);
  advanceChartSpray(beads, 0, true);
  assert.equal(beads[0].age, 0);
  assert.equal(beads[1].age, SPRAY_MARK_SECONDS);
  advanceChartSpray(beads, 0.1, true);
  assert.equal(beads[0].age, 0.1);
  advanceChartSpray(beads, 1000, true);
  assert.equal(beads.length, 3);
  assert.ok(beads.every((bead) => bead.age === 0 && bead.next > 0));
});
