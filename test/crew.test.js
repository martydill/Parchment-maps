import { PORT_NAMES } from "../src/names.js";
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyCrewTrait,
  applyCrewVoyage,
  createCrewState,
  crewMutinyPressure,
  crewTraitLabel,
  crewVoyageModifiers,
  crewWeeklyWage,
  CREW_TRAITS,
  normalizeCrewState,
  portRecruitmentPool,
  recruitCrew,
  resolveCrewVoyageEvent,
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
    traits: [],
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
    traits: [],
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
  const pool = portRecruitmentPool(PORT_NAMES.orvessaQuay, 86400);
  assert.deepEqual(pool, portRecruitmentPool(PORT_NAMES.orvessaQuay, 86400));
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

test("crew normalization preserves a bounded unique trait list", () => {
  const crew = normalizeCrewState({
    groups: {
      deck: {
        count: 8,
        traits: [
          "Sure-footed",
          "Sure-footed",
          7,
          "Reefwise",
          "Calm",
          "Bold",
          "Keen",
          "Patient",
          "Extra",
        ],
      },
    },
  });

  assert.deepEqual(crew.groups.deck.traits, [
    "Sure-footed",
    "Reefwise",
    "Calm",
    "Bold",
    "Keen",
    "Patient",
  ]);
});

test("crew voyage events award officer-led traits and bounded rewards", () => {
  const storm = resolveCrewVoyageEvent(createCrewState(), {
    days: 4,
    distance: 1800,
    roughness: 0.9,
    routePlan: "fast",
    specialistId: "boatswain",
    origin: PORT_NAMES.orvessaQuay,
    destination: PORT_NAMES.narthkel,
  });

  assert.equal(storm.event.id, "boatswain-rigging");
  assert.equal(storm.event.trait, CREW_TRAITS.artisans.juryRiggers.id);
  assert.equal(storm.event.roleLabel, "Artisans");
  assert.equal(storm.event.repair.rigging, 3);
  assert.ok(storm.crew.groups.artisans.traits.includes("jury-riggers"));
  assert.ok(storm.crew.groups.artisans.experience > 35);

  const repeated = resolveCrewVoyageEvent(storm.crew, {
    days: 4,
    distance: 1800,
    roughness: 0.9,
    routePlan: "fast",
    specialistId: "boatswain",
  });
  assert.notEqual(repeated.event?.trait, "jury-riggers");

  const quiet = resolveCrewVoyageEvent(createCrewState(), {
    days: 0,
    distance: 120,
    roughness: 0,
  });
  assert.equal(quiet.event, null);
});

test("crew traits can be applied directly without duplicating invalid entries", () => {
  const applied = applyCrewTrait(
    createCrewState(),
    "deck",
    CREW_TRAITS.deck.routeSavvy.id,
    12,
    5,
  );
  assert.equal(applied.gained, true);
  assert.deepEqual(applied.crew.groups.deck.traits, ["route-savvy"]);
  assert.equal(applied.crew.groups.deck.experience, 57);
  assert.equal(applied.crew.groups.deck.loyalty, 75);

  const duplicate = applyCrewTrait(
    applied.crew,
    "deck",
    CREW_TRAITS.deck.routeSavvy.id,
  );
  assert.equal(duplicate.gained, false);
  assert.deepEqual(duplicate.crew.groups.deck.traits, ["route-savvy"]);

  const invalid = applyCrewTrait(createCrewState(), "cooks", "route-savvy");
  assert.equal(invalid.gained, false);
  const unknownTrait = applyCrewTrait(createCrewState(), "deck", "unknown");
  assert.equal(unknownTrait.gained, false);
  assert.equal(crewTraitLabel("unknown"), "unknown");
});

test("crew voyage events cover rationing relief, ties, and fully trained crews", () => {
  const rationing = resolveCrewVoyageEvent(createCrewState(), {
    days: 2,
    distance: 500,
    roughness: 0.1,
    shortage: 2,
    routePlan: "rationing",
    specialistId: "purser",
  });
  assert.equal(rationing.event.id, "purser-ledger");
  assert.equal(rationing.event.provisions, 1);
  assert.equal(rationing.event.trait, CREW_TRAITS.stewards.rationMasters.id);
  assert.equal(rationing.crew.groups.deck.loyalty, 71);
  assert.equal(rationing.crew.groups.stewards.loyalty, 74);

  const tied = resolveCrewVoyageEvent(createCrewState(), {
    days: 1,
    distance: 1200,
    roughness: 0,
    routePlan: "battle",
    seed: "tie-breaker",
  });
  assert.equal(tied.event.id, "convoy-signal-watch");
  assert.equal(tied.event.trait, CREW_TRAITS.marines.convoySentinels.id);

  let trained = createCrewState();
  for (const [role, traits] of Object.entries(CREW_TRAITS)) {
    trained.groups[role].traits = Object.values(traits).map(
      (trait) => trait.id,
    );
  }
  const noLesson = resolveCrewVoyageEvent(trained, {
    days: 5,
    distance: 2400,
    roughness: 1,
    shortage: 3,
    routePlan: "fast",
    specialistId: "boatswain",
  });
  assert.equal(noLesson.event, null);
});

test("crew voyage events cover remaining mentor branches", () => {
  assert.equal(resolveCrewVoyageEvent(null, {}).event, null);

  const navigator = resolveCrewVoyageEvent(createCrewState(), {
    days: 3,
    distance: 1200,
    roughness: 0,
    specialistId: "navigator",
  });
  assert.equal(navigator.event.id, "navigator-drills");

  const market = resolveCrewVoyageEvent(createCrewState(), {
    days: 2,
    distance: 500,
    roughness: 0,
    specialistId: "factor",
  });
  assert.equal(market.event.id, "factor-quay-auction");
  assert.equal(market.event.trait, CREW_TRAITS.stewards.contractBrokers.id);
  assert.equal(market.event.provisions, 0);

  const storm = resolveCrewVoyageEvent(createCrewState(), {
    days: 3,
    distance: 600,
    roughness: 0.8,
    specialistId: "surgeon",
  });
  assert.equal(storm.event.id, "storm-watch");
  assert.equal(storm.event.officerLoyalty, 2);
});

test("crew voyage events apply long-voyage experience caps with default planning context", () => {
  const long = resolveCrewVoyageEvent(createCrewState(), {
    days: 8,
    distance: 1300,
    roughness: 0.6,
  });
  assert.equal(long.event.id, "navigator-drills");
  assert.equal(long.crew.groups.deck.experience, 52);
});

test("gunner mentorship can drive marine progression without battle orders", () => {
  const event = resolveCrewVoyageEvent(createCrewState(), {
    days: 1,
    distance: 300,
    roughness: 0,
    specialistId: "gunner",
  });
  assert.equal(event.event.id, "gunner-quarters");
  assert.equal(event.event.trait, CREW_TRAITS.marines.boardingDrilled.id);
});

test("expanded voyage events include naturalist, smuggler, and hardware lessons", () => {
  const naturalist = resolveCrewVoyageEvent(createCrewState(), {
    days: 2,
    distance: 950,
    roughness: 0.1,
    specialistId: "naturalist",
  });
  assert.equal(naturalist.event.id, "naturalist-sea-signs");
  assert.equal(naturalist.event.trait, CREW_TRAITS.deck.currentReaders.id);

  const smuggler = resolveCrewVoyageEvent(createCrewState(), {
    days: 1,
    distance: 800,
    roughness: 0.2,
    routePlan: "fast",
    specialistId: "smuggler",
  });
  assert.equal(smuggler.event.id, "smuggler-manifest-lessons");
  assert.equal(smuggler.event.trait, CREW_TRAITS.stewards.discreetFactors.id);

  const artisans = resolveCrewVoyageEvent(createCrewState(), {
    days: 5,
    distance: 650,
    roughness: 0.2,
    specialistId: "boatswain",
  });
  assert.equal(artisans.event.id, "dockyard-hardware-drills");
  assert.equal(artisans.event.trait, CREW_TRAITS.artisans.copperhands.id);
  assert.deepEqual(artisans.event.repair, { fittings: 2, rudder: 1 });
});
