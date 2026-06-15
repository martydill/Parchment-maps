import assert from "node:assert/strict";
import test from "node:test";

import {
  adjustSpecialistLoyalty,
  createSpecialistState,
  normalizeSpecialistState,
  resolveSpecialistEvent,
  SPECIALIST_ROSTER,
  specialistCombatBonus,
  specialistExplorationBonus,
  specialistPower,
  specialistRewardMultiplier,
  specialistVoyageModifiers,
} from "../src/core/specialists.js";

test("specialist roster supplies a named character for every officer role", () => {
  assert.equal(SPECIALIST_ROSTER.length, 8);
  assert.deepEqual(
    SPECIALIST_ROSTER.map((officer) => officer.role),
    [
      "Navigator",
      "Purser",
      "Boatswain",
      "Gunner",
      "Surgeon",
      "Factor",
      "Smuggler",
      "Naturalist",
    ],
  );
  for (const officer of SPECIALIST_ROSTER) {
    assert.ok(officer.name);
    assert.ok(officer.emblem);
    assert.ok(officer.benefit);
    assert.ok(officer.flaw);
    assert.ok(officer.ambition);
    assert.ok(officer.relationship);
  }
});

test("specialist state normalizes legacy and invalid saves", () => {
  assert.deepEqual(normalizeSpecialistState(), createSpecialistState());
  const state = normalizeSpecialistState({
    officers: [
      { id: "navigator", loyalty: 200, events: -2 },
      { id: "gunner", loyalty: -5, events: 2.8 },
    ],
    lastEventDay: -4,
  });
  assert.equal(state.officers[0].loyalty, 100);
  assert.equal(state.officers[0].events, 0);
  assert.equal(state.officers[3].loyalty, 0);
  assert.equal(state.officers[3].events, 2);
  assert.equal(state.lastEventDay, 0);
});

test("loyalty scales all specialist mechanical benefits", () => {
  const state = createSpecialistState();
  assert.equal(specialistPower(state, "missing"), 0);
  assert.ok(specialistCombatBonus(state) > 0);
  assert.ok(specialistExplorationBonus(state) > 0);
  assert.ok(specialistRewardMultiplier(state) > 1);
  const modifiers = specialistVoyageModifiers(state);
  assert.ok(modifiers.distanceMultiplier < 1);
  assert.ok(modifiers.provisionMultiplier < 1);
  assert.ok(modifiers.damageMultiplier < 1);
  assert.ok(modifiers.moraleLossMultiplier < 1);
  assert.equal(
    adjustSpecialistLoyalty(state, "unknown", 5).officers[0].loyalty,
    60,
  );
  assert.equal(
    adjustSpecialistLoyalty(state, "gunner", -80).officers[3].loyalty,
    0,
  );
});

test("weekly personal events reflect loyalty and rotate through officers", () => {
  const early = resolveSpecialistEvent(createSpecialistState(), 6);
  assert.equal(early.event, null);
  const positive = resolveSpecialistEvent(early.state, 7);
  assert.match(positive.event.title, /Eira Voss/);
  assert.equal(positive.event.morale, 1);
  assert.equal(resolveSpecialistEvent(positive.state, 8).event, null);

  let low = adjustSpecialistLoyalty(createSpecialistState(), "purser", -30);
  low.lastEventDay = 7;
  const negative = resolveSpecialistEvent(low, 14);
  assert.match(negative.event.title, /Silas Quill/);
  assert.equal(negative.event.coins, -3);
  assert.equal(negative.state.officers[1].events, 1);

  let favored = adjustSpecialistLoyalty(createSpecialistState(), "factor", 20);
  favored.lastEventDay = 35;
  const factor = resolveSpecialistEvent(favored, 42);
  assert.equal(factor.event.coins, 3);
});
