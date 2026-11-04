import assert from "node:assert/strict";
import test from "node:test";
import { buildSeaField, segmentClear } from "../src/core/navfield.js";
import { createPassagePlanner } from "../src/core/passages.js";

test("passage distances include coastal approaches and wrap across the seam", () => {
  const field = buildSeaField([], { width: 1000, height: 600 });
  const original = field.grid.slice();
  const planner = createPassagePlanner(field);
  const route = planner.plan({ x: 980, y: 300 }, { x: 180, y: 300 });
  assert.ok(route.distance >= 200 && route.distance < 220);
  assert.deepEqual(field.grid, original);
  assert.equal(planner.field.grid[0], 1);
  assert.equal(planner.field.grid.at(-1), 1);
  assert.equal(planner.field.grid[30 * field.cols], 0);
});

test("passages retain hull clearance through narrow straits without a world detour", () => {
  const field = buildSeaField([], { width: 1000, height: 600 });
  for (let row = 0; row < field.rows; row++)
    for (let col = 40; col <= 60; col++)
      if (row < 27 || row >= 31) field.grid[row * field.cols + col] = 1;
  const origin = { x: 300, y: 290 };
  const destination = { x: 700, y: 290 };
  const planner = createPassagePlanner(field);
  const passage = planner.plan(origin, destination);
  assert.ok(passage.distance < 450);
  const detour = createPassagePlanner(field, { clearance: 2 }).plan(
    origin,
    destination,
  );
  assert.ok(detour.distance > passage.distance + 150);
  for (let i = 1; i < passage.points.length; i++)
    assert.ok(
      segmentClear(
        planner.field,
        ...passage.points[i - 1],
        ...passage.points[i],
      ),
    );
});

test("passage estimates measure the sea detour around land", () => {
  const field = buildSeaField(
    [
      {
        poly: [
          [400, 100],
          [600, 100],
          [600, 400],
          [400, 400],
        ],
      },
    ],
    { width: 2000, height: 600 },
  );
  const passage = createPassagePlanner(field).plan(
    { x: 300, y: 250 },
    { x: 700, y: 250 },
  );
  assert.ok(passage.distance > 500);
  for (let i = 1; i < passage.points.length; i++)
    assert.ok(
      segmentClear(field, ...passage.points[i - 1], ...passage.points[i]),
    );
});

test("coastal passages finish in actual open water past the clearance corridor", () => {
  const field = buildSeaField(
    [
      {
        poly: [
          [500, 200],
          [650, 200],
          [650, 400],
          [500, 400],
        ],
      },
    ],
    { width: 1000, height: 600 },
  );
  const passage = createPassagePlanner(field).plan(
    { x: 400, y: 300 },
    { x: 560, y: 300 },
  );
  assert.ok(passage.points.at(-1)[0] > passage.approachFrom[0]);
  assert.ok(passage.distance >= 160);
  assert.ok(560 - passage.points.at(-1)[0] < 78);
});

test("clearance wraps at the coast and tolerates the top and bottom grid edges", () => {
  const field = buildSeaField([], { width: 400, height: 400 });
  field.grid[0] = 1;
  field.grid[(field.rows - 1) * field.cols] = 1;
  const safe = createPassagePlanner(field, { margin: 0 }).field;
  assert.equal(safe.grid[field.cols - 1], 1);
  assert.equal(safe.grid.at(-1), 1);
  assert.equal(safe.grid[10], 0);
});

test("unreachable passages and endpoints in the same cell return no route", () => {
  const field = buildSeaField([], { width: 400, height: 400 });
  const planner = createPassagePlanner(field, { margin: 0, clearance: 0 });
  assert.equal(planner.plan({ x: 100, y: 200 }, { x: 101, y: 201 }), null);
  field.grid.fill(1);
  const blocked = createPassagePlanner(field);
  assert.equal(blocked.plan({ x: 100, y: 200 }, { x: 300, y: 200 }), null);
});
