import assert from "node:assert/strict";
import test from "node:test";

import {
  createExplorationState,
  explorationHazardProfile,
  expeditionRequirements,
  normalizeExplorationState,
  resolveExpedition,
  resolveExpeditionAftermath,
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
      aftermath: [],
    },
  );
  assert.deepEqual(
    normalizeExplorationState({
      expeditionSerial: 0,
      sites: null,
      history: {},
      aftermath: {},
    }),
    createExplorationState(),
  );
  assert.equal(
    normalizeExplorationState({
      aftermath: Array.from({ length: 50 }, (_, id) => ({ id })),
    }).aftermath.length,
    40,
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

test("hazard profiles are inferred from generated site hazard text", () => {
  assert.equal(
    explorationHazardProfile({ hazards: "Hidden reefs, sudden squalls" }),
    "reefs",
  );
  assert.equal(
    explorationHazardProfile({ hazards: "Steep jungle gullies" }),
    "jungle",
  );
  assert.equal(explorationHazardProfile({ hazards: "Loose scree" }), "cliffs");
  assert.equal(
    explorationHazardProfile({ hazards: "Tidal mud, fogbound channels" }),
    "fogbound",
  );
  assert.equal(
    explorationHazardProfile({ hazards: "Unstable ruins" }),
    "ruins",
  );
  assert.equal(
    explorationHazardProfile({ hazards: "Dense thornwood, brackish marsh" }),
    "jungle",
  );
});

test("reef hazards can damage weak hulls without sounding gear", () => {
  const state = createExplorationState();
  const result = resolveExpedition({
    state,
    site: { ...site, hazards: "Hidden reefs, sudden squalls" },
    approach: "deep",
    day: 2,
    provisions: 30,
    morale: 100,
    hazardContext: { hullCondition: 30, hasSoundingGear: false },
  });
  assert.equal(result.ok, true);
  assert.equal(result.record.hazard.profile, "reefs");
  assert.ok(result.record.hazard.damage.hull > 0);
  assert.equal(
    result.provisionsUsed,
    expeditionRequirements("deep").provisions,
  );
});

test("jungle hazards drain provisions and morale", () => {
  const result = resolveExpedition({
    state: createExplorationState(),
    site: { ...site, id: "jungle", hazards: "Steep jungle gullies" },
    approach: "standard",
    day: 1,
    provisions: 30,
    morale: 100,
  });
  assert.equal(result.ok, true);
  assert.equal(result.record.hazard.profile, "jungle");
  assert.equal(result.record.hazard.provisions, 2);
  assert.ok(result.record.hazard.morale < 0);
  assert.equal(
    result.provisionsUsed,
    expeditionRequirements("standard").provisions + 2,
  );
});

test("cliff guide and ruin scholar bonuses mitigate and improve hazards", () => {
  const cliff = resolveExpedition({
    state: createExplorationState(),
    site: {
      ...site,
      id: "cliff-guide",
      hazards: "Loose scree, exposed cliffs",
    },
    approach: "deep",
    day: 4,
    provisions: 30,
    morale: 100,
    hazardContext: { hasClimberOrGuide: true },
  });
  assert.equal(cliff.ok, true);
  assert.equal(cliff.record.hazard.profile, "cliffs");
  assert.equal(cliff.record.hazard.injuries, 0);

  const ruin = resolveExpedition({
    state: createExplorationState(),
    site: { ...site, id: "ruin-scholar", hazards: "Unstable ruins" },
    approach: "standard",
    day: 7,
    provisions: 30,
    morale: 100,
    hazardContext: { hasScholar: true },
  });
  assert.equal(ruin.ok, true);
  assert.equal(ruin.record.hazard.profile, "ruins");
  assert.ok(ruin.record.hazard.reward > 0);
  assert.ok(ruin.record.reward > 100);
});

test("fog and marsh hazards apply weather and discipline pressure", () => {
  const fog = resolveExpedition({
    state: createExplorationState(),
    site: { ...site, id: "fog", hazards: "Tidal mud, fogbound channels" },
    approach: "deep",
    day: 1,
    provisions: 30,
    morale: 100,
    hazardContext: { visibilityKm: 4, weatherRoughness: 1 },
  });
  assert.equal(fog.ok, true);
  assert.equal(fog.record.hazard.profile, "fogbound");
  assert.ok(fog.record.hazard.damage.rudder > 0);
  assert.ok(fog.record.hazard.morale < 0);

  const marsh = resolveExpedition({
    state: createExplorationState(),
    site: { ...site, id: "marsh", hazards: "brackish marsh" },
    approach: "deep",
    day: 2,
    provisions: 30,
    morale: 100,
  });
  assert.equal(marsh.ok, true);
  assert.equal(marsh.record.hazard.profile, "marsh");
  assert.ok(marsh.record.hazard.morale < 0);
});

test("hazard branches cover mitigated and quiet outcomes", () => {
  const safeReef = resolveExpedition({
    state: createExplorationState(),
    site: { ...site, id: "safe-reef", hazards: "Hidden reefs" },
    approach: "recon",
    day: 1,
    provisions: 30,
    morale: 100,
    hazardContext: { hasSoundingGear: true, hullCondition: 100 },
  });
  assert.equal(safeReef.ok, true);
  assert.equal(safeReef.record.hazard.damage.hull, undefined);
  assert.match(safeReef.record.hazard.notes[0], /Sounding gear/);

  const cliff = resolveExpedition({
    state: createExplorationState(),
    site: { ...site, id: "bad-cliff", hazards: "exposed cliffs" },
    approach: "deep",
    day: 1,
    provisions: 30,
    morale: 0,
  });
  assert.equal(cliff.ok, true);
  assert.ok(cliff.record.hazard.injuries > 0);
  assert.match(cliff.record.hazard.notes[0], /Loose scree/);

  const clearFog = resolveExpedition({
    state: createExplorationState(),
    site: { ...site, id: "clear-fog", hazards: "fogbound channels" },
    approach: "recon",
    day: 3,
    provisions: 30,
    morale: 100,
    hazardContext: { visibilityKm: 24, weatherRoughness: 0 },
  });
  assert.equal(clearFog.ok, true);
  assert.equal(clearFog.record.hazard.damage.rudder, undefined);
  assert.match(clearFog.record.hazard.notes[0], /Clearer weather/);

  const quietMarsh = resolveExpedition({
    state: createExplorationState(),
    site: { ...site, id: "quiet-marsh", hazards: "brackish marsh" },
    approach: "recon",
    day: 2,
    provisions: 30,
    morale: 100,
    hazardContext: { hazardSpecialistBonus: 100 },
  });
  assert.equal(quietMarsh.ok, true);
  assert.equal(quietMarsh.record.hazard.morale, 0);
  assert.match(quietMarsh.record.hazard.notes[0], /discipline held/);

  const general = resolveExpedition({
    state: createExplorationState(),
    site: { ...site, id: "general-hazard", hazards: "sudden squalls" },
    approach: "recon",
    day: 1,
    provisions: 30,
    morale: 100,
  });
  assert.equal(general.ok, true);
  assert.equal(general.record.hazard.profile, "general");
  assert.match(general.record.hazard.notes[0], /no lasting trouble/);
});

test("ruin hazards can cause curses and collapses instead of relics", () => {
  const result = resolveExpedition({
    state: createExplorationState(),
    site: { ...site, id: "cursed-ruin", hazards: "Unstable ruins" },
    approach: "standard",
    day: 1,
    provisions: 30,
    morale: 100,
  });
  assert.equal(result.ok, true);
  assert.equal(result.record.hazard.reward, 0);
  assert.equal(result.record.hazard.injuries, 1);
  assert.equal(result.record.hazard.morale, -2);
  assert.match(result.record.hazard.notes[0], /curse/);
});

test("hazard mechanics cover remaining branch modifiers", () => {
  assert.equal(explorationHazardProfile(null), "general");

  const safeWithoutGear = resolveExpedition({
    state: createExplorationState(),
    site: { ...site, id: "nogear-safe", hazards: "Hidden reefs" },
    approach: "recon",
    day: 5,
    provisions: 30,
    morale: 100,
    hazardContext: { hullCondition: 80 },
  });
  assert.equal(safeWithoutGear.record.hazard.damage.hull, undefined);
  assert.match(safeWithoutGear.record.hazard.notes[0], /Careful leadsmen/);

  const scrapedReef = resolveExpedition({
    state: createExplorationState(),
    site: { ...site, id: "reef-mid", hazards: "Hidden reefs" },
    approach: "recon",
    day: 2,
    provisions: 30,
    morale: 100,
    hazardContext: { hullCondition: 50 },
  });
  assert.equal(scrapedReef.record.hazard.damage.hull, 3);

  const relic = resolveExpedition({
    state: createExplorationState(),
    site: { ...site, id: "plain-ruin", hazards: "Unstable ruins" },
    approach: "recon",
    day: 3,
    provisions: 30,
    morale: 100,
  });
  assert.equal(relic.record.hazard.reward, 18);
  assert.match(relic.record.hazard.notes[0], /small relic/);

  const marshInjury = resolveExpedition({
    state: createExplorationState(),
    site: { ...site, id: "bad-marsh", hazards: "marsh" },
    approach: "deep",
    day: 1,
    provisions: 30,
    morale: 100,
  });
  assert.equal(marshInjury.record.hazard.injuries, 1);
});

test("hazard defaults and no-incident cliffs remain stable", () => {
  assert.equal(explorationHazardProfile({}), "general");

  const quietCliff = resolveExpedition({
    state: createExplorationState(),
    site: { ...site, id: "quiet-cliff", hazards: "cliffs" },
    approach: "recon",
    day: 3,
    provisions: 30,
    morale: 100,
  });
  assert.equal(quietCliff.record.hazard.injuries, 0);
  assert.match(quietCliff.record.hazard.notes[0], /no lasting trouble/);

  const defaultReef = resolveExpedition({
    state: createExplorationState(),
    site: { ...site, id: "default-reef", hazards: "Hidden reefs" },
    approach: "recon",
    day: 1,
    provisions: 30,
    morale: 100,
    hazardContext: { hazardSpecialistBonus: -10 },
  });
  assert.equal(defaultReef.record.hazard.profile, "reefs");

  const midFog = resolveExpedition({
    state: createExplorationState(),
    site: { ...site, id: "mid-fog", hazards: "fogbound channels" },
    approach: "recon",
    day: 1,
    provisions: 30,
    morale: 100,
    hazardContext: { visibilityKm: 12 },
  });
  assert.equal(midFog.record.hazard.damage.rudder, undefined);
});

test("expedition aftermath records living-world consequences", () => {
  const state = createExplorationState();
  const result = resolveExpedition({
    state,
    site: {
      ...site,
      id: "anchorage-ruin",
      name: "Bell Haven",
      type: "Uncharted anchorage",
      objective: "Survey the anchorage and recover an artifact.",
      hazards: "Unstable ruins",
    },
    approach: "recon",
    day: 3,
    provisions: 30,
    morale: 100,
  });

  assert.equal(result.ok, true);
  assert.ok(result.record.aftermath.length > 0);
  assert.deepEqual(state.aftermath, result.record.aftermath);
  assert.ok(
    result.record.aftermath.some((event) => event.type === "named-anchorage"),
  );
  assert.ok(
    result.record.aftermath.some((event) => event.type === "crew-trait"),
  );
  assert.ok(
    result.record.aftermath.some((event) => event.type === "exclusive-demand"),
  );
});

test("failed deep expeditions can strand parties and require treatment", () => {
  const result = resolveExpedition({
    state: createExplorationState(),
    site: { ...site, difficulty: 100, hazards: "fogbound channels" },
    approach: "deep",
    day: 1,
    provisions: 30,
    morale: 0,
  });

  assert.equal(result.ok, true);
  assert.equal(result.record.success, false);
  assert.ok(
    result.record.aftermath.some((event) => event.type === "stranded-party"),
  );
  assert.ok(
    result.record.aftermath.some((event) => event.type === "crew-treatment"),
  );
});

test("standalone aftermath resolver handles missing input and crew trait rewards", () => {
  assert.deepEqual(
    resolveExpeditionAftermath({ site: null, record: null }),
    [],
  );
  const events = resolveExpeditionAftermath({
    site: { ...site, name: "High Spur", hazards: "clear slopes" },
    approach: "standard",
    record: {
      id: 7,
      completedDay: 12,
      success: true,
      exceptional: true,
      injuries: 0,
      reward: 120,
      discoveryId: null,
      hazard: { profile: "general" },
    },
  });

  assert.ok(events.some((event) => event.type === "crew-trait"));
  assert.ok(events.some((event) => event.type === "rival-interest"));
});

test("artifact omens always follow successful ruin discoveries", () => {
  const events = resolveExpeditionAftermath({
    site: { ...site, name: "Old Vault", hazards: "Unstable ruins" },
    approach: "standard",
    record: {
      id: 11,
      completedDay: 9,
      success: true,
      exceptional: false,
      injuries: 0,
      reward: 40,
      discoveryId: "vault-relic",
      hazard: { profile: "ruins" },
    },
  });

  const omen = events.find((event) => event.type === "artifact-omen");
  assert.equal(omen.discoveryId, "vault-relic");
  assert.ok(omen.triggerDay > 9);
});

test("aftermath resolver covers fallback text and alternate branch conditions", () => {
  const injuryEvents = resolveExpeditionAftermath({
    site: { id: "fallback-site" },
    approach: "standard",
    record: {
      id: 1,
      completedDay: "bad",
      success: false,
      exceptional: false,
      injuries: 1,
      reward: 0,
      discoveryId: null,
      hazard: { profile: "fogbound" },
    },
  });
  const treatment = injuryEvents.find(
    (event) => event.type === "crew-treatment",
  );
  assert.match(treatment.summary, /hand needs treatment/);
  assert.equal(treatment.dueDay, 5);
  assert.equal(
    injuryEvents.find((event) => event.type === "stranded-party").provisions,
    1,
  );

  const anchorageEvents = resolveExpeditionAftermath({
    site: {
      id: "type-only-anchorage",
      name: "Needle",
      type: "Uncharted anchorage",
      objective: "",
      hazards: "",
    },
    approach: "recon",
    record: {
      id: 2,
      completedDay: 4,
      success: true,
      exceptional: false,
      injuries: 0,
      reward: 0,
      discoveryId: null,
      hazard: null,
    },
  });
  assert.ok(anchorageEvents.some((event) => event.type === "named-anchorage"));
});
