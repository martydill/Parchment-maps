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

// Screen-space presentation profiles. The port index is stable across saves
// and wrapped world copies; none of these variations need persisted state.
const LIGHTHOUSE_PROFILES = [
  // kind, reach, beam half-angle, radians/ms, bloom, RGB, beam count
  ["lens", 245, 0.065, 0.00013, 30, "255,230,185", 1],
  ["flame", 62, 0, 0, 25, "255,151,67", 0],
  ["lens", 195, 0.32, 0.000032, 36, "255,211,146", 1],
  ["lens", 82, 0.18, -0.00018, 19, "208,235,231", 1],
  ["lens", 275, 0.095, 0.000095, 32, "211,227,255", 2],
  ["flame", 44, 0, 0, 19, "255,178,91", 0],
  ["lantern", 110, 0.25, 0, 24, "255,218,175", 1],
  ["lens", 170, 0.14, -0.00025, 27, "237,224,255", 1],
];

// Includes the maximum profile variation, bloom and flame/ember footprint.
export const MAX_LIGHTHOUSE_REACH = 320;

export function sampleLighthouse(time = 0, index = 0) {
  const t = Number.isFinite(time) ? time : 0;
  const id = Number.isFinite(index) ? Math.abs(Math.trunc(index)) : 0;
  const [kind, range, width, speed, bloom, color, beams] =
    LIGHTHOUSE_PROFILES[id % LIGHTHOUSE_PROFILES.length];
  const fraction = (value) => value - Math.floor(value);
  const seed = fraction(Math.sin(id * 127.1 + 4.7) * 43758.5453);
  const phase = id * 2.399963;
  const flame = kind === "flame";
  const flicker =
    Math.sin(t * 0.0071 + phase) * 0.09 +
    Math.sin(t * 0.0173 + phase * 1.7) * 0.05;
  return {
    kind,
    angle: t * speed * (0.85 + seed * 0.3) + phase,
    reach: range * (0.88 + seed * 0.24),
    beamWidth: width * (0.85 + seed * 0.3),
    rotationSpeed: speed * (0.85 + seed * 0.3),
    glowRadius: bloom * (0.9 + seed * 0.2),
    lampRadius: 2.1 + seed * 0.9,
    color,
    beams,
    intensity: flame
      ? 0.9 + flicker
      : 0.94 + Math.sin(t * 0.0007 + phase) * 0.06,
    flameHeight: 8 + seed * 4 + flicker * 12,
    sway: Math.sin(t * 0.0043 + phase) * 1.5,
    ember: fraction(t * 0.00027 + seed),
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
  swell = 0,
} = {}) {
  const t = reducedMotion ? 0 : time;
  const sea = clamp(roughness, 0, 1);
  const wind = clamp(windStrength / 0.22, 0, 1);
  const underway = anchored ? 0 : clamp(speed / 150, 0, 1);
  // A building storm arc sends long swells ahead of the front, so the hull
  // starts working before the local sea state actually roughens.
  const arcSwell = clamp(Number.isFinite(swell) ? swell : 0, 0, 1);
  const amplitude = reducedMotion
    ? 0
    : (0.25 + sea * 0.75) * (1 + arcSwell * 0.9) * (anchored ? 0.35 : 1);
  const phase = seed * 2.399963;
  const swellWave = Math.sin(t * 1.65 + phase);
  // One slow pressure envelope drives every wind-sensitive material. Keep it
  // separate from hull swell, so pennants still catch gusts while at anchor.
  const gust = reducedMotion
    ? 0
    : wind *
      (Math.sin(t * 1.1 + phase) * 0.7 + Math.sin(t * 2.3 + phase) * 0.3);
  return {
    heave:
      amplitude *
      (swellWave * 1.6 +
        Math.sin(t * 2.7 + phase) * 0.35 +
        Math.sin(t * 0.55 + phase) * arcSwell * 0.8),
    roll: amplitude * Math.sin(t * 1.4 + phase + 0.7) * 0.075,
    pitch: amplitude * Math.cos(t * 1.65 + phase) * (0.035 + underway * 0.025),
    gust,
    billow: (0.45 + wind * 1.55) * (1 + gust * 0.16),
    flutter: reducedMotion
      ? 0
      : Math.sin(t * 8 + phase) * wind * (0.45 + gust * 0.2),
    spray: wind * (0.55 + gust * 0.35),
    wake: underway,
  };
}

// Scrambling deck crew. Figures hurry between the rail and the mast as a
// squall builds, each appearing one by one and keeping a stable patrol so the
// scramble reads as work rather than jitter. Presentation only: deterministic
// in (time, index, intensity), no simulation state.
export function sampleDeckCrew(time, index, intensity = 0) {
  const t = Number.isFinite(time) ? time : 0;
  const level = clamp(Number.isFinite(intensity) ? intensity : 0, 0, 1);
  const id = Number.isFinite(index) ? Math.abs(Math.trunc(index)) : 0;
  if (level <= 0.05) return { along: 0, side: 1, step: 0, alpha: 0 };
  const station = -0.3 + (id % 4) * 0.13;
  const patrol = 0.07 + (id % 3) * 0.03;
  const cycle = Math.sin(t * (1.4 + level * 1.6) + id * 1.79);
  return {
    along: station + cycle * patrol,
    side: id % 2 ? 1 : -1,
    step: Math.sin(t * (7 + level * 5) + id * 2.3),
    alpha: clamp((level - 0.12 - id * 0.14) * 1.6, 0, 1),
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
