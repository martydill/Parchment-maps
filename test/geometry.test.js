import assert from "node:assert/strict";
import test from "node:test";

import {
  expandPolygon,
  pointInPolygon,
  pointInWrappedPolygon,
  polygonCentroid,
  polygonContainsBounds,
  rayIntersectsBounds,
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

test("pointInWrappedPolygon treats seam-crossing polygons as continuous", () => {
  const westOverflow = [
    [-12, 10],
    [24, 10],
    [24, 40],
    [-12, 40],
  ];
  const eastOverflow = [
    [82, 10],
    [112, 10],
    [112, 40],
    [82, 40],
  ];

  assert.equal(pointInWrappedPolygon(96, 25, westOverflow, 100), true);
  assert.equal(pointInWrappedPolygon(-4, 25, westOverflow, 100), true);
  assert.equal(pointInWrappedPolygon(4, 25, eastOverflow, 100), true);
  assert.equal(pointInWrappedPolygon(104, 25, eastOverflow, 100), true);
  assert.equal(pointInWrappedPolygon(50, 25, eastOverflow, 100), false);
});

test("raySegmentDistance returns only forward intersections on the segment", () => {
  assert.equal(raySegmentDistance(0, 0, 1, 0, 5, -2, 5, 2, 10), 5);
  assert.equal(raySegmentDistance(0, 0, 1, 0, 5, 2, 5, 4, 10), null);
  assert.equal(raySegmentDistance(0, 0, 1, 0, -5, -2, -5, 2, 10), null);
  assert.equal(raySegmentDistance(0, 0, 1, 0, 12, -2, 12, 2, 10), null);
  assert.equal(raySegmentDistance(0, 0, 1, 0, 0, 2, 5, 2, 10), null);
});

test("ray bounds retain grazing, interior, reverse, and finite-range hits", () => {
  const bounds = { left: 5, right: 10, top: 5, bottom: 10 };
  const cases = [
    [0, 5, 1, 0, 5, true],
    [0, 5, 1, 0, 4.99, false],
    [7, 0, 0, 1, 5, true],
    [7, 0, 0, 1, 4.99, false],
    [5, 5, -1, 0, 0, true],
    [10, 10, 0, -1, 0, true],
    [7, 7, 1, 1, 0, true],
    [15, 15, -1, -1, 5, true],
    [0, 10, 1, -1, 5, true],
    [0, 4, 1, 0, 100, false],
    [0, 11, 1, 0, 100, false],
    [4, 0, 0, 1, 100, false],
    [11, 0, 0, 1, 100, false],
    [0, 7, -1, 0, 100, false],
    [7, 0, 0, -1, 100, false],
    [0, 0, 1, 0.1, 100, false],
    [7, 7, 0, 0, 0, true],
    [7, 7, 0, 0, -1, false],
  ];
  for (const [x, y, dx, dy, distance, expected] of cases)
    assert.equal(
      rayIntersectsBounds(x, y, dx, dy, bounds, distance),
      expected,
      JSON.stringify([x, y, dx, dy, distance]),
    );
});

test("ray bounds never cull actual polygon hits, including wrapped copies", () => {
  const poly = [
    [85, 12],
    [110, 10],
    [105, 28],
    [90, 30],
  ];
  const bounds = { left: 84, right: 111, top: 9, bottom: 31 };
  let hits = 0;
  for (const offset of [-100, 0, 100]) {
    for (const x of [-20, 0, 92, 112, 180]) {
      for (const y of [0, 12, 22, 30, 50]) {
        for (let index = 0; index < 192; index++) {
          const angle = (index / 192) * Math.PI * 2;
          const dx = Math.cos(angle),
            dy = Math.sin(angle);
          for (let edge = 0; edge < poly.length; edge++) {
            const [ax, ay] = poly[edge];
            const [bx, by] = poly[(edge + 1) % poly.length];
            const distance = raySegmentDistance(
              x,
              y,
              dx,
              dy,
              ax + offset,
              ay,
              bx + offset,
              by,
              120,
            );
            if (distance === null) continue;
            hits++;
            assert.equal(
              rayIntersectsBounds(x - offset, y, dx, dy, bounds, distance),
              true,
            );
          }
        }
      }
    }
  }
  assert.ok(hits > 1000);
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

test("polygon bounds containment rejects exterior and touching rectangles", () => {
  const square = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ];
  assert.equal(
    polygonContainsBounds(square, { left: 2, right: 8, top: 2, bottom: 8 }),
    true,
  );
  for (const bounds of [
    { left: 0, right: 8, top: 2, bottom: 8 },
    { left: 2, right: 10, top: 2, bottom: 8 },
    { left: 2, right: 8, top: 0, bottom: 8 },
    { left: 2, right: 8, top: 2, bottom: 10 },
    { left: -1, right: 11, top: -1, bottom: 11 },
    { left: 12, right: 14, top: 2, bottom: 8 },
  ])
    assert.equal(polygonContainsBounds(square, bounds), false);
  assert.equal(
    polygonContainsBounds([], { left: 2, right: 8, top: 2, bottom: 8 }),
    false,
  );
});

test("polygon containment detects concave notches even with interior corners", () => {
  const polygon = [
    [0, 0],
    [10, 0],
    [10, 10],
    [7, 10],
    [7, 4],
    [6, 4],
    [6, 10],
    [0, 10],
  ];
  // All corners and the center are inside; the notch still crosses the box.
  assert.equal(
    polygonContainsBounds(polygon, { left: 2, right: 9, top: 2, bottom: 8 }),
    false,
  );
  assert.equal(
    polygonContainsBounds(polygon, { left: 1, right: 5, top: 1, bottom: 9 }),
    true,
  );
  for (const offset of [-4800, 4800]) {
    const shifted = polygon.map(([x, y]) => [x + offset, y]);
    assert.equal(
      polygonContainsBounds(shifted, {
        left: 1 + offset,
        right: 5 + offset,
        top: 1,
        bottom: 9,
      }),
      true,
    );
    assert.equal(
      polygonContainsBounds(shifted, {
        left: 2 + offset,
        right: 9 + offset,
        top: 2,
        bottom: 8,
      }),
      false,
    );
  }
});

test("wrapped polygon checks fall back to plain polygons without a world width", () => {
  const square = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ];

  assert.equal(pointInWrappedPolygon(5, 5, square, 0), true);
  assert.equal(pointInWrappedPolygon(15, 5, square, 0), false);
});
