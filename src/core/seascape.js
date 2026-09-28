import { clamp, nearestWrapped } from "./math.js";

export function coastFaceDepth(index, satellite = false) {
  return satellite ? 13 + (index % 4) * 3 : 31 + (index % 6) * 5;
}

export function sampleCreatureAppearance(time, index) {
  const cycle = 18;
  const phase = (((time / 1000 + index * 3.7 + 2) % cycle) + cycle) % cycle;
  if (phase >= 6) return { rise: 0, phase };
  return { rise: Math.sin((phase / 6) * Math.PI) ** 1.3, phase };
}

export function sampleCoastalBird(time, flockIndex, birdIndex) {
  const orbit = time * 0.42 + flockIndex * 1.79;
  const rank = Math.ceil(birdIndex / 2);
  const side = birdIndex % 2 ? -1 : 1;
  return {
    x: Math.cos(orbit) * 18 - rank * 12 + Math.sin(time * 0.8 + birdIndex) * 3,
    y: Math.sin(orbit) * 11 + side * rank * 7,
    wing: Math.sin(time * 7 + flockIndex * 1.9 + birdIndex * 0.65),
    size: 8 - rank * 0.7,
  };
}

// Presentation-only motion, sampled in seconds. No simulation state or random
// numbers: a vessel's pose is independent of frame rate and world wrapping.
export function sampleShipMotion({
  time = 0,
  seed = 0,
  roughness = 0,
  windStrength = 0,
  speed = 0,
  anchored = false,
  reducedMotion = false,
} = {}) {
  const t = reducedMotion ? 0 : time;
  const sea = clamp(roughness, 0, 1);
  const wind = clamp(windStrength / 0.22, 0, 1);
  const underway = anchored ? 0 : clamp(speed / 150, 0, 1);
  const amplitude = reducedMotion
    ? 0
    : (0.25 + sea * 0.75) * (anchored ? 0.35 : 1);
  const phase = seed * 2.399963;
  const swell = Math.sin(t * 1.65 + phase);
  return {
    heave: amplitude * (swell * 1.6 + Math.sin(t * 2.7 + phase) * 0.35),
    roll: amplitude * Math.sin(t * 1.4 + phase + 0.7) * 0.075,
    pitch: amplitude * Math.cos(t * 1.65 + phase) * (0.035 + underway * 0.025),
    billow:
      (0.45 + wind * 1.55) * (1 + Math.sin(t * 2.1 + phase) * amplitude * 0.18),
    flutter: Math.sin(t * 8 + phase) * amplitude * (0.3 + wind * 0.7),
    wake: underway,
  };
}

// Newest point first. Resolve every point against its predecessor so a wake
// follows a turn across the first meridian without a line across the chart.
export function buildWakeRibbon(trail, time, worldWidth) {
  const sections = [];
  let previousX = trail[0]?.x ?? 0;
  for (const point of trail) {
    const age = (time - point.time) / 1000;
    if (age < 0 || age >= 5) continue;
    const x = nearestWrapped(point.x, previousX, worldWidth);
    previousX = x;
    const strength = Number.isFinite(point.strength)
      ? clamp(point.strength, 0, 1)
      : 1;
    sections.push({
      x,
      y: point.y,
      seed: point.time * 0.001,
      width: (2 + age * 5.5) * (0.45 + strength * 0.55),
      alpha: (1 - age / 5) ** 2 * 0.48 * strength,
    });
  }
  return sections;
}
