import assert from "node:assert/strict";
import test from "node:test";
import { getHarborLayout } from "../src/harbor-layouts.js";
import { harborProfile } from "../src/core/harbors.js";
import { PORT_NAMES } from "../src/names.js";

const plans = Object.values(PORT_NAMES).map((name) => [
  name,
  getHarborLayout(name),
]);

test("every harbor has a complete finite illustration plan and a supported palette", () => {
  for (const [name, plan] of plans) {
    assert.ok(plan, name);
    assert.ok(harborProfile(name), name);
    assert.ok(Number.isFinite(plan.angle));
    assert.ok(plan.scale > 0);
    for (const ground of plan.grounds) {
      assert.ok(ground.outline.length >= 3, name);
      assert.ok(ground.outline.flat().every(Number.isFinite), name);
      assert.ok(Number.isFinite(ground.z), name);
    }
    for (const [u, v, w, d, h, angle] of plan.houses) {
      assert.ok([u, v, w, d, h, angle].every(Number.isFinite), name);
      assert.ok(w > 0 && d > 0 && h > 0, name);
    }
    assert.ok(plan.walk.length >= 2, name);
    assert.ok(plan.walk.flat().every(Number.isFinite), name);
    assert.ok(plan.flag.every(Number.isFinite), name);
    assert.ok(plan.docks.flat().every(Number.isFinite), name);
    assert.equal(plan.expansion.length, 2, name);
    assert.ok(plan.expansion.flat().every(Number.isFinite), name);
  }
  assert.equal(getHarborLayout("Unknown"), null);
});

test("harbors have distinct footprints and orientations even within the same architectural family", () => {
  const footprints = new Set(
    plans.map(([, plan]) => JSON.stringify(plan.grounds)),
  );
  assert.equal(footprints.size, plans.length);
  assert.equal(new Set(plans.map(([, plan]) => plan.angle)).size, plans.length);
  for (const kind of [
    "citadel",
    "foundry",
    "canals",
    "lighthouse",
    "monastery",
  ]) {
    const family = plans.filter(([name]) => harborProfile(name).kind === kind);
    const arrangements = new Set(
      family.map(([, plan]) => JSON.stringify(plan.houses)),
    );
    assert.equal(arrangements.size, family.length, kind);
  }
});

test("small villages, large cities, and individually oriented buildings preserve meaningful scale differences", () => {
  const sizes = plans.map(([, plan]) => plan.scale);
  assert.ok(Math.max(...sizes) / Math.min(...sizes) > 1.45);
  const densities = plans.map(([, plan]) => plan.houses.length);
  assert.ok(Math.min(...densities) <= 3);
  assert.ok(Math.max(...densities) >= 10);
  const houses = plans.flatMap(([, plan]) => plan.houses);
  const widths = houses.map((house) => house[2]);
  const heights = houses.map((house) => house[4]);
  assert.ok(Math.max(...widths) / Math.min(...widths) > 3);
  assert.ok(Math.max(...heights) / Math.min(...heights) > 3);
  for (const [name, plan] of plans) {
    assert.ok(new Set(plan.houses.map((house) => house[5])).size > 1, name);
  }
});
