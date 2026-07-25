import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSeaField,
  findSeaPath,
  routeLaneAroundLand,
  segmentClear,
  smoothSeaPath,
} from "../src/core/navfield.js";
import { unwrapPath } from "../src/core/routes.js";
import { lands } from "../src/world-data.js";

// Tests use a world much wider than any test segment so the "direct" path
// between two points is unambiguous (its span stays under W/2). The real game
// world is 4800x3200 and every lane is a local corridor, so consecutive
// waypoints are always within W/2 directly — these dimensions mirror that.
const WIDTH = 1000;
const HEIGHT = 800;

function rectangle(x0, y0, x1, y1) {
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
}

function fieldFrom(
  polys,
  { width = WIDTH, height = HEIGHT, cellSize = 10 } = {},
) {
  const lands = polys.map((poly) => ({ poly }));
  return buildSeaField(lands, { width, height, cellSize });
}

function isBlocked(field, x, y) {
  return !segmentClear(field, x, y, x, y);
}

function everySegmentClear(field, points) {
  for (let i = 0; i + 1 < points.length; i += 1) {
    if (
      !segmentClear(
        field,
        points[i][0],
        points[i][1],
        points[i + 1][0],
        points[i + 1][1],
      )
    )
      return false;
  }
  return true;
}

test("buildSeaField marks a polygon's interior and leaves open water open", () => {
  const field = fieldFrom([rectangle(300, 200, 700, 600)]);
  assert.equal(isBlocked(field, 500, 400), true);
  assert.equal(isBlocked(field, 450, 550), true);
  assert.equal(isBlocked(field, 100, 100), false);
  assert.equal(isBlocked(field, 500, 100), false);
  assert.equal(isBlocked(field, 900, 700), false);
});

test("buildSeaField skips degenerate and empty polygons", () => {
  const field = fieldFrom([
    [
      [1, 1],
      [2, 2],
    ],
    [],
    rectangle(0, 0, 0, 0),
  ]);
  for (let r = 0; r < field.rows; r += 1)
    for (let c = 0; c < field.cols; c += 1)
      assert.equal(field.grid[r * field.cols + c], 0);
});

test("buildSeaField rasterizes polygons that straddle the wrap seam (3-offset)", () => {
  // A vertical bar centred on the east/west seam (x near 0 / near 1000).
  const field = fieldFrom([rectangle(980, 200, 1020, 600)]);
  assert.equal(isBlocked(field, 990, 400), true); // east side of the seam
  assert.equal(isBlocked(field, 10, 400), true); // wraps to the west side
  assert.equal(isBlocked(field, 500, 400), false); // open water mid-world
  assert.equal(isBlocked(field, 990, 100), false); // off the bar vertically
});

test("segmentClear reports open, blocked, degenerate, padding, and out-of-bounds cases", () => {
  const field = fieldFrom([rectangle(480, 380, 520, 420)]);

  assert.equal(segmentClear(field, 100, 400, 400, 400), true); // open
  assert.equal(segmentClear(field, 300, 400, 700, 400), false); // crosses island
  assert.equal(segmentClear(field, 500, 400, 500, 400), false); // degenerate on land
  assert.equal(segmentClear(field, 100, 100, 100, 100), true); // degenerate in open water

  // Skims above the island: clear with no padding, blocked with enough padding.
  assert.equal(segmentClear(field, 300, 360, 700, 360), true);
  assert.equal(segmentClear(field, 300, 360, 700, 360, { padding: 2 }), false);

  // Vertical out-of-bounds sampling is treated as blocked.
  assert.equal(segmentClear(field, 100, -5, 200, -5), false);
  assert.equal(segmentClear(field, 100, 805, 200, 805), false);
});

test("segmentClear respects the wrap when sampling a seam-spanning segment", () => {
  const field = fieldFrom([rectangle(480, 380, 520, 420)]);
  // From x=980 to x=20 the short way crosses the seam and stays in open water.
  assert.equal(segmentClear(field, 980, 400, 20, 400), true);
  assert.equal(segmentClear(field, 980, 100, 20, 100), true);
  // The island mid-world must not trip the wrapped sample.
  assert.equal(isBlocked(field, 500, 400), true);
});

test("findSeaPath routes around an island and never enters land", () => {
  const field = fieldFrom([rectangle(480, 300, 520, 500)]);
  const path = findSeaPath(field, 300, 400, 700, 400);
  assert.ok(path && path.length >= 2);
  assert.equal(everySegmentClear(field, path), true);
  const ys = path.map((p) => p[1]);
  assert.ok(Math.min(...ys) < 300 || Math.max(...ys) > 500);
});

test("findSeaPath returns null when the goal is sealed inside a ring of land", () => {
  const ringed = fieldFrom([
    rectangle(400, 300, 600, 340), // top wall
    rectangle(400, 460, 600, 500), // bottom wall
    rectangle(400, 300, 440, 500), // left wall
    rectangle(560, 300, 600, 500), // right wall
  ]);
  const path = findSeaPath(ringed, 100, 400, 500, 400); // goal sealed inside
  assert.equal(path, null);
});

test("findSeaPath snaps a coastal start toward open water", () => {
  const field = fieldFrom([rectangle(480, 380, 520, 420)]);
  // Start inside the small island; snap finds open water toward the goal.
  const path = findSeaPath(field, 500, 400, 900, 400);
  assert.ok(path && path.length >= 2);
  assert.equal(everySegmentClear(field, path), true);
});

test("findSeaPath gives up when the node budget is exhausted", () => {
  const field = fieldFrom([rectangle(480, 300, 520, 500)]);
  const path = findSeaPath(field, 300, 400, 700, 400, { maxNodes: 2 });
  assert.equal(path, null);
});

test("findSeaPath returns null when no open cell is within the snap ring", () => {
  const field = fieldFrom([rectangle(400, 300, 600, 500)]); // large solid block
  const path = findSeaPath(field, 500, 400, 500, 700, { snapRing: 2 });
  assert.equal(path, null);
});

test("findSeaPath returns null when start and goal share a cell", () => {
  const field = fieldFrom([]);
  const path = findSeaPath(field, 500, 400, 500, 400);
  assert.equal(path, null);
});

test("findSeaPath routes the short way across the wrap seam", () => {
  // Land sits mid-world; the only open route from x=980 to x=20 is across seam.
  const field = fieldFrom([rectangle(480, 300, 520, 500)]);
  const path = findSeaPath(field, 980, 400, 20, 400);
  assert.ok(path && path.length >= 2);
  assert.equal(everySegmentClear(field, path), true);
  for (const [x] of path) assert.ok(x >= 0 && x < WIDTH);
  // The short wrapped route is a handful of cells; the long way would be ~96.
  assert.ok(
    path.length < 20,
    `expected short seam route, got ${path.length} points`,
  );
});

test("smoothSeaPath collapses a clear staircase to its endpoints", () => {
  const field = fieldFrom([]);
  const staircase = [
    [100, 100],
    [300, 100],
    [300, 300],
    [500, 300],
    [500, 500],
  ];
  const smoothed = smoothSeaPath(field, staircase);
  assert.deepEqual(smoothed, [
    [100, 100],
    [500, 500],
  ]);
  assert.equal(everySegmentClear(field, smoothed), true);
  assert.deepEqual(smoothSeaPath(field, [[300, 300]]), [[300, 300]]);
  assert.deepEqual(smoothSeaPath(field, []), []);
});

test("smoothSeaPath keeps a vertex when the direct shortcut crosses land", () => {
  const field = fieldFrom([rectangle(200, 200, 250, 250)]);
  const around = [
    [100, 225],
    [225, 180],
    [350, 225],
  ];
  const smoothed = smoothSeaPath(field, around);
  assert.equal(smoothed.length, 3);
  assert.equal(everySegmentClear(field, smoothed), true);
});

test("routeLaneAroundLand preserves an already-clear lane verbatim", () => {
  const field = fieldFrom([]);
  const lane = [
    [100, 100],
    [500, 500],
    [900, 700],
  ];
  const baked = routeLaneAroundLand(field, lane);
  assert.deepEqual(baked, lane);
});

test("routeLaneAroundLand re-routes a crossing leg and keeps clear legs straight", () => {
  const field = fieldFrom([rectangle(580, 300, 620, 500)]);
  const lane = [
    [200, 400],
    [500, 400],
    [800, 400],
  ];
  const baked = routeLaneAroundLand(field, lane);
  assert.equal(baked[0][0], 200);
  assert.equal(baked.at(-1)[0], 800);
  assert.ok(baked.length > 3); // the crossing leg gained detour waypoints
  assert.equal(everySegmentClear(field, baked), true);
});

test("routeLaneAroundLand falls back to the straight leg when A* fails", () => {
  const ringed = fieldFrom([
    rectangle(400, 300, 600, 340),
    rectangle(400, 460, 600, 500),
    rectangle(400, 300, 440, 500),
    rectangle(560, 300, 600, 500),
  ]);
  // The goal waypoint sits sealed inside the ring, so the leg cannot route.
  const baked = routeLaneAroundLand(ringed, [
    [100, 400],
    [500, 400],
  ]);
  assert.deepEqual(baked, [
    [100, 400],
    [500, 400],
  ]);
});

test("routeLaneAroundLand handles short input and dedups shared waypoints", () => {
  const field = fieldFrom([]);
  assert.deepEqual(routeLaneAroundLand(field, [[300, 300]]), [[300, 300]]);
  assert.deepEqual(routeLaneAroundLand(field, []), []);
  // Two clear legs share the middle waypoint; the duplicate is collapsed.
  const baked = routeLaneAroundLand(field, [
    [100, 100],
    [500, 500],
    [500, 500],
    [900, 100],
  ]);
  assert.deepEqual(baked, [
    [100, 100],
    [500, 500],
    [900, 100],
  ]);
});

test("routeLaneAroundLand output round-trips through unwrapPath without a seam jump", () => {
  const field = fieldFrom([rectangle(480, 300, 520, 500)]);
  const baked = routeLaneAroundLand(field, [
    [980, 400],
    [20, 400],
  ]);
  const unwrapped = unwrapPath(baked, baked[0][0], WIDTH);
  for (let i = 1; i < unwrapped.length; i += 1) {
    const dx = Math.abs(unwrapped[i][0] - unwrapped[i - 1][0]);
    assert.ok(dx < WIDTH / 2, `unwrapped lane jumped ${dx} across the seam`);
  }
});

test("buildSeaField rasterizes the real refined coastline quickly (integration)", () => {
  // lands are authored in source coordinates (6400x2400) before the app maps
  // them to world space, so build the field in that space. This exercises the
  // scanline rasterizer on the actual high-detail coast polygons and doubles as
  // a perf smoke test for the one-time startup cost.
  const start = performance.now();
  const field = buildSeaField(lands, {
    width: 6400,
    height: 2400,
    cellSize: 10,
  });
  const elapsed = performance.now() - start;
  let land = 0;
  for (let i = 0; i < field.grid.length; i += 1) land += field.grid[i];
  assert.ok(land > 1000, `expected substantial land, got ${land}`);
  assert.ok(land < field.grid.length, "expected open water too");
  assert.ok(elapsed < 500, `rasterize took ${elapsed.toFixed(1)}ms`);
});

test("routeLaneAroundLand snaps stranded transformed waypoints or falls back", () => {
  const field = fieldFrom([rectangle(0, 0, WIDTH, HEIGHT)], {
    width: WIDTH,
    height: HEIGHT,
    cellSize: 50,
  });
  const waypoints = [
    [100, 100],
    [200, 200],
  ];
  assert.deepEqual(routeLaneAroundLand(field, waypoints), waypoints);

  const coastal = fieldFrom([rectangle(100, 100, 300, 300)], {
    width: WIDTH,
    height: HEIGHT,
    cellSize: 50,
  });
  const detoured = routeLaneAroundLand(coastal, [
    [150, 150],
    [500, 150],
  ]);
  assert.ok(detoured.length >= 2);
  assert.ok(everySegmentClear(coastal, detoured));
});
