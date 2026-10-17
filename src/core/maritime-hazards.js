import { clamp, wrappedDelta } from "./math.js";

export function createMaritimeHazardState() {
  return {
    lastStormCycle: -1,
    lastStormDay: -1_000_000_000,
    lastShoalDistance: -1_000_000_000,
    encounters: 0,
  };
}

export function normalizeMaritimeHazardState(value) {
  const fresh = createMaritimeHazardState();
  if (!value || typeof value !== "object") return fresh;
  return {
    lastStormCycle: Math.floor(
      Number(value.lastStormCycle ?? fresh.lastStormCycle),
    ),
    lastStormDay: Number.isFinite(Number(value.lastStormDay))
      ? Math.floor(Number(value.lastStormDay))
      : fresh.lastStormDay,
    lastShoalDistance: Number.isFinite(Number(value.lastShoalDistance))
      ? Number(value.lastShoalDistance)
      : fresh.lastShoalDistance,
    encounters: Math.max(0, Math.floor(Number(value.encounters ?? 0))),
  };
}

export function currentAtPosition(
  position,
  currents,
  worldWidth,
  radius = 230,
) {
  let x = 0;
  let y = 0;
  let strength = 0;
  let label = null;
  for (const [currentX, currentY, angle, name] of currents) {
    const dx = wrappedDelta(currentX, position.x, worldWidth);
    const dy = currentY - position.y;
    const distance = Math.hypot(dx, dy);
    if (distance >= radius) continue;
    const influence = 1 - distance / radius;
    const localStrength = influence * influence;
    x += Math.cos(angle) * localStrength;
    y += Math.sin(angle) * localStrength;
    if (localStrength > strength) {
      strength = localStrength;
      label = name;
    }
  }
  return { x, y, strength, label };
}

export function shoalAtPosition(position, shoals, worldWidth) {
  let nearest = null;
  for (const [shoalX, shoalY, radiusX, radiusY, name] of shoals) {
    const dx = wrappedDelta(shoalX, position.x, worldWidth);
    const dy = shoalY - position.y;
    const exposure = 1 - Math.hypot(dx / radiusX, dy / radiusY);
    if (exposure > 0 && (!nearest || exposure > nearest.exposure))
      nearest = {
        name: name || "Unmarked shallows",
        exposure: clamp(exposure, 0, 1),
      };
  }
  return nearest;
}

export function roughSeaAtPosition(position, seas, worldWidth) {
  let nearest = null;
  for (const [index, sea] of seas.entries()) {
    const dx = wrappedDelta(sea.x, position.x, worldWidth);
    const dy = sea.y - position.y;
    const exposure = 1 - Math.hypot(dx / sea.rx, dy / sea.ry);
    if (exposure > 0 && (!nearest || exposure > nearest.exposure))
      nearest = {
        index,
        exposure: clamp(exposure, 0, 1),
        strength: sea.strength || 1,
      };
  }
  return nearest;
}

export function hazardAhead({
  position,
  heading,
  distance,
  shoals,
  roughSeas,
  worldWidth,
  iceAt,
}) {
  for (let step = 0; step <= 8; step++) {
    const ahead = (distance * step) / 8;
    const point = {
      x: position.x + Math.cos(heading) * ahead,
      y: position.y + Math.sin(heading) * ahead,
    };
    if (iceAt?.(point).exposure >= 0.12)
      return { type: "ice", name: "Drifting sea ice", distance: ahead };
    const shoal = shoalAtPosition(point, shoals, worldWidth);
    if (shoal && shoal.exposure >= 0.12)
      return { type: "shoal", name: shoal.name, distance: ahead };
    const storm = roughSeaAtPosition(point, roughSeas, worldWidth);
    if (storm && storm.exposure >= 0.25)
      return { type: "storm", name: "Squall waters", distance: ahead };
  }
  return null;
}

export function resolveUnderwayHazard({
  type,
  exposure,
  speed,
  seamanship = 0,
  stormResistance = 1,
}) {
  if (type === "shoal") {
    if (exposure < 0.4 || speed <= 45) return null;
    const severity = clamp(
      exposure * 0.7 + speed / 200 - seamanship * 0.08,
      0,
      1,
    );
    return {
      outcome: "Grounded on a shoal",
      componentDamage: {
        hull: Math.max(1, Math.round(severity * 9)),
        rudder: Math.max(1, Math.round(severity * 4)),
      },
      moraleChange: -3,
      speedMultiplier: 0.2,
      cargoLossRisk: severity * 0.22,
    };
  }
  if (type !== "storm" || exposure < 0.55 || speed <= 95) return null;
  const severity = clamp(
    (exposure * speed) / (150 * Math.max(0.5, stormResistance)) -
      seamanship * 0.06,
    0,
    1,
  );
  return {
    outcome: "Squall struck the sails",
    componentDamage: {
      rigging: Math.max(1, Math.round(severity * 10)),
      hull: Math.max(0, Math.round(severity * 3)),
    },
    moraleChange: -2,
    speedMultiplier: 0.58,
    cargoLossRisk: severity * 0.15,
  };
}

export function stormCycle(day, voyageDistance, interval = 2200) {
  return Math.floor(((day - 1) * 620 + voyageDistance) / interval);
}

export function shouldTriggerStorm(
  hazardState,
  { day, voyageDistance, roughness, minRoughness = 0.52, cooldownDays = 3 },
) {
  const state = normalizeMaritimeHazardState(hazardState);
  const cycle = stormCycle(day, voyageDistance);
  return (
    roughness >= minRoughness &&
    cycle > state.lastStormCycle &&
    day - state.lastStormDay >= cooldownDays
  );
}

export function markHazardEncounter(
  hazardState,
  { type, cycle, voyageDistance, day },
) {
  const next = normalizeMaritimeHazardState(hazardState);
  next.encounters += 1;
  if (type === "storm") {
    next.lastStormCycle = cycle;
    const encounterDay = Number(day);
    if (Number.isFinite(encounterDay))
      next.lastStormDay = Math.max(next.lastStormDay, Math.floor(encounterDay));
  }
  if (type === "shoal") next.lastShoalDistance = voyageDistance;
  return next;
}
