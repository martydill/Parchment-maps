function noise(seed, edge, sample, channel) {
  const wave =
    Math.sin(
      seed * 12.9898 + edge * 78.233 + sample * 37.719 + channel * 19.913,
    ) * 43758.5453;
  return wave - Math.floor(wave);
}

function catmullRom(a, b, c, d, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * b +
      (-a + c) * t +
      (2 * a - 5 * b + 4 * c - d) * t2 +
      (-a + 3 * b - 3 * c + d) * t3)
  );
}

/**
 * Breaks long outline edges into broad, asymmetric bays and headlands before
 * fine coastline detail is applied. Authored vertices remain fixed so the
 * intended geography and nearby port placements are preserved.
 */
export function continentalCoast(poly, seed, relief = 1) {
  if (poly.length < 3) return poly.map((point) => [...point]);

  const shaped = [];
  for (let edge = 0; edge < poly.length; edge++) {
    const start = poly[edge];
    const end = poly[(edge + 1) % poly.length];
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    const samples = Math.max(2, Math.min(6, Math.ceil(length / 105)));
    const phase = noise(seed, edge, 0, 4) * Math.PI * 2;
    const bias = (noise(seed, edge, 0, 5) - 0.5) * 0.9;

    for (let sample = 0; sample < samples; sample++) {
      const t = sample / samples;
      const envelope = Math.sin(Math.PI * t);
      const shelf =
        Math.sin(t * Math.PI * 2 + phase) * 0.68 +
        Math.sin(t * Math.PI * 4 - phase * 0.7) * 0.24 +
        bias;
      const displacement =
        shelf * Math.min(72, length * 0.2) * relief * envelope;
      shaped.push([
        start[0] + dx * t + nx * displacement,
        start[1] + dy * t + ny * displacement,
      ]);
    }
  }
  return shaped;
}

/**
 * Adds deterministic bays and headlands to a closed, hand-authored outline.
 * The curve passes through every source vertex while rounding the hard corners
 * between them.
 */
export function ruggedCoast(poly, seed, roughness = 1) {
  if (poly.length < 3) return poly.map((point) => [...point]);

  const detailed = [];
  for (let edge = 0; edge < poly.length; edge++) {
    const previous = poly[(edge - 1 + poly.length) % poly.length];
    const start = poly[edge];
    const end = poly[(edge + 1) % poly.length];
    const next = poly[(edge + 2) % poly.length];
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    const samples = Math.max(4, Math.min(11, Math.ceil(length / 38)));
    const phase = noise(seed, edge, 0, 0) * Math.PI * 2;

    for (let sample = 0; sample < samples; sample++) {
      const t = sample / samples;
      const envelope = Math.sin(Math.PI * t);
      const broad = Math.sin(t * Math.PI * 2 + phase) * 0.62;
      const inlet = (noise(seed, edge, sample, 1) - 0.5) * 0.76;
      const ripple = Math.sin(t * Math.PI * 5 + phase * 1.7) * 0.18;
      const displacement =
        (broad + inlet + ripple) *
        Math.min(32, length * 0.13) *
        roughness *
        envelope;
      const x = catmullRom(previous[0], start[0], end[0], next[0], t);
      const y = catmullRom(previous[1], start[1], end[1], next[1], t);
      detailed.push([x + nx * displacement, y + ny * displacement]);
    }
  }
  return detailed;
}
