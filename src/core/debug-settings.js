import {
  calculateShipStats,
  normalizeShipUpgradeState,
  SHIP_CLASSES,
} from "./upgrades.js";

export const DEFAULT_DEBUG_SETTINGS = {
  raiderStrength: "2",
  weather: "auto",
  arc: "auto",
  time: "auto",
  season: "auto",
  damage: "auto",
  paused: false,
};

// Validate stored selections against the current menu options so removed
// presets and malformed preferences cannot become scene overrides.
export function parseDebugSettings(serialized, choices) {
  let stored;
  try {
    stored = JSON.parse(serialized);
  } catch {
    stored = null;
  }
  const settings = { ...DEFAULT_DEBUG_SETTINGS };
  for (const field of Object.keys(choices)) {
    if (choices[field].includes(stored?.[field]))
      settings[field] = stored[field];
  }
  settings.paused = stored?.paused === true;
  return settings;
}

// Debug swaps bypass price and ownership requirements, but keep the manifest
// and fitted equipment intact. Only commit the new vessel if its hold fits.
export function setDebugShipClass(game, classId, cargoAboard = 0) {
  if (!Object.hasOwn(SHIP_CLASSES, classId))
    return { ok: false, reason: "Unknown ship class." };
  const candidate = normalizeShipUpgradeState({
    ...game.shipUpgrades,
    activeClass: classId,
  });
  if (calculateShipStats(candidate).holdMax < cargoAboard)
    return {
      ok: false,
      reason: "Unload cargo before changing to this ship class.",
    };
  game.shipUpgrades = candidate;
  return { ok: true, shipClass: SHIP_CLASSES[classId] };
}
