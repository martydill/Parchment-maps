import assert from "node:assert/strict";
import test from "node:test";

import {
  aidRival,
  createRivalState,
  normalizeRivalState,
  recordPlayerCompetition,
  recordRivalDelivery,
  rivalForMerchant,
  rivalRelationshipLabel,
  tradeRivalIntelligence,
} from "../src/core/rivals.js";

test("rival state is complete, independent, and normalizes old saves", () => {
  const first = createRivalState();
  const second = createRivalState();
  first.captains.vale.wealth = 999;
  assert.equal(second.captains.vale.wealth, 120);
  const normalized = normalizeRivalState({
    captains: {
      vale: { relationship: 500, reputation: -2, wealth: -4, deliveries: 2.8 },
    },
    claims: [
      { rivalId: "vale", port: "Goldhaven", goodKey: "iron", day: 4, units: 0 },
      { rivalId: "unknown", port: "Nowhere", goodKey: "silk" },
    ],
  });
  assert.deepEqual(normalized.captains.vale, {
    relationship: 100,
    reputation: 0,
    wealth: 0,
    deliveries: 2,
    lastAidDay: 0,
    lastMetDay: 0,
  });
  assert.deepEqual(normalized.claims, [
    { rivalId: "vale", port: "Goldhaven", goodKey: "iron", day: 4, units: 1 },
  ]);
  assert.equal(normalizeRivalState(null).captains.vale.reputation, 20);
  assert.equal(normalizeRivalState("invalid").captains.vale.reputation, 20);
  assert.equal(normalizeRivalState({}).claims.length, 0);
  const defaults = normalizeRivalState({ captains: { vale: {} }, claims: {} });
  assert.deepEqual(defaults.captains.vale, second.captains.vale);
  assert.deepEqual(
    normalizeRivalState({
      claims: [{ rivalId: "vale", port: "Goldhaven", goodKey: "iron" }],
    }).claims,
    [{ rivalId: "vale", port: "Goldhaven", goodKey: "iron", day: 0, units: 1 }],
  );
  assert.equal(
    normalizeRivalState({
      claims: [
        null,
        { rivalId: "vale", goodKey: "iron" },
        { rivalId: "vale", port: "Goldhaven" },
      ],
    }).claims.length,
    0,
  );
});

test("merchant identity resolves by id or legacy vessel name", () => {
  assert.equal(
    rivalForMerchant({ rivalId: "voss" }).captain,
    "Captain Torren Voss",
  );
  assert.equal(rivalForMerchant({ name: "Amber Heron" }).id, "vale");
  assert.equal(rivalForMerchant({ name: "Unknown" }), null);
  assert.equal(rivalForMerchant(null), null);
});

test("deliveries build a house and create temporary market claims", () => {
  let state = recordRivalDelivery(createRivalState(), "vale", {
    port: "Goldhaven",
    goodKey: "iron",
    units: 7,
    day: 10,
    unitValue: 20,
  });
  assert.equal(state.captains.vale.deliveries, 1);
  assert.equal(state.captains.vale.wealth, 145);
  assert.equal(state.captains.vale.reputation, 22);
  state = recordRivalDelivery(state, "unknown", {
    port: "Goldhaven",
    goodKey: "iron",
    units: 2,
    day: 20,
  });
  assert.equal(state.claims.length, 1);
  state = recordRivalDelivery(state, "voss", {
    port: "Rimegate",
    goodKey: "silk",
    units: 2,
    day: 20,
  });
  assert.equal(state.captains.voss.reputation, 21);
  assert.equal(state.claims.length, 1);
});

test("selling into a recent rival market claim creates competition", () => {
  const delivered = recordRivalDelivery(createRivalState(), "vale", {
    port: "Goldhaven",
    goodKey: "iron",
    units: 5,
    day: 10,
  });
  const competed = recordPlayerCompetition(delivered, {
    port: "Goldhaven",
    goodKey: "iron",
    day: 12,
  });
  assert.equal(competed.rivalId, "vale");
  assert.equal(competed.state.captains.vale.relationship, -3);
  assert.equal(competed.state.captains.vale.reputation, 20);
  const missed = recordPlayerCompetition(delivered, {
    port: "Goldhaven",
    goodKey: "silk",
    day: 12,
  });
  assert.equal(missed.rivalId, null);
  assert.equal(
    recordPlayerCompetition(delivered, {
      port: "Goldhaven",
      goodKey: "iron",
      day: 14,
    }).rivalId,
    null,
  );
});

test("rival meetings exchange money for relationship and respect cooldowns", () => {
  const unaffordable = aidRival(createRivalState(), "vale", 7, 3);
  assert.equal(unaffordable.ok, false);
  assert.equal(aidRival(createRivalState(), "unknown", 7, 20).ok, false);
  const aided = aidRival(createRivalState(), "vale", 7, 20);
  assert.equal(aided.ok, true);
  assert.equal(aided.coins, 11);
  assert.equal(aided.state.captains.vale.relationship, 10);
  assert.equal(aidRival(aided.state, "vale", 12, 20).ok, false);

  const noIntel = tradeRivalIntelligence(createRivalState(), "vale", 2, 3);
  assert.equal(noIntel.ok, false);
  assert.equal(
    tradeRivalIntelligence(createRivalState(), "unknown", 2, 20).ok,
    false,
  );
  const intel = tradeRivalIntelligence(createRivalState(), "vale", 2, 20);
  assert.equal(intel.ok, true);
  assert.equal(intel.coins, 12);
  assert.equal(intel.state.captains.vale.relationship, 2);
});

test("relationship labels cover alliances, neutrality, and hostility", () => {
  assert.equal(rivalRelationshipLabel(50), "Trusted ally");
  assert.equal(rivalRelationshipLabel(20), "Friendly competitor");
  assert.equal(rivalRelationshipLabel(0), "Professional rival");
  assert.equal(rivalRelationshipLabel(-20), "Hostile rival");
  assert.equal(rivalRelationshipLabel(-50), "Bitter enemy");
});
