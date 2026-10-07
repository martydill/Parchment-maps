import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceEncounter,
  beginEncounter,
  createEncounterState,
  creatureEncounter,
  encounterCamera,
  encounterFrame,
  ENCOUNTER_DURATION,
} from "../src/core/encounters.js";

const camera = { x: 995, y: 200, zoom: 1 };
const raider = {
  id: "raider:1",
  kind: "raider",
  name: "Boarding brutes",
  x: 10,
  y: 240,
};
const whale = { ...raider, id: "whale:1", kind: "whale" };

test("encounters reject invalid subjects and copy their camera origin", () => {
  const state = createEncounterState();
  for (const invalid of [
    { kind: "dolphin" },
    { id: "" },
    { name: "" },
    { x: NaN },
    { y: Infinity },
  ])
    assert.equal(
      beginEncounter(state, { ...raider, ...invalid }, camera),
      false,
    );
  assert.equal(beginEncounter(state, raider, camera), true);
  assert.notEqual(state.active.origin, camera);
  assert.deepEqual(state.active.origin, camera);
  assert.equal(state.active.elapsed, 0);
  assert.equal(beginEncounter(state, raider, camera), false);
  assert.equal(
    beginEncounter(state, { ...raider, id: "other" }, camera),
    false,
  );
  assert.equal(beginEncounter(state, whale, camera), false);
});

test("danger preempts a sighting and bypasses its cooldown; sightings wait", () => {
  const state = createEncounterState();
  assert.equal(beginEncounter(state, whale, camera), true);
  assert.equal(
    beginEncounter(state, { ...whale, id: "whale:2" }, camera),
    false,
  );
  assert.equal(beginEncounter(state, raider, camera), true);
  assert.equal(state.active.kind, "raider");
  advanceEncounter(state, ENCOUNTER_DURATION);
  assert.equal(state.active, null);
  assert.equal(
    beginEncounter(state, { ...whale, id: "whale:2" }, camera),
    false,
  );
  advanceEncounter(state, 45);
  assert.equal(state.cooldown, 0);
  assert.equal(
    beginEncounter(state, { ...whale, id: "whale:2" }, camera),
    true,
  );
});

test("timeline opens bars, punches in, slows play, and restores the frame", () => {
  assert.deepEqual(encounterFrame(-1), encounterFrame(0));
  const beginning = encounterFrame(0);
  assert.equal(beginning.bars, 0);
  assert.equal(beginning.zoom, 1);
  assert.equal(beginning.timeScale, 1);
  const held = encounterFrame(1);
  assert.equal(held.bars, 1);
  assert.equal(held.banner, 1);
  assert.equal(held.focus, 1);
  assert.equal(held.zoom, 1.9);
  assert.ok(held.timeScale < 0.15);
  const exit = encounterFrame(2.35);
  assert.ok(exit.focus > 0 && exit.focus < 1);
  assert.ok(exit.banner > 0 && exit.banner < 1);
  const complete = encounterFrame(ENCOUNTER_DURATION);
  assert.equal(complete.complete, true);
  assert.equal(complete.bars, 0);
  assert.equal(complete.banner, 0);
  assert.equal(complete.focus, 0);
  assert.equal(complete.timeScale, 1);
});

test("debug previews bypass sighting cooldowns and repeat without consuming real encounters", () => {
  const state = createEncounterState();
  state.cooldown = 30;
  state.seen.add(whale.id);
  const preview = { ...whale, preview: true };
  assert.equal(beginEncounter(state, preview, camera), true);
  assert.equal(state.cooldown, 30);
  assert.deepEqual([...state.seen], [whale.id]);
  assert.equal(beginEncounter(state, preview, camera), false);
  advanceEncounter(state, ENCOUNTER_DURATION);
  assert.equal(beginEncounter(state, preview, camera), true);
  advanceEncounter(state, ENCOUNTER_DURATION);
  assert.equal(
    beginEncounter(state, { ...raider, preview: true }, camera),
    true,
  );
  assert.equal(state.seen.has(raider.id), false);
  advanceEncounter(state, ENCOUNTER_DURATION);
  assert.equal(beginEncounter(state, raider, camera), true);
  assert.equal(beginEncounter(state, preview, camera), false);
});

test("camera focuses on the nearest wrapped threat and returns to the moving ship", () => {
  const state = createEncounterState();
  beginEncounter(state, raider, camera);
  const held = encounterFrame(1);
  assert.deepEqual(encounterCamera(state.active, held, camera, 1000), {
    x: 1010,
    y: 240,
    zoom: 1.9,
  });
  state.active.elapsed = 2.4;
  const home = { x: 1005, y: 210, zoom: 0.8 };
  const returning = encounterCamera(
    state.active,
    encounterFrame(2.4),
    home,
    1000,
  );
  assert.ok(returning.x > home.x && returning.x < 1010);
  assert.deepEqual(
    encounterCamera(state.active, encounterFrame(2.6), home, 1000),
    home,
  );
  state.active.elapsed = 0;
  const west = { ...state.active, x: 995, origin: { ...camera, x: 10 } };
  assert.equal(encounterCamera(west, held, camera, 1000).x, -5);
});

test("reduced motion keeps the title briefly with no zoom or slow motion", () => {
  const frame = encounterFrame(0.3, true);
  assert.equal(frame.focus, 0);
  assert.equal(frame.zoom, 1);
  assert.equal(frame.bars, 1);
  assert.ok(frame.banner > 0);
  assert.equal(frame.timeScale, 1);
  assert.equal(encounterFrame(0.9, true).complete, true);
  const state = createEncounterState();
  beginEncounter(state, raider, camera);
  advanceEncounter(state, 0.9, true);
  assert.equal(state.active, null);
});

test("bad deltas cannot reverse time and dropped frames finish the intro", () => {
  const state = createEncounterState();
  assert.equal(advanceEncounter(state, 1).complete, true);
  beginEncounter(state, raider, camera);
  advanceEncounter(state, NaN);
  advanceEncounter(state, -2);
  assert.equal(state.active.elapsed, 0);
  for (let i = 0; i < 30; i++) advanceEncounter(state, 1 / 30);
  assert.ok(Math.abs(state.active.elapsed - 1) < 1e-9);
  advanceEncounter(state, 10);
  assert.equal(state.active, null);
});

test("only surfaced whales and leviathans become encounter subjects", () => {
  assert.equal(creatureEncounter(0, [10, 20], { rise: 0.64 }), null);
  assert.equal(creatureEncounter(1, [10, 20], { rise: 1 }), null);
  const whale = creatureEncounter(3, [10, 20], { rise: 0.65 });
  assert.equal(whale.kind, "whale");
  assert.equal(whale.name, "The great whale");
  assert.deepEqual([whale.x, whale.y, whale.index], [10, 20, 3]);
  const monster = creatureEncounter(2, [10, 20], { rise: 1 });
  assert.equal(monster.kind, "monster");
  assert.equal(monster.name, "The deepwater leviathan");
});
