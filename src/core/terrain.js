import { pointInPolygon } from "./geometry.js";
import { LAND_NAMES } from "../names.js";

const regionalBiomes = new Map([
  ...[
    LAND_NAMES.thrymmSpires,
    LAND_NAMES.rimevault,
    LAND_NAMES.drazhmark,
    LAND_NAMES.stormvaneCrown,
  ].map((name) => [name, "alpine"]),
  ...[LAND_NAMES.veyrAshreach, LAND_NAMES.sivvynIsle].map((name) => [
    name,
    "volcanic",
  ]),
  ...[
    LAND_NAMES.verdantate,
    LAND_NAMES.eoslynKeys,
    LAND_NAMES.vesprynKeys,
    LAND_NAMES.lazulynAtolls,
    LAND_NAMES.kavrelChain,
  ].map((name) => [name, "tropical"]),
  [LAND_NAMES.lunemire, "marsh"],
  [LAND_NAMES.orynthSteppe, "arid"],
]);

export function terrainBiome(name) {
  return regionalBiomes.get(name) || "temperate";
}

function randomSource(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function polygonArea(poly) {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(sum) / 2;
}

function closestCoast(poly, point) {
  let closest = null;
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const lengthSquared = dx * dx + dy * dy || 1;
    const t = Math.max(
      0,
      Math.min(
        1,
        ((point.x - a[0]) * dx + (point.y - a[1]) * dy) / lengthSquared,
      ),
    );
    const x = a[0] + dx * t;
    const y = a[1] + dy * t;
    const distance = Math.hypot(x - point.x, y - point.y);
    if (distance < best) {
      best = distance;
      closest = { x, y };
    }
  }
  return { point: closest, distance: best };
}

export function planLandTerrain(poly, seed, mountainous = false) {
  const empty = {
    ranges: [],
    hills: [],
    rivers: [],
    tributaries: [],
    plains: [],
  };
  if (poly.length < 3) return empty;
  const random = randomSource(seed);
  const xs = poly.map((point) => point[0]);
  const ys = poly.map((point) => point[1]);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const width = Math.max(...xs) - left;
  const height = Math.max(...ys) - top;
  const area = polygonArea(poly);
  const sample = (margin) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const x = left + random() * width;
      const y = top + random() * height;
      if (!pointInPolygon(x, y, poly)) continue;
      if (closestCoast(poly, { x, y }).distance < margin) continue;
      return { x, y };
    }
    return null;
  };

  const ranges = [];
  const ridgeAngle = random() * Math.PI;
  const rangeCount = mountainous
    ? area > 110000
      ? 2
      : 1
    : area > 240000
      ? 1
      : 0;
  for (let i = 0; i < rangeCount; i++) {
    const center = sample(35);
    if (!center) continue;
    const angle = ridgeAngle + (random() - 0.5) * 0.55;
    const span = Math.min(260, Math.max(65, Math.min(width, height) * 0.5));
    const peaks = [];
    for (let step = -3; step <= 3; step++) {
      const along =
        (step / 3) * span * 0.5 +
        (random() - 0.5) * span * 0.02 * Math.abs(step);
      const across =
        Math.sin(step * 0.85) * span * 0.13 +
        (random() - 0.5) * 7 * Math.abs(step);
      const x = center.x + Math.cos(angle) * along - Math.sin(angle) * across;
      const y = center.y + Math.sin(angle) * along + Math.cos(angle) * across;
      if (pointInPolygon(x, y, poly)) {
        const size = Math.min(
          17 + random() * 19,
          closestCoast(poly, { x, y }).distance * 0.65,
        );
        if (size >= 10) peaks.push({ x, y, size });
      }
    }
    ranges.push({ center, angle, span, peaks });
  }

  const hills = [];
  const hillCount = Math.min(
    20,
    Math.floor(area / (mountainous ? 18000 : 12500)),
  );
  for (let i = 0; i < hillCount; i++) {
    const point = sample(18);
    if (point) hills.push({ ...point, size: 18 + random() * 22 });
  }

  const rivers = [];
  const tributaries = [];
  const riverCount = area > 45000 ? (area > 210000 ? 2 : 1) : 0;
  for (let i = 0; i < riverCount; i++) {
    const source = ranges[i]?.center || sample(45);
    if (!source) continue;
    const coast = closestCoast(poly, source);
    if (coast.distance < 45) continue;
    const dx = coast.point.x - source.x;
    const dy = coast.point.y - source.y;
    const length = Math.hypot(dx, dy);
    const bend = (random() - 0.5) * Math.min(70, length * 0.35);
    const points = [source];
    // The disk bounded by the nearest coastline is entirely inland. These
    // control points stay in that disk, including their smoothed river curve.
    for (const t of [0.2, 0.4, 0.6, 0.8]) {
      const meander = Math.sin(t * Math.PI * 2) * bend;
      points.push({
        x: source.x + dx * t - (dy / length) * meander,
        y: source.y + dy * t + (dx / length) * meander,
      });
    }
    rivers.push([...points, coast.point]);
    const side = i % 2 === 0 ? 1 : -1;
    // Join at an actual point on the quadratic curve used by the renderer.
    const join = {
      x: (points[2].x + points[3].x) / 2,
      y: (points[2].y + points[3].y) / 2,
    };
    tributaries.push([
      {
        x: source.x + dx * 0.12 - dy * 0.32 * side,
        y: source.y + dy * 0.12 + dx * 0.32 * side,
      },
      {
        x: source.x + dx * 0.3 - dy * 0.18 * side,
        y: source.y + dy * 0.3 + dx * 0.18 * side,
      },
      join,
    ]);
  }

  const plains = [];
  const plainCount = Math.min(90, Math.floor(area / 5000));
  for (let i = 0; i < plainCount; i++) {
    const point = sample(12);
    if (!point) continue;
    if (
      ranges.some(
        (range) =>
          Math.hypot(point.x - range.center.x, point.y - range.center.y) < 75,
      )
    )
      continue;
    plains.push({ ...point, angle: (random() - 0.5) * 0.35 });
  }

  return { ranges, hills, rivers, tributaries, plains };
}

// Artwork is planned in an island's unwrapped coordinate system. Translating
// the island and its clearings translates every mark without changing its art.
export function planTerrainIllustration(
  poly,
  seed,
  { mountainous = false, biome = "temperate", clearings = [] } = {},
) {
  const terrain = planLandTerrain(poly, seed, mountainous);
  const result = { ...terrain, biome, ridges: [], groves: [] };
  if (poly.length < 3 || polygonArea(poly) < 300) return result;
  const random = randomSource(seed + 7919);
  const clear = (point, radius) =>
    clearings.every(
      (zone) =>
        ((point.x - zone.x) / (zone.rx + radius)) ** 2 +
          ((point.y - zone.y) / (zone.ry + radius)) ** 2 >
        1,
    );
  const inland = (point, radius) =>
    pointInPolygon(point.x, point.y, poly) &&
    closestCoast(poly, point).distance >= radius &&
    clear(point, radius);

  // Preserve the geographic relief, but leave cartographic lettering and
  // harbor approaches free of tall silhouettes and ridge hatching.
  result.ranges = terrain.ranges.map((range) => ({
    ...range,
    peaks: range.peaks.filter((peak) => clear(peak, peak.size * 1.2)),
  }));
  result.hills = terrain.hills.filter((hill) => inland(hill, hill.size * 1.2));
  result.plains = terrain.plains.filter((plain) => inland(plain, 16));
  for (const range of result.ranges) {
    for (let i = 1; i < range.peaks.length; i++) {
      const a = range.peaks[i - 1],
        b = range.peaks[i];
      const width = Math.min(a.size, b.size) * 0.55;
      const steps = Math.max(
        2,
        Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6),
      );
      const spine = Array.from({ length: steps + 1 }, (_, j) => ({
        x: a.x + ((b.x - a.x) * j) / steps,
        y: a.y + ((b.y - a.y) * j) / steps,
      }));
      if (spine.every((point) => inland(point, width)))
        result.ridges.push({ a, b, width });
    }
  }

  // Dry and ash-covered regions get dunes/scree instead of evergreen symbols.
  if (biome === "arid" || biome === "volcanic") return result;
  const xs = poly.map(([x]) => x),
    ys = poly.map(([, y]) => y);
  const left = Math.min(...xs),
    top = Math.min(...ys);
  const width = Math.max(...xs) - left,
    height = Math.max(...ys) - top;
  const peaks = result.ranges.flatMap((range) => range.peaks);
  const trees = [];
  const waterways = [...terrain.rivers, ...terrain.tributaries];
  const byRiver = (point, margin) =>
    waterways.some((river) =>
      river.slice(1).some((b, i) => {
        const a = river[i],
          dx = b.x - a.x,
          dy = b.y - a.y;
        const t = Math.max(
          0,
          Math.min(
            1,
            ((point.x - a.x) * dx + (point.y - a.y) * dy) /
              (dx * dx + dy * dy || 1),
          ),
        );
        return (
          Math.hypot(point.x - a.x - dx * t, point.y - a.y - dy * t) < margin
        );
      }),
    );
  const count = Math.min(9, Math.floor(polygonArea(poly) / 18000));
  for (let groveIndex = 0; groveIndex < count; groveIndex++) {
    const radius = 26 + random() * 35;
    let center = null;
    for (let attempt = 0; attempt < 50; attempt++) {
      const point = { x: left + random() * width, y: top + random() * height };
      if (
        !inland(point, 20) ||
        result.groves.some(
          (grove) =>
            Math.hypot(point.x - grove.x, point.y - grove.y) <
            radius + grove.radius * 0.6,
        )
      )
        continue;
      center = point;
      break;
    }
    if (!center) continue;
    const grove = { ...center, radius, trees: [] };
    for (let attempt = 0; attempt < 100 && grove.trees.length < 28; attempt++) {
      const angle = random() * Math.PI * 2;
      const distance = Math.sqrt(random()) * radius;
      const size = 7 + random() * 7;
      const point = {
        x: center.x + Math.cos(angle) * distance,
        y: center.y + Math.sin(angle) * distance * 0.7,
      };
      if (
        !inland(point, size * 1.5) ||
        byRiver(point, size + 5) ||
        peaks.some(
          (peak) =>
            Math.hypot(point.x - peak.x, point.y - peak.y) <
            peak.size * 1.6 + size,
        ) ||
        trees.some(
          (tree) =>
            Math.hypot(point.x - tree.x, point.y - tree.y) <
            (tree.size + size) * 0.55,
        )
      )
        continue;
      const tree = { ...point, size, variant: random() };
      grove.trees.push(tree);
      trees.push(tree);
    }
    if (grove.trees.length) result.groves.push(grove);
  }
  return result;
}
