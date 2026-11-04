import assert from "node:assert/strict";
import test from "node:test";
import {
  crewReadiness,
  previewShoreLeave,
} from "../src/core/crew-readiness.js";
import { createOperationsState, processWages } from "../src/core/operations.js";
import { shouldAutomationRest } from "../src/core/automation.js";

test("crew warnings use living crew weights and exact warning thresholds", () => {
  const ops = createOperationsState();
  for (const group of Object.values(ops.crew.groups)) group.fatigue = 60;
  ops.morale = 35;
  assert.equal(crewReadiness(ops).needsRest, false);
  ops.crew.groups.deck.fatigue = 61;
  assert.equal(crewReadiness(ops).needsRest, true);
  ops.morale = 34;
  ops.crew.groups.deck.fatigue = 0;
  assert.equal(crewReadiness(ops).needsRest, true);
  for (const group of Object.values(ops.crew.groups)) group.count = 0;
  assert.equal(crewReadiness(ops).fatigue, 0);
  assert.equal(crewReadiness({}).morale, 0);
});

test("shore leave previews recovery, wages, affordability, and imminent deadlines without mutation", () => {
  const ops = createOperationsState();
  ops.morale = 25;
  for (const group of Object.values(ops.crew.groups)) group.fatigue = 80;
  const before = structuredClone(ops);
  const preview = previewShoreLeave(ops, 100, 7, [
    { title: "Urgent", deadline: 8 },
    { title: "Later", deadline: 10 },
  ]);
  assert.equal(preview.ok, true);
  assert.equal(preview.cost, 11);
  assert.equal(preview.days, 1);
  assert.equal(preview.wages, 18);
  assert.equal(preview.coinsAfter, 71);
  assert.equal(preview.moraleAfter, 37);
  assert.equal(preview.fatigueAfter, 52);
  assert.deepEqual(preview.urgentContracts, ["Urgent"]);
  assert.deepEqual(ops, before);
  assert.deepEqual(
    processWages(preview.operations, 8, 89).operations.morale,
    preview.moraleAfter,
  );
  const poor = previewShoreLeave(ops, 10, 7);
  assert.equal(poor.ok, false);
  assert.equal(poor.unpaidWages, 18);
  assert.equal(
    previewShoreLeave({ ...ops, morale: 99 }, 100, 1).moraleAfter,
    100,
  );
});

test("automation rests only with a reserve and room for the next commission", () => {
  const ops = createOperationsState();
  assert.equal(shouldAutomationRest(ops, 100, 1, [], {}), false);
  ops.morale = 20;
  assert.equal(shouldAutomationRest(ops, 10, 1, [], {}), false);
  assert.equal(shouldAutomationRest(ops, 50, 1, [], {}), false);
  assert.equal(shouldAutomationRest(ops, 51, 1, [], {}), true);
  const contract = { destination: "B", deadline: 4 };
  assert.equal(shouldAutomationRest(ops, 100, 1, [contract], { B: 2 }), true);
  assert.equal(shouldAutomationRest(ops, 100, 2, [contract], { B: 2 }), false);
  assert.equal(shouldAutomationRest(ops, 100, 1, [contract], {}), false);
  assert.equal(
    shouldAutomationRest(ops, 100, 1, [{ destination: null, deadline: 2 }], {}),
    true,
  );
});
