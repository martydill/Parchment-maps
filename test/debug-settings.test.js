import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_DEBUG_SETTINGS,
  parseDebugSettings,
} from "../src/core/debug-settings.js";

const choices = {
  raiderStrength: ["1", "2", "3"],
  weather: ["auto", "Clear", "Heavy storm"],
  arc: ["auto", "gathering", "brewing", "tempest", "breaking", "afterglow"],
  time: ["auto", "0.25", "0.5", "0.73", "0"],
  season: ["auto", "1", "25", "49", "73", "83"],
  damage: ["auto", "sound", "frayed", "worn", "holed", "critical", "patched"],
};

test("missing, malformed, and non-object preferences use defaults", () => {
  for (const serialized of [
    null,
    undefined,
    "",
    "{invalid",
    "null",
    "false",
    "42",
    '"weather"',
    "[]",
    "{}",
  ]) {
    assert.deepEqual(
      parseDebugSettings(serialized, choices),
      DEFAULT_DEBUG_SETTINGS,
    );
  }
});

test("all current selections survive serialization, including night and pause", () => {
  const settings = {
    raiderStrength: "3",
    weather: "Heavy storm",
    arc: "afterglow",
    time: "0",
    season: "83",
    damage: "patched",
    paused: true,
  };
  assert.deepEqual(
    parseDebugSettings(JSON.stringify(settings), choices),
    settings,
  );
  for (const [field, values] of Object.entries(choices)) {
    for (const value of values) {
      assert.deepEqual(
        parseDebugSettings(JSON.stringify({ [field]: value }), choices),
        { ...DEFAULT_DEBUG_SETTINGS, [field]: value },
      );
    }
  }
});

test("invalid and removed selections fall back independently", () => {
  for (const invalid of ["removed", 0, 1, true, false, null, [], {}]) {
    const settings = Object.fromEntries(
      Object.keys(DEFAULT_DEBUG_SETTINGS).map((field) => [field, invalid]),
    );
    settings.arc = "tempest";
    settings.unknown = "ignored";
    assert.deepEqual(parseDebugSettings(JSON.stringify(settings), choices), {
      ...DEFAULT_DEBUG_SETTINGS,
      arc: "tempest",
      paused: invalid === true,
    });
  }
});

test("reset defaults round-trip without changing shared defaults or choices", () => {
  const originalChoices = structuredClone(choices);
  const reset = parseDebugSettings(
    JSON.stringify(DEFAULT_DEBUG_SETTINGS),
    choices,
  );
  assert.deepEqual(reset, DEFAULT_DEBUG_SETTINGS);
  reset.weather = "Heavy storm";
  assert.equal(DEFAULT_DEBUG_SETTINGS.weather, "auto");
  assert.deepEqual(choices, originalChoices);
});
