import { createMapTransform } from "../src/core/map-generation.js";
import { polygonCentroid, pointInPolygon } from "../src/core/geometry.js";
import { wrappedDelta } from "../src/core/math.js";
import { buildSeaField, segmentClear } from "../src/core/navfield.js";
import { lands as sourceLands } from "../src/world-data.js";

const WORLD = { w: 4800, h: 3200 };
const inSrc = sourceLands
  .filter((l) => l.poly.length >= 3)
  .some((l) => pointInPolygon(650, 485, l.poly));
console.log("(650,485) in source land?", inSrc);

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
const field = buildSeaField(lands, { width: WORLD.w, height: WORLD.h });

function snapDist(x, y) {
  for (let rad = 0; rad < 40; rad++) {
    for (let dr = -rad; dr <= rad; dr++)
      for (let dc = -rad; dc <= rad; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
        const cx = x + dc * 10;
        const cy = y + dr * 10;
        if (segmentClear(field, cx, cy, cx, cy)) return rad;
      }
  }
  return 99;
}
for (const [sx, sy] of [
  [650, 485],
  [2380, 650],
  [4700, 1220],
]) {
  const m = mp(sx, sy);
  const onLand = !segmentClear(field, m.x, m.y, m.x, m.y);
  console.log(
    "src [" +
      sx +
      "," +
      sy +
      "] -> world (" +
      m.x.toFixed(0) +
      "," +
      m.y.toFixed(0) +
      ") onLand=" +
      onLand +
      " snapCells=" +
      snapDist(m.x, m.y),
  );
}
