import { createMapTransform } from "../src/core/map-generation.js";
import { polygonCentroid } from "../src/core/geometry.js";
import { wrappedDelta } from "../src/core/math.js";
import {
  buildSeaField,
  findSeaPath,
  routeLaneAroundLand,
  segmentClear,
} from "../src/core/navfield.js";
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
const regions = lands.filter((l) => l.name).map((l) => ({ key: l.name, c: polygonCentroid(l.poly) }));
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
const lane = [
  [4700, 1220],
  [4480, 900],
  [4380, 720],
].map((p) => mp(p[0], p[1]));
const baked = routeLaneAroundLand(
  field,
  lane.map((m) => [m.x, m.y]),
);
console.log("npts=" + baked.length);
baked.forEach((p, i) =>
  console.log(
    " " + i + " (" + p[0].toFixed(0) + "," + p[1].toFixed(0) + ") onLand=" +
      !segmentClear(field, p[0], p[1], p[0], p[1]),
  ),
);
// connectivity of each baked point to a known open-ocean cell
for (let i = 0; i < baked.length; i++) {
  const p = findSeaPath(field, baked[i][0], baked[i][1], 5, 5, { maxNodes: 200000 });
  console.log("  pt" + i + " -> ocean: " + (p ? p.length + "pts" : "DISCONNECTED"));
}
