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
