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

export function resolveShoalAction({
  action,
  exposure,
  speed,
  seamanship = 0,
}) {
  const danger = clamp(exposure * 0.75 + speed / 260 - seamanship * 0.08, 0, 1);
  if (action === "soundings")
    return {
      outcome: "Soundings taken",
      description:
        "The leadsmen found a twisting channel and the vessel crept through.",
      componentDamage: danger > 0.72 ? { hull: 1 } : {},
      moraleChange: 1,
      speedMultiplier: 0.32,
      cargoLossRisk: 0,
    };
  if (action === "back-sails")
    return {
      outcome: "Backed clear",
      description:
        "The crew backed the sails and warped the vessel toward deeper water.",
      componentDamage: {},
      moraleChange: -1,
      speedMultiplier: 0,
      cargoLossRisk: 0,
    };
  const damage = Math.max(1, Math.round(2 + danger * 10));
  return {
    outcome: "Forced the passage",
    description:
      "The keel struck hard as the vessel forced a direct path across the bank.",
    componentDamage: {
      hull: damage,
      rudder: Math.ceil(damage * 0.45),
      fittings: Math.floor(damage * 0.35),
    },
    moraleChange: danger > 0.55 ? -7 : -3,
    speedMultiplier: 0.55,
    cargoLossRisk: danger * 0.3,
  };
}

export function resolveStormAction({
  action,
  roughness,
  stormResistance = 1,
  seamanship = 0,
}) {
  const danger = clamp(
    roughness / Math.max(0.5, stormResistance) - seamanship * 0.06,
    0,
    1,
  );
  if (action === "heave-to")
    return {
      outcome: "Hove to",
      description:
        "The ship rode out the worst of the squall under shortened canvas.",
      componentDamage: {
        hull: Math.max(1, Math.round(1 + danger * 3)),
        rigging: Math.max(1, Math.round(1 + danger * 2)),
      },
      moraleChange: 1,
      provisionsUsed: 1,
      daysLost: 1,
      speedMultiplier: 0,
    };
  if (action === "seek-lee")
    return {
      outcome: "Shelter found",
      description:
        "Careful piloting found a lee that spared the hull, though the detour cost time.",
      componentDamage: { rigging: Math.max(0, Math.round(danger * 2)) },
      moraleChange: 3,
      provisionsUsed: 2,
      daysLost: 2,
      speedMultiplier: 0.18,
    };
  const damage = Math.max(1, Math.round(2 + danger * 8));
  return {
    outcome: "Ran before the storm",
    description:
      "The vessel raced beneath dark canvas, preserving time at the cost of punishing strain.",
    componentDamage: {
      hull: Math.floor(damage * 0.45),
      rigging: damage,
      rudder: Math.floor(damage * 0.35),
    },
    moraleChange: danger > 0.55 ? -5 : 2,
    provisionsUsed: 0,
    daysLost: 0,
    speedMultiplier: 0.72,
  };
}
