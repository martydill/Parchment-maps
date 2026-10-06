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
  const orbit = time * (0.24 + (flockIndex % 4) * 0.07) + flockIndex * 1.79;
  const rank = Math.ceil(birdIndex / 2);
  const side = birdIndex % 2 ? -1 : 1;
  const formation = flockIndex % 4;
  const spread =
    formation === 0
      ? [rank * -10, side * rank * 7]
      : formation === 1
        ? [birdIndex * -8, Math.sin(birdIndex * 1.8) * 9]
        : formation === 2
          ? [Math.cos(birdIndex * 2.4) * 15, Math.sin(birdIndex * 2.4) * 10]
          : [birdIndex * -9, side * 4 + birdIndex * 2];
  return {
    x: Math.cos(orbit) * 18 + spread[0] + Math.sin(time * 0.8 + birdIndex) * 3,
    y: Math.sin(orbit) * 11 + spread[1],
    wing: Math.sin(time * 7 + flockIndex * 1.9 + birdIndex * 0.65),
    size: 8 - (birdIndex % 4) * 0.45,
  };
}

export function coastalFlockSize(index) {
  return 3 + ((index * 7 + Math.floor(index / 3)) % 6);
}

export function sampleLighthouse(time, index) {
  return {
    angle: time * (0.00028 + (index % 5) * 0.00011) + index * 2.4,
    reach: 135 + (index % 4) * 38,
  };
}

// Broken reflection bands share a deterministic clock, with wider distortion
// and less coherent light on rough water. Call with zero time for reduced motion.
export function sampleWaterReflection(time = 0, index = 0, roughness = 0) {
  const t = Number.isFinite(time) ? time : 0;
  const row = Number.isFinite(index) ? index : 0;
  const sea = Number.isFinite(roughness) ? clamp(roughness, 0, 1) : 0;
  const phase = row * 2.399963;
  return {
    offset: Math.sin(t * 1.8 + phase) * (1.2 + sea * 3.8),
    width: 0.55 + (Math.sin(t * 1.1 + phase) + 1) * 0.2,
    alpha: (0.42 + (Math.sin(t * 1.5 + phase) + 1) * 0.29) * (1 - sea * 0.55),
  };
}

export function sampleSeaLife(time, index) {
  const phase = (((time + index * 2.7) % 22) + 22) % 22;
  const visible = phase < 11;
  return {
    visible,
    x: Math.sin(time * 0.18 + index * 1.7) * 34,
    y: Math.cos(time * 0.13 + index) * 12,
    swim: Math.sin(time * 3.1 + index * 2),
    opacity: visible ? Math.min(1, phase / 1.5, (11 - phase) / 1.5) : 0,
  };
}

export function sampleShoreAnimal(time, index) {
  const phase = time * (0.18 + (index % 3) * 0.06) + index * 1.9;
  return {
    x: Math.sin(phase) * 15,
    y: Math.cos(phase * 0.7) * 4,
    step: Math.sin(phase * 8),
    facing: Math.cos(phase) >= 0 ? 1 : -1,
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
