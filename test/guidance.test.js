import assert from "node:assert/strict";
import test from "node:test";

import { currentObjective, voyageWarnings } from "../src/core/guidance.js";

function game(overrides = {}) {
  return {
    day: 1,
    activeContracts: [],
    completedContracts: 0,
    milestone: {
      shortageProfit: 0,
      shortageExploited: false,
      lawChanged: false,
    },
    factionStanding: {},
    operations: { provisions: 10 },
    ...overrides,
  };
}

test("currentObjective guides the first commission from docking through delivery", () => {
  assert.equal(currentObjective({ game: game() }).id, "return-home");
  assert.equal(
    currentObjective({ game: game(), nearPortName: "Goldhaven" }).action,
    "dock",
  );
  assert.equal(
    currentObjective({ game: game(), currentPortName: "Goldhaven" }).action,
    "trade",
  );

  const contracted = game({
    activeContracts: [
      {
        destination: "Rimegate",
        cargoName: "guild ledgers",
        reward: 90,
        deadline: 5,
      },
    ],
  });
  assert.equal(
    currentObjective({
      game: contracted,
      currentPortName: "Goldhaven",
    }).action,
    "map",
  );
  assert.equal(
    currentObjective({ game: contracted, nearPortName: "Rimegate" }).action,
    "dock",
  );
  assert.equal(currentObjective({ game: contracted }).id, "sail-contract");
});

test("currentObjective warns under-provisioned captains and advances milestones", () => {
  const contracted = game({
    operations: { provisions: 2 },
    activeContracts: [
      {
        destination: "Rimegate",
        cargoName: "guild ledgers",
        reward: 90,
        deadline: 2,
      },
    ],
  });
  const preparation = currentObjective({
    game: contracted,
    currentPortName: "Goldhaven",
  });
  assert.equal(preparation.action, "vessel");
  assert.equal(preparation.urgency, "danger");

  assert.equal(
    currentObjective({ game: game({ completedContracts: 3 }) }).id,
    "exploit-shortage",
  );
  assert.equal(
    currentObjective({
      game: game({
        completedContracts: 3,
        milestone: {
          shortageProfit: 10,
          shortageExploited: false,
          lawChanged: false,
        },
      }),
    }).destination,
    "Goldhaven",
  );
  assert.equal(
    currentObjective({
      game: game({
        completedContracts: 3,
        milestone: {
          shortageProfit: 50,
          shortageExploited: true,
          lawChanged: false,
        },
      }),
    }).title,
    "Build Guild influence",
  );
  assert.equal(
    currentObjective({
      game: game({
        completedContracts: 3,
        milestone: {
          shortageProfit: 50,
          shortageExploited: true,
          lawChanged: false,
        },
        factionStanding: { "Guild of Gilded Oars": 20 },
      }),
      currentPortName: "Goldhaven",
    }).action,
    "politics",
  );
  assert.equal(
    currentObjective({
      game: game({
        completedContracts: 3,
        milestone: {
          shortageProfit: 50,
          shortageExploited: true,
          lawChanged: true,
        },
      }),
    }).urgency,
    "complete",
  );
});

test("currentObjective handles deadlines, multiple commissions, and missing legacy fields", () => {
  const contracted = game({
    day: 4,
    operations: undefined,
    activeContracts: [
      {
        destination: "Far",
        cargoName: "late cargo",
        reward: 100,
        deadline: 9,
      },
      {
        destination: "Near",
        cargoName: "urgent cargo",
        reward: 80,
        deadline: 5,
      },
    ],
  });
  const preparation = currentObjective({
    game: contracted,
    currentPortName: "Harbor",
  });
  assert.equal(preparation.destination, "Near");
  assert.equal(preparation.action, "vessel");
  assert.equal(preparation.urgency, "danger");
  assert.equal(
    currentObjective({
      game: { ...contracted, activeContracts: null },
      homePortName: "Harbor",
      nearPortName: "Harbor",
    }).action,
    "dock",
  );
  assert.equal(
    currentObjective({
      game: {
        ...contracted,
        operations: { provisions: 8 },
        activeContracts: [contracted.activeContracts[0]],
      },
      currentPortName: "Harbor",
    }).urgency,
    "normal",
  );
  assert.equal(
    currentObjective({
      game: contracted,
      nearPortName: "Near",
    }).urgency,
    "danger",
  );
  assert.equal(currentObjective({ game: contracted }).urgency, "danger");
  assert.match(
    currentObjective({
      game: { ...contracted, operations: { provisions: 8 } },
      currentPortName: "Harbor",
    }).detail,
    /1 day left/,
  );
  assert.equal(
    currentObjective({
      game: {
        ...contracted,
        completedContracts: 3,
        activeContracts: [],
        milestone: {
          shortageProfit: 50,
          shortageExploited: true,
          lawChanged: false,
        },
        factionStanding: undefined,
      },
      currentPortName: "Goldhaven",
    }).action,
    "map",
  );
  assert.equal(
    currentObjective({
      game: {
        ...contracted,
        completedContracts: 3,
        activeContracts: [],
        milestone: {
          shortageProfit: 50,
          shortageExploited: true,
          lawChanged: false,
        },
        factionStanding: { "Guild of Gilded Oars": 20 },
      },
      currentPortName: "Rimegate",
    }).action,
    "map",
  );
});

test("voyageWarnings explains readiness failures and clears safe voyages", () => {
  assert.deepEqual(
    voyageWarnings(
      { provisions: 2, condition: 40, morale: 20, wagesDueDay: 3 },
      { provisionsNeeded: 6, arrivalDay: 4 },
    ),
    [
      "Load 4 more provisions.",
      "Repair the ship before a demanding passage.",
      "Low morale will slow the ship and worsen voyage risks.",
      "Crew wages fall due before arrival on Day 4.",
    ],
  );
  assert.deepEqual(
    voyageWarnings(
      { provisions: 10, condition: 90, morale: 80, wagesDueDay: 8 },
      { provisionsNeeded: 4, arrivalDay: 3 },
    ),
    [],
  );
});
