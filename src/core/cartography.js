import { clamp } from "./math.js";

// Wide, overlapping reveal bands avoid a sudden change of map vocabulary.
export function labelZoomOpacity(zoom, tier) {
  const bands = {
    sea: [0.55, 0.76],
    region: [0.72, 1.02],
    port: [0.88, 1.2],
    detail: [1.15, 1.46],
  };
  const [start, end] = bands[tier];
  const t = clamp((zoom - start) / (end - start), 0, 1);
  return t * t * (3 - 2 * t);
}

// A shallow parabola with a horizontal midpoint tangent, rotated as one
// landform. The center stays fixed as tracking or font metrics change.
export function letteringPoint(path, t) {
  const u = (t - 0.5) * path.span;
  const v = path.bend * (4 * (t - 0.5) ** 2);
  const cos = Math.cos(path.angle);
  const sin = Math.sin(path.angle);
  return {
    x: path.x + u * cos - v * sin,
    y: path.y + u * sin + v * cos,
    angle: path.angle + Math.atan2(8 * path.bend * (t - 0.5), path.span),
  };
}

// Place glyph centers by distance along the curve, rather than uniform t:
// wide letters and narrow letters retain the same optical tracking.
export function layoutPathGlyphs(widths, path) {
  if (!widths.length || path.span <= 0) return [];
  const samples = [{ ...letteringPoint(path, 0), distance: 0 }];
  for (let index = 1; index <= 64; index++) {
    const point = letteringPoint(path, index / 64);
    const previous = samples[index - 1];
    samples.push({
      ...point,
      distance:
        previous.distance +
        Math.hypot(point.x - previous.x, point.y - previous.y),
    });
  }
  const length = samples[64].distance;
  const inkWidth = widths.reduce((sum, width) => sum + width, 0);
  if (inkWidth > length) return [];
  const tracking =
    widths.length > 1 ? (length - inkWidth) / (widths.length - 1) : 0;
  let cursor = widths.length === 1 ? (length - inkWidth) / 2 : 0;
  return widths.map((width) => {
    const distance = cursor + width / 2;
    cursor += width + tracking;
    let index = 1;
    while (index < 64 && samples[index].distance < distance) index++;
    const before = samples[index - 1].distance;
    const fraction = (distance - before) / (samples[index].distance - before);
    return letteringPoint(path, (index - 1 + fraction) / 64);
  });
}

// Follow the long axis of the actual island, while keeping lettering upright.
export function regionalLettering(poly, center) {
  let xx = 0,
    yy = 0,
    xy = 0;
  for (const [x, y] of poly) {
    xx += (x - center.x) ** 2;
    yy += (y - center.y) ** 2;
    xy += (x - center.x) * (y - center.y);
  }
  const angle = clamp(Math.atan2(2 * xy, xx - yy) / 2, -0.5, 0.5);
  const along = poly.map(
    ([x, y]) =>
      (x - center.x) * Math.cos(angle) + (y - center.y) * Math.sin(angle),
  );
  return {
    ...center,
    angle,
    span: clamp((Math.max(...along) - Math.min(...along)) * 0.58, 100, 620),
    bend: -8,
  };
}
