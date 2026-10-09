import { normalizeTimeOfDay } from "./lighting.js";

export const SHADOW_PHASES = [0.23, 0.4, 0.6, 0.77];

export function mountainShadowSun(phase) {
  const progress = (phase - 0.23) / 0.54;
  return {
    x: -Math.cos(progress * Math.PI),
    y: 0.35,
    length: 1.1 + Math.abs(progress - 0.5) * 5,
  };
}

export function mountainShadowBlend(timeOfDay, daylight = 1, storm = 0) {
  const time = normalizeTimeOfDay(timeOfDay);
  let from = 0;
  while (from < SHADOW_PHASES.length - 2 && time > SHADOW_PHASES[from + 1])
    from++;
  const to = from + 1;
  const mix = Math.max(
    0,
    Math.min(
      1,
      (time - SHADOW_PHASES[from]) / (SHADOW_PHASES[to] - SHADOW_PHASES[from]),
    ),
  );
  const alpha =
    Math.max(0, Math.min(1, daylight)) *
    (1 - Math.max(0, Math.min(1, storm)) * 0.75);
  return [
    { bucket: from, alpha: alpha * (1 - mix) },
    { bucket: to, alpha: alpha * mix },
  ];
}
