import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceCrises,
  applyCrisisAftermath,
  cargoInterventionStatus,
  CRISIS_TEMPLATES,
  createCrisisState,
  crisisAtPort,
  crisisEconomyModifiers,
  interveneInCrisis,
  interveneInCrisisWithCargo,
  normalizeCrisisState,
} from "../src/core/crises.js";

test("crises progress from warning through active crisis to ignored aftermath", () => {
  let state = createCrisisState();
  let result = advanceCrises(state, 12);
  state = result.state;
  assert.deepEqual(result.transitions, [
    { id: "loomUnrest", phase: "warning" },
  ]);
  assert.equal(state.arcs.loomUnrest.activeDay, 15);

  result = advanceCrises(state, 15);
  state = result.state;
  assert.equal(result.transitions[0].phase, "active");
  assert.equal(state.arcs.loomUnrest.endDay, 21);

  result = advanceCrises(state, 22);
  assert.deepEqual(result.transitions, [
    { id: "loomUnrest", phase: "aftermath", outcome: "ignored" },
  ]);
  assert.equal(result.state.arcs.loomUnrest.outcome, "ignored");
});

test("advancing across several thresholds reports every transition", () => {
  const result = advanceCrises(createCrisisState(), 51);
  assert.equal(result.transitions.length, 9);
  assert.equal(
    Object.values(result.state.arcs).every(
      (arc) => arc.phase === "aftermath" && arc.outcome === "ignored",
    ),
    true,
  );
});

test("a funded intervention resolves only an active crisis", () => {
  const active = advanceCrises(createCrisisState(), 15).state;
  const poor = interveneInCrisis(active, "loomUnrest", 20, 15);
  assert.equal(poor.ok, false);
  assert.match(poor.reason, /Not enough/);

  const result = interveneInCrisis(active, "loomUnrest", 100, 16);
  assert.equal(result.ok, true);
  assert.equal(result.coins, 10);
  assert.equal(result.state.arcs.loomUnrest.phase, "aftermath");
  assert.equal(result.state.arcs.loomUnrest.outcome, "resolved");
  assert.equal(result.state.arcs.loomUnrest.endDay, 16);

  assert.equal(
    interveneInCrisis(result.state, "loomUnrest", 500, 17).ok,
    false,
  );
  assert.equal(
    interveneInCrisis(result.state, "missing", 500, 17).reason,
    "Unknown regional crisis.",
  );
});

test("cargo interventions require relief goods and consume matching lots", () => {
  const active = advanceCrises(createCrisisState(), 28).state;
  const partialCargo = [
    { id: "medicine-1", key: "medicine" },
    { id: "herbs-1", key: "herbs" },
  ];
  const partial = interveneInCrisisWithCargo(
    active,
    "fenFever",
    partialCargo,
    26,
  );
  assert.equal(partial.ok, false);
  assert.equal(partial.reason, "Required relief cargo is not aboard.");
  assert.deepEqual(partial.status.missing, { medicine: 1, herbs: 1 });
  assert.equal(partial.cargoLots, partialCargo);

  const cargoLots = [
    { id: "medicine-1", key: "medicine" },
    { id: "grain-1", key: "grain" },
    { id: "medicine-2", key: "medicine" },
    { id: "herbs-1", key: "herbs" },
    { id: "herbs-2", key: "herbs" },
  ];
  const status = cargoInterventionStatus(CRISIS_TEMPLATES.fenFever, cargoLots);
  assert.equal(status.ready, true);
  assert.deepEqual(status.missing, {});

  const result = interveneInCrisisWithCargo(active, "fenFever", cargoLots, 27);
  assert.equal(result.ok, true);
  assert.equal(result.state.arcs.fenFever.phase, "aftermath");
  assert.equal(result.state.arcs.fenFever.outcome, "resolved");
  assert.deepEqual(result.consumedLotIds, [
    "medicine-1",
    "medicine-2",
    "herbs-1",
    "herbs-2",
  ]);
  assert.deepEqual(result.cargoLots, [{ id: "grain-1", key: "grain" }]);
});

test("cargo interventions reject inactive, unknown, and unsupplied crises", () => {
  const warning = advanceCrises(createCrisisState(), 12).state;
  assert.equal(
    interveneInCrisisWithCargo(warning, "loomUnrest", [], 12).reason,
    "This crisis cannot be supplied at present.",
  );
  assert.equal(
    interveneInCrisisWithCargo(warning, "missing", [], 12).reason,
    "Unknown regional crisis.",
  );
  assert.equal(cargoInterventionStatus({}, []).ready, false);
  assert.deepEqual(
    cargoInterventionStatus(CRISIS_TEMPLATES.loomUnrest, [null, {}]).missing,
    { grain: 3, tea: 1 },
  );
  const invalidCargo = interveneInCrisisWithCargo(warning, "missing", null, 12);
  assert.deepEqual(invalidCargo.cargoLots, []);
});

test("crisis modifiers distinguish warning, emergency, and both aftermaths", () => {
  let state = advanceCrises(createCrisisState(), 12).state;
  assert.deepEqual(crisisEconomyModifiers(state, "Lethariel", "silk"), {
    price: 1,
    production: 0,
    consumption: 0,
  });
  state = advanceCrises(state, 15).state;
  assert.equal(
    crisisEconomyModifiers(state, "Lethariel", "silk").price,
    CRISIS_TEMPLATES.loomUnrest.activeModifiers.price,
  );
  assert.deepEqual(crisisEconomyModifiers(state, "Lethariel", "iron"), {
    price: 1,
    production: 0,
    consumption: 0,
  });

  const resolved = interveneInCrisis(state, "loomUnrest", 100, 16).state;
  assert.equal(
    crisisEconomyModifiers(resolved, "Lethariel", "silk").production,
    0.35,
  );
  const ignored = advanceCrises(state, 22).state;
  assert.equal(
    crisisEconomyModifiers(ignored, "Lethariel", "silk").production,
    -0.3,
  );
  assert.equal(crisisAtPort(ignored, "Lethariel").length, 1);
  assert.equal(crisisAtPort(ignored, "Goldhaven").length, 0);
});

test("aftermath permanently changes bounded regional conditions", () => {
  const regional = {
    unrest: 10,
    labor: 1.48,
    infrastructure: 3,
    population: 10000,
  };
  applyCrisisAftermath(regional, CRISIS_TEMPLATES.loomUnrest, "resolved");
  assert.equal(regional.unrest, 0);
  assert.equal(regional.labor, 1.5);

  applyCrisisAftermath(regional, CRISIS_TEMPLATES.fenFever, "ignored");
  assert.equal(regional.unrest, 18);
  assert.equal(regional.labor, 1.38);
  assert.equal(regional.population, 9750);
  applyCrisisAftermath(regional, CRISIS_TEMPLATES.delversCollapse, "resolved");
  assert.equal(regional.infrastructure, 3);
});

test("normalization repairs malformed and legacy crisis saves", () => {
  assert.deepEqual(normalizeCrisisState(null), createCrisisState());
  assert.deepEqual(normalizeCrisisState({}), createCrisisState());
  const normalized = normalizeCrisisState({
    arcs: {
      loomUnrest: {
        phase: "aftermath",
        startDay: -4,
        activeDay: "15",
        endDay: "bad",
        outcome: "resolved",
      },
      fenFever: { phase: "invalid", outcome: "ignored" },
      delversCollapse: "invalid",
    },
  });
  assert.equal(normalized.arcs.loomUnrest.startDay, 1);
  assert.equal(normalized.arcs.loomUnrest.activeDay, 15);
  assert.equal(normalized.arcs.loomUnrest.endDay, null);
  assert.equal(normalized.arcs.loomUnrest.outcome, "resolved");
  assert.equal(normalized.arcs.fenFever.phase, "dormant");
  assert.equal(normalized.arcs.fenFever.outcome, null);
});
