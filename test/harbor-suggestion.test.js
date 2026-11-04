import assert from "node:assert/strict";
import test from "node:test";
import { harborSuggestion } from "../src/core/harbor-suggestion.js";
import { createGameState } from "../src/core/state.js";
import { PORT_NAMES, FACTION_NAMES } from "../src/names.js";

test("harbor suggestions expose relevant story steps even with active commissions", () => {
  const g = createGameState();
  g.cargo.iron = 2;
  g.activeContracts.push({ cargoUnits: 1, destination: "Elsewhere" });
  let hint = harborSuggestion(g, PORT_NAMES.orvessaQuay, true);
  assert.equal(hint.good, "iron");
  assert.match(hint.detail, /0\/50/);
  g.cargo.iron = 0;
  g.completedContracts = 3;
  hint = harborSuggestion(g, PORT_NAMES.orvessaQuay, true);
  assert.equal(hint.port, PORT_NAMES.narthkel);
  g.milestone.shortageExploited = true;
  assert.equal(harborSuggestion(g, PORT_NAMES.orvessaQuay, true), null);
  g.factionStanding[FACTION_NAMES.syrrelwakeOarwrightPact] = 20;
  assert.equal(
    harborSuggestion(g, PORT_NAMES.orvessaQuay, false).tab,
    "politics",
  );
  g.laws.amberConvoy = true;
  assert.equal(harborSuggestion(g, PORT_NAMES.orvessaQuay, false), null);
});

test("upgrade suggestions show concrete benefits and preserve operating reserves and cargo", () => {
  const g = createGameState();
  assert.equal(harborSuggestion(g, "Other", false), null);
  g.coins = 320;
  let hint = harborSuggestion(g, "Other", false);
  assert.equal(hint.vessel, "sloop");
  assert.match(hint.detail, /260 crowns/);
  g.cargo.iron = 16;
  assert.equal(harborSuggestion(g, "Other", false), null);
  g.coins = 420;
  hint = harborSuggestion(g, "Other", false);
  assert.equal(hint.vessel, "carrack");
  assert.match(hint.detail, /30 hold \(\+12\)/);
  g.cargo.iron = 0;
  g.activeContracts = [{ kind: "survey", cargoUnits: 0 }];
  assert.equal(harborSuggestion(g, "Other", false).vessel, "barque");
  g.shipUpgrades.ownedClasses.push("barque");
  assert.equal(harborSuggestion(g, "Other", false).vessel, "carrack");
  g.shipUpgrades.activeClass = "carrack";
  g.shipUpgrades.ownedClasses = ["cutter"];
  g.activeContracts = [];
  g.cargo.iron = 16;
  // Normalization marks the active vessel as owned, so it is never re-suggested.
  assert.equal(harborSuggestion(g, "Other", false), null);
});
