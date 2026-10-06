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

// Bounds reject distant islands before an exact coastline test. Build once for
// static map geometry; the returned query keeps the same wrapping semantics.
export function createWrappedPolygonLookup(polygons, worldWidth) {
  const entries = polygons.map((poly) => {
    const xs = poly.map(([x]) => x),
      ys = poly.map(([, y]) => y);
    return {
      poly,
      left: Math.min(...xs),
      right: Math.max(...xs),
      top: Math.min(...ys),
      bottom: Math.max(...ys),
    };
  });
  const offsets = worldWidth ? [-worldWidth, 0, worldWidth] : [0];
  return (x, y) => {
    const wx = worldWidth ? ((x % worldWidth) + worldWidth) % worldWidth : x;
    return entries.some(({ poly, left, right, top, bottom }) => {
      if (y < top || y > bottom) return false;
      return offsets.some((offset) => {
        const px = wx + offset;
        return px >= left && px <= right && pointInPolygon(px, y, poly);
      });
    });
  };
}

function cross(ax, ay, bx, by) {
  return ax * by - ay * bx;
}

// Intersect the finite ray with both axis slabs before testing polygon edges.
// Bounds are inclusive so a grazing ray or an origin on the coast is retained.
export function rayIntersectsBounds(px, py, dx, dy, bounds, maxDistance) {
  let near = 0;
  let far = maxDistance;
  if (dx === 0) {
    if (px < bounds.left || px > bounds.right) return false;
  } else {
    const a = (bounds.left - px) / dx;
    const b = (bounds.right - px) / dx;
    near = Math.max(near, Math.min(a, b));
    far = Math.min(far, Math.max(a, b));
  }
  if (dy === 0) {
    if (py < bounds.top || py > bounds.bottom) return false;
  } else {
    const a = (bounds.top - py) / dy;
    const b = (bounds.bottom - py) / dy;
    near = Math.max(near, Math.min(a, b));
    far = Math.min(far, Math.max(a, b));
  }
  return near <= far;
}

// A connected rectangle is strictly inside a polygon when its center is inside
// and no polygon edge enters it. Boundary contact is deliberately rejected.
export function polygonContainsBounds(polygon, bounds) {
  if (
    !pointInPolygon(
      (bounds.left + bounds.right) / 2,
      (bounds.top + bounds.bottom) / 2,
      polygon,
    )
  )
    return false;
  for (let index = 0; index < polygon.length; index++) {
    const [ax, ay] = polygon[index];
    const [bx, by] = polygon[(index + 1) % polygon.length];
    if (rayIntersectsBounds(ax, ay, bx - ax, by - ay, bounds, 1)) return false;
  }
  return true;
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
