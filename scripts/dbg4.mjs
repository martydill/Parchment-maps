import { createMapTransform } from "../src/core/map-generation.js";
import { polygonCentroid } from "../src/core/geometry.js";
import { wrappedDelta } from "../src/core/math.js";
import { buildSeaField, findSeaPath, routeLaneAroundLand } from "../src/core/navfield.js";
import { lands as sourceLands } from "../src/world-data.js";

const WORLD = { w: 4800, h: 3200 };
function unwrap(poly, w) {
  let p = poly[0][0];
  for (let i = 1; i < poly.length; i++) {
    p += wrappedDelta(poly[i][0], p, w);
    poly[i][0] = p;
  }
}
const lands = structuredClone(sourceLands);
const mt = createMapTransform("");
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
const field = buildSeaField(lands, { width: WORLD.w, height: WORLD.h });

const ma = mp(650, 485);
const mb = mp(2380, 650);
const baked = routeLaneAroundLand(field, [
  [ma.x, ma.y],
  [mb.x, mb.y],
]);
const A = baked[0];
const B = baked[baked.length - 1];
for (const mn of [12000, 50000, 200000]) {
  const t0 = performance.now();
  const p = findSeaPath(field, A[0], A[1], B[0], B[1], { maxNodes: mn });
  console.log("maxNodes=" + mn + " => " + (p ? p.length + " pts" : "null") + " (" + (performance.now() - t0).toFixed(1) + "ms)");
}

// Control: two clearly-open cells far apart (scan grid for water cells).
const opens = [];
for (let r = 0; r < field.rows && opens.length < 4; r += 40)
  for (let c = 0; c < field.cols && opens.length < 4; c += 200)
    if (field.grid[r * field.cols + c] === 0) opens.push([c * 10 + 5, r * 10 + 5]);
for (let i = 0; i + 2 < opens.length; i += 2) {
  const p = findSeaPath(field, opens[i][0], opens[i][1], opens[i + 2][0], opens[i + 2][1], {
    maxNodes: 200000,
  });
  console.log(
    "control " + i + " (" + opens[i][0] + "," + opens[i][1] + ")->(" + opens[i + 2][0] + "," + opens[i + 2][1] + ") => " +
      (p ? p.length + " pts" : "null"),
  );
}
console.log("A=", A.map((v) => v.toFixed(0)), "B=", B.map((v) => v.toFixed(0)));
