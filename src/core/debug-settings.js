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
