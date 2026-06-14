import assert from "node:assert/strict";
import test from "node:test";

import { ruggedCoast } from "../src/core/coastlines.js";

const square = [
  [0, 0],
  [120, 0],
  [120, 120],
  [0, 120],
];

test("ruggedCoast preserves authored vertices and adds curved detail", () => {
  const coast = ruggedCoast(square, 42);

  assert.ok(coast.length >= square.length * 4);
  for (const vertex of square) {
    assert.ok(
      coast.some(
        ([x, y]) =>
          Math.abs(x - vertex[0]) < 1e-10 && Math.abs(y - vertex[1]) < 1e-10,
      ),
    );
  }
  assert.ok(coast.some(([, y]) => y !== 0 && Math.abs(y) < 30));
});

test("ruggedCoast is deterministic and responds to seed and roughness", () => {
  const coast = ruggedCoast(square, 42);

  assert.deepEqual(ruggedCoast(square, 42), coast);
  assert.notDeepEqual(ruggedCoast(square, 43), coast);
  assert.notDeepEqual(ruggedCoast(square, 42, 0), coast);
});

test("ruggedCoast safely copies outlines too small to curve", () => {
  const line = [
    [1, 2],
    [3, 4],
  ];
  const result = ruggedCoast(line, 1);

  assert.deepEqual(result, line);
  assert.notEqual(result, line);
  assert.notEqual(result[0], line[0]);
});

test("ruggedCoast bounds detail on very long and zero-length edges", () => {
  const unusualOutline = [
    [0, 0],
    [0, 0],
    [1000, 0],
    [0, 20],
  ];
  const coast = ruggedCoast(unusualOutline, 7);

  assert.equal(coast.length, 30);
  assert.ok(coast.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)));
});
