export function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index++
  ) {
    const [x1, y1] = polygon[index];
    const [x2, y2] = polygon[previous];
    const intersects =
      y1 > y !== y2 > y &&
      x < ((x2 - x1) * (y - y1)) / (y2 - y1 + 0.00001) + x1;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function pointInWrappedPolygon(x, y, polygon, worldWidth) {
  if (!worldWidth) return pointInPolygon(x, y, polygon);
  const wrappedX = ((x % worldWidth) + worldWidth) % worldWidth;
  return [-worldWidth, 0, worldWidth].some((offset) =>
    pointInPolygon(wrappedX + offset, y, polygon),
  );
}

function cross(ax, ay, bx, by) {
  return ax * by - ay * bx;
}

export function raySegmentDistance(
  px,
  py,
  dx,
  dy,
  ax,
  ay,
  bx,
  by,
  maxDistance,
) {
  const sx = bx - ax;
  const sy = by - ay;
  const denominator = cross(dx, dy, sx, sy);
  if (Math.abs(denominator) < 1e-8) return null;

  const qx = ax - px;
  const qy = ay - py;
  const rayDistance = cross(qx, qy, sx, sy) / denominator;
  const segmentProgress = cross(qx, qy, dx, dy) / denominator;
  return rayDistance >= 0 &&
    rayDistance <= maxDistance &&
    segmentProgress >= 0 &&
    segmentProgress <= 1
    ? rayDistance
    : null;
}

export function polygonCentroid(polygon) {
  return {
    x: polygon.reduce((total, point) => total + point[0], 0) / polygon.length,
    y: polygon.reduce((total, point) => total + point[1], 0) / polygon.length,
  };
}

export function expandPolygon(polygon, amount) {
  const centroid = polygonCentroid(polygon);
  return polygon.map(([x, y]) => {
    const dx = x - centroid.x;
    const dy = y - centroid.y;
    const distance = Math.hypot(dx, dy) || 1;
    return [x + (dx / distance) * amount, y + (dy / distance) * amount];
  });
}
