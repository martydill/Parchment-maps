import assert from "node:assert/strict";
import test from "node:test";

import {
  completeLegacyCapstone,
  continueLegacySandbox,
  createLegacyState,
  legacyChecklist,
  legacyMetrics,
  legacyReadyForCapstone,
  normalizeLegacyState,
} from "../src/core/legacies.js";
import { createGameState } from "../src/core/state.js";

function merchantPrince(pathId) {
  const game = createGameState();
  game.milestone.complete = true;
  game.milestone.lawChanged = true;
  game.legacy.selected = pathId;
  return game;
}

test("legacy state is created and old saves normalize safely", () => {
  assert.deepEqual(createLegacyState(), {
    selected: null,
    capstoneComplete: false,
    endingSeen: false,
    sandbox: false,
  });
  assert.deepEqual(
    normalizeLegacyState({ selected: "missing", capstoneComplete: true }),
    createLegacyState(),
  );
  assert.deepEqual(
    normalizeLegacyState({
      selected: "masterExplorer",
      capstoneComplete: true,
      endingSeen: true,
      sandbox: true,
    }),
    {
      selected: "masterExplorer",
      capstoneComplete: true,
      endingSeen: true,
      sandbox: true,
    },
  );
});

test("trade magnate checklist combines warehouses, industries, and reserves", () => {
  const game = merchantPrince("tradeMagnate");
  game.coins = 900;
  game.warehouses = {
    Goldhaven: { leased: true },
    Rimegate: { leased: true },
    Maritole: { leased: true },
    Pearl: { leased: true },
  };
  game.regionalEconomy = {
    Goldhaven: {
      industries: { iron: { investment: 3 }, silk: { investment: 2 } },
    },
    Rimegate: { industries: { timber: { investment: 3 } } },
  };

  assert.equal(legacyReadyForCapstone(game), true);
  assert.deepEqual(
    legacyChecklist(game).map((step) => step.done),
    [true, true, true, true],
  );
});

test("each legacy path exposes measurable checklist requirements", () => {
  const faction = merchantPrince("factionKingmaker");
  faction.factionCharter = "Guild of Gilded Oars";
  faction.factionStanding["Guild of Gilded Oars"] = 70;
  assert.equal(legacyReadyForCapstone(faction), true);

  const explorer = merchantPrince("masterExplorer");
  for (let index = 0; index < 12; index += 1)
    explorer.discoveries.found[`D${index}`] = {
      disposition: index < 6 ? "sell" : null,
    };
  explorer.maritimeHazards.resolvedEncounters = 6;
  assert.equal(legacyReadyForCapstone(explorer), true);

  const admiral = merchantPrince("fleetAdmiral");
  admiral.shipUpgrades.ownedClasses = ["cutter", "brig", "barque"];
  admiral.shipUpgrades.owned = Array.from(
    { length: 10 },
    (_, index) => `U${index}`,
  );
  admiral.shipUpgrades.equipped = Object.fromEntries(
    admiral.shipUpgrades.owned.map((id, index) => [`S${index}`, id]),
  );
  admiral.legacyProgress.piratesRepelled = 5;
  assert.equal(legacyReadyForCapstone(admiral), true);

  const broker = merchantPrince("shadowBroker");
  broker.intelligence = Array.from({ length: 12 }, (_, index) => ({
    id: index,
  }));
  broker.shipUpgrades.equipped.cargo = "smugglers-lockers";
  broker.legal.permits = {
    a: { expiresDay: 2 },
    b: { expiresDay: 2 },
    c: { expiresDay: 2 },
    d: { expiresDay: 2 },
  };
  assert.equal(legacyReadyForCapstone(broker), true);

  const prince = merchantPrince("independentPrince");
  prince.warehouses = Object.fromEntries(
    ["A", "B", "C", "D", "E", "F"].map((port) => [port, { leased: true }]),
  );
  prince.factionStanding = { A: 25, B: 30, C: 40 };
  assert.equal(legacyReadyForCapstone(prince), true);
});

test("capstone completion requires a chosen and ready legacy, then unlocks sandbox", () => {
  const game = merchantPrince("tradeMagnate");
  assert.equal(
    completeLegacyCapstone({ legacy: createLegacyState() }).reason,
    "Choose a legacy first.",
  );
  assert.equal(
    completeLegacyCapstone(game).reason,
    "Finish the legacy checklist first.",
  );

  game.coins = 1000;
  game.warehouses = Object.fromEntries(
    ["A", "B", "C", "D"].map((port) => [port, { leased: true }]),
  );
  game.regionalEconomy = { A: { industries: { one: { investment: 8 } } } };
  const completed = completeLegacyCapstone(game);
  assert.equal(completed.ok, true);
  assert.equal(completed.path.name, "Trade Magnate");
  assert.equal(game.legacy.endingSeen, true);
  assert.equal(continueLegacySandbox(game), true);
  assert.equal(game.legacy.sandbox, true);
  assert.equal(
    completeLegacyCapstone(game).reason,
    "This legacy is already complete.",
  );
});

test("legacy metrics tolerate malformed or missing legacy fields", () => {
  assert.deepEqual(legacyChecklist({ legacy: { selected: "unknown" } }), []);
  assert.equal(legacyMetrics({}).leasedWarehouses, 0);
  assert.equal(continueLegacySandbox({ legacy: createLegacyState() }), false);
});

test("legacy checklists report pending branches and malformed metric fallbacks", () => {
  assert.deepEqual(normalizeLegacyState(null), createLegacyState());
  assert.deepEqual(
    normalizeLegacyState({
      selected: "tradeMagnate",
      capstoneComplete: false,
      endingSeen: false,
    }),
    {
      selected: "tradeMagnate",
      capstoneComplete: false,
      endingSeen: false,
      sandbox: false,
    },
  );

  const faction = merchantPrince("factionKingmaker");
  assert.deepEqual(
    legacyChecklist(faction).map((step) => step.detail),
    ["Complete", "No charter", "0/70", "Complete"],
  );

  const prince = merchantPrince("independentPrince");
  prince.factionCharter = "Guild";
  assert.equal(legacyChecklist(prince)[1].detail, "Guild");
  assert.equal(legacyChecklist(prince)[1].done, false);

  const metrics = legacyMetrics({
    coins: Number.NaN,
    warehouses: { Bad: null, Good: { leased: false } },
    regionalEconomy: {
      Bad: null,
      Good: { industries: { one: null, two: { investment: "bad" } } },
    },
    shipUpgrades: {
      activeClass: "cutter",
      ownedClasses: null,
      equipped: { cargo: null },
    },
    discoveries: {
      found: {
        a: { disposition: "secret" },
        b: { disposition: "share" },
        c: null,
      },
    },
    maritimeHazards: { resolvedEncounters: "bad" },
    legacyProgress: { piratesRepelled: "bad" },
    intelligence: null,
    legal: {
      permits: {
        old: { expiresDay: 0 },
        current: { expiresDay: 1 },
        bad: null,
      },
    },
    factionStanding: { A: 24, B: 25 },
    day: 1,
  });
  assert.equal(metrics.leasedWarehouses, 0);
  assert.equal(metrics.industryInvestment, 0);
  assert.equal(metrics.coins, 0);
  assert.equal(metrics.publicDiscoveries, 1);
  assert.equal(metrics.vesselClasses, 1);
  assert.equal(metrics.permits, 1);
  assert.equal(metrics.friendlyFactions, 1);
});

test("legacy helpers cover empty inputs and remaining default-detail branches", () => {
  assert.deepEqual(legacyChecklist(), []);
  assert.equal(
    legacyReadyForCapstone({ legacy: { selected: "unknown" } }),
    true,
  );
  assert.equal(
    completeLegacyCapstone(undefined).reason,
    "Choose a legacy first.",
  );
  assert.deepEqual(normalizeLegacyState([]), createLegacyState());
  assert.deepEqual(normalizeLegacyState({}), createLegacyState());

  const broker = merchantPrince("shadowBroker");
  const concealed = legacyChecklist(broker).find(
    (step) => step.id === "concealed",
  );
  assert.equal(concealed.done, false);
  assert.equal(concealed.detail, "Pending");

  const explorer = merchantPrince("masterExplorer");
  explorer.discoveries.found.secret = { disposition: "secret" };
  explorer.discoveries.found.sold = { disposition: "sell" };
  explorer.discoveries.found.pending = { disposition: null };
  const metrics = legacyMetrics(explorer);
  assert.equal(metrics.discoveries, 3);
  assert.equal(metrics.publicDiscoveries, 1);
  assert.equal(metrics.hazards, 0);
  assert.equal(metrics.piratesRepelled, 0);
  assert.equal(metrics.concealedHold, false);
});

test("legacy metrics cover additional partial nested objects", () => {
  const metrics = legacyMetrics({
    regionalEconomy: { Empty: {} },
    discoveries: { found: { blank: { disposition: "" } } },
    shipUpgrades: { ownedClasses: ["brig"], equipped: {} },
    legal: {},
    factionCharter: "Guild",
    factionStanding: {},
  });
  assert.equal(metrics.industryInvestment, 0);
  assert.equal(metrics.publicDiscoveries, 0);
  assert.equal(metrics.vesselClasses, 1);
  assert.equal(metrics.charterStanding, 0);
});

test("legacy metrics treat missing day as day zero for permits", () => {
  assert.equal(
    legacyMetrics({ legal: { permits: { open: { expiresDay: 0 } } } }).permits,
    1,
  );
});
