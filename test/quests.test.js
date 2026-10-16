import assert from "node:assert/strict";
import test from "node:test";
import {
  QUEST_CHAINS,
  QUESTS,
  claimQuestReward,
  createQuestState,
  normalizeQuestState,
  questJournal,
  questObjective,
  recordQuestPort,
  recordQuestTrade,
  trackQuest,
  updateQuestProgress,
} from "../src/core/quests.js";
import { createGameState } from "../src/core/state.js";
import {
  createSaveData,
  parseSave,
  serializeSave,
} from "../src/core/persistence.js";
import { currentObjective } from "../src/core/guidance.js";
import { PORT_NAMES } from "../src/names.js";

function accomplishedGame() {
  const game = createGameState();
  game.completedContracts = 5;
  game.warehouses = {
    A: { leased: true },
    B: { leased: true },
    C: { leased: true },
    D: { leased: false },
  };
  game.regionalEconomy = { A: { industries: { forge: { investment: 2 } } } };
  game.discoveries.found = Object.fromEntries(
    Array.from({ length: 6 }, (_, index) => [
      index,
      { disposition: index < 3 ? "share" : "secret" },
    ]),
  );
  game.exploration.sites = {
    island: { status: "surveyed" },
    reef: { status: "charted" },
  };
  game.shipUpgrades.equipped.hull = "reinforced-hull";
  game.specialists.officers[0].ambition.status = "completed";
  game.fleet = {
    ships: [
      { classId: "cutter", route: "A-B", status: "sailing" },
      { classId: "brig", route: "B-C", status: "sailing" },
    ],
  };
  game.legacyProgress.fleetDeliveries = 3;
  for (const port of ["A", "B", "C"]) recordQuestPort(game, port);
  recordQuestTrade(game, 100);
  return game;
}

test("fifteen quests form three ordered chains with valid rewards and targets", () => {
  assert.equal(QUESTS.length, 15);
  assert.equal(new Set(QUESTS.map((quest) => quest.id)).size, 15);
  for (const chain of QUEST_CHAINS) {
    const quests = QUESTS.filter((quest) => quest.chain === chain.id);
    assert.equal(quests.length, 5);
    assert.equal(quests[0].requires, null);
    quests.forEach((quest, index) => {
      assert.ok(quest.target > 0 && Number.isFinite(quest.target));
      assert.ok(quest.reward > 0 && Number.isInteger(quest.reward));
      assert.ok(quest.title && quest.detail);
      if (index) assert.equal(quest.requires, quests[index - 1].id);
    });
  }
});

test("quest state is independent and missing or malformed older saves normalize", () => {
  const first = createQuestState();
  first.completed.push("first-commission");
  first.visitedPorts.push("Home");
  first.progress["first-refit"] = 1;
  assert.deepEqual(createQuestState(), {
    completed: [],
    tracked: null,
    progress: {},
    visitedPorts: [],
    tradeProfit: 0,
  });
  const fresh = normalizeQuestState();
  for (const value of [
    null,
    false,
    12,
    "old save",
    [],
    { completed: {}, visitedPorts: {}, progress: null },
  ])
    assert.deepEqual(normalizeQuestState(value), fresh);
  const normalized = normalizeQuestState({
    completed: [
      "unknown",
      "first-commission",
      "first-commission",
      "cargo-profit",
      "two-routes",
    ],
    tracked: "cargo-profit",
    progress: {
      "first-refit": Infinity,
      "three-harbors": -3,
      "cargo-profit": 900,
      unknown: 10,
    },
    visitedPorts: ["Home", "Home", "Away", null, "", "   ", 2],
    tradeProfit: NaN,
  });
  assert.deepEqual(normalized.completed, ["first-commission"]);
  assert.equal(normalized.tracked, null);
  assert.equal(normalized.progress["first-refit"], 0);
  assert.equal(normalized.progress["three-harbors"], 0);
  assert.equal(normalized.progress["cargo-profit"], 100);
  assert.equal(normalized.progress.unknown, undefined);
  assert.deepEqual(normalized.visitedPorts, ["Home", "Away"]);
  assert.equal(normalized.tradeProfit, 0);
  assert.equal(
    normalizeQuestState({
      completed: ["first-commission"],
      tracked: "first-commission",
    }).tracked,
    null,
  );
  assert.equal(
    normalizeQuestState({
      completed: ["first-commission"],
      tracked: "first-warehouse",
    }).tracked,
    "first-warehouse",
  );
  assert.equal(normalizeQuestState({ tracked: "unknown" }).tracked, null);
});

test("harbor visits are unique and only profitable sales count toward cargo profit", () => {
  const game = {};
  for (const port of ["Home", "Home", "Away", "", "   ", undefined, 4])
    recordQuestPort(game, port);
  assert.deepEqual(game.quests.visitedPorts, ["Home", "Away"]);
  for (const profit of [35, 0, -40, 12.5, Infinity, NaN, undefined, "100"])
    recordQuestTrade(game, profit);
  assert.equal(game.quests.tradeProfit, 47.5);
  assert.equal(
    questJournal(game).find((item) => item.id === "cargo-profit").progress,
    47.5,
  );
  assert.equal(
    questJournal(game).find((item) => item.id === "three-harbors").progress,
    2,
  );
});

test("new voyages expose one quest per chain and starter fittings earn no progress", () => {
  const game = createGameState();
  const journal = questJournal(game);
  assert.equal(journal.filter((item) => !item.locked).length, 3);
  assert.equal(journal.filter((item) => item.ready).length, 0);
  assert.ok(journal.every((item) => item.progress === 0));
  assert.ok(journal.every((item) => !item.completed && !item.tracked));
  game.completedContracts = 1;
  const first = questJournal(game).find(
    (item) => item.id === "first-commission",
  );
  assert.equal(first.ready, true);
  assert.equal(first.completed, false);
  assert.equal(game.coins, 120, "rewards require an explicit claim");
});

test("existing achievements count for every quest, including locked steps", () => {
  const game = accomplishedGame();
  const journal = questJournal(game);
  assert.ok(journal.every((item) => item.progress === item.target));
  assert.equal(journal.filter((item) => item.ready).length, 3);
  assert.equal(journal.find((item) => item.id === "two-routes").locked, true);
  // Progress is remembered after selling a vessel or removing a fitting.
  game.fleet.ships = [];
  game.shipUpgrades.equipped.hull = "standard-hull";
  game.warehouses = {};
  const remembered = questJournal(game);
  assert.equal(remembered.find((item) => item.id === "two-routes").progress, 2);
  assert.equal(
    remembered.find((item) => item.id === "first-refit").progress,
    1,
  );
  assert.equal(
    remembered.find((item) => item.id === "trading-house").progress,
    3,
  );
});

test("incomplete, unknown, and locked rewards cannot be collected", () => {
  const game = createGameState();
  assert.equal(claimQuestReward(game, "unknown").reason, "Unknown quest.");
  assert.equal(
    claimQuestReward(game, "first-commission").reason,
    "Finish the quest requirements first.",
  );
  game.completedContracts = 1;
  game.warehouses = { Home: { leased: true } };
  assert.equal(
    claimQuestReward(game, "first-warehouse").reason,
    "Complete the previous quest in this chain first.",
  );
  assert.equal(game.coins, 120);
  assert.deepEqual(game.quests.completed, []);
});

test("claiming grants a reward exactly once and unlocks the next step", () => {
  const game = accomplishedGame();
  assert.equal(trackQuest(game, "first-commission"), true);
  const result = claimQuestReward(game, "first-commission");
  assert.equal(result.ok, true);
  assert.equal(result.quest.reward, 20);
  assert.equal(game.coins, 140);
  assert.equal(game.quests.tracked, null);
  assert.equal(
    claimQuestReward(game, "first-commission").reason,
    "This reward has already been collected.",
  );
  assert.equal(game.coins, 140);
  assert.equal(
    questJournal(game).find((item) => item.id === "first-warehouse").ready,
    true,
  );
  game.completedContracts = 0;
  game.quests.progress["first-commission"] = 0;
  assert.equal(
    questJournal(game).find((item) => item.id === "first-commission").progress,
    1,
  );
  assert.equal(claimQuestReward(game, "first-warehouse").ok, true);
});

test("tracking rejects unavailable quests, switches goals, and toggles off", () => {
  const game = createGameState();
  assert.equal(questObjective(game), null);
  assert.equal(trackQuest(game, "unknown"), false);
  assert.equal(trackQuest(game, "first-warehouse"), false);
  assert.equal(trackQuest(game, "first-refit"), true);
  assert.equal(questObjective(game).id, "quest-first-refit");
  assert.equal(questObjective(game).urgency, "normal");
  assert.equal(questObjective(game).action, "quests");
  assert.equal(trackQuest(game, "three-harbors"), true);
  assert.equal(questJournal(game).filter((item) => item.tracked).length, 1);
  assert.equal(trackQuest(game, "three-harbors"), true);
  assert.equal(game.quests.tracked, null);
  assert.equal(questObjective(game), null);
  assert.equal(questObjective(game, true).id, "quest-first-commission");
  game.completedContracts = 1;
  assert.equal(trackQuest(game, "first-commission"), true);
  assert.equal(questObjective(game).urgency, "ready");
  assert.match(questObjective(game).title, /Collect reward/);
  claimQuestReward(game, "first-commission");
  assert.equal(trackQuest(game, "first-commission"), false);
});

test("all chains can be finished and rewards survive save and load without duplication", () => {
  const game = accomplishedGame();
  for (const quest of QUESTS)
    assert.equal(claimQuestReward(game, quest.id).ok, true, quest.id);
  const totalReward = QUESTS.reduce((sum, item) => sum + item.reward, 0);
  assert.equal(game.coins, 120 + totalReward);
  assert.equal(game.quests.completed.length, 15);
  assert.equal(questObjective(game, true), null);
  const restored = parseSave(
    serializeSave(
      createSaveData({
        game,
        ship: {},
        merchants: [],
        worldEvents: {},
        gameStarted: true,
      }),
    ),
  ).game;
  restored.quests = normalizeQuestState(restored.quests);
  assert.equal(restored.quests.completed.length, 15);
  assert.equal(claimQuestReward(restored, "two-routes").ok, false);
  assert.equal(restored.coins, 120 + totalReward);
  assert.equal(
    questJournal(restored).filter((item) => item.completed).length,
    15,
  );
});

test("older voyages receive quests and credit for achievements without altering milestone state", () => {
  const game = accomplishedGame();
  delete game.quests;
  const milestone = { ...game.milestone };
  updateQuestProgress(game);
  assert.equal(game.quests.progress["first-commission"], 1);
  assert.equal(game.quests.progress["trading-house"], 3);
  assert.equal(game.quests.progress["six-discoveries"], 6);
  assert.equal(game.quests.progress["cargo-profit"], 0);
  assert.equal(game.coins, 120);
  assert.deepEqual(game.milestone, milestone);
});

test("guidance follows tracked quests while active deliveries retain priority", () => {
  const game = createGameState();
  trackQuest(game, "three-harbors");
  assert.equal(currentObjective({ game }).id, "quest-three-harbors");
  game.activeContracts = [
    {
      destination: PORT_NAMES.narthkel,
      cargoName: "letters",
      reward: 90,
      deadline: 6,
    },
  ];
  assert.equal(currentObjective({ game }).id, "sail-contract");
  assert.equal(
    currentObjective({ game, nearPortName: PORT_NAMES.narthkel }).id,
    "deliver-contract",
  );
  game.activeContracts = [];
  assert.equal(currentObjective({ game }).id, "quest-three-harbors");
  trackQuest(game, "three-harbors");
  assert.equal(currentObjective({ game }).id, "return-home");
  game.completedContracts = 1;
  assert.equal(
    currentObjective({ game, currentPortName: PORT_NAMES.orvessaQuay }).title,
    "Accept another commission",
  );
  game.completedContracts = 3;
  game.milestone = {
    shortageExploited: true,
    lawChanged: true,
    complete: true,
  };
  assert.equal(currentObjective({ game }).id, "quest-first-commission");
  game.quests.completed = QUESTS.map((item) => item.id);
  assert.equal(currentObjective({ game }).id, "merchant-prince");
});
