import assert from "node:assert/strict";
import test from "node:test";

import {
  applyComponentDamage,
  adjustedContractReward,
  adjustedIntelCost,
  buyProvisions,
  componentEfficiency,
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
  repairShipComponent,
  resolveCombatAction,
  resolveHostileEncounter,
  resolveVoyageOperations,
  shipCondition,
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
  assert.deepEqual(state.components, {
    hull: 0,
    rigging: 0,
    rudder: 0,
    fittings: 0,
    weapons: 0,
  });
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
  assert.equal(partial.components.hull, 80);

  const componentSave = normalizeOperationsState({
    condition: 70,
    components: {
      hull: 20,
      rigging: 40,
      rudder: 60,
      fittings: 80,
      weapons: 120,
    },
  });
  assert.deepEqual(componentSave.components, {
    hull: 20,
    rigging: 40,
    rudder: 60,
    fittings: 80,
    weapons: 100,
  });
  assert.equal(componentSave.condition, 60);
});

test("component condition determines aggregate condition and efficiency", () => {
  assert.equal(
    shipCondition({
      hull: 100,
      rigging: 80,
      rudder: 60,
      fittings: 40,
      weapons: 20,
    }),
    60,
  );
  assert.equal(shipCondition(), 100);
  assert.equal(componentEfficiency(100), 1);
  assert.equal(componentEfficiency(0), 0.45);
  assert.equal(componentEfficiency(-20), 0.45);
  assert.equal(componentEfficiency(200), 1);
});

test("component damage is bounded and updates overall condition", () => {
  const result = applyComponentDamage(createOperationsState(), {
    hull: 12.4,
    rigging: -5,
    rudder: 200,
    unknown: 50,
  });
  assert.deepEqual(result.applied, {
    hull: 12,
    rigging: 0,
    rudder: 100,
    fittings: 0,
    weapons: 0,
  });
  assert.equal(result.operations.components.hull, 88);
  assert.equal(result.operations.components.rudder, 0);
  assert.equal(result.operations.condition, 77.6);
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
  assert.ok(result.componentDamage.hull > 0);
  assert.ok(result.componentDamage.rigging > 0);
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
  assert.ok(capped.speedMultiplier < 0.7);
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
      componentDamage: {},
      moraleChange: 0,
      coinsLost: 0,
    },
  );
});

test("combat actions offer escape, negotiation, fighting, and surrender", () => {
  const defaults = resolveCombatAction({});
  assert.equal(defaults.outcome, "surrendered");
  assert.equal(defaults.coinsLost, 0);

  const bounded = resolveCombatAction({
    action: "surrender",
    attackStrength: 99,
    coins: -10,
  });
  assert.equal(bounded.componentDamage.fittings, 5);

  assert.equal(
    resolveCombatAction({
      action: "flee",
      attackStrength: 1,
      maxSpeed: 300,
      morale: 100,
      seed: 1,
    }).outcome,
    "escaped",
  );
  const caught = resolveCombatAction({
    action: "flee",
    attackStrength: 3,
    maxSpeed: 0,
    morale: 0,
    coins: 50,
    seed: 1,
  });
  assert.equal(caught.outcome, "caught");
  assert.ok(caught.componentDamage.rigging > 0);

  const parley = resolveCombatAction({
    action: "parley",
    attackStrength: 2,
    coins: 100,
  });
  assert.equal(parley.outcome, "parleyed");
  assert.equal(parley.coinsLost, 22);
  assert.ok(parley.description.includes("22 crowns"));

  const penniless = resolveCombatAction({
    action: "parley",
    attackStrength: 2,
  });
  assert.equal(penniless.coinsLost, 0);
  assert.ok(penniless.componentDamage.fittings > 0);

  const victory = resolveCombatAction({
    action: "fight",
    attackStrength: 1,
    defense: 3,
    morale: 100,
  });
  assert.equal(victory.outcome, "repelled");
  assert.equal(victory.moraleChange, 5);

  const defeat = resolveCombatAction({
    action: "fight",
    attackStrength: 3,
    defense: 0,
    morale: 0,
    coins: 100,
  });
  assert.equal(defeat.outcome, "boarded");
  assert.ok(defeat.componentDamage.hull > 0);

  const surrendered = resolveCombatAction({
    action: "surrender",
    attackStrength: 2,
    coins: 10,
  });
  assert.equal(surrendered.outcome, "surrendered");
  assert.equal(surrendered.coinsLost, 10);
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
    {
      ...createOperationsState(),
      condition: 90,
      components: {
        hull: 90,
        rigging: 90,
        rudder: 90,
        fittings: 90,
        weapons: 90,
      },
    },
    9,
  );
  assert.equal(repaired.repaired, 4);
  assert.equal(repaired.coins, 1);
  assert.equal(repairOperations(createOperationsState(), 100).repaired, 0);
  const targeted = repairShipComponent(
    {
      ...createOperationsState(),
      components: {
        hull: 80,
        rigging: 90,
        rudder: 100,
        fittings: 100,
        weapons: 100,
      },
    },
    15,
    "hull",
  );
  assert.equal(targeted.ok, true);
  assert.equal(targeted.repaired, 7);
  assert.equal(targeted.operations.components.hull, 87);
  assert.equal(targeted.coins, 1);
  assert.equal(
    repairShipComponent(createOperationsState(), 10, "mast").ok,
    false,
  );
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
