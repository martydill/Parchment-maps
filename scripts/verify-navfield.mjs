// Throwaway verification mirroring app.js: build field, bake land-avoiding
// routes for real lane endpoints, confirm every segment is land-free. Not
// committed; deleted after running.
import { createMapTransform } from "../src/core/map-generation.js";
import { polygonCentroid } from "../src/core/geometry.js";
import { wrappedDelta } from "../src/core/math.js";
import {
  buildSeaField,
  routeLaneAroundLand,
  segmentClear,
} from "../src/core/navfield.js";
import { lands as sourceLands } from "../src/world-data.js";

const WORLD = { w: 4800, h: 3200 };
// Full lane point sequences (source coords), incl. the seam lane. Real lanes
// carry intermediate waypoints, so route the whole sequence — not just ends.
const LANES = [
  [
    [650, 485],
    [1200, 530],
    [1800, 600],
    [2380, 650],
  ],
  [
    [4700, 1220],
    [4480, 900],
    [4380, 720],
  ],
  [
    [6240, 760],
    [6320, 1000],
    [6310, 1320],
    [6280, 1600],
  ],
  [
    [6280, 1600],
    [6360, 1650],
    [40, 1690],
    [80, 1730],
  ],
  [
    [1950, 1105],
    [2300, 1300],
    [2850, 1510],
    [3410, 1660],
  ],
  [
    [2000, 765],
    [2350, 900],
    [2720, 1080],
    [3050, 1210],
  ],
];

function unwrap(poly, w) {
  let p = poly[0][0];
  for (let i = 1; i < poly.length; i++) {
    p += wrappedDelta(poly[i][0], p, w);
    poly[i][0] = p;
  }
}
function buildForSeed(seed) {
  const lands = structuredClone(sourceLands);
  const mt = createMapTransform(seed);
  const regions = lands
    .filter((l) => l.name)
    .map((l) => ({ key: l.name, c: polygonCentroid(l.poly) }));
  const near = (x, y) =>
    regions.reduce((b, r) => {
      const d = Math.hypot(x - r.c.x, y - r.c.y);
      return !b || d < b.d ? { ...r, d } : b;
    }, null);
  const mp = (x, y) => {
    const r = near(x, y);
    return mt.regionPoint(x, y, r.key, r.c);
  };
  for (const land of lands) {
    const c = polygonCentroid(land.poly);
    const r = land.name
      ? regions.find((g) => g.key === land.name)
      : near(c.x, c.y);
    for (const p of land.poly) {
      const m = mt.regionPoint(p[0], p[1], r.key, r.c);
      p[0] = m.x;
      p[1] = m.y;
    }
    unwrap(land.poly, WORLD.w);
  }
  const t0 = performance.now();
  const field = buildSeaField(lands, { width: WORLD.w, height: WORLD.h });
  return { field, mp, buildMs: performance.now() - t0 };
}

function segsClear(field, pts) {
  for (let i = 0; i + 1 < pts.length; i++)
    if (
      !segmentClear(field, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])
    )
      return false;
  return true;
}

let total = 0;
for (const seed of ["", "abc123", "7Q2v9", "maple-leaf", "zzz42"]) {
  const { field, mp, buildMs } = buildForSeed(seed);
  let crossings = 0;
  let bakeMs = 0;
  for (const lane of LANES) {
    const mapped = lane.map((p) => mp(p[0], p[1]));
    const t0 = performance.now();
    const baked = routeLaneAroundLand(
      field,
      mapped.map((m) => [m.x, m.y]),
    );
    bakeMs += performance.now() - t0;
    const bad = [];
    for (let i = 0; i + 1 < baked.length; i++)
      if (
        !segmentClear(
          field,
          baked[i][0],
          baked[i][1],
          baked[i + 1][0],
          baked[i + 1][1],
        )
      )
        bad.push(i);
    if (bad.length) {
      crossings++;
      console.log(
        "  seed " +
          JSON.stringify(seed) +
          " lane " +
          lane[0] +
          " FAIL segs=" +
          JSON.stringify(bad) +
          " npts=" +
          baked.length,
      );
    }
  }
  total += crossings;
  console.log(
    `seed=${JSON.stringify(seed).padEnd(13)} build=${buildMs.toFixed(1)}ms bake=${bakeMs.toFixed(2)}ms crossings=${crossings}`,
  );
}
console.log(`TOTAL crossings across seeds: ${total}`);
process.exit(total === 0 ? 0 : 1);
