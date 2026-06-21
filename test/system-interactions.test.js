import { PORT_NAMES, FACTION_NAMES } from "../src/names.js";
import assert from "node:assert/strict";
import test from "node:test";

import {
  cargoCompartmentCapacities,
  grantCargo,
  syncCargoCounts,
} from "../src/core/cargo.js";
import { contractConflict } from "../src/core/factions.js";
import {
  contractOutcome,
  maybeCreateObligation,
} from "../src/core/operations.js";
import {
  cargoCount,
  changeStanding,
  createGameState,
} from "../src/core/state.js";
import {
  depositCargo,
  leaseWarehouse,
  withdrawCargo,
} from "../src/core/warehouses.js";

const tradeGoods = {
  spice: { name: "Spice", base: 24, perishRate: 0.02 },
  silk: { name: "Silk", base: 35, fragile: true },
};

test("contract completion feeds faction standing, obligations, and rival conflicts", () => {
  const game = createGameState();
  const contract = {
    faction: FACTION_NAMES.syrrelwakeOarwrightPact,
    reward: 100,
    influence: 30,
    deadline: 6,
  };

  const outcome = contractOutcome(contract, 6, 25);
  assert.deepEqual(outcome, {
    grade: "On time",
    reward: 110,
    standing: 30,
    completed: true,
  });

  game.coins += outcome.reward;
  assert.equal(changeStanding(game, contract.faction, outcome.standing), 30);
  assert.equal(game.factionStanding["Free Keel Brotherhood"], -15);

  const obligation = maybeCreateObligation(
    game.operations,
    contract.faction,
    game.factionStanding[contract.faction],
    game.day,
  );
  game.operations = obligation.operations;

  assert.equal(obligation.obligation.faction, contract.faction);
  assert.equal(obligation.obligation.dueDay, 9);
  assert.equal(game.coins, 230);
  assert.equal(
    contractConflict(
      { faction: "Free Keel Brotherhood" },
      game.activeContracts,
      contract.faction,
    ),
    `Your ${FACTION_NAMES.syrrelwakeOarwrightPact} charter bars service to Free Keel Brotherhood.`,
  );
});

test("warehouse transfers stay synchronized with ship cargo counts and hold space", () => {
  const game = createGameState();
  game.holdMax = 3;
  const capacities = cargoCompartmentCapacities(game.holdMax);

  assert.equal(
    grantCargo(game, "spice", 2, tradeGoods, capacities, {
      origin: PORT_NAMES.orvessaQuay,
    }).granted,
    2,
  );
  assert.equal(
    grantCargo(game, "silk", 1, tradeGoods, capacities, {
      origin: PORT_NAMES.velquorin,
    }).granted,
    1,
  );
  assert.equal(cargoCount(game), 3);

  const leased = leaseWarehouse(
    game.warehouses,
    PORT_NAMES.orvessaQuay,
    game.coins,
    10,
  );
  game.coins = leased.coins;
  const storedLotId = game.cargoLots[0].id;
  const stored = depositCargo(
    game.warehouses,
    PORT_NAMES.orvessaQuay,
    game.cargoLots,
    storedLotId,
  );
  assert.equal(stored.ok, true);
  syncCargoCounts(game, tradeGoods);

  assert.equal(cargoCount(game), 2);
  assert.equal(game.cargo.spice, 1);
  assert.equal(game.warehouses[PORT_NAMES.orvessaQuay].lots.length, 1);

  const withdrawn = withdrawCargo(
    game.warehouses,
    PORT_NAMES.orvessaQuay,
    game.cargoLots,
    storedLotId,
    game.holdMax - cargoCount(game),
  );
  assert.equal(withdrawn.ok, true);
  syncCargoCounts(game, tradeGoods);

  assert.equal(cargoCount(game), 3);
  assert.equal(game.cargo.spice, 2);
  assert.equal(game.warehouses[PORT_NAMES.orvessaQuay].lots.length, 0);
  assert.equal(game.coins, 90);
});
