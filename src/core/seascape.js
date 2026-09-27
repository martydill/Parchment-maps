import { clamp, nearestWrapped } from "./math.js";

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
    sections.push({
      x,
      y: point.y,
      width: 2 + age * 5.5,
      alpha: (1 - age / 5) ** 2 * 0.48,
    });
  }
  return sections;
}
