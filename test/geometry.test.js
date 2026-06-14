import assert from "node:assert/strict";
import test from "node:test";

import {
  expandPolygon,
  pointInPolygon,
  polygonCentroid,
  raySegmentDistance,
} from "../src/core/geometry.js";

test("pointInPolygon identifies interior and exterior points", () => {
  const square = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ];

  assert.equal(pointInPolygon(5, 5, square), true);
  assert.equal(pointInPolygon(15, 5, square), false);
  assert.equal(pointInPolygon(0, 0, []), false);
});

test("raySegmentDistance returns only forward intersections on the segment", () => {
  assert.equal(raySegmentDistance(0, 0, 1, 0, 5, -2, 5, 2, 10), 5);
  assert.equal(raySegmentDistance(0, 0, 1, 0, 5, 2, 5, 4, 10), null);
  assert.equal(raySegmentDistance(0, 0, 1, 0, -5, -2, -5, 2, 10), null);
  assert.equal(raySegmentDistance(0, 0, 1, 0, 12, -2, 12, 2, 10), null);
  assert.equal(raySegmentDistance(0, 0, 1, 0, 0, 2, 5, 2, 10), null);
});

test("polygonCentroid averages vertices and expandPolygon moves them outward", () => {
  const polygon = [
    [0, 0],
    [4, 0],
    [2, 3],
    [2, 1],
  ];

  assert.deepEqual(polygonCentroid(polygon), { x: 2, y: 1 });
  assert.deepEqual(expandPolygon(polygon, 2), [
    [-4 / Math.sqrt(5), -2 / Math.sqrt(5)],
    [4 + 4 / Math.sqrt(5), -2 / Math.sqrt(5)],
    [2, 5],
    [2, 1],
  ]);
});
