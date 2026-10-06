import { pointInPolygon, polygonCentroid } from "./geometry.js";

function bounds(poly) {
  return {
    left: Math.min(...poly.map(([x]) => x)),
    right: Math.max(...poly.map(([x]) => x)),
    top: Math.min(...poly.map(([, y]) => y)),
    bottom: Math.max(...poly.map(([, y]) => y)),
  };
}

function nearbyBounds(a, b, gap, offset = 0) {
  return (
    a.right + gap >= b.left + offset &&
    b.right + offset + gap >= a.left &&
    a.bottom + gap >= b.top &&
    b.bottom + gap >= a.top
  );
}

function pointSegmentDistanceSquared(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = dx * dx + dy * dy;
  const t = length
    ? Math.max(
        0,
        Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length),
      )
    : 0;
  return (p[0] - a[0] - dx * t) ** 2 + (p[1] - a[1] - dy * t) ** 2;
}

function cross(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function segmentsTooClose(a, b, c, d, gapSquared) {
  // Strict crossings need a separate check: neither endpoint has to be close.
  if (
    cross(a, b, c) * cross(a, b, d) < 0 &&
    cross(c, d, a) * cross(c, d, b) < 0
  )
    return true;
  return (
    Math.min(
      pointSegmentDistanceSquared(a, c, d),
      pointSegmentDistanceSquared(b, c, d),
      pointSegmentDistanceSquared(c, a, b),
      pointSegmentDistanceSquared(d, a, b),
    ) <= gapSquared
  );
}

function preparePolygon(poly) {
  return {
    poly,
    bounds: bounds(poly),
    edges: poly.map((a, index) => {
      const b = poly[(index + 1) % poly.length];
      return { a, b, bounds: bounds([a, b]) };
    }),
  };
}

function polygonsTooClose(a, b, width, gap) {
  const nearestOffset =
    Math.round(
      (a.bounds.left + a.bounds.right - b.bounds.left - b.bounds.right) /
        2 /
        width,
    ) * width;
  for (const offset of [
    nearestOffset - width,
    nearestOffset,
    nearestOffset + width,
  ]) {
    if (!nearbyBounds(a.bounds, b.bounds, gap, offset)) continue;
    const shifted = b.poly.map(([x, y]) => [x + offset, y]);
    if (
      pointInPolygon(a.poly[0][0], a.poly[0][1], shifted) ||
      pointInPolygon(shifted[0][0], shifted[0][1], a.poly)
    )
      return true;
    for (const edgeA of a.edges) {
      for (const edgeB of b.edges) {
        if (!nearbyBounds(edgeA.bounds, edgeB.bounds, gap, offset)) continue;
        if (
          segmentsTooClose(
            edgeA.a,
            edgeA.b,
            [edgeB.a[0] + offset, edgeB.a[1]],
            [edgeB.b[0] + offset, edgeB.b[1]],
            gap * gap,
          )
        )
          return true;
      }
    }
  }
  return false;
}

// Polygons use continuous, unwrapped longitudes. Check containment, crossing
// edges, touching coasts, and minimum water clearance in every relevant copy.
export function landPolygonsTooClose(a, b, width, gap = 0) {
  if (a.length < 3 || b.length < 3) return false;
  return polygonsTooClose(preparePolygon(a), preparePolygon(b), width, gap);
}

function area(poly) {
  return (
    Math.abs(
      poly.reduce((sum, a, index) => {
        const b = poly[(index + 1) % poly.length];
        return sum + a[0] * b[1] - b[0] * a[1];
      }, 0),
    ) / 2
  );
}

function wrap(x, width) {
  return ((x % width) + width) % width;
}

function longitudeDelta(x, origin, width) {
  return wrap(x - origin + width / 2, width) - width / 2;
}

function nearestRegion(regions, x, y, width) {
  let nearest = null;
  let best = Infinity;
  for (const region of regions) {
    const distance = Math.hypot(
      longitudeDelta(x, region.center.x, width),
      y - region.center.y,
    );
    if (distance < best) {
      best = distance;
      nearest = region;
    }
  }
  return nearest;
}

export function generateWorldMap(
  sourceLands,
  transform,
  { gap = 36, margin = 90, anchorages = [] } = {},
) {
  const { width, height } = transform;
  if (
    ![width, height, gap, margin].every(Number.isFinite) ||
    width <= gap * 2 ||
    height <= margin * 2 + gap * 2 ||
    gap < 0 ||
    margin < 0
  )
    throw new RangeError("World dimensions leave no room for separated land.");
  const regions = sourceLands.map((land, index) => {
    if (
      land.poly.length < 3 ||
      !land.poly.every((p) => p.length === 2 && p.every(Number.isFinite))
    )
      throw new TypeError(
        "Land requires a finite polygon with at least three vertices.",
      );
    land = { ...land, poly: land.poly.map((p) => [...p]) };
    const center = polygonCentroid(land.poly);
    const key = land.name || `islet-${index}`;
    const shape = land.poly.map(([x, y]) => {
      const offset = transform.regionOffset(x, y, key, center);
      return [offset.x, offset.y];
    });
    const size = area(shape);
    if (size <= 0) throw new TypeError("Land polygon must enclose an area.");
    const water = anchorages
      .filter((a) => a.land === land.name)
      .map((a) => ({
        offset: transform.regionOffset(a.x, a.y, key, center),
        radius: a.radius ?? 36,
      }));
    return { land, index, center, key, shape, size, water };
  });
  const continents = regions.filter((region) => region.land.name);
  const placed = [];
  // Keep large continents intact; smaller islands find nearby coastal water.
  const ordered = [...regions].sort(
    (a, b) => b.size - a.size || a.index - b.index,
  );
  for (const region of ordered) {
    let preferred = transform.regionPoint(
      region.center.x,
      region.center.y,
      region.key,
      region.center,
    );
    // Offshore islets travel with their source continent, forming coastal
    // chains instead of scattering independently across the ocean.
    if (!region.land.name) {
      const parent = nearestRegion(
        continents,
        region.center.x,
        region.center.y,
        transform.sourceWidth,
      );
      if (parent?.placement) {
        const offset = transform.regionOffset(
          parent.center.x +
            longitudeDelta(
              region.center.x,
              parent.center.x,
              transform.sourceWidth,
            ),
          region.center.y,
          parent.key,
          parent.center,
        );
        preferred = {
          x: parent.placement.origin.x + offset.x * parent.placement.scale,
          y: parent.placement.origin.y + offset.y * parent.placement.scale,
        };
      }
    }
    const shapeBounds = bounds(region.shape);
    let scale = Math.min(
      1,
      (width - gap * 2) / (shapeBounds.right - shapeBounds.left),
      (height - margin * 2 - gap * 2) / (shapeBounds.bottom - shapeBounds.top),
    );
    let placement = null;
    // Try the home position, then a local spiral, then the entire ocean.
    // Shrinking is a bounded fallback for crowded/custom worlds; never accept
    // a colliding candidate just because the search budget has run out.
    for (let pass = 0; pass < 12 && !placement; pass++, scale *= 0.82) {
      const tryPosition = (x, y) => {
        const origin = {
          x: wrap(x, width),
          y: Math.max(
            margin - shapeBounds.top * scale,
            Math.min(height - margin - shapeBounds.bottom * scale, y),
          ),
        };
        const poly = region.shape.map(([dx, dy]) => [
          origin.x + dx * scale,
          origin.y + dy * scale,
        ]);
        const candidate = preparePolygon(poly);
        const water = region.water.map((anchorage) =>
          preparePolygon(
            Array.from({ length: 16 }, (_, i) => {
              const angle = (i / 16) * Math.PI * 2;
              const radius = anchorage.radius / Math.cos(Math.PI / 16);
              return [
                origin.x +
                  anchorage.offset.x * scale +
                  Math.cos(angle) * radius,
                origin.y +
                  anchorage.offset.y * scale +
                  Math.sin(angle) * radius,
              ];
            }),
          ),
        );
        if (
          placed.some(
            (other) =>
              polygonsTooClose(candidate, other, width, gap) ||
              water.some((zone) => polygonsTooClose(zone, other, width, 0)) ||
              other.water.some((zone) =>
                polygonsTooClose(candidate, zone, width, 0),
              ),
          )
        )
          return false;
        placement = { ...candidate, origin, scale, water };
        return true;
      };
      if (tryPosition(preferred.x, preferred.y)) break;
      for (let step = 1; step <= 96 && !placement; step++) {
        const angle = step * 2.399963229728653;
        const radius = 42 * Math.sqrt(step);
        tryPosition(
          preferred.x + Math.cos(angle) * radius,
          preferred.y + Math.sin(angle) * radius,
        );
      }
      const spacing = Math.max(gap * 2, 80);
      for (let y = margin; y <= height - margin && !placement; y += spacing) {
        for (let x = 0; x < width && !placement; x += spacing)
          tryPosition(preferred.x + x, preferred.y + y - height / 2);
      }
    }
    if (!placement)
      throw new RangeError(
        "Cannot place all land with the requested sea clearance.",
      );
    region.placement = placement;
    placed.push(placement);
  }

  function point(x, y, landName) {
    let region = regions.find(
      (entry) => entry.land.name && entry.land.name === landName,
    );
    // Interior annotations belong to the actual outline, not the nearest
    // centroid (which can belong to an island across a bay).
    region ||= regions.find((entry) => pointInPolygon(x, y, entry.land.poly));
    region ||= nearestRegion(regions, x, y, transform.sourceWidth);
    if (!region) return transform.point(x, y);
    const sourceX =
      region.center.x +
      longitudeDelta(x, region.center.x, transform.sourceWidth);
    const offset = transform.regionOffset(
      sourceX,
      y,
      region.key,
      region.center,
    );
    return {
      x: wrap(
        region.placement.origin.x + offset.x * region.placement.scale,
        width,
      ),
      y: Math.max(
        margin,
        Math.min(
          height - margin,
          region.placement.origin.y + offset.y * region.placement.scale,
        ),
      ),
    };
  }
  return {
    lands: regions.map((region) => ({
      ...region.land,
      poly: region.placement.poly,
    })),
    point,
  };
}
