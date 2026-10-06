// Map space is lit from the northwest and above. Keep this direction shared
// by the cached terrain and ports and the moving ship models.
export const LIGHT_DIRECTION = Object.freeze({ x: -0.55, y: -0.45, z: 0.7 });
export const LIGHTING_SECONDS_PER_CYCLE = 72;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(start, end, value) {
  const t = clamp01((value - start) / (end - start));
  return t * t * (3 - 2 * t);
}

export function normalizeTimeOfDay(value) {
  return Number.isFinite(value) ? ((value % 1) + 1) % 1 : 0.5;
}

export function advanceTimeOfDay(value, seconds) {
  return normalizeTimeOfDay(
    normalizeTimeOfDay(value) +
      Math.max(0, Number.isFinite(seconds) ? seconds : 0) /
        LIGHTING_SECONDS_PER_CYCLE,
  );
}

// Midnight is 0, sunrise is 0.25, noon is 0.5, sunset is 0.75.
export function sceneLighting(timeOfDay = 0.5, roughness = 0, day = 1) {
  const time = normalizeTimeOfDay(timeOfDay);
  const seas = Math.max(0, Number(roughness) || 0);
  const storm = smoothstep(0.2, 0.48, seas);
  const daylight =
    smoothstep(0.19, 0.32, time) * (1 - smoothstep(0.68, 0.81, time));
  const sunrise =
    smoothstep(0.17, 0.26, time) * (1 - smoothstep(0.29, 0.4, time));
  const sunset =
    smoothstep(0.61, 0.72, time) * (1 - smoothstep(0.76, 0.85, time));
  const night = 1 - daylight;
  const moonCycle = (((Math.floor(Number(day) || 1) - 1) % 8) + 8) % 8;
  const moon =
    0.32 + (0.68 * (1 + Math.cos((moonCycle / 8) * Math.PI * 2))) / 2;
  return {
    time,
    daylight,
    night,
    sunrise,
    sunset,
    dusk: Math.max(sunrise, sunset),
    storm,
    moon,
    stars: smoothstep(0.55, 0.94, night) * (1 - storm * 0.8),
    strength: (0.34 + daylight * 0.66) * (1 - storm * 0.34),
  };
}

// Shared relief lighting for ship faces, masonry, and raised coastlines. A
// stronger diffuse response separates sunlit planes from their shaded sides.
export function litPigment(color, normal, lighting = sceneLighting()) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  const length = Math.hypot(...normal);
  const diffuse =
    Number.isFinite(length) && length > 0
      ? clamp01(
          (normal[0] * LIGHT_DIRECTION.x +
            normal[1] * LIGHT_DIRECTION.y +
            normal[2] * LIGHT_DIRECTION.z) /
            length,
        )
      : 0;
  const light = 0.68 + diffuse * 0.62 * lighting.strength;
  const tint = [
    1 + lighting.dusk * 0.08 - lighting.storm * 0.08,
    1 - lighting.dusk * 0.01 - lighting.storm * 0.04,
    1 - lighting.dusk * 0.09 + lighting.storm * 0.06,
  ];
  const channels = [1, 3, 5].map((offset, index) =>
    Math.min(
      255,
      Math.round(
        parseInt(color.slice(offset, offset + 2), 16) * light * tint[index],
      ),
    ),
  );
  return `rgb(${channels.join(",")})`;
}

export function nightSightLimit(lighting, weatherVisibilityKm) {
  const weather = Math.max(0, Number(weatherVisibilityKm) || 0);
  const nocturnal = 1.7 + lighting.moon * 1.6;
  return Math.min(
    weather,
    weather * lighting.daylight + nocturnal * lighting.night,
  );
}

export function timeOfDayLabel(lighting) {
  if (lighting.sunrise > 0.42) return "Sunrise";
  if (lighting.sunset > 0.42) return "Sunset";
  if (lighting.daylight > 0.72) return "Daylight";
  return "Night";
}
