import assert from "node:assert/strict";
import test from "node:test";

import {
  adjustedContractReward,
  adjustedIntelCost,
  buyProvisions,
  contractOutcome,
  createOperationsState,
  estimateVoyageReadiness,
  factionPrivilege,
  fulfillObligationsAtPort,
  intelligenceFreshness,
  maybeCreateObligation,
  normalizeOperationsState,
  processObligations,
  processWages,
  repairOperations,
  resolveHostileEncounter,
  resolveVoyageOperations,
  weatherRoughness,
} from "../src/core/operations.js";

test("operations state normalizes old and invalid saves", () => {
  assert.deepEqual(normalizeOperationsState(null), createOperationsState());
  assert.deepEqual(normalizeOperationsState({}), createOperationsState());
  const state = normalizeOperationsState({
    provisions: 99,
    condition: -4,
    morale: 200,
    wagesDueDay: 0,
    obligations: {},
  });
  assert.equal(state.provisions, 30);
  assert.equal(state.condition, 0);
  assert.equal(state.morale, 100);
  assert.equal(state.wagesDueDay, 1);
  assert.deepEqual(state.obligations, []);
  const partial = normalizeOperationsState({
    provisions: 4,
    condition: 80,
    morale: 60,
    wagesDueDay: 12,
    wageArrears: 7,
    obligations: [{ id: "O1" }],
    nextObligationId: 3,
  });
  assert.equal(partial.wageArrears, 7);
  assert.equal(partial.nextObligationId, 3);
  assert.equal(partial.obligations.length, 1);
});

test("faction ranks grant escalating contract and intelligence benefits", () => {
  assert.equal(factionPrivilege(9).label, "Unproven");
  assert.equal(factionPrivilege(10).label, "Trusted factor");
  assert.equal(factionPrivilege(25).label, "Favored captain");
  assert.equal(factionPrivilege(45).label, "Chartered ally");
  assert.equal(adjustedContractReward(100, 45), 115);
  assert.equal(adjustedIntelCost(100, 25), 85);
  assert.equal(adjustedIntelCost(2, 45), 2);
});

test("intelligence visibly decays before expiry", () => {
  const report = { boughtDay: 2, expiresDay: 8 };
  assert.equal(intelligenceFreshness(report, 3).label, "Current");
  assert.equal(intelligenceFreshness(report, 5).label, "Aging");
  assert.equal(intelligenceFreshness(report, 7).label, "Stale");
  assert.equal(intelligenceFreshness(report, 9).label, "Expired");
  assert.equal(intelligenceFreshness({ expiresDay: 4 }, 4).label, "Stale");
});

test("voyages consume supplies and convert comfort and weather into consequences", () => {
  assert.deepEqual(
    estimateVoyageReadiness(621, {
      crewComfort: 1,
      stormResistance: 1,
    }),
    { days: 2, provisionsNeeded: 4, conditionRisk: 3 },
  );
  const result = resolveVoyageOperations(createOperationsState(), {
    distance: 1240,
    days: 2,
    roughness: 0.8,
    stats: { crewComfort: 1, stormResistance: 1 },
  });
  assert.equal(result.provisionsUsed, 4);
  assert.ok(result.damage > 0);
  assert.ok(result.operations.condition < 100);
  assert.ok(result.operations.morale < 75);

  const hungry = resolveVoyageOperations(
    { ...createOperationsState(), provisions: 0 },
    {
      distance: 620,
      days: 1,
      roughness: 0,
      stats: { crewComfort: 1.5, stormResistance: 2 },
    },
  );
  assert.ok(hungry.shortage > 0);
  assert.ok(hungry.operations.morale < result.operations.morale);
  const capped = resolveVoyageOperations(createOperationsState(), {
    distance: 100000,
    days: 100,
    roughness: 10,
    stats: { crewComfort: 0.1, stormResistance: 0.1 },
  });
  assert.equal(capped.damage, 35);
  assert.equal(capped.operations.condition, 65);
  assert.equal(capped.speedMultiplier, 0.7);
});

test("weather roughness uses explicit weather data and storm resistance", () => {
  assert.equal(weatherRoughness({ roughness: 0.5 }, 2), 0.25);
  assert.equal(weatherRoughness({ roughness: 0.5 }, 0.1), 1);
  assert.equal(weatherRoughness({}, 1), 0);
});

test("defensive armament deters and repels hostile encounters", () => {
  let encounterSeed = 0;
  while (
    !resolveHostileEncounter({
      distance: 1600,
      risk: 0.8,
      defense: 0,
      seed: encounterSeed,
    }).encountered
  )
    encounterSeed += 1;

  const unarmed = resolveHostileEncounter({
    distance: 1600,
    risk: 0.8,
    defense: 0,
    seed: encounterSeed,
  });
  assert.equal(unarmed.encountered, true);
  assert.equal(unarmed.repelled, false);
  assert.ok(unarmed.conditionDamage > 0);
  assert.ok(unarmed.coinsLost > 0);
  assert.ok(unarmed.moraleChange < 0);

  const armed = resolveHostileEncounter({
    distance: 1600,
    risk: 0.8,
    defense: 3,
    seed: encounterSeed,
  });
  if (armed.encountered) {
    assert.equal(armed.repelled, true);
    assert.equal(armed.coinsLost, 0);
    assert.ok(armed.moraleChange > 0);
  }

  assert.deepEqual(
    resolveHostileEncounter({
      distance: 0,
      risk: 0.8,
      defense: 0,
      seed: encounterSeed,
    }),
    {
      encountered: false,
      repelled: false,
      conditionDamage: 0,
      moraleChange: 0,
      coinsLost: 0,
    },
  );
});

test("weekly wages, provisions, and repairs create predictable operating costs", () => {
  const wages = processWages(createOperationsState(), 8, 20);
  assert.equal(wages.paid, 18);
  assert.equal(wages.coins, 2);
  const missed = processWages(createOperationsState(), 8, 5);
  assert.equal(missed.missed, 18);
  assert.equal(missed.operations.wageArrears, 18);
  const multiple = processWages(createOperationsState(), 22, 100);
  assert.equal(multiple.paid, 54);
  assert.equal(multiple.operations.wagesDueDay, 29);

  const provisioned = buyProvisions(
    { ...createOperationsState(), provisions: 10 },
    12,
  );
  assert.equal(provisioned.purchased, 4);
  assert.equal(provisioned.coins, 0);
  const repaired = repairOperations(
    { ...createOperationsState(), condition: 90 },
    9,
  );
  assert.equal(repaired.repaired, 4);
  assert.equal(repaired.coins, 1);
  assert.equal(repairOperations(createOperationsState(), 100).repaired, 0);
  assert.equal(
    buyProvisions({ ...createOperationsState(), provisions: 30 }, 100)
      .purchased,
    0,
  );
});

test("contracts resolve to on-time, late, and defaulted outcomes", () => {
  const contract = { reward: 100, influence: 8, deadline: 5 };
  assert.deepEqual(contractOutcome(contract, 5, 10), {
    grade: "On time",
    reward: 105,
    standing: 8,
    completed: true,
  });
  assert.equal(contractOutcome(contract, 7).reward, 55);
  assert.equal(contractOutcome(contract, 8).grade, "Defaulted");
});

test("favored factions create obligations that can be fulfilled or failed", () => {
  let result = maybeCreateObligation(createOperationsState(), "Guild", 25, 3);
  assert.equal(result.obligation.dueDay, 11);
  assert.equal(
    maybeCreateObligation(result.operations, "Guild", 50, 4).obligation,
    null,
  );
  const fulfilled = fulfillObligationsAtPort(result.operations, ["Guild"], 5);
  assert.equal(fulfilled.fulfilled.length, 1);
  assert.equal(
    fulfillObligationsAtPort(result.operations, ["Other"], 12).fulfilled.length,
    0,
  );
  assert.equal(
    fulfillObligationsAtPort(fulfilled.operations, ["Guild"], 5).fulfilled
      .length,
    0,
  );

  result = maybeCreateObligation(createOperationsState(), "League", 25, 1);
  const failed = processObligations(result.operations, 10);
  assert.equal(failed.failed.length, 1);
  assert.equal(processObligations(failed.operations, 11).failed.length, 0);
  assert.equal(
    maybeCreateObligation(createOperationsState(), "Minor", 24, 1).obligation,
    null,
  );
});
