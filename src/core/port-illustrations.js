import { pointInWrappedPolygon } from "./geometry.js";

const TAU = Math.PI * 2;
const FOOTPRINTS = [
  { radius: 36, scale: 0.44 },
  { radius: 29, scale: 0.36 },
  { radius: 22, scale: 0.28 },
];

function discFits(x, y, radius, polygon, worldWidth) {
  if (!pointInWrappedPolygon(x, y, polygon, worldWidth)) return false;
  for (const distance of [radius * 0.55, radius]) {
    for (let sample = 0; sample < 12; sample++) {
      const angle = (sample / 12) * TAU;
      if (
        !pointInWrappedPolygon(
          x + Math.cos(angle) * distance,
          y + Math.sin(angle) * distance,
          polygon,
          worldWidth,
        )
      )
        return false;
    }
  }
  return true;
}

function coastlineHeading(x, y, polygon, worldWidth) {
  let nearest = null;
  for (let index = 0; index < polygon.length; index++) {
    const [ax, ay] = polygon[index];
    const [bx, by] = polygon[(index + 1) % polygon.length];
    const segmentX = bx - ax;
    const segmentY = by - ay;
    const segmentLengthSquared = segmentX ** 2 + segmentY ** 2;
    const wrap = Math.round((x - (ax + bx) / 2) / worldWidth);
    for (const offset of [wrap - 1, wrap, wrap + 1]) {
      const wrappedAx = ax + offset * worldWidth;
      const projection = Math.max(
        0,
        Math.min(
          1,
          ((x - wrappedAx) * segmentX + (y - ay) * segmentY) /
            (segmentLengthSquared || 1),
        ),
      );
      const dx = wrappedAx + projection * segmentX - x;
      const dy = ay + projection * segmentY - y;
      const distanceSquared = dx ** 2 + dy ** 2;
      if (!nearest || distanceSquared < nearest.distanceSquared)
        nearest = { dx, dy, distanceSquared };
    }
  }
  return Math.atan2(-nearest.dx, nearest.dy);
}

export function planPortIllustration(port, lands, worldWidth) {
  if (!Number.isFinite(port?.x) || !Number.isFinite(port?.y) || worldWidth <= 0)
    return null;
  const land = lands.find(
    (entry) => entry.name === port.land && entry.poly?.length >= 3,
  );
  if (!land) return null;
  const centroidX =
    land.poly.reduce((sum, vertex) => sum + vertex[0], 0) / land.poly.length;
  const centroidY =
    land.poly.reduce((sum, vertex) => sum + vertex[1], 0) / land.poly.length;
  const inlandX =
    centroidX +
    Math.round((port.x - centroidX) / worldWidth) * worldWidth -
    port.x;
  const inlandY = centroidY - port.y;
  const inlandLength = Math.hypot(inlandX, inlandY) || 1;

  for (const { radius, scale } of FOOTPRINTS) {
    for (let distance = 0; distance <= 240; distance += 10) {
      let best = null;
      for (let direction = 0; direction < 24; direction++) {
        const angle = (direction / 24) * TAU;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        const x = port.x + dx * distance;
        const y = port.y + dy * distance;
        if (!discFits(x, y, radius, land.poly, worldWidth)) continue;
        const alignment = (dx * inlandX + dy * inlandY) / inlandLength;
        if (!best || alignment > best.alignment)
          best = { x, y, scale, distance, alignment };
      }
      if (best) {
        return {
          x: best.x,
          y: best.y,
          scale: best.scale,
          distance: best.distance,
          heading: coastlineHeading(best.x, best.y, land.poly, worldWidth),
        };
      }
    }
  }
  return null;
}
