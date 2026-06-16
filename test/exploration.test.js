import assert from "node:assert/strict";
import test from "node:test";

import {
  createExplorationState,
  expeditionRequirements,
  normalizeExplorationState,
  resolveExpedition,
} from "../src/core/exploration.js";

const site = {
  id: "cliffs",
  difficulty: 5,
  reward: 100,
  discoveryId: "ore",
};

test("exploration state normalizes old and malformed saves", () => {
  assert.deepEqual(normalizeExplorationState(null), createExplorationState());
  assert.deepEqual(normalizeExplorationState("bad"), createExplorationState());
  assert.deepEqual(
    normalizeExplorationState({
      expeditionSerial: 4.9,
      sites: { cliffs: { visits: 1 } },
      history: [{ id: 3 }],
    }),
    {
      expeditionSerial: 4,
      sites: { cliffs: { visits: 1 } },
      history: [{ id: 3 }],
    },
  );
  assert.deepEqual(
    normalizeExplorationState({
      expeditionSerial: 0,
      sites: null,
      history: {},
    }),
    createExplorationState(),
  );
});

test("requirements reject unknown plans and insufficient provisions", () => {
  assert.equal(expeditionRequirements("missing"), null);
  assert.equal(
    resolveExpedition({
      state: createExplorationState(),
      site,
      approach: "missing",
      day: 1,
      provisions: 30,
      morale: 100,
    }).ok,
    false,
  );
  assert.equal(
    resolveExpedition({
      state: createExplorationState(),
      site,
      approach: "deep",
      day: 1,
      provisions: 2,
      morale: 100,
    }).reason,
    "The expedition needs more provisions.",
  );
  assert.equal(
    resolveExpedition({
      state: createExplorationState(),
      site: null,
      approach: "recon",
      day: 1,
      provisions: 30,
      morale: 100,
    }).ok,
    false,
  );
});

test("successful expeditions consume resources and persist site progress", () => {
  const state = createExplorationState();
  const result = resolveExpedition({
    state,
    site,
    approach: "recon",
    day: 2,
    provisions: 30,
    morale: 100,
  });
  assert.equal(result.ok, true);
  assert.equal(result.days, 1);
  assert.equal(result.provisionsUsed, 2);
  assert.equal(result.discoveryId, "ore");
  assert.equal(result.record.success, true);
  assert.equal(state.sites.cliffs.status, "surveyed");
  assert.equal(state.sites.cliffs.visits, 1);
  assert.equal(state.expeditionSerial, 2);

  const repeated = resolveExpedition({
    state,
    site,
    approach: "recon",
    day: 3,
    provisions: 30,
    morale: 100,
  });
  assert.equal(repeated.ok, false);
  assert.equal(repeated.reason, "That shore expedition has already sailed.");
  assert.equal(state.sites.cliffs.visits, 1);
  assert.equal(state.expeditionSerial, 2);
});

test("difficult expeditions can fail, retain charted status, and cannot repeat", () => {
  const state = createExplorationState();
  const result = resolveExpedition({
    state,
    site: { ...site, difficulty: 100 },
    approach: "deep",
    day: 1,
    provisions: 30,
    morale: 0,
  });
  assert.equal(result.ok, true);
  assert.equal(result.record.success, false);
  assert.equal(result.discoveryId, null);
  assert.equal(result.record.reward, 0);
  assert.equal(result.record.injuries, 2);
  assert.equal(result.moraleChange, -8);
  assert.equal(state.sites.cliffs.status, "charted");
  assert.equal(state.history.length, 1);
  const repeated = resolveExpedition({
    state,
    site,
    approach: "recon",
    day: 2,
    provisions: 30,
    morale: 100,
  });
  assert.equal(repeated.ok, false);
  assert.equal(state.sites.cliffs.visits, 1);
});

test("deterministic scoring covers ordinary, complicated, and exceptional results", () => {
  const outcomes = new Map();
  for (let day = 1; day <= 200; day++) {
    const state = createExplorationState();
    const result = resolveExpedition({
      state,
      site,
      approach: "standard",
      day,
      provisions: 30,
      morale: 50,
    });
    const key = !result.record.success
      ? `failure-${result.record.injuries}`
      : result.record.exceptional
        ? "exceptional"
        : result.record.injuries
          ? "complicated"
          : "ordinary";
    outcomes.set(key, result);
  }
  assert.deepEqual([...outcomes.keys()].sort(), [
    "complicated",
    "exceptional",
    "failure-1",
    "failure-2",
    "ordinary",
  ]);
  assert.equal(outcomes.get("exceptional").moraleChange, 5);
  assert.equal(outcomes.get("complicated").record.injuries, 1);
  assert.equal(outcomes.get("ordinary").record.injuries, 0);
  assert.equal(outcomes.get("failure-1").record.injuries, 1);
  assert.equal(outcomes.get("failure-2").record.injuries, 2);
});

test("history is capped and negative save serials recover", () => {
  assert.equal(
    normalizeExplorationState({ expeditionSerial: -4 }).expeditionSerial,
    1,
  );
  const state = createExplorationState();
  state.history = Array.from({ length: 30 }, (_, id) => ({ id }));
  resolveExpedition({
    state,
    site,
    approach: "recon",
    day: 10,
    provisions: 30,
    morale: 100,
  });
  assert.equal(state.history.length, 30);
});
