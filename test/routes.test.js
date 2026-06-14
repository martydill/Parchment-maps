import assert from "node:assert/strict";
import test from "node:test";

import {
  orientRoute,
  pathLength,
  pointAlongPath,
  routesFrom,
  unwrapPath,
} from "../src/core/routes.js";

const route = {
  a: "West",
  b: "East",
  points: [
    [9, 0],
    [1, 0],
    [3, 0],
  ],
};

test("pathLength sums every segment", () => {
  assert.equal(
    pathLength([
      [0, 0],
      [3, 4],
      [6, 8],
    ]),
    10,
  );
  assert.equal(pathLength([]), 0);
});

test("pointAlongPath interpolates, clamps past the end, and handles a singleton", () => {
  assert.deepEqual(
    pointAlongPath(
      [
        [0, 0],
        [10, 0],
      ],
      -4,
    ),
    { x: 0, y: 0, angle: 0 },
  );
  assert.deepEqual(
    pointAlongPath(
      [
        [0, 0],
        [10, 0],
      ],
      4,
    ),
    { x: 4, y: 0, angle: 0 },
  );
  assert.deepEqual(
    pointAlongPath(
      [
        [0, 0],
        [10, 0],
      ],
      20,
    ),
    { x: 10, y: 0, angle: 0 },
  );
  assert.deepEqual(pointAlongPath([[3, 4]], 2), { x: 3, y: 4, angle: 0 });
  assert.deepEqual(pointAlongPath([], 2), { x: 0, y: 0, angle: 0 });
  assert.deepEqual(
    pointAlongPath(
      [
        [3, 4],
        [3, 4],
      ],
      0,
    ),
    { x: 3, y: 4, angle: 0 },
  );
});

test("unwrapPath keeps seam-crossing segments continuous", () => {
  assert.deepEqual(unwrapPath([], 9, 10), []);
  assert.deepEqual(unwrapPath(route.points, 9, 10), [
    [9, 0],
    [11, 0],
    [13, 0],
  ]);
});

test("orientRoute supports both route directions", () => {
  assert.deepEqual(orientRoute(route, "West", "East", 9, 10), [
    [9, 0],
    [11, 0],
    [13, 0],
  ]);
  assert.deepEqual(orientRoute(route, "East", "West", 3, 10), [
    [3, 0],
    [1, 0],
    [-1, 0],
  ]);
  assert.deepEqual(orientRoute(route, "West", "East", undefined, 10), [
    [9, 0],
    [11, 0],
    [13, 0],
  ]);
});

test("routesFrom returns only routes connected to a port", () => {
  const routes = [route, { a: "North", b: "South", points: [] }];
  assert.deepEqual(routesFrom(routes, "East"), [route]);
  assert.deepEqual(routesFrom(routes, "Missing"), []);
});
