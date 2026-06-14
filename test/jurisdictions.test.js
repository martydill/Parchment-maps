import test from "node:test";
import assert from "node:assert/strict";
import {
  buyPermit,
  canTrade,
  createLegalState,
  cultivateOfficial,
  customsScrutiny,
  hasPermit,
  jurisdictionLaw,
  lawDetails,
  normalizeLegalState,
  resolveCustoms,
  tradeQuote,
} from "../src/core/jurisdictions.js";

test("jurisdictions assign distinct laws and crises or factions change them", () => {
  assert.equal(jurisdictionLaw("Goldhaven", "spice"), "taxed");
  assert.equal(jurisdictionLaw("Rimegate", "grain"), "rationed");
  assert.equal(jurisdictionLaw("Lethariel", "coal"), "prohibited");
  assert.equal(jurisdictionLaw("Unknown", "grain"), "legal");
  assert.equal(
    jurisdictionLaw("Goldhaven", "medicine", {
      crises: [{ phase: "active" }],
    }),
    "rationed",
  );
  assert.equal(
    jurisdictionLaw("Khaz Vhar", "iron", {
      dominantFaction: "Tideborn Commons",
    }),
    "taxed",
  );
  assert.equal(
    jurisdictionLaw("Goldhaven", "amber", {
      dominantFaction: "The Ivory Crown",
    }),
    "prohibited",
  );
  assert.equal(
    jurisdictionLaw("Goldhaven", "grain", {
      crises: [{ phase: "warning" }],
      dominantFaction: "Guild",
    }),
    "legal",
  );
  assert.equal(lawDetails("missing").label, "Legal");
});

test("legal state normalization preserves valid legacy data and repairs bad data", () => {
  assert.deepEqual(normalizeLegalState(null), createLegalState());
  const lastInspection = { day: 4 };
  const normalized = normalizeLegalState({
    permits: { "Goldhaven:amber": 20 },
    cultivatedOfficials: null,
    offenses: { Goldhaven: 2 },
    portBans: "bad",
    recentBehavior: 99,
    forgedManifest: 1,
    remoteAnchorage: true,
    lastInspection,
  });
  assert.deepEqual(normalized.permits, { "Goldhaven:amber": 20 });
  assert.deepEqual(normalized.cultivatedOfficials, {});
  assert.deepEqual(normalized.offenses, { Goldhaven: 2 });
  assert.deepEqual(normalized.portBans, {});
  assert.equal(normalized.recentBehavior, 20);
  assert.equal(normalized.forgedManifest, true);
  assert.equal(normalized.remoteAnchorage, true);
  assert.equal(normalized.lastInspection, lastInspection);
  assert.equal(
    normalizeLegalState({ recentBehavior: "bad" }).recentBehavior,
    0,
  );
});

test("permits and official relationships cost money and unlock legal trade", () => {
  const state = createLegalState();
  assert.deepEqual(buyPermit(state, "Rimegate", "iron", 5, 20), {
    ok: false,
    reason: "Not enough crowns.",
  });
  const permit = buyPermit(state, "Rimegate", "iron", 5, 50);
  assert.deepEqual(permit, { ok: true, coins: 15, expiresDay: 35 });
  assert.equal(hasPermit(state, "Rimegate", "iron", 35), true);
  assert.equal(hasPermit(state, "Rimegate", "iron", 36), false);

  assert.deepEqual(cultivateOfficial(state, "Rimegate", 20), {
    ok: false,
    reason: "Not enough crowns.",
  });
  assert.deepEqual(cultivateOfficial(state, "Rimegate", 70), {
    ok: true,
    coins: 15,
  });
  assert.deepEqual(cultivateOfficial(state, "Rimegate", 70), {
    ok: false,
    reason: "You already have a cultivated official here.",
  });
});

test("registered trade enforces bans, prohibitions, licenses, and rations", () => {
  const state = createLegalState();
  assert.equal(
    canTrade({
      state,
      portName: "Goldhaven",
      good: "spice",
      status: "legal",
      day: 2,
    }).ok,
    true,
  );
  assert.match(
    canTrade({
      state,
      portName: "Goldhaven",
      good: "coal",
      status: "prohibited",
      day: 2,
    }).reason,
    /Prohibited/,
  );
  assert.match(
    canTrade({
      state,
      portName: "Goldhaven",
      good: "amber",
      status: "licensed",
      day: 2,
    }).reason,
    /permit/,
  );
  state.permits["Goldhaven:amber"] = 3;
  assert.equal(
    canTrade({
      state,
      portName: "Goldhaven",
      good: "amber",
      status: "licensed",
      day: 2,
    }).ok,
    true,
  );
  assert.match(
    canTrade({
      state,
      portName: "Goldhaven",
      good: "grain",
      status: "rationed",
      day: 2,
      units: 2,
    }).reason,
    /ration/,
  );
  state.portBans.Goldhaven = 8;
  assert.match(
    canTrade({
      state,
      portName: "Goldhaven",
      good: "spice",
      status: "legal",
      day: 2,
    }).reason,
    /port ban/,
  );
});

test("scrutiny rewards reputation and honest declarations while reacting to concealment", () => {
  const honest = customsScrutiny({
    portName: "Goldhaven",
    reputation: 50,
    declaredUnits: 4,
    actualUnits: 4,
  });
  const suspicious = customsScrutiny({
    portName: "Goldhaven",
    reputation: -50,
    declaredUnits: 0,
    actualUnits: 5,
    concealedUnits: 2,
    recentBehavior: 10,
    forgedManifest: true,
  });
  assert.ok(suspicious > honest);
  assert.equal(
    customsScrutiny({
      portName: "Unknown",
      reputation: 1000,
      cultivated: true,
      remoteAnchorage: true,
    }),
    0.05,
  );
  assert.equal(
    customsScrutiny({
      portName: "Khaz Vhar",
      reputation: -1000,
      actualUnits: 100,
    }),
    0.95,
  );
});

test("customs clears honest legal trade and records the inspection", () => {
  const state = createLegalState();
  const result = resolveCustoms({
    state,
    portName: "Goldhaven",
    lots: [{ id: "grain", key: "grain", compartment: "main" }],
    day: 3,
    reputation: 100,
    laws: { grain: "legal" },
    seed: "clear",
  });
  assert.equal(result.admitted, true);
  assert.deepEqual(result.confiscated, []);
  assert.equal(result.fine, 0);
  assert.equal(result.standingChange, 0);
  assert.equal(result.remoteFee, 0);
  assert.equal(state.forgedManifest, false);
  assert.equal(state.remoteAnchorage, false);
  assert.equal(state.lastInspection.portName, "Goldhaven");

  const behaviorBeforeInspection = state.recentBehavior;
  const inspectedButCompliant = resolveCustoms({
    state,
    portName: "Khaz Vhar",
    lots: [{ id: "unlisted", key: "unlisted", compartment: "main" }],
    day: 4,
    reputation: -100,
    laws: {},
    seed: "0",
  });
  assert.equal(inspectedButCompliant.inspected, true);
  assert.equal(inspectedButCompliant.fine, 0);
  assert.equal(state.recentBehavior, behaviorBeforeInspection - 1);

  const notInspected = resolveCustoms({
    state,
    portName: "Glasswater",
    lots: [{ id: "coal", key: "coal", compartment: "main" }],
    day: 5,
    reputation: 100,
    laws: { coal: "prohibited" },
    seed: "0",
  });
  assert.equal(notInspected.inspected, false);
  assert.deepEqual(notInspected.confiscated, []);
});

test("customs detects prohibited and excess rationed cargo with escalating consequences", () => {
  const state = createLegalState();
  const lots = [
    { id: "coal", key: "coal", compartment: "main" },
    { id: "grain-1", key: "grain", compartment: "main" },
    { id: "grain-2", key: "grain", compartment: "main" },
    { id: "grain-3", key: "grain", compartment: "main" },
  ];
  for (let offense = 1; offense <= 3; offense += 1) {
    state.forgedManifest = true;
    state.remoteAnchorage = offense === 1;
    const result = resolveCustoms({
      state,
      portName: "Khaz Vhar",
      lots,
      day: offense,
      reputation: -100,
      laws: { coal: "prohibited", grain: "rationed" },
      seed: `caught-${offense}`,
    });
    assert.equal(result.admitted, true);
    assert.equal(result.inspected, true);
    assert.ok(result.confiscated.length >= 1);
    assert.ok(result.fine > 0);
    assert.ok(result.standingChange < 0);
    if (offense === 1) assert.equal(result.remoteFee, 8);
  }
  assert.equal(state.offenses["Khaz Vhar"], 3);
  assert.equal(state.portBans["Khaz Vhar"], 23);
  const banned = resolveCustoms({
    state,
    portName: "Khaz Vhar",
    lots: [],
    day: 4,
  });
  assert.equal(banned.admitted, false);
  assert.match(banned.reason, /Day 23/);
});

test("concealed cargo can survive inspection and licenses prevent violations", () => {
  const state = createLegalState();
  state.permits["Goldhaven:amber"] = 20;
  const result = resolveCustoms({
    state,
    portName: "Goldhaven",
    lots: [
      { id: "amber", key: "amber", compartment: "main" },
      { id: "coal", key: "coal", compartment: "concealed" },
    ],
    day: 5,
    reputation: -100,
    laws: { amber: "licensed", coal: "prohibited" },
    seed: "concealed-survives",
  });
  assert.equal(result.inspected, true);
  assert.equal(
    result.confiscated.some((lot) => lot.id === "amber"),
    false,
  );
});

test("duties preserve viable posted trade prices", () => {
  assert.equal(tradeQuote(100, "legal"), 100);
  assert.equal(tradeQuote(100, "taxed", "buy"), 112);
  assert.equal(tradeQuote(100, "taxed", "sell"), 108);
  assert.equal(tradeQuote(0, "taxed"), 1);
});
