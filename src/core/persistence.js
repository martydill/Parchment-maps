export const SAVE_VERSION = 1;

export function createSaveData({
  game,
  ship,
  merchants,
  worldEvents,
  exploredMap,
  gameStarted,
}) {
  return {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    game,
    ship,
    merchants,
    worldEvents,
    exploredMap,
    gameStarted,
  };
}

export function serializeSave(data) {
  return JSON.stringify(data);
}

export function parseSave(serialized) {
  if (!serialized) return null;

  try {
    const data = JSON.parse(serialized);
    if (
      !data ||
      data.version !== SAVE_VERSION ||
      typeof data.game !== "object" ||
      typeof data.ship !== "object" ||
      !Array.isArray(data.merchants) ||
      typeof data.worldEvents !== "object" ||
      typeof data.gameStarted !== "boolean"
    )
      return null;
    return data;
  } catch {
    return null;
  }
}
