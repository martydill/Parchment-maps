import { pointInPolygon } from "./geometry.js";

function randomSource(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

// A visual skin on the existing, unwrapped coastline. Authored navigation
// geometry stays fixed; both the chart plate and animated surf use this plan.
export function planShoreline(poly, seed, biome = "temperate") {
  if (poly.length < 3) return [];
  let area = 0;
  poly.forEach(([x, y], i) => {
    const next = poly[(i + 1) % poly.length];
    area += x * next[1] - next[0] * y;
  });
  const facing = Math.sign(area) || 1;
  const random = randomSource(seed);
  const segments = [];
  let distance = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    const previous = poly[(i - 1 + poly.length) % poly.length];
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    const length = Math.hypot(dx, dy);
    if (length < 0.01) continue;
    const tx = dx / length,
      ty = dy / length;
    const nx = ty * facing,
      ny = -tx * facing;
    const turn =
      ((a[0] - previous[0]) * dy - (a[1] - previous[1]) * dx) * facing;
    // Broad stretches stay coherent; tight concave coves favor broken stone.
    const variation = Math.sin((distance + length / 2) / 115 + seed * 0.73);
    let kind;
    if (biome === "marsh") kind = "marsh";
    else if (biome === "volcanic") kind = variation > 0.72 ? "rock" : "basalt";
    else if (biome === "alpine") kind = variation < -0.8 ? "sand" : "rock";
    else if (biome === "arid" || biome === "tropical")
      kind = variation < -0.72 && turn < 0 ? "rock" : "sand";
    else kind = variation > -0.15 && turn > -length * 7 ? "sand" : "rock";
    const samples = Math.max(1, Math.ceil(length / 18));
    for (let sample = 0; sample < samples; sample++) {
      const t = sample / samples,
        end = (sample + 1) / samples;
      const grain = random();
      segments.push({
        a: { x: a[0] + dx * t, y: a[1] + dy * t },
        b: { x: a[0] + dx * end, y: a[1] + dy * end },
        tx,
        ty,
        nx,
        ny,
        kind,
        grain,
        length: length / samples,
        phase: seed * 0.31 + (distance + length * t) / 43,
        shelf:
          kind === "sand"
            ? 42 + grain * 12
            : kind === "marsh"
              ? 22 + grain * 7
              : 14 + grain * 8,
      });
    }
    distance += length;
  }
  return segments;
}

// Rejection sampling confines sediment to the actual crown or mountain face.
// A bounded number of attempts also handles empty, thin, or degenerate shapes.
export function planPigmentGrains(poly, seed, count = 100) {
  if (poly.length < 3 || count <= 0) return [];
  const xs = poly.map(([x]) => x),
    ys = poly.map(([, y]) => y);
  const left = Math.min(...xs),
    top = Math.min(...ys);
  const width = Math.max(...xs) - left,
    height = Math.max(...ys) - top;
  if (width === 0 || height === 0) return [];
  const random = randomSource(seed);
  const grains = [];
  for (
    let attempt = 0;
    attempt < count * 5 && grains.length < count;
    attempt++
  ) {
    const u = random(),
      v = random();
    const x = left + u * width,
      y = top + v * height;
    if (!pointInPolygon(x, y, poly)) continue;
    const sediment = random();
    grains.push({
      x,
      y,
      radius: 0.22 + sediment * 0.65,
      alpha: 0.06 + v * 0.12 + sediment * 0.09,
      light: sediment > 0.78,
    });
  }
  return grains;
}

export function sampleShoreBreak(segment, time, roughness = 0) {
  if (segment.kind === "marsh") return null;
  const energy = Math.max(0, Math.min(1, roughness));
  if (segment.kind === "sand") {
    const cycle = (((time * 0.14 + segment.phase / (Math.PI * 2)) % 1) + 1) % 1;
    // A quick incoming sheet leaves a thin, slowly retreating water line.
    const retreat = cycle < 0.24 ? 1 - cycle / 0.24 : (cycle - 0.24) / 0.76;
    return {
      reach: 1 + retreat * (9 + energy * 3),
      alpha: Math.sin(cycle * Math.PI) * 0.52,
      spray: 0,
    };
  }
  const impact =
    Math.max(0, Math.sin(time * (1.7 + energy * 0.6) + segment.phase)) ** 4;
  return {
    reach: 2 + impact * (5 + energy * 5),
    alpha: impact * 0.72,
    spray: impact,
  };
}

export function shorelineCliffFaces(segments, depth) {
  if (depth <= 0) return [];
  return segments
    .filter((s) => s.ny > 0 && (s.kind === "rock" || s.kind === "basalt"))
    .map((s) => ({
      a: s.a,
      b: s.b,
      depth,
      kind: s.kind,
      normal: [s.nx, s.ny, 0],
      fissures: Array.from({ length: Math.floor(s.length / 7) }, (_, i) => ({
        x: s.a.x + s.tx * (i + 0.5) * 7,
        y: s.a.y + s.ty * (i + 0.5) * 7,
        variant: s.grain,
      })),
    }));
}

// Joined material areas replace per-segment border strokes. Average adjacent
// normals and vary the inland width slowly so subdivision never creates teeth.
export function shorelineMaterialRibbons(segments) {
  if (!segments.length) return [];
  const inner = segments.map((s, i) => {
    const previous = segments[(i - 1 + segments.length) % segments.length];
    let nx = previous.nx + s.nx,
      ny = previous.ny + s.ny;
    const length = Math.hypot(nx, ny);
    if (length < 0.001) {
      nx = s.nx;
      ny = s.ny;
    } else {
      nx /= length;
      ny /= length;
    }
    const base = s.kind === "sand" ? 13 : s.kind === "marsh" ? 17 : 8;
    const width =
      base *
      (1 + Math.sin(s.phase * 0.47) * 0.26 + Math.cos(s.phase * 0.19) * 0.14);
    return { x: s.a.x - nx * width, y: s.a.y - ny * width };
  });
  const runs = [];
  for (const [i, s] of segments.entries()) {
    let run = runs.at(-1);
    if (!run || run.kind !== s.kind) {
      run = { kind: s.kind, outer: [s.a], inner: [inner[i]] };
      runs.push(run);
    }
    run.outer.push(s.b);
    run.inner.push(inner[(i + 1) % segments.length]);
  }
  if (runs.length > 1 && runs[0].kind === runs.at(-1).kind) {
    const last = runs.pop(),
      first = runs[0];
    first.outer = [...last.outer, ...first.outer.slice(1)];
    first.inner = [...last.inner, ...first.inner.slice(1)];
  }
  return runs.map((run) => ({
    kind: run.kind,
    points: [...run.outer, ...run.inner.reverse()],
  }));
}
