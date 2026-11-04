import { PORT_NAMES, FACTION_NAMES } from "../src/names.js";
import assert from "node:assert/strict";
import test from "node:test";

import { currentObjective, voyageWarnings } from "../src/core/guidance.js";
import { QUESTS } from "../src/core/quests.js";

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
    currentObjective({ game: game(), nearPortName: PORT_NAMES.orvessaQuay })
      .action,
    "dock",
  );
  assert.equal(
    currentObjective({ game: game(), currentPortName: PORT_NAMES.orvessaQuay })
      .action,
    "trade",
  );

  const contracted = game({
    activeContracts: [
      {
        destination: PORT_NAMES.narthkel,
        cargoName: "guild ledgers",
        reward: 90,
        deadline: 5,
      },
    ],
  });
  assert.equal(
    currentObjective({
      game: contracted,
      currentPortName: PORT_NAMES.orvessaQuay,
    }).action,
    "map",
  );
  assert.equal(
    currentObjective({ game: contracted, nearPortName: PORT_NAMES.narthkel })
      .action,
    "dock",
  );
  assert.equal(currentObjective({ game: contracted }).id, "sail-contract");
});

test("currentObjective warns under-provisioned captains and advances milestones", () => {
  const contracted = game({
    operations: { provisions: 2 },
    activeContracts: [
      {
        destination: PORT_NAMES.narthkel,
        cargoName: "guild ledgers",
        reward: 90,
        deadline: 2,
      },
    ],
  });
  const preparation = currentObjective({
    game: contracted,
    currentPortName: PORT_NAMES.orvessaQuay,
  });
  assert.equal(preparation.action, "vessel");
  assert.match(preparation.detail, /Dock → Passage/);
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
    PORT_NAMES.orvessaQuay,
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
        factionStanding: { [FACTION_NAMES.syrrelwakeOarwrightPact]: 20 },
      }),
      currentPortName: PORT_NAMES.orvessaQuay,
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
        quests: { completed: QUESTS.map((item) => item.id) },
      }),
    }).urgency,
    "complete",
  );
});

test("survey objectives explain the task without a delivery destination", () => {
  const survey = {
    kind: "survey",
    title: "Catalogue rare ecosystems",
    destination: null,
    deadline: 6,
    survey: {
      target: "discovery",
      disposition: "share",
      required: 2,
      completed: ["reef-garden"],
    },
  };
  for (const location of [
    {},
    { currentPortName: PORT_NAMES.orvessaQuay },
    { nearPortName: PORT_NAMES.orvessaQuay },
  ]) {
    const objective = currentObjective({
      game: game({ activeContracts: [survey] }),
      ...location,
    });
    assert.equal(objective.id, "survey-contract");
    assert.equal(objective.title, survey.title);
    assert.equal(objective.destination, null);
    assert.equal(objective.action, "contracts");
    assert.equal(objective.urgency, "normal");
    assert.match(objective.detail, /Share with faction/);
    assert.match(objective.detail, /1\/2 sites recorded · Due Day 6/);
    assert.doesNotMatch(objective.detail, /null|undefined/);
  }
  const delivery = {
    destination: "Near",
    cargoName: "urgent cargo",
    deadline: 3,
  };
  assert.equal(
    currentObjective({
      game: game({ activeContracts: [survey, delivery] }),
    }).destination,
    "Near",
  );
  assert.equal(
    currentObjective({
      game: game({ day: 5, activeContracts: [survey] }),
    }).urgency,
    "danger",
  );
});

test("commission and law guidance names visible harbor tabs", () => {
  for (const location of [
    {},
    { nearPortName: PORT_NAMES.orvessaQuay },
    { currentPortName: "New Home", homePortName: "New Home" },
  ]) {
    const objective = currentObjective({ game: game(), ...location });
    assert.match(objective.detail, /Guildhall → Contracts/);
    if (location.currentPortName) assert.match(objective.detail, /at New Home/);
  }
  const objective = currentObjective({
    game: game({
      completedContracts: 3,
      milestone: { shortageExploited: true, lawChanged: false },
      factionStanding: { [FACTION_NAMES.syrrelwakeOarwrightPact]: 20 },
    }),
  });
  assert.match(objective.detail, /Council → Factions & law/);
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
      currentPortName: PORT_NAMES.orvessaQuay,
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
        factionStanding: { [FACTION_NAMES.syrrelwakeOarwrightPact]: 20 },
      },
      currentPortName: PORT_NAMES.narthkel,
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
