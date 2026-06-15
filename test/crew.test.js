import assert from "node:assert/strict";
import test from "node:test";

import {
  applyCrewVoyage,
  createCrewState,
  crewMutinyPressure,
  crewVoyageModifiers,
  crewWeeklyWage,
  normalizeCrewState,
  portRecruitmentPool,
  recruitCrew,
  resolveCrewIncident,
  takeShoreLeave,
} from "../src/core/crew.js";

test("crew state normalizes legacy and malformed saves", () => {
  assert.deepEqual(normalizeCrewState(null), createCrewState());
  const crew = normalizeCrewState({
    groups: {
      deck: {
        count: 99,
        experience: 120,
        fatigue: -5,
        injuries: 30,
        loyalty: -1,
      },
    },
    mutinyPressure: 200,
    lastIncidentDay: -3,
  });
  assert.deepEqual(crew.groups.deck, {
    role: "deck",
    count: 20,
    experience: 100,
    fatigue: 0,
    injuries: 20,
    loyalty: 0,
  });
  assert.equal(crew.mutinyPressure, 100);
  assert.equal(crew.lastIncidentDay, 0);
  assert.equal(crew.groups.marines.count, 2);
  assert.deepEqual(normalizeCrewState({ groups: { deck: null } }).groups.deck, {
    role: "deck",
    count: 8,
    experience: 45,
    fatigue: 0,
    injuries: 0,
    loyalty: 70,
  });
  assert.equal(
    normalizeCrewState({ groups: { deck: { count: 0 } } }).groups.deck.count,
    0,
  );
});

test("crew roles produce distinct wages and voyage capabilities", () => {
  const crew = createCrewState();
  assert.equal(crewWeeklyWage(crew), 18);
  const modifiers = crewVoyageModifiers(crew);
  assert.ok(modifiers.stormResistance > 1);
  assert.ok(modifiers.defense > 0);
  assert.ok(modifiers.repairCapacity > 0);
  assert.ok(modifiers.tradeBonus > 0);

  crew.groups.marines.injuries = 2;
  crew.groups.marines.fatigue = 100;
  assert.equal(crewVoyageModifiers(crew).defense, 0);
  crew.groups.stewards.count = 20;
  assert.equal(crewVoyageModifiers(crew).tradeBonus, 0.08);
});

test("hard voyages build fatigue, experience, injuries, and mutiny pressure", () => {
  const crew = applyCrewVoyage(createCrewState(), {
    days: 5,
    roughness: 1,
    shortage: 2,
  });
  assert.ok(crew.groups.deck.fatigue > crew.groups.stewards.fatigue);
  assert.ok(crew.groups.deck.experience > 45);
  assert.equal(crew.groups.deck.injuries, 1);
  assert.ok(crew.groups.deck.loyalty < 70);
  assert.ok(crew.mutinyPressure > 0);
  assert.equal(crewMutinyPressure(createCrewState()), 0);

  const routine = applyCrewVoyage(createCrewState(), {
    days: 1,
    roughness: 0,
    shortage: 0,
  });
  assert.equal(routine.groups.deck.injuries, 0);
  assert.equal(routine.groups.deck.fatigue, 3);
  const moderate = applyCrewVoyage(createCrewState(), {
    days: 3,
    roughness: 1,
    shortage: 0,
  });
  assert.equal(moderate.groups.artisans.injuries, 1);
});

test("arrears escalate through refusal, theft, desertion, and mutiny", () => {
  const base = createCrewState();
  const quiet = resolveCrewIncident(base, { day: 4, arrears: 0, coins: 50 });
  assert.equal(quiet.incident, null);

  const refusal = resolveCrewIncident(base, {
    day: 4,
    arrears: 42,
    coins: 50,
  });
  assert.equal(refusal.incident.type, "refusal");

  const theft = resolveCrewIncident(base, {
    day: 4,
    arrears: 60,
    coins: 5,
  });
  assert.equal(theft.incident.type, "theft");
  assert.equal(theft.incident.coinsLost, 5);

  const desertion = resolveCrewIncident(base, {
    day: 4,
    arrears: 75,
    coins: 50,
  });
  assert.equal(desertion.incident.type, "desertion");
  assert.equal(desertion.crew.groups.deck.count, 7);

  const mutiny = resolveCrewIncident(base, {
    day: 4,
    arrears: 100,
    coins: 10,
  });
  assert.equal(mutiny.incident.type, "mutiny");
  assert.equal(mutiny.incident.coinsLost, 10);
  assert.equal(
    resolveCrewIncident(mutiny.crew, { day: 5, arrears: 100 }).incident,
    null,
  );
  assert.equal(
    resolveCrewIncident(base, { day: 5, arrears: 100 }).incident,
    null,
  );
});

test("ports offer deterministic recruits and recruitment enforces limits", () => {
  const pool = portRecruitmentPool("Goldhaven", 86400);
  assert.deepEqual(pool, portRecruitmentPool("Goldhaven", 86400));
  assert.equal(pool.length, 4);
  const offer = pool[0];
  const hired = recruitCrew(createCrewState(), offer, offer.cost);
  assert.equal(hired.ok, true);
  assert.equal(hired.coins, 0);
  assert.equal(hired.crew.groups.deck.count, 9);
  assert.equal(recruitCrew(createCrewState(), offer, 0).ok, false);
  assert.equal(
    recruitCrew(createCrewState(), { ...offer, available: 0 }, 100).ok,
    false,
  );
  assert.equal(recruitCrew(createCrewState(), { role: "cook" }, 100).ok, false);
  assert.equal(recruitCrew(createCrewState(), undefined, 100).ok, false);
});

test("shore leave costs time and money while restoring readiness", () => {
  const crew = createCrewState();
  for (const group of Object.values(crew.groups)) {
    group.fatigue = 60;
    group.loyalty = 40;
    group.injuries = 1;
  }
  const denied = takeShoreLeave(crew, 0);
  assert.equal(denied.ok, false);
  assert.equal(denied.days, 0);
  const leave = takeShoreLeave(crew, 100, 2);
  assert.equal(leave.ok, true);
  assert.equal(leave.days, 2);
  assert.ok(leave.coins < 100);
  assert.equal(leave.crew.groups.deck.fatigue, 32);
  assert.equal(leave.crew.groups.deck.loyalty, 50);
  assert.equal(leave.crew.groups.deck.injuries, 0);
  assert.equal(takeShoreLeave(createCrewState(), 100).days, 1);
});
