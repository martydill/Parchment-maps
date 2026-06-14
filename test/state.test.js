import assert from "node:assert/strict";
import test from "node:test";

import {
  addNews,
  cargoCount,
  changeStanding,
  createGameState,
} from "../src/core/state.js";
import {
  createSaveData,
  parseSave,
  SAVE_VERSION,
  serializeSave,
} from "../src/core/persistence.js";

test("createGameState returns independent complete state objects", () => {
  const first = createGameState();
  const second = createGameState();
  first.cargo.iron = 3;
  first.news.push({ title: "Changed" });
  assert.equal(second.cargo.iron, 0);
  assert.deepEqual(second.news, []);
  assert.equal(first.day, 1);
  assert.equal(first.holdMax, 18);
});

test("cargoCount includes trade and sealed contract cargo", () => {
  const game = createGameState();
  game.cargo = { spice: 2, iron: 3, silk: 1 };
  assert.equal(cargoCount(game, 4), 10);
});

test("addNews prepends entries and enforces the configured history limit", () => {
  const game = createGameState();
  for (let index = 0; index < 5; index += 1)
    addNews(game, `Title ${index}`, "Body", 3);
  assert.equal(game.news.length, 3);
  assert.equal(game.news[0].title, "Title 4");
  assert.equal(game.news[0].day, 1);
});

test("changeStanding initializes, adjusts, and clamps faction standing", () => {
  const game = createGameState();
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  assert.equal(changeStanding(game, "Guild", 20, clamp), 20);
  assert.equal(changeStanding(game, "Guild", 200, clamp), 100);
  assert.equal(changeStanding(game, "Guild", -250, clamp), -100);
});

test("helping a faction costs standing with its rival", () => {
  const game = createGameState();
  changeStanding(game, "Deep Delvers’ Union", 10);
  assert.equal(game.factionStanding["Deep Delvers’ Union"], 10);
  assert.equal(game.factionStanding["Black Hammer Compact"], -5);
  changeStanding(game, "Deep Delvers’ Union", -4);
  assert.equal(game.factionStanding["Black Hammer Compact"], -5);
});

test("full game saves round-trip through JSON", () => {
  const game = createGameState();
  game.coins = 777;
  const save = createSaveData({
    game,
    ship: { x: 42, y: 84, trail: [{ x: 40, y: 80 }] },
    merchants: [{ id: "M1", distance: 125 }],
    worldEvents: { shortage: { active: true } },
    exploredMap: "data:image/png;base64,map",
    gameStarted: true,
  });

  const restored = parseSave(serializeSave(save));
  assert.equal(restored.version, SAVE_VERSION);
  assert.equal(restored.game.coins, 777);
  assert.equal(restored.ship.x, 42);
  assert.equal(restored.merchants[0].distance, 125);
  assert.equal(restored.worldEvents.shortage.active, true);
  assert.equal(restored.exploredMap, "data:image/png;base64,map");
  assert.equal(restored.gameStarted, true);
  assert.match(restored.savedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("invalid or incompatible saves are ignored", () => {
  assert.equal(parseSave(null), null);
  assert.equal(parseSave("{broken"), null);
  assert.equal(parseSave(JSON.stringify({ version: SAVE_VERSION + 1 })), null);
  assert.equal(
    parseSave(
      JSON.stringify({
        version: SAVE_VERSION,
        game: {},
        ship: {},
        merchants: {},
        worldEvents: {},
        gameStarted: true,
      }),
    ),
    null,
  );
});
