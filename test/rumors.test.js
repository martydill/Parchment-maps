import test from "node:test";
import assert from "node:assert/strict";

import {
  BASE_RUMOR_RADIUS,
  RUMOR_TYPES,
  SPECIALIST_RUMOR_RADIUS,
  createRumorLead,
  expireRumorLeads,
  normalizeRumorLeads,
  rumorTypeFor,
  targetMatchesFaction,
} from "../src/core/rumors.js";
import {
  createDiscoveryState,
  normalizeDiscoveryState,
} from "../src/core/discoveries.js";

test("rumor leads create broad or specialist-interpreted search circles", () => {
  const port = { name: "Narthkel", x: 50, y: 50 };
  const target = { id: "black-water", x: 1900, y: 120, faction: "Navigators" };
  const broad = createRumorLead({ port, target, day: 3, worldWidth: 2000 });
  const interpreted = createRumorLead({
    port,
    target,
    day: 3,
    worldWidth: 2000,
    specialistBonus: true,
  });

  assert.ok(broad.radius >= Math.round(BASE_RUMOR_RADIUS * 0.72));
  assert.ok(broad.radius <= Math.round(BASE_RUMOR_RADIUS * 1.35));
  assert.ok(interpreted.radius <= Math.round(SPECIALIST_RUMOR_RADIUS * 1.35));
  assert.match(broad.clue, /of Narthkel/);
  assert.ok(RUMOR_TYPES.some((type) => type.id === broad.rumorType));
  assert.equal(broad.targetKind, "discovery");
  assert.ok(broad.x >= 0 && broad.x < 2000);
});

test("rumors can target expedition sites and prefer related factions", () => {
  const expedition = {
    id: "ice-landing",
    x: 10,
    y: 20,
    objective: "Survey the floe",
    factions: [{ name: "Narthkel Admiralty" }],
  };
  const lead = createRumorLead({
    port: { name: "Narthkel", x: 0, y: 0 },
    target: expedition,
    day: 4,
    worldWidth: 1000,
  });

  assert.equal(lead.targetKind, "expedition");
  assert.equal(targetMatchesFaction(expedition, ["Narthkel Admiralty"]), true);
  assert.equal(targetMatchesFaction(expedition, ["Pearl Senate"]), false);
});

test("rumor state normalizes legacy saves and marks expired leads", () => {
  const state = createDiscoveryState();
  assert.deepEqual(state.rumorLeads, []);

  const normalized = normalizeDiscoveryState({
    found: {},
    routeConsequences: [],
    rumorLeads: [{ targetId: "site", expiresDay: 2, radius: 0 }],
  });
  assert.equal(normalized.rumorLeads[0].radius, BASE_RUMOR_RADIUS);

  const leads = normalizeRumorLeads(normalized.rumorLeads);
  const expired = expireRumorLeads(leads, 3);
  assert.equal(expired.length, 1);
  assert.equal(expired[0].expiredDay, 3);
  assert.equal(expireRumorLeads(leads, 4).length, 0);
});

test("rumor helpers cover unrelated targets, string factions, and false leads", () => {
  assert.equal(targetMatchesFaction(null, ["Guild"]), false);
  assert.equal(targetMatchesFaction({ id: "plain" }, ["Guild"]), false);
  assert.equal(
    targetMatchesFaction({ factions: ["Guild", "Commons"] }, ["Commons"]),
    true,
  );

  const falseLead = createRumorLead({
    port: { name: "Miremouth", x: 10, y: 10 },
    target: { id: "decoy", x: 50, y: 0 },
    day: 9,
    worldWidth: 100,
    falseLead: true,
  });
  assert.equal(falseLead.falseLead, true);
  assert.ok(falseLead.y >= 0);
  assert.ok(falseLead.clue.length > "north of Miremouth".length);
});

test("rumor normalization repairs malformed optional fields", () => {
  assert.deepEqual(normalizeRumorLeads(null), []);
  assert.deepEqual(normalizeRumorLeads([{ id: "missing-target" }, null]), []);

  const [lead] = normalizeRumorLeads([
    {
      id: "custom",
      targetId: 42,
      targetKind: "expedition",
      rumorType: "salvaged-chart",
      title: "",
      source: "",
      origin: "",
      boughtDay: -5,
      expiresDay: "bad",
      falseLead: 1,
      interpreted: 1,
      radius: 39,
      x: "12",
      y: "",
      clue: "",
      resolvedDay: 8,
      expiredDay: 9,
    },
  ]);

  assert.deepEqual(
    {
      id: lead.id,
      targetId: lead.targetId,
      targetKind: lead.targetKind,
      rumorType: lead.rumorType,
      title: lead.title,
      source: lead.source,
      origin: lead.origin,
      boughtDay: lead.boughtDay,
      expiresDay: lead.expiresDay,
      falseLead: lead.falseLead,
      interpreted: lead.interpreted,
      radius: lead.radius,
      x: lead.x,
      y: lead.y,
      clue: lead.clue,
      resolvedDay: lead.resolvedDay,
      expiredDay: lead.expiredDay,
    },
    {
      id: "custom",
      targetId: "42",
      targetKind: "expedition",
      rumorType: "salvaged-chart",
      title: "Salvaged chart",
      source: "salvaged chart",
      origin: "Unknown port",
      boughtDay: 1,
      expiresDay: 1,
      falseLead: true,
      interpreted: true,
      radius: 40,
      x: 12,
      y: 0,
      clue: "A vague mark on the chart.",
      resolvedDay: 8,
      expiredDay: 9,
    },
  );
});

test("rumor matching covers direct faction hits and already handled expiry", () => {
  assert.equal(targetMatchesFaction({ faction: "Guild" }, ["Guild"]), true);
  const leads = [
    { targetId: "resolved", expiresDay: 1, resolvedDay: 1 },
    { targetId: "expired", expiresDay: 1, expiredDay: 2 },
  ];
  assert.deepEqual(expireRumorLeads(leads, 5), []);
});

test("rumor type selection varies by faction, source, reliability, and specialists", () => {
  assert.equal(
    rumorTypeFor({ seed: 6, factionRelated: true, specialistBonus: false }).id,
    "faction-dossier",
  );
  assert.equal(
    rumorTypeFor({ seed: 8, factionRelated: false, specialistBonus: true }).id,
    "specialist-interpretation",
  );

  const port = { name: "Orvessa Quay", x: 100, y: 100 };
  const target = { id: "auric", x: 180, y: 140, faction: "Guild" };
  const kinds = new Set(
    Array.from(
      { length: 12 },
      (_, index) =>
        createRumorLead({
          port,
          target: { ...target, id: `${target.id}-${index}` },
          day: index + 2,
          worldWidth: 1000,
        }).rumorType,
    ),
  );
  assert.ok(kinds.size >= 4);

  const factionLead = createRumorLead({
    port,
    target,
    day: 10,
    worldWidth: 1000,
    factionRelated: true,
  });
  assert.ok(
    [
      "faction dossier",
      "tavern whisper",
      "dockside sighting",
      "salvaged chart",
      "omens and songs",
    ].includes(factionLead.source),
  );

  const specialistLead = createRumorLead({
    port,
    target: { ...target, id: "special" },
    day: 4,
    worldWidth: 1000,
    specialistBonus: true,
  });
  assert.equal(specialistLead.interpreted, true);
  assert.ok(specialistLead.radius <= BASE_RUMOR_RADIUS);
});
