import assert from "node:assert/strict";
import test from "node:test";

import { createGameState } from "../src/core/state.js";
import {
  BASE_SHIP_STATS,
  buyOrEquipUpgrade,
  buyOrSelectShipClass,
  calculateShipIdentity,
  calculateShipStats,
  createShipUpgradeState,
  normalizeShipUpgradeState,
  SHIP_CLASSES,
  SHIP_IDENTITIES,
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

test("ship classes provide distinct baseline tradeoffs", () => {
  const state = createShipUpgradeState();
  state.activeClass = "carrack";
  state.ownedClasses.push("carrack");
  const carrack = calculateShipStats(state);
  assert.equal(carrack.holdMax, 30);
  assert.equal(carrack.maxSpeed, 157);
  assert.ok(Math.abs(carrack.turnRate - 2.36) < 1e-12);
  assert.ok(carrack.stormResistance > 1);

  state.activeClass = "barque";
  const barque = calculateShipStats(state);
  assert.equal(barque.visibilityHeightM, 19);
  assert.equal(barque.holdMax, 15);
  assert.ok(barque.crewComfort > 1);

  assert.equal(Object.keys(SHIP_CLASSES).length, 6);
  assert.ok(
    Object.values(SHIP_CLASSES).every(
      (item) => item.vesselName && item.description,
    ),
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

test("three aligned fittings establish a ship identity with another tradeoff", () => {
  const state = createShipUpgradeState();
  state.equipped.hull = "narrow-hull";
  state.equipped.sails = "lateen-sails";
  state.equipped.rudder = "balanced-rudder";
  const identity = calculateShipIdentity(state);
  assert.equal(identity.id, "courier");
  assert.equal(identity.name, "Swift courier");
  assert.equal(identity.score, 3);
  assert.equal(identity.required, 3);
  assert.equal(identity.scores.courier, 3);
  assert.deepEqual(identity.modifiers, SHIP_IDENTITIES.courier.modifiers);

  const stats = calculateShipStats(state);
  assert.equal(stats.maxSpeed, 189);
  assert.equal(stats.accel, 144);
  assert.equal(stats.holdMax, 13);
});

test("mixed fittings remain a general merchantman without identity modifiers", () => {
  const state = createShipUpgradeState();
  state.equipped.hull = "narrow-hull";
  state.equipped.cargo = "reinforced-hold";
  const identity = calculateShipIdentity(state);
  assert.equal(identity.id, null);
  assert.equal(identity.name, "General merchantman");
  assert.equal(identity.score, 1);
  assert.deepEqual(identity.modifiers, {});
  assert.match(identity.description, /three compatible/i);
});

test("identity ties resolve consistently by catalog order", () => {
  const state = createShipUpgradeState();
  state.equipped.hull = "reinforced-hull";
  state.equipped.sails = "towering-sails";
  state.equipped.quarters = "expanded-quarters";
  assert.equal(calculateShipIdentity(state).id, "freighter");
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

test("ships are purchased once and owned classes can be selected freely", () => {
  const game = createGameState();
  game.coins = 500;
  const purchase = buyOrSelectShipClass(game, "sloop");
  assert.equal(purchase.ok, true);
  assert.equal(purchase.purchased, true);
  assert.equal(game.coins, 240);
  assert.equal(game.shipUpgrades.activeClass, "sloop");
  assert.ok(game.shipUpgrades.ownedClasses.includes("sloop"));

  buyOrSelectShipClass(game, "cutter");
  const selected = buyOrSelectShipClass(game, "sloop");
  assert.equal(selected.ok, true);
  assert.equal(selected.purchased, false);
  assert.equal(game.coins, 240);
});

test("ship class changes reject invalid, unaffordable, active, and undersized vessels", () => {
  const game = createGameState();
  game.coins = 10;
  assert.equal(
    buyOrSelectShipClass(game, "unknown").reason,
    "Unknown ship class.",
  );
  assert.equal(
    buyOrSelectShipClass(game, "cutter").reason,
    "That ship is already active.",
  );
  assert.equal(buyOrSelectShipClass(game, "brig").reason, "Not enough crowns.");

  game.coins = 500;
  const tooSmall = buyOrSelectShipClass(game, "sloop", 18);
  assert.equal(
    tooSmall.reason,
    "Unload cargo before changing to this ship class.",
  );
  assert.equal(game.coins, 500);
  assert.equal(game.shipUpgrades.ownedClasses.includes("sloop"), false);
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
  assert.equal(normalized.activeClass, "cutter");
  assert.deepEqual(normalized.ownedClasses, ["cutter"]);

  const fleet = normalizeShipUpgradeState({
    activeClass: "barque",
    ownedClasses: ["barque", "brig", "not-real"],
  });
  assert.equal(fleet.activeClass, "barque");
  assert.deepEqual(fleet.ownedClasses, ["barque", "brig"]);
});
