import assert from "node:assert/strict";
import test from "node:test";

import {
  addNews,
  cargoCount,
  changeStanding,
  createGameState,
} from "../src/core/state.js";

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
