// Reference noon light for static chart engraving and older lighting callers.
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

// The sun crosses the northern sky from east to west. Elevation and bearing
// vary continuously, including at midnight; low sun produces long shadows.
export function solarGeometry(timeOfDay = 0.5) {
  const angle = (normalizeTimeOfDay(timeOfDay) - 0.25) * Math.PI * 2;
  const elevation = Math.max(0, Math.sin(angle));
  const x = Math.cos(angle) - 0.55 * elevation;
  const y = -0.45;
  const z = 0.16 + elevation * 0.54;
  const length = Math.hypot(x, y, z);
  const horizontal = Math.hypot(x, y);
  return {
    sunDirection: { x: x / length, y: y / length, z: z / length },
    shadow: {
      x: -x / horizontal,
      y: -y / horizontal,
      length: Math.min(4.5, horizontal / z),
    },
  };
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
  const solar = solarGeometry(time);
  return {
    sunDirection: solar.sunDirection,
    shadow: {
      ...solar.shadow,
      strength: daylight * (1 - storm * 0.85),
    },
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
  const direction = lighting.sunDirection ?? LIGHT_DIRECTION;
  const diffuse =
    Number.isFinite(length) && length > 0
      ? clamp01(
          (normal[0] * direction.x +
            normal[1] * direction.y +
            normal[2] * direction.z) /
            length,
        )
      : 0;
  const light =
    0.68 - lighting.night * 0.16 + diffuse * 0.62 * lighting.strength;
  const warm = lighting.dusk * diffuse * (1 - lighting.storm);
  const cool = lighting.dusk * (1 - diffuse) * (1 - lighting.storm * 0.5);
  const tint = [
    1 +
      warm * 0.28 -
      cool * 0.13 -
      lighting.storm * 0.08 -
      lighting.night * 0.08,
    1 + warm * 0.04 - cool * 0.03 - lighting.storm * 0.04,
    1 -
      warm * 0.24 +
      cool * 0.2 +
      lighting.storm * 0.06 +
      lighting.night * 0.08,
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

// Screen-space falloff follows the ship's world-space surroundings, with a
// readable minimum at chart zoom. Weather compresses the middle distance.
export function lightingHierarchy(zoom = 1, lighting = sceneLighting()) {
  const scale = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const sharpRadius = Math.max(110, 230 * scale);
  const washRadius = Math.max(300, 680 * scale) * (1 - lighting.storm * 0.16);
  return {
    sharpRadius,
    washRadius: Math.max(sharpRadius + 100, washRadius),
    washOpacity: 0.76 + lighting.storm * 0.12,
    pigmentOpacity: 0.16 + lighting.storm * 0.08,
    amber: lighting.night * (1 - lighting.storm * 0.25),
  };
}

export function timeOfDayLabel(lighting) {
  if (lighting.sunrise > 0.42) return "Sunrise";
  if (lighting.sunset > 0.42) return "Sunset";
  if (lighting.daylight > 0.72) return "Daylight";
  return "Night";
}
