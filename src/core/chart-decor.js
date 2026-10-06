// Deterministic generators for the hand-inked chart furniture baked into the
// world map layer: the portolan rhumb web, Catalan wind roses, coastal
// toponymy, the leagues scale bar, and the physical wear of a surviving
// parchment (foxing, tidelines, wax drips, fold creases, tattered edges).
// Everything here is pure math so the canvas work in rendering.js stays thin.

const TAU = Math.PI * 2;

function seeded(initialSeed) {
  let t = initialSeed + 0x6d2b79f5;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// The classical Mediterranean winds, clockwise from north, as inked around
// the great compass roses of Catalan charts.
export const WIND_ROSE_NAMES = Object.freeze([
  { label: "TRAMONTANA", angle: -Math.PI / 2 },
  { label: "GRECO", angle: -Math.PI / 4 },
  { label: "LEVANTE", angle: 0 },
  { label: "SCIROCCO", angle: Math.PI / 4 },
  { label: "OSTRO", angle: Math.PI / 2 },
  { label: "LIBECCIO", angle: (3 * Math.PI) / 4 },
  { label: "PONENTE", angle: Math.PI },
  { label: "MAESTRO", angle: (-3 * Math.PI) / 4 },
]);

// Rhumb lines alternate between two inks on period charts — vermillion on the
// principal bearings, viridian between them (Benincasa's convention).
export function rhumbInk(index) {
  return index % 2 === 0
    ? { color: "146,44,34", major: true }
    : { color: "44,98,66", major: false };
}

export function rhumbRayAngles(points = 16) {
  if (!Number.isInteger(points) || points < 4 || points > 64) return [];
  return Array.from(
    { length: points },
    (_, index) => -Math.PI / 2 + (index * TAU) / points,
  );
}

function wrappedSeparation(x1, x2, width) {
  const direct = Math.abs(x1 - x2);
  return Math.hypot(Math.min(direct, width - direct), 0);
}

// Choose hidden rhumb centers on open water. The visible compass roses are
// passed in as anchors; period charts scatter additional "blind" centers so
// the bearing lattice covers the whole sea.
export function createRhumbWeb(
  {
    width,
    height,
    margin = 120,
    anchors = [],
    count = 9,
    minRadius = 1900,
    maxRadius = 3000,
    minSeparation = 560,
  },
  isSea,
  seed,
) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    margin * 2 >= height
  )
    return [];
  const rng = seeded(seed);
  const centers = anchors.map(([x, y]) => ({
    x,
    y,
    major: true,
    radius: maxRadius,
  }));
  let guard = 0;
  while (centers.length < anchors.length + count && guard++ < 500) {
    const x = rng() * width;
    const y = margin + rng() * (height - margin * 2);
    if (!isSea(x, y)) continue;
    const separated = centers.every(
      (center) =>
        wrappedSeparation(x, center.x, width) >= minSeparation * 0.6 ||
        Math.abs(y - center.y) >= minSeparation * 0.35,
    );
    if (!separated) continue;
    centers.push({
      x,
      y,
      major: false,
      radius: minRadius + rng() * (maxRadius - minRadius),
    });
  }
  return centers;
}

// The 16 principal bearings of a rose, starting at north.
export function roseTickPoints(radius, points = 32) {
  if (radius <= 0) return [];
  return Array.from({ length: points }, (_, index) => {
    const angle = -Math.PI / 2 + (index * TAU) / points;
    const reach =
      index % 8 === 0
        ? radius
        : index % 4 === 0
          ? radius * 0.78
          : index % 2 === 0
            ? radius * 0.55
            : radius * 0.34;
    return [Math.cos(angle) * reach, Math.sin(angle) * reach];
  });
}

// Estimate the local coastline direction around a coastal point by comparing
// the land and water halves of a sample ring. Returns null when the point is
// not on a recognizable shore (open water or deep inland).
export function coastAspect(isLandAt, x, y, probe = 42) {
  if (!(probe > 0)) return null;
  let landX = 0;
  let landY = 0;
  let seaX = 0;
  let seaY = 0;
  let landCount = 0;
  const rays = 16;
  for (let index = 0; index < rays; index += 1) {
    const angle = (index * TAU) / rays;
    const px = x + Math.cos(angle) * probe;
    const py = y + Math.sin(angle) * probe;
    if (isLandAt(px, py)) {
      landX += Math.cos(angle);
      landY += Math.sin(angle);
      landCount += 1;
    } else {
      seaX += Math.cos(angle);
      seaY += Math.sin(angle);
    }
  }
  if (landCount === 0 || landCount === rays) return null;
  const towardSea = Math.atan2(seaY - landY, seaX - landX);
  let angle = towardSea + Math.PI / 2;
  // Keep chart text upright: labels never run upside-down along the coast.
  let flipped = false;
  while (angle > Math.PI / 2) {
    angle -= Math.PI;
    flipped = true;
  }
  while (angle <= -Math.PI / 2) {
    angle += Math.PI;
    flipped = true;
  }
  return {
    angle,
    flipped,
    seaward: { x: Math.cos(towardSea), y: Math.sin(towardSea) },
  };
}

// Portolan toponymy: red ink and a shield box for the ports that matter to
// merchants, plain black for minor landings.
export function portChartLabel(port, illustrated) {
  const major = Boolean(port?.home) || Boolean(illustrated);
  return major ? { tone: "red", boxed: true } : { tone: "black", boxed: false };
}

// Torn, deckled north and south sheet edges. Points sweep the edge left to
// right; rare deep "bites" suggest where the skin failed outright.
export function tatteredEdge(seed, { maxDepth = 16, biteDepth = 26 } = {}) {
  const rng = seeded(seed);
  const points = [{ u: 0, depth: maxDepth * 0.55 }];
  let u = 0.008;
  while (u < 0.99) {
    points.push({ u, depth: 2 + rng() * maxDepth * 0.5 });
    if (rng() < 0.08) {
      const bite = biteDepth * (0.55 + rng() * 0.45);
      points.push({ u: u + 0.004, depth: bite * 0.5 });
      points.push({ u: u + 0.01, depth: bite });
      points.push({ u: u + 0.02, depth: Math.min(maxDepth, bite * 0.4) });
      u += 0.02;
    }
    u += 0.004 + rng() * 0.012;
  }
  points.push({ u: 1, depth: maxDepth * 0.55 });
  return points;
}

export function edgeDepthAt(points, u) {
  if (!points.length) return 0;
  const clamped = Math.max(0, Math.min(1, u));
  let previous = points[0];
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    if (point.u >= clamped) {
      const span = point.u - previous.u;
      const t = span > 0 ? (clamped - previous.u) / span : 1;
      return previous.depth + (point.depth - previous.depth) * t;
    }
    previous = point;
  }
  return previous.depth;
}

// Foxing: rusty fungal speckle clusters that bloom on old skin, densest in
// the damp margins.
export function foxingClusters(seed, anchors) {
  const rng = seeded(seed);
  return anchors.map(({ x, y, spread }) => {
    const speckles = [];
    const count = 7 + Math.floor(rng() * 12);
    for (let index = 0; index < count; index += 1) {
      const angle = rng() * TAU;
      const distance = Math.abs(rng() + rng() - 1) * spread;
      speckles.push({
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance * 0.8,
        r: 0.6 + rng() * 2.6,
        alpha: 0.05 + rng() * 0.16,
      });
    }
    return { x, y, speckles };
  });
}

// Water damage leaves tide-stain rings: wobbly concentric contours with a
// darker rim where the moisture repeatedly dried.
export function tidelines({ width, height }, seed, count) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    return [];
  const rng = seeded(seed);
  return Array.from({ length: count }, () => {
    const base = 60 + rng() * 150;
    return {
      x: width * (0.12 + rng() * 0.76),
      y: height * (0.12 + rng() * 0.76),
      rings: [base, base * (1.3 + rng() * 0.3), base * (1.7 + rng() * 0.5)],
      lobes: 7 + Math.floor(rng() * 5),
      wobble: 0.06 + rng() * 0.09,
      rotation: rng() * TAU,
    };
  });
}

export function tidelineRingPoints(
  centerX,
  centerY,
  radius,
  lobes,
  wobble,
  rotation,
) {
  if (radius <= 0 || lobes < 3) return [];
  const steps = Math.max(24, lobes * 8);
  return Array.from({ length: steps + 1 }, (_, index) => {
    const angle = rotation + (index / steps) * TAU;
    const r =
      radius *
      (1 +
        wobble * Math.sin(angle * lobes) +
        wobble * 0.5 * Math.cos(angle * (lobes + 3)));
    return [centerX + Math.cos(angle) * r, centerY + Math.sin(angle) * r];
  });
}

// Candle wax fell on the chart at some point in its life.
export function waxDrops({ width, height }, seed, count) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    return [];
  const rng = seeded(seed);
  return Array.from({ length: count }, () => ({
    x: width * (0.08 + rng() * 0.84),
    y: height * (0.08 + rng() * 0.84),
    r: 5 + rng() * 11,
    alpha: 0.1 + rng() * 0.08,
  }));
}

// A rolled chart carries one vertical fold from storage plus a soft diagonal
// crease where it was once half-opened on a cabin table.
export function foldCreases(width, height, seed) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    return [];
  const rng = seeded(seed);
  return [
    {
      x0: width * (0.31 + rng() * 0.08),
      y0: 0,
      cx: width * (0.35 + rng() * 0.06),
      cy: height * (0.4 + rng() * 0.2),
      x1: width * (0.29 + rng() * 0.08),
      y1: height,
    },
    {
      x0: width * (0.66 + rng() * 0.1),
      y0: height * (0.1 + rng() * 0.2),
      cx: width * (0.5 + rng() * 0.2),
      cy: height * (0.55 + rng() * 0.1),
      x1: width * (0.72 + rng() * 0.12),
      y1: height,
    },
  ];
}

// The leagues ladder every chart carries in a framed box.
export function scaleBarSpec({ width, height }) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    return null;
  const segment = 42;
  const segments = 8;
  const barWidth = segment * segments;
  // Beneath the title cartouche in the northwestern sea, where a new voyage
  // begins and the chartmaker's tools cluster together.
  return {
    x: width * 0.045,
    y: height * 0.13,
    segment,
    segments,
    total: 400,
    values: [0, 200, 400],
    caption: "LEAGUES",
    width: barWidth,
    height: 34,
  };
}

// Occasional islands receive a wash of hand-mixed pigment, the way late
// chartmakers tinted Crete green and Cyprus red.
const ISLAND_PIGMENTS = [
  "rgba(126,88,60,.12)",
  "rgba(104,116,80,.12)",
  "rgba(128,78,66,.11)",
  "rgba(94,104,122,.10)",
];

export function islandTint(name, index) {
  if (!name || index % 3 !== 0) return null;
  let hash = index * 31;
  for (const character of String(name))
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return ISLAND_PIGMENTS[hash % ISLAND_PIGMENTS.length];
}

// The chartmaker's signature line beneath the title.
export function cartoucheInscription(homePort, seed = 7) {
  const rng = seeded(seed);
  const phrases = [
    `set down at ${homePort} for the Guild of the Open Sea`,
    `drawn at ${homePort} and corrected from many voyages`,
    `composed at ${homePort}, pilot of the encircling world`,
  ];
  return phrases[Math.floor(rng() * phrases.length) % phrases.length];
}
