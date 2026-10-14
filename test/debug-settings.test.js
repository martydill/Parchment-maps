import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_DEBUG_SETTINGS,
  parseDebugSettings,
  setDebugShipClass,
} from "../src/core/debug-settings.js";

import { createGameState } from "../src/core/state.js";
import { calculateShipStats, SHIP_CLASSES } from "../src/core/upgrades.js";

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

test("debug ship swaps grant every class for free while preserving fitted gear", () => {
  const game = createGameState();
  game.coins = 0;
  game.shipUpgrades.equipped.sails = "lateen-sails";
  game.shipUpgrades.owned.push("lateen-sails");
  const equipment = structuredClone(game.shipUpgrades.equipped);
  const fittings = [...game.shipUpgrades.owned];
  for (const shipClass of Object.values(SHIP_CLASSES)) {
    assert.deepEqual(setDebugShipClass(game, shipClass.id), {
      ok: true,
      shipClass,
    });
    assert.equal(game.shipUpgrades.activeClass, shipClass.id);
    assert.ok(game.shipUpgrades.ownedClasses.includes(shipClass.id));
    assert.equal(game.coins, 0);
    assert.deepEqual(game.shipUpgrades.equipped, equipment);
    assert.deepEqual(game.shipUpgrades.owned, fittings);
    setDebugShipClass(game, shipClass.id);
    assert.equal(
      game.shipUpgrades.ownedClasses.filter((id) => id === shipClass.id).length,
      1,
    );
  }
});

test("debug ship swaps accept a full hold and reject excess cargo atomically", () => {
  const game = createGameState();
  setDebugShipClass(game, "carrack");
  const capacity = calculateShipStats({
    ...game.shipUpgrades,
    activeClass: "sloop",
  }).holdMax;
  const before = structuredClone(game);
  assert.deepEqual(setDebugShipClass(game, "sloop", capacity + 1), {
    ok: false,
    reason: "Unload cargo before changing to this ship class.",
  });
  assert.deepEqual(game, before);
  assert.equal(setDebugShipClass(game, "sloop", capacity).ok, true);
  assert.equal(game.shipUpgrades.activeClass, "sloop");
});

test("debug ship swaps reject unknown classes and normalize older upgrade state", () => {
  const game = { coins: 12 };
  for (const classId of ["missing", "toString", null, undefined]) {
    assert.deepEqual(setDebugShipClass(game, classId), {
      ok: false,
      reason: "Unknown ship class.",
    });
    assert.deepEqual(game, { coins: 12 });
  }
  assert.equal(setDebugShipClass(game, "brig").ok, true);
  assert.equal(game.shipUpgrades.activeClass, "brig");
  assert.ok(game.shipUpgrades.ownedClasses.includes("brig"));
  assert.ok(game.shipUpgrades.equipped.sails);
  assert.equal(game.coins, 12);
});
