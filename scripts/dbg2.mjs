import { createMapTransform } from "../src/core/map-generation.js";
import { polygonCentroid } from "../src/core/geometry.js";
import { wrappedDelta } from "../src/core/math.js";
import { buildSeaField, routeLaneAroundLand, segmentClear } from "../src/core/navfield.js";
import { lands as sourceLands } from "../src/world-data.js";

const WORLD = { w: 4800, h: 3200 };
const PAIRS = [
  [[650, 485], [2380, 650]],
  [[4700, 1220], [4640, 1510]],
  [[6240, 760], [6280, 1600]],
  [[6280, 1600], [40, 1690]],
  [[1950, 1105], [3410, 1660]],
  [[2000, 765], [3050, 1210]],
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
    const r = land.name ? regions.find((g) => g.key === land.name) : near(c.x, c.y);
    for (const p of land.poly) {
      const m = mt.regionPoint(p[0], p[1], r.key, r.c);
      p[0] = m.x;
      p[1] = m.y;
    }
    unwrap(land.poly, WORLD.w);
  }
  return { field: buildSeaField(lands, { width: WORLD.w, height: WORLD.h }), mp };
}
for (const seed of ["", "abc123"]) {
  const { field, mp } = buildForSeed(seed);
  console.log("=== seed " + JSON.stringify(seed) + " ===");
  PAIRS.forEach(([a, b], idx) => {
    const ma = mp(a[0], a[1]);
    const mb = mp(b[0], b[1]);
    const baked = routeLaneAroundLand(field, [
      [ma.x, ma.y],
      [mb.x, mb.y],
    ]);
    const bad = [];
    for (let i = 0; i + 1 < baked.length; i++)
      if (!segmentClear(field, baked[i][0], baked[i][1], baked[i + 1][0], baked[i + 1][1]))
        bad.push(i);
    if (bad.length)
      console.log(
        "pair " + idx + " FAIL segs=" + JSON.stringify(bad) + " npts=" + baked.length +
          " startOnLand=" + !segmentClear(field, ma.x, ma.y, ma.x, ma.y) +
          " endOnLand=" + !segmentClear(field, mb.x, mb.y, mb.x, mb.y),
      );
  });
}
