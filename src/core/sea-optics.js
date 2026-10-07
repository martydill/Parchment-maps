import { clamp } from "./math.js";

// Screen fractions shared by the sky disc and its reflection on the chart.
export function celestialPosition(kind, lighting = {}) {
  if (kind === "moon") return { x: 0.76, y: 0.19 };
  const sunrise = lighting.sunrise ?? 0;
  const sunset = lighting.sunset ?? 0;
  const twilight = sunrise + sunset;
  return {
    x: twilight > 0.01 ? (0.64 * sunrise + 0.38 * sunset) / twilight : 0.38,
    y: 0.28,
  };
}

export function seaLightSources(lighting = {}) {
  const daylight = lighting.daylight ?? 1;
  const dusk = Math.max(lighting.sunrise ?? 0, lighting.sunset ?? 0);
  const transmission = 1 - (lighting.storm ?? 0) * 0.8;
  return [
    {
      kind: "sun",
      ...celestialPosition("sun", lighting),
      strength: (daylight * 0.1 + dusk * 0.055) * transmission,
      warm: dusk > 0.2,
    },
    {
      kind: "moon",
      ...celestialPosition("moon", lighting),
      strength:
        (lighting.night ?? 0) * (lighting.moon ?? 0.32) * 0.085 * transmission,
      warm: false,
    },
  ];
}

// A narrow source opens toward the viewer; rough seas scatter the corridor.
export function glitterCorridor(source, depth, roughness = 0) {
  const d = clamp(depth, 0, 1);
  const sea = clamp(roughness, 0, 1);
  return {
    x: source.x + (0.5 - source.x) * d,
    y: source.y + (1.12 - source.y) * d,
    width: (0.012 + d ** 1.35 * 0.19) * (1 + sea * 0.8),
    intensity:
      Math.sin(Math.PI * Math.min(1, d * 1.15)) ** 0.45 * (1 - sea * 0.35),
  };
}

export function shallowLightStrength(lighting = {}) {
  return (
    ((lighting.daylight ?? 1) * 0.46 +
      (lighting.night ?? 0) * (lighting.moon ?? 0.32) * 0.12) *
    (1 - (lighting.storm ?? 0) * 0.85)
  );
}

// Neighboring hexagons share the same deformation. Integer longitude waves
// make the lace continuous across the atlas seam, even while it breathes.
export function causticPoint(x, y, time, worldWidth) {
  const phase =
    ((((x % worldWidth) + worldWidth) % worldWidth) / worldWidth) * Math.PI * 2;
  return {
    x:
      x +
      Math.sin(phase * 37 + y * 0.047 + time * 0.7) * 4 +
      Math.cos(phase * 53 - y * 0.031 - time * 0.43) * 2,
    y:
      y +
      Math.cos(phase * 29 + y * 0.053 - time * 0.61) * 4 +
      Math.sin(phase * 43 + y * 0.027 + time * 0.37) * 2,
  };
}
