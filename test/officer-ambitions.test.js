import assert from "node:assert/strict";
import test from "node:test";
import { PORT_NAMES } from "../src/names.js";
import {
  advanceOfficerAmbitions,
  createSpecialistState,
  normalizeSpecialistState,
  officerAbilityUnlocked,
  OFFICER_AMBITIONS,
  resolveOfficerAmbition,
  SPECIALIST_ROSTER,
  specialistCombatBonus,
  specialistCustomsRelief,
  specialistExplorationBonus,
  specialistRewardMultiplier,
  specialistVoyageModifiers,
} from "../src/core/specialists.js";
import { createLegalState, resolveCustoms } from "../src/core/jurisdictions.js";
import {
  createOperationsState,
  resolveVoyageOperations,
} from "../src/core/operations.js";
import {
  createSaveData,
  parseSave,
  serializeSave,
} from "../src/core/persistence.js";
import { createGameState } from "../src/core/state.js";
import { wrappedDistance } from "../src/core/math.js";
import { estimateVoyageDays } from "../src/core/voyage-time.js";

function offeredState(officerId = "navigator", day = 3) {
  const state = createSpecialistState();
  const officer = state.officers.find((item) => item.id === officerId);
  officer.ambition = { status: "offered", offeredDay: day, deadline: day + 8 };
  return state;
}

function choose(state, action, overrides = {}) {
  return resolveOfficerAmbition(state, {
    officerId: "navigator",
    action,
    day: 3,
    coins: 120,
    ...overrides,
  });
}

function complete(state, officerId = "navigator") {
  const accepted = choose(state, "accept", { officerId });
  assert.equal(accepted.ok, true);
  return choose(accepted.state, "complete", {
    officerId,
    day: 11,
    portName: OFFICER_AMBITIONS[officerId].destination,
    coins: OFFICER_AMBITIONS[officerId].cost,
  });
}

test("every officer has an actionable favor, a real destination, and a distinct ability", () => {
  assert.deepEqual(
    Object.keys(OFFICER_AMBITIONS),
    SPECIALIST_ROSTER.map((item) => item.id),
  );
  assert.equal(
    new Set(Object.values(OFFICER_AMBITIONS).map((item) => item.ability)).size,
    8,
  );
  for (const ambition of Object.values(OFFICER_AMBITIONS)) {
    assert.ok(Object.values(PORT_NAMES).includes(ambition.destination));
    assert.ok(ambition.cost > 0);
    for (const field of [
      "title",
      "request",
      "task",
      "ability",
      "reward",
      "outcome",
    ])
      assert.ok(ambition[field]);
  }
});

test("older and malformed specialist saves normalize without unlocking rewards", () => {
  const state = normalizeSpecialistState({
    officers: [
      null,
      "bad",
      {
        id: "navigator",
        loyalty: "bad",
        events: Infinity,
        ambition: { status: "invented" },
      },
      {
        id: "purser",
        loyalty: Infinity,
        ambition: { status: "accepted", offeredDay: "bad", deadline: Infinity },
      },
      {
        id: "gunner",
        ambition: { status: "offered", offeredDay: 10.8, deadline: -3 },
      },
      { id: "surgeon", loyalty: 72.5 },
    ],
    lastAmbitionDay: Infinity,
    lastEventDay: "bad",
  });
  assert.equal(state.officers[0].loyalty, 60);
  assert.equal(state.officers[0].events, 0);
  assert.equal(state.officers[0].ambition.status, "unoffered");
  assert.equal(state.officers[1].loyalty, 60);
  assert.equal(state.officers[4].loyalty, 72.5);
  assert.deepEqual(state.officers[1].ambition, {
    status: "accepted",
    offeredDay: 1,
    deadline: 1,
  });
  assert.deepEqual(state.officers[3].ambition, {
    status: "offered",
    offeredDay: 10,
    deadline: 10,
  });
  assert.equal(state.lastAmbitionDay, 0);
  assert.equal(state.lastEventDay, 0);
  assert.equal(officerAbilityUnlocked(state, "navigator"), false);
  assert.equal(officerAbilityUnlocked(state, "unknown"), false);
  assert.equal(specialistCustomsRelief(state), 0);
  assert.deepEqual(
    normalizeSpecialistState({ officers: {} }),
    createSpecialistState(),
  );
});

test("requests start on day three, stay singular, and use the original offer deadline", () => {
  const original = createSpecialistState();
  const early = advanceOfficerAmbitions(original, 2);
  assert.deepEqual(early.state, original);
  assert.deepEqual(early.events, []);
  const first = advanceOfficerAmbitions(original, 3);
  assert.equal(first.events.length, 1);
  assert.match(first.events[0].title, /Eira Voss asks a favor/);
  assert.deepEqual(first.state.officers[0].ambition, {
    status: "offered",
    offeredDay: 3,
    deadline: 11,
  });
  assert.equal(
    original.officers[0].ambition.status,
    "unoffered",
    "transitions do not mutate inputs",
  );
  assert.equal(advanceOfficerAmbitions(first.state, 10).events.length, 0);
  const accepted = choose(first.state, "accept", { day: 10 });
  assert.equal(accepted.state.officers[0].ambition.deadline, 11);
  assert.equal(
    accepted.coins,
    120,
    "promising does not spend the completion fee",
  );
  assert.equal(advanceOfficerAmbitions(accepted.state, 11).events.length, 0);
});

test("long passages get travel allowance, including across the wrapping meridian", () => {
  const far = advanceOfficerAmbitions(undefined, 3, 12);
  assert.equal(far.state.officers[0].ambition.deadline, 19);
  const wrapped = advanceOfficerAmbitions(undefined, 3, (destination) => {
    assert.equal(destination, PORT_NAMES.narthkel);
    return estimateVoyageDays(wrappedDistance(10, 0, 5990, 0, 6000));
  });
  assert.equal(wrapped.state.officers[0].ambition.deadline, 11);
  assert.equal(
    advanceOfficerAmbitions(undefined, 3, NaN).state.officers[0].ambition
      .deadline,
    11,
  );
});

test("refusal costs loyalty and the next officer waits for the seven-day cadence", () => {
  const offered = advanceOfficerAmbitions(undefined, 3).state;
  const refused = choose(offered, "refuse");
  assert.equal(refused.ok, true);
  assert.equal(refused.state.officers[0].loyalty, 52);
  assert.equal(refused.state.officers[0].ambition.status, "refused");
  assert.equal(refused.coins, 120);
  assert.equal(offered.officers[0].loyalty, 60);
  assert.equal(advanceOfficerAmbitions(refused.state, 9).events.length, 0);
  const next = advanceOfficerAmbitions(refused.state, 10);
  assert.equal(next.events[0].officerId, "purser");
  assert.equal(next.state.officers[0].ambition.status, "refused");
  const low = offeredState();
  low.officers[0].loyalty = 2;
  assert.equal(choose(low, "refuse").state.officers[0].loyalty, 0);
});

test("ignored requests and broken promises expire once with different loyalty losses", () => {
  for (const [accepted, loss] of [
    [false, 4],
    [true, 12],
  ]) {
    const offered = advanceOfficerAmbitions(undefined, 3).state;
    const state = accepted ? choose(offered, "accept").state : offered;
    state.officers[0].loyalty = 10;
    const expired = advanceOfficerAmbitions(state, 12);
    assert.equal(expired.state.officers[0].ambition.status, "failed");
    assert.equal(expired.state.officers[0].loyalty, Math.max(0, 10 - loss));
    assert.match(expired.events[0].body, new RegExp(`${loss} loyalty lost`));
    assert.equal(
      expired.events.length,
      2,
      "the next officer may offer a request after expiry",
    );
    assert.equal(advanceOfficerAmbitions(expired.state, 12).events.length, 0);
    assert.equal(officerAbilityUnlocked(expired.state, "navigator"), false);
  }
});

test("help requires a promise, timely docking, and sufficient funds; failures leave state alone", () => {
  const state = offeredState();
  const accepted = choose(state, "accept").state;
  const before = structuredClone(accepted);
  const failures = [
    [choose(state, "accept", { officerId: "unknown" }), /Unknown officer/],
    [choose(createSpecialistState(), "accept"), /no longer available/],
    [choose(state, "accept", { day: 12 }), /deadline has passed/],
    [
      choose(state, "complete", { portName: PORT_NAMES.narthkel }),
      /unavailable/,
    ],
    [choose(accepted, "accept"), /unavailable/],
    [choose(accepted, "refuse"), /unavailable/],
    [choose(accepted, "unknown"), /unavailable/],
    [choose(accepted, "complete"), /Dock at/],
    [
      choose(accepted, "complete", { portName: PORT_NAMES.orvessaQuay }),
      /Dock at/,
    ],
    [
      choose(accepted, "complete", {
        portName: PORT_NAMES.narthkel,
        coins: 29,
      }),
      /30 crowns/,
    ],
    [
      choose(accepted, "complete", {
        portName: PORT_NAMES.narthkel,
        coins: Infinity,
      }),
      /30 crowns/,
    ],
    [
      choose(accepted, "complete", { portName: PORT_NAMES.narthkel, day: 12 }),
      /deadline has passed/,
    ],
  ];
  for (const [result, reason] of failures) {
    assert.equal(result.ok, false);
    assert.match(result.reason, reason);
  }
  assert.deepEqual(accepted, before);
  assert.equal(officerAbilityUnlocked(accepted, "navigator"), false);
});

test("all eight favors complete on the deadline, charge once, and unlock only their own ability", () => {
  for (const { id } of SPECIALIST_ROSTER) {
    const result = complete(offeredState(id), id);
    assert.equal(result.ok, true);
    assert.equal(result.coins, 0);
    const officer = result.state.officers.find((item) => item.id === id);
    assert.equal(officer.loyalty, 75);
    assert.equal(officer.ambition.status, "completed");
    assert.match(result.event.body, /Unlocked/);
    for (const other of SPECIALIST_ROSTER)
      assert.equal(
        officerAbilityUnlocked(result.state, other.id),
        other.id === id,
      );
    assert.equal(choose(result.state, "complete", { officerId: id }).ok, false);
  }
  const loyal = offeredState();
  loyal.officers[0].loyalty = 99;
  assert.equal(complete(loyal).state.officers[0].loyalty, 100);
});

test("finished requests never repeat after every officer has had a turn", () => {
  let state = createSpecialistState();
  for (let i = 0; i < SPECIALIST_ROSTER.length; i++) {
    const day = 3 + i * 7;
    const offer = advanceOfficerAmbitions(state, day);
    assert.equal(offer.events[0].officerId, SPECIALIST_ROSTER[i].id);
    state = choose(offer.state, "refuse", {
      officerId: SPECIALIST_ROSTER[i].id,
      day,
    }).state;
  }
  assert.equal(advanceOfficerAmbitions(state, 1000).events.length, 0);
});

test("learned abilities change voyage, combat, contract, exploration, and customs mechanics", () => {
  const state = createSpecialistState();
  const locked = structuredClone(state);
  for (const officer of state.officers)
    officer.ambition = { status: "completed", offeredDay: 3, deadline: 11 };
  const base = specialistVoyageModifiers(locked);
  const improved = specialistVoyageModifiers(state);
  for (const [key, ratio] of [
    ["distanceMultiplier", 0.88],
    ["provisionMultiplier", 0.8],
    ["damageMultiplier", 0.75],
    ["moraleLossMultiplier", 0.5],
  ]) {
    assert.equal(improved[key], base[key] * ratio);
  }
  assert.equal(
    specialistCombatBonus(state),
    specialistCombatBonus(locked) + 0.6,
  );
  assert.equal(
    specialistRewardMultiplier(state),
    specialistRewardMultiplier(locked) + 0.1,
  );
  assert.equal(
    specialistExplorationBonus(state),
    specialistExplorationBonus(locked) + 5,
  );
  const voyage = (modifiers) =>
    resolveVoyageOperations(createOperationsState(), {
      distance: 3000 * modifiers.distanceMultiplier,
      days: 5,
      roughness: 0.8,
      stats: { ...modifiers, stormResistance: 1, crewComfort: 1 },
    });
  assert.ok(voyage(improved).provisionsUsed < voyage(base).provisionsUsed);
  assert.ok(voyage(improved).damage < voyage(base).damage);
  assert.ok(
    voyage(improved).operations.morale > voyage(base).operations.morale,
  );
  const customs = (specialists) =>
    resolveCustoms({
      state: createLegalState(),
      portName: PORT_NAMES.orvessaQuay,
      day: 5,
      lots: [],
      scrutinyRelief: specialistCustomsRelief(specialists),
    });
  assert.equal(customs(state).scrutiny, customs(locked).scrutiny - 0.15);
  const minimum = resolveCustoms({
    state: createLegalState(),
    portName: PORT_NAMES.orvessaQuay,
    day: 5,
    lots: [],
    reputation: 200,
    scrutinyRelief: specialistCustomsRelief(state),
  });
  assert.equal(minimum.scrutiny, 0.05);
});

test("requests, earned abilities, and scheduling survive the normal save round trip", () => {
  const game = createGameState();
  game.specialists = advanceOfficerAmbitions(
    complete(offeredState()).state,
    20,
  ).state;
  const saved = createSaveData({
    game,
    ship: {},
    merchants: [],
    worldEvents: {},
    gameStarted: true,
  });
  const restored = parseSave(serializeSave(saved));
  assert.deepEqual(
    normalizeSpecialistState(restored.game.specialists),
    game.specialists,
  );
  assert.equal(
    officerAbilityUnlocked(restored.game.specialists, "navigator"),
    true,
  );
  assert.equal(
    restored.game.specialists.officers[1].ambition.status,
    "offered",
  );
});
