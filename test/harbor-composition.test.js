import assert from "node:assert/strict";
import test from "node:test";
import {
  harborFocalWalk,
  harborSkyline,
} from "../src/core/harbor-composition.js";
import { getHarborLayout } from "../src/harbor-layouts.js";
import { PORT_NAMES } from "../src/names.js";

test("every port has a unique skyline and an authored signature landmark", () => {
  const skylines = new Set();
  const titles = new Set();
  for (const name of Object.values(PORT_NAMES)) {
    const layout = getHarborLayout(name);
    const skyline = harborSkyline(layout);
    assert.deepEqual(harborSkyline(layout), skyline, name);
    assert.equal(
      skyline.length,
      layout.houses.length + layout.landmarks.length,
    );
    const signatures = skyline.filter((building) => building.signature);
    assert.equal(signatures.length, 1, name);
    assert.equal(
      signatures[0].type,
      layout.landmarks[layout.composition.signature].type,
    );
    for (const building of skyline) {
      assert.ok(building.x > 0 && building.x < 1, name);
      assert.ok(building.width > 0 && building.width < 1, name);
      assert.ok(building.height > 0 && building.height < 0.4, name);
    }
    skylines.add(JSON.stringify(skyline));
    titles.add(layout.composition.title);
  }
  assert.equal(skylines.size, Object.values(PORT_NAMES).length);
  assert.equal(titles.size, Object.values(PORT_NAMES).length);
  assert.deepEqual(harborSkyline(null), []);
});

test("activity stays on the promenade section nearest its authored focal point", () => {
  for (const name of Object.values(PORT_NAMES)) {
    const layout = getHarborLayout(name);
    const { focus, site } = layout.composition;
    const [u, v] =
      focus === "awning"
        ? layout.awnings[site]
        : focus === "crane"
          ? layout.cranes[site]
          : layout.docks[site];
    const walk = harborFocalWalk(layout);
    assert.equal(walk.length, 2);
    assert.ok(walk.flat().every(Number.isFinite));
    const distance = ([first, second]) =>
      Math.hypot(
        (first[0] + second[0]) / 2 - u,
        (first[1] + second[1]) / 2 - v,
      );
    for (let index = 0; index < layout.walk.length - 1; index++)
      assert.ok(
        distance(walk) <= distance(layout.walk.slice(index, index + 2)),
        name,
      );
    if (focus === "crane") assert.ok(layout.cranes.length > 0, name);
    assert.equal(layout.lanterns.length, 2);
    assert.ok(layout.lanterns.flat().every(Number.isFinite));
  }
});

test("two-point promenades and equal distances choose a stable first section", () => {
  const layout = {
    composition: { focus: "lantern", site: 0 },
    docks: [[0, 0]],
    walk: [
      [-10, 0, 5],
      [0, 0, 5],
      [10, 0, 5],
    ],
  };
  assert.deepEqual(harborFocalWalk(layout), layout.walk.slice(0, 2));
  layout.walk.pop();
  assert.deepEqual(harborFocalWalk(layout), layout.walk);
});
