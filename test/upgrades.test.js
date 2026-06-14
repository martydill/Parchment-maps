import assert from "node:assert/strict";
import test from "node:test";

import { createGameState } from "../src/core/state.js";
import {
  BASE_SHIP_STATS,
  buyOrEquipUpgrade,
  calculateShipStats,
  createShipUpgradeState,
  normalizeShipUpgradeState,
  SHIP_UPGRADES,
  UPGRADE_SLOTS,
} from "../src/core/upgrades.js";

test("the catalog provides a baseline and multiple tradeoff choices for every slot", () => {
  const lowerIsBetter = new Set(["inspectionRisk", "windDrift"]);
  assert.equal(UPGRADE_SLOTS.length, 7);
  for (const slot of UPGRADE_SLOTS) {
    assert.ok(SHIP_UPGRADES[slot.id].length >= 3);
    assert.equal(SHIP_UPGRADES[slot.id][0].cost, 0);
    for (const item of SHIP_UPGRADES[slot.id].slice(1)) {
      const effects = Object.entries(item.modifiers);
      assert.ok(
        effects.some(
          ([stat, value]) =>
            (lowerIsBetter.has(stat) && value < 0) ||
            (!lowerIsBetter.has(stat) && value > 0),
        ),
      );
      assert.ok(
        effects.some(
          ([stat, value]) =>
            (lowerIsBetter.has(stat) && value > 0) ||
            (!lowerIsBetter.has(stat) && value < 0),
        ),
      );
    }
  }
});

test("default upgrade state calculates baseline ship statistics", () => {
  assert.deepEqual(
    calculateShipStats(createShipUpgradeState()),
    BASE_SHIP_STATS,
  );
});

test("equipped upgrades combine benefits and drawbacks", () => {
  const state = createShipUpgradeState();
  state.equipped.hull = "narrow-hull";
  state.equipped.cargo = "reinforced-hold";
  const stats = calculateShipStats(state);
  assert.equal(stats.holdMax, 21);
  assert.equal(stats.maxSpeed, 187);
  assert.ok(Math.abs(stats.stormResistance - 0.82) < 1e-12);
});

test("buying deducts coins while owned upgrades can be refitted for free", () => {
  const game = createGameState();
  game.coins = 300;
  const purchase = buyOrEquipUpgrade(game, "sails", "lateen-sails");
  assert.equal(purchase.ok, true);
  assert.equal(purchase.purchased, true);
  assert.equal(game.coins, 175);
  assert.equal(game.shipUpgrades.equipped.sails, "lateen-sails");

  buyOrEquipUpgrade(game, "sails", "patched-sails");
  const refit = buyOrEquipUpgrade(game, "sails", "lateen-sails");
  assert.equal(refit.purchased, false);
  assert.equal(game.coins, 175);
});

test("purchase failures do not mutate coins or equipment", () => {
  const game = createGameState();
  game.coins = 10;
  const poor = buyOrEquipUpgrade(game, "hull", "reinforced-hull");
  assert.deepEqual(poor, { ok: false, reason: "Not enough crowns." });
  assert.equal(game.coins, 10);
  assert.equal(game.shipUpgrades.equipped.hull, "standard-hull");

  assert.equal(
    buyOrEquipUpgrade(game, "missing", "unknown").reason,
    "Unknown ship fitting.",
  );
});

test("a refit cannot reduce capacity below cargo already aboard", () => {
  const game = createGameState();
  game.coins = 500;
  const result = buyOrEquipUpgrade(game, "cargo", "smugglers-lockers", 18);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "Unload cargo before fitting this option.");
  assert.equal(game.coins, 500);
  assert.equal(game.shipUpgrades.owned.includes("smugglers-lockers"), false);
});

test("normalization repairs missing and invalid saved upgrade data", () => {
  assert.deepEqual(normalizeShipUpgradeState(null), createShipUpgradeState());
  assert.deepEqual(normalizeShipUpgradeState({}), createShipUpgradeState());
  const normalized = normalizeShipUpgradeState({
    equipped: { hull: "narrow-hull", sails: "not-real" },
    owned: ["narrow-hull", "not-real"],
  });
  assert.equal(normalized.equipped.hull, "narrow-hull");
  assert.equal(normalized.equipped.sails, "patched-sails");
  assert.equal(normalized.owned.includes("not-real"), false);
});
