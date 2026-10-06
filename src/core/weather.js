function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function angularDifference(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

export function weatherAppearance({
  name = "",
  roughness = 0,
  visibilityKm,
} = {}) {
  const lower = String(name).toLowerCase();
  const sea = Number.isFinite(roughness) ? roughness : 0;
  const storm = clamp((sea - 0.2) / 0.28, 0, 1);
  let nameFog = 0;
  if (/mist/.test(lower)) nameFog = 0.62;
  if (/fog/.test(lower)) nameFog = Math.max(nameFog, 0.82);
  if (/haze/.test(lower)) nameFog = Math.max(nameFog, 0.26);
  const visFog = Number.isFinite(visibilityKm)
    ? clamp((7.5 - visibilityKm) / 5.5, 0, 1)
    : 0;
  return {
    storm,
    fog: Math.max(nameFog, visFog),
    cloud: clamp(
      (/(cloud|overcast|haze)/.test(lower) ? 0.5 : 0) + storm * 0.6,
      0,
      1,
    ),
    rain: clamp(storm + (/rain/.test(lower) ? 0.4 : 0), 0, 1),
    lightning: clamp((storm - 0.45) / 0.2, 0, 1),
  };
}

function smooth(start, end, value) {
  const t = clamp((value - start) / (end - start), 0, 1);
  return t * t * (3 - 2 * t);
}

// Visual fronts follow the voyage's existing weather cycle. Clouds lead the
// rain on approach, rain stops first on departure, and sunlight breaks through
// lingering cloud. All channels meet continuously at pattern boundaries.
export function sampleWeatherFront(patterns, progress = 0) {
  if (!Array.isArray(patterns) || !patterns.length)
    return {
      ...weatherAppearance(),
      phase: "fair",
      sunbreak: 0,
      seaDarkness: 0,
    };
  const cycle = Number.isFinite(progress) ? progress : 0;
  const segment = Math.floor(cycle);
  const index =
    ((segment % patterns.length) + patterns.length) % patterns.length;
  const t = cycle - segment;
  const from = weatherAppearance(patterns[index] ?? {});
  const to = weatherAppearance(patterns[(index + 1) % patterns.length] ?? {});
  const incoming = to.storm > from.storm;
  const outgoing = to.storm < from.storm;
  const blend = (a, b, response) => a + (b - a) * response;
  const storm = blend(from.storm, to.storm, smooth(0.05, 0.95, t));
  const cloud = blend(
    Math.max(from.cloud, from.storm * 0.95),
    Math.max(to.cloud, to.storm * 0.95),
    incoming
      ? smooth(0, 0.7, t)
      : outgoing
        ? smooth(0.35, 1, t)
        : smooth(0, 1, t),
  );
  const rain = blend(
    from.rain,
    to.rain,
    incoming
      ? smooth(0.42, 0.95, t)
      : outgoing
        ? smooth(0, 0.65, t)
        : smooth(0, 1, t),
  );
  const lightning = blend(
    from.lightning,
    to.lightning,
    incoming
      ? smooth(0.7, 1, t)
      : outgoing
        ? smooth(0, 0.42, t)
        : smooth(0, 1, t),
  );
  const fog = blend(from.fog, to.fog, smooth(0, 1, t));
  const sunbreak = outgoing
    ? smooth(0.2, 0.6, t) *
      (1 - smooth(0.8, 1, t)) *
      (from.storm - to.storm) *
      (1 - fog * 0.5)
    : 0;
  return {
    phase:
      storm > 0.75
        ? "storm"
        : incoming && to.storm > 0.2
          ? "approaching"
          : outgoing && from.storm > 0.2
            ? "clearing"
            : fog > 0.55
              ? "fog"
              : "fair",
    storm,
    cloud,
    rain,
    lightning,
    fog,
    sunbreak,
    seaDarkness: clamp(storm * 0.8 + cloud * 0.22, 0, 1),
  };
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
    front: baseWeather?.front,
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
