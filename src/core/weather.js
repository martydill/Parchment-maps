function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function angularDifference(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function weatherPatch(position, angle, day = 1, voyageDistance = 0) {
  const x = position?.x || 0;
  const y = position?.y || 0;
  const phase = day * 0.37 + voyageDistance * 0.0011;
  const drift = x * 0.0027 - y * 0.0034 + phase;
  const bandA = Math.sin(drift + Math.cos(angle * 1.7 + phase) * 1.2);
  const bandB = Math.cos(x * 0.0015 + y * 0.0021 - angle * 2.4 + phase * 1.6);
  const bankAngle = Math.atan2(
    Math.sin(y * 0.004 + phase * 1.9),
    Math.cos(x * 0.003 - phase * 1.3),
  );
  const bank = Math.cos(angularDifference(angle, bankAngle));
  return clamp(bandA * 0.48 + bandB * 0.32 + bank * 0.55, -1, 1);
}

export function localWeatherAtBearing({
  baseWeather,
  position,
  angle,
  day = 1,
  voyageDistance = 0,
  horizonKm = Infinity,
}) {
  const baseVisibilityKm = Math.max(
    0.5,
    baseWeather?.visibilityKm ?? horizonKm,
  );
  const patch = weatherPatch(position, angle, day, voyageDistance);
  const patchy = clamp((10 - baseVisibilityKm) / 8, 0.15, 1);
  const visibilityScale = clamp(1 + patch * patchy * 0.42, 0.45, 1.45);
  return {
    name: baseWeather?.name || "Fair",
    visibilityKm: Math.min(horizonKm, baseVisibilityKm * visibilityScale),
    roughness: clamp((baseWeather?.roughness || 0) - patch * 0.08, 0, 1),
    patch,
  };
}

export function directionalVisibilityRadius({
  baseWeather,
  position,
  angle,
  day,
  voyageDistance,
  horizonKm,
  worldUnitsPerKm,
}) {
  return (
    localWeatherAtBearing({
      baseWeather,
      position,
      angle,
      day,
      voyageDistance,
      horizonKm,
    }).visibilityKm * worldUnitsPerKm
  );
}
