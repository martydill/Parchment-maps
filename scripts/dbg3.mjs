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

function snapDist(x, y) {
  for (let rad = 0; rad < 60; rad++) {
    for (let dr = -rad; dr <= rad; dr++)
      for (let dc = -rad; dc <= rad; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
        if (segmentClear(field, x + dc * 10, y + dr * 10, x + dc * 10, y + dr * 10))
          return rad;
      }
  }
  return 99;
}

const ma = mp(650, 485);
const mb = mp(2380, 650);
console.log("A snapCells=" + snapDist(ma.x, ma.y), "B snapCells=" + snapDist(mb.x, mb.y));
const baked = routeLaneAroundLand(field, [
  [ma.x, ma.y],
  [mb.x, mb.y],
]);
console.log("baked npts=" + baked.length);
console.log(
  "baked[0] onLand=" + !segmentClear(field, baked[0][0], baked[0][1], baked[0][0], baked[0][1]),
  "baked[last] onLand=" +
    !segmentClear(field, baked.at(-1)[0], baked.at(-1)[1], baked.at(-1)[0], baked.at(-1)[1]),
);
console.log("segmentClear(baked[0],baked[last])=" +
  segmentClear(field, baked[0][0], baked[0][1], baked.at(-1)[0], baked.at(-1)[1]));
const p = findSeaPath(field, baked[0][0], baked[0][1], baked.at(-1)[0], baked.at(-1)[1]);
console.log("findSeaPath(baked endpoints) =>", p ? p.length + " pts" : "null");
const p2 = findSeaPath(field, ma.x, ma.y, mb.x, mb.y);
console.log("findSeaPath(raw endpoints) =>", p2 ? p2.length + " pts" : "null");
