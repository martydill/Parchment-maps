import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceRaider,
  createSeaRaidState,
  normalizeSeaRaidState,
  raidChance,
  spawnRaider,
} from "../src/core/sea-raiders.js";

test("sea raid state restores valid pursuit and repairs older saves", () => {
  assert.deepEqual(normalizeSeaRaidState(undefined), createSeaRaidState());
  assert.deepEqual(normalizeSeaRaidState("bad"), createSeaRaidState());
  assert.deepEqual(normalizeSeaRaidState({ raider: { x: NaN } }), {
    raider: null,
    checkedThisVoyage: false,
  });
  const state = normalizeSeaRaidState({
    checkedThisVoyage: 1,
    raider: {
      x: 10,
      y: 20,
      angle: 0,
      seed: 7,
      attackStrength: 9,
      mode: "chase",
      discarded: true,
    },
  });
  assert.deepEqual(state, {
    checkedThisVoyage: true,
    raider: {
      x: 10,
      y: 20,
      angle: 0,
      seed: 7,
      attackStrength: 3,
      mode: "chase",
    },
  });
  assert.equal(
    normalizeSeaRaidState({ raider: { ...state.raider, mode: "lost" } }).raider,
    null,
  );
});

test("wealth and route risk attract raiders while deterrence lowers odds", () => {
  const ordinary = raidChance({ risk: 0.2 });
  assert.ok(raidChance({ risk: 0.34, cargoValue: 100 }) > ordinary);
  assert.ok(raidChance({ risk: 0.2, deterrence: 0.7 }) < ordinary);
  assert.equal(raidChance({ risk: 9, cargoValue: 900 }), 0.7);
  assert.equal(raidChance({ risk: -9 }), 0.08);
});

test("raider appears ahead in open water, including near the map seam", () => {
  const player = { x: 1990, y: 100, angle: 0 };
  const raider = spawnRaider({
    player,
    worldWidth: 2000,
    isOpen: (_x, y) => y > 100,
    seed: 1,
    attackStrength: 7,
  });
  assert.ok(raider.x > 1990);
  assert.ok(raider.y > 100);
  assert.equal(raider.attackStrength, 3);
  assert.equal(raider.mode, "patrol");
  assert.ok(Math.abs(Math.abs(raider.angle) - Math.PI) < 0.2);
  assert.equal(
    spawnRaider({ player, worldWidth: 2000, isOpen: () => false, seed: 1 }),
    null,
  );
});

test("raider can be spotted, catch the player, or be evaded", () => {
  const raider = {
    x: 900,
    y: 100,
    angle: 0,
    seed: 3,
    attackStrength: 2,
    mode: "patrol",
  };
  const base = {
    raider,
    player: { x: 10, y: 100 },
    dt: 0.1,
    worldWidth: 1000,
    sightRange: 200,
    hasSight: true,
    isOpen: () => true,
  };
  const sighting = advanceRaider(base);
  assert.equal(sighting.event, "spotted");
  assert.equal(sighting.raider.mode, "chase");
  assert.ok(sighting.raider.x > raider.x);
  assert.deepEqual(
    advanceRaider({
      ...base,
      raider: sighting.raider,
      player: { x: sighting.raider.x + 10, y: 100 },
    }),
    { raider: null, event: "caught" },
  );
  assert.deepEqual(
    advanceRaider({
      ...base,
      raider: { ...raider, mode: "chase" },
      player: { x: 500, y: 600 },
    }),
    { raider: null, event: "escaped" },
  );
});

test("patrols pass by, respect sight, and steer away from land", () => {
  const raider = {
    x: 100,
    y: 100,
    angle: 0,
    seed: 1,
    attackStrength: 1,
    mode: "patrol",
  };
  const base = {
    raider,
    player: { x: 300, y: 100 },
    dt: 1,
    worldWidth: 1000,
    sightRange: 250,
    hasSight: false,
    isOpen: (x) => x <= 105,
  };
  const blocked = advanceRaider(base);
  assert.equal(blocked.event, null);
  assert.equal(blocked.raider.mode, "patrol");
  assert.ok(blocked.raider.x <= 105);
  const cannotAdvance = advanceRaider({
    ...base,
    isOpen: (x) => x > 150 && x < 200,
  });
  assert.equal(cannotAdvance.raider.x, 100);
  assert.deepEqual(advanceRaider({ ...base, player: { x: 700, y: 1400 } }), {
    raider: null,
    event: "passed",
  });
});
