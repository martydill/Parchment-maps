import { clamp } from "./math.js";

// The storm narrative arc. Weather fronts already interpolate continuously
// between patterns (see sampleWeatherFront); the arc turns those channels
// into a readable story — the sky darkens in distinct grades, the swell rises
// ahead of the squall, seabirds clear out, the crew scrambles, lightning
// builds from distant sheet flickers into a rising strike cadence, and then
// the front breaks into gold light and leaves a watercolor rainbow.
//
// Everything here is a pure function of the weather front, so arcs stay
// deterministic across saves and require no persisted state.

const EMPTY_FRONT = {
  storm: 0,
  cloud: 0,
  rain: 0,
  lightning: 0,
  fog: 0,
  sunbreak: 0,
};

export const STORM_ARC_STAGES = [
  "fair",
  "gathering",
  "brewing",
  "tempest",
  "breaking",
  "afterglow",
];

// Per-grade darkening washes. Quantized so each step reads as a decision —
// "the sky just dropped another grade" — instead of a slow smear.
export const SKY_GRADE_INK = [0, 0.075, 0.15, 0.24, 0.34];
// Lower build bound of sky grades 1..4.
const SKY_GRADE_BUILD = [0.14, 0.36, 0.58, 0.8];

function clamp01(value) {
  return clamp(Number.isFinite(value) ? value : 0, 0, 1);
}

function smooth(start, end, value) {
  const t = clamp01((value - start) / (end - start));
  return t * t * (3 - 2 * t);
}

export function stormArc({ front, roughness = 0 } = {}) {
  const f = front ?? EMPTY_FRONT;
  const storm = clamp01(f.storm);
  const cloud = clamp01(f.cloud);
  const rain = clamp01(f.rain);
  const lightning = clamp01(f.lightning);
  const fog = clamp01(f.fog);
  const sunbreak = clamp01(f.sunbreak);
  // Cloud banks lead the rain on approach, so a cloud-and-storm mix rises
  // well before the squall itself arrives: the arc's leading edge. Local sea
  // roughness nudges the build so squall waters join the same story.
  const build = clamp01(
    cloud * 0.68 + storm * 0.55 + clamp01(roughness) * 0.08,
  );
  let grade = 0;
  for (let index = SKY_GRADE_BUILD.length - 1; index >= 0; index -= 1) {
    if (build >= SKY_GRADE_BUILD[index]) {
      grade = index + 1;
      break;
    }
  }
  // Long swells run ahead of the wind — the navigator's classic telegraph.
  const swell = clamp01(cloud * 1.05 + storm * 0.4);
  // Seabirds shelter before the front arrives and return as it dissolves.
  const birds = clamp01(1 - smooth(0.34, 0.62, build));
  const crew = smooth(0.6, 0.85, build);
  // Distant sheet lightning while the cell is brewing; real strikes take
  // over as the storm matures, and the cadence between them tightens.
  const flicker = smooth(0.36, 0.55, build) * (1 - lightning);
  const strikeIntensity = clamp01(Math.max(lightning, (build - 0.55) / 0.45));
  const cadence = Number((2.3 + (1 - strikeIntensity) * 6.4).toFixed(2));
  // The break: gold floods through first, then the rainbow arches over the
  // wake once the rain has thinned and the storm is clearly dying.
  const rainbow = clamp01(
    sunbreak * 1.5 * (1 - smooth(0.3, 0.55, storm)) - rain * 1.8 - fog * 1.2,
  );
  const gold = clamp01(sunbreak * 1.45 * (1 - rainbow * 0.55) - rain * 0.35);
  const stage =
    rainbow > 0.25
      ? "afterglow"
      : gold > 0.32
        ? "breaking"
        : storm > 0.72
          ? "tempest"
          : build > 0.36
            ? "brewing"
            : build > 0.14
              ? "gathering"
              : "fair";
  return {
    stage,
    grade,
    build,
    swell,
    birds,
    crew,
    flicker,
    cadence,
    gold,
    rainbow,
    ink: SKY_GRADE_INK[grade],
  };
}

// Front channels representative of each stage, for scene previews and the
// debug menu. Pure fixtures: no dependence on weather patterns or progress.
const STAGE_FIXTURES = {
  fair: { storm: 0, cloud: 0.04, rain: 0, lightning: 0, sunbreak: 0, fog: 0 },
  gathering: {
    storm: 0.12,
    cloud: 0.3,
    rain: 0,
    lightning: 0,
    sunbreak: 0,
    fog: 0,
  },
  brewing: {
    storm: 0.28,
    cloud: 0.55,
    rain: 0.12,
    lightning: 0,
    sunbreak: 0,
    fog: 0,
  },
  tempest: {
    storm: 0.95,
    cloud: 1,
    rain: 0.9,
    lightning: 0.9,
    sunbreak: 0,
    fog: 0,
  },
  breaking: {
    storm: 0.5,
    cloud: 0.7,
    rain: 0.3,
    lightning: 0.2,
    sunbreak: 0.85,
    fog: 0,
  },
  afterglow: {
    storm: 0.12,
    cloud: 0.4,
    rain: 0.02,
    lightning: 0,
    sunbreak: 0.9,
    fog: 0,
  },
};

export function stormArcForStage(stage) {
  return stormArc({ front: STAGE_FIXTURES[stage] ?? STAGE_FIXTURES.fair });
}
