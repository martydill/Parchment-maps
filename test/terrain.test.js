import assert from "node:assert/strict";
import test from "node:test";
import { pointInPolygon } from "../src/core/geometry.js";
import { planLandTerrain } from "../src/core/terrain.js";

const broadLand = [
  [0, 0],
  [620, 0],
  [620, 500],
  [0, 500],
];

test("terrain plans are stable and organize mountainous land into ranges and rivers", () => {
  const terrain = planLandTerrain(broadLand, 42, true);
  assert.deepEqual(terrain, planLandTerrain(broadLand, 42, true));
  assert.notDeepEqual(terrain, planLandTerrain(broadLand, 43, true));
  assert.equal(terrain.ranges.length, 2);
  assert.ok(terrain.hills.length > 0);
  assert.ok(terrain.rivers.length > 0);
  assert.ok(terrain.plains.length > 0);
  for (const range of terrain.ranges) {
    for (const peak of range.peaks) {
      assert.ok(pointInPolygon(peak.x, peak.y, broadLand));
    }
  }
  for (const river of terrain.rivers) {
    for (const point of river.slice(0, -1)) {
      assert.ok(pointInPolygon(point.x, point.y, broadLand));
    }
    const mouth = river.at(-1);
    assert.ok(
      mouth.x === 0 || mouth.x === 620 || mouth.y === 0 || mouth.y === 500,
    );
  }
});

test("plains and islands receive terrain suited to their size", () => {
  const plains = planLandTerrain(broadLand, 57);
  assert.equal(plains.ranges.length, 1);
  const islet = planLandTerrain(
    [
      [0, 0],
      [40, 0],
      [40, 28],
      [0, 28],
    ],
    57,
  );
  assert.equal(islet.ranges.length, 0);
  assert.equal(islet.rivers.length, 0);
  assert.deepEqual(planLandTerrain([], 57), {
    ranges: [],
    hills: [],
    rivers: [],
    tributaries: [],
    plains: [],
  });
});

test("narrow and degenerate land cannot acquire terrain that needs inland room", () => {
  const narrow = [
    [0, 0],
    [20000, 0],
    [20000, 3],
    [0, 3],
  ];
  for (const poly of [
    narrow,
    [
      [0, 0],
      [0, 0],
      [0, 0],
    ],
  ]) {
    const terrain = planLandTerrain(poly, 7, true);
    assert.deepEqual(terrain, {
      ranges: [],
      hills: [],
      rivers: [],
      tributaries: [],
      plains: [],
    });
  }
});

test("terrain and river controls remain inland on irregular coasts", () => {
  const polygons = [
    [
      [0, 0],
      [250, 0],
      [250, 250],
      [0, 250],
    ],
    [
      [0, 0],
      [500, 0],
      [20, 360],
    ],
    [
      [0, 0],
      [500, 0],
      [500, 500],
      [300, 500],
      [300, 150],
      [200, 150],
      [200, 500],
      [0, 500],
    ],
    [...broadLand, broadLand[0]],
  ];
  for (const poly of polygons) {
    const unchanged = structuredClone(poly);
    for (let seed = 1; seed <= 24; seed++) {
      for (const mountainous of [true, false]) {
        const terrain = planLandTerrain(poly, seed, mountainous);
        const points = [
          ...terrain.ranges.flatMap((range) => range.peaks),
          ...terrain.hills,
          ...terrain.plains,
          ...terrain.rivers.flatMap((river) => river.slice(0, -1)),
          ...terrain.tributaries.flat(),
        ];
        for (const point of points) {
          assert.ok(pointInPolygon(point.x, point.y, poly));
        }
        for (const peak of terrain.ranges.flatMap((range) => range.peaks)) {
          for (const [dx, dy] of [
            [-1.2, 0],
            [1.2, 0],
            [0, -1.2],
            [0, 1.2],
          ]) {
            assert.ok(
              pointInPolygon(
                peak.x + dx * peak.size,
                peak.y + dy * peak.size,
                poly,
              ),
            );
          }
        }
        assert.equal(terrain.tributaries.length, terrain.rivers.length);
      }
    }
    assert.deepEqual(poly, unchanged);
  }
});

test("terrain is continuous when an unwrapped island crosses the world seam", () => {
  const base = planLandTerrain(broadLand, 71, true);
  const shifted = planLandTerrain(
    broadLand.map(([x, y]) => [x + 4800, y]),
    71,
    true,
  );
  const positions = (plan) => [
    ...plan.ranges.flatMap((range) => range.peaks),
    ...plan.hills,
    ...plan.rivers.flat(),
    ...plan.tributaries.flat(),
    ...plan.plains,
  ];
  const originalPoints = positions(base);
  const shiftedPoints = positions(shifted);
  assert.equal(originalPoints.length, shiftedPoints.length);
  originalPoints.forEach((point, index) => {
    assert.ok(Math.abs(shiftedPoints[index].x - point.x - 4800) < 1e-8);
    assert.ok(Math.abs(shiftedPoints[index].y - point.y) < 1e-8);
  });
});
