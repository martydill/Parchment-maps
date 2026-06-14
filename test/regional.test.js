import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceRegionalResources,
  availableMarketGoods,
  chooseRecipe,
  createRegionalState,
  dockingFee,
  infrastructureCapacity,
  inputQuality,
  investInIndustry,
  investmentCost,
  normalizeRegionalState,
  portEvolution,
  regionalSummary,
  runRegionalIndustries,
} from "../src/core/regional.js";

const ports = [
  {
    name: "Forgeport",
    infrastructure: 2,
    labor: 1.1,
    extractiveGoods: ["ore"],
  },
  { name: "Oldport", extractiveGoods: [] },
  { name: "Unmapped" },
];
const chains = [
  {
    id: "forge",
    inputs: { ore: 2 },
    alternatives: [{ id: "scrap", inputs: { iron: 1.5 }, outputScale: 0.7 }],
    outputs: { iron: 1 },
    rate: 1,
    fuel: 0.2,
  },
];

function states() {
  return {
    ore: { stock: 10, target: 20, production: 1 },
    iron: { stock: 1, target: 20, production: 0 },
    timber: { stock: 10, target: 20, production: 1 },
    grain: { stock: 20, target: 20, production: 1 },
  };
}

test("regional state reflects port specialties and repairs old saves", () => {
  const fresh = createRegionalState(ports, chains);
  assert.equal(fresh.Forgeport.infrastructure, 2);
  assert.equal(fresh.Forgeport.resourceHealth.ore, 1);
  assert.equal(fresh.Oldport.industries.forge.investment, 0);
  assert.deepEqual(fresh.Unmapped.resourceHealth, {});
  assert.deepEqual(normalizeRegionalState(null, ports, chains), fresh);
  assert.deepEqual(normalizeRegionalState({}, ports, chains), fresh);

  const normalized = normalizeRegionalState(
    {
      Forgeport: {
        infrastructure: 9,
        labor: 0,
        resourceHealth: { ore: 0 },
        industries: { forge: { investment: 8 } },
      },
      Oldport: "invalid",
    },
    ports,
    chains,
  );
  assert.equal(normalized.Forgeport.infrastructure, 3);
  assert.equal(normalized.Forgeport.labor, 0.35);
  assert.equal(normalized.Forgeport.resourceHealth.ore, 0.2);
  assert.equal(normalized.Forgeport.industries.forge.investment, 3);
  const partial = normalizeRegionalState(
    {
      Forgeport: {
        resourceHealth: {},
        industries: {},
      },
    },
    ports,
    chains,
  );
  assert.equal(partial.Forgeport.infrastructure, 2);
  assert.equal(partial.Forgeport.labor, 1.1);
  assert.equal(partial.Forgeport.resourceHealth.ore, 1);
});

test("investment changes markets, port artwork, fees, and creates a named magnate", () => {
  const regional = createRegionalState(ports, chains).Forgeport;
  const before = availableMarketGoods(regional, chains, [
    "ore",
    "iron",
    "grain",
  ]);
  assert.equal(before.has("ore"), true);
  assert.equal(before.has("iron"), false);
  const initialFee = dockingFee(regional);
  const result = investInIndustry(regional, "forge", 500, "Forgeport");
  assert.match(result.magnate, /\w+ .+/);
  assert.equal(regional.industries.forge.magnate, result.magnate);
  assert.equal(
    availableMarketGoods(regional, chains, ["ore", "iron"]).has("iron"),
    true,
  );
  assert.equal(portEvolution(regional).warehouses, true);
  investInIndustry(regional, "forge", 500, "Forgeport");
  assert.equal(portEvolution(regional).cranes, true);
  investInIndustry(regional, "forge", 500, "Forgeport");
  assert.ok(dockingFee(regional) > initialFee);
  assert.equal(portEvolution(regional).fortifications, true);
});

test("resource collapse drives unrest and migration until investment restores industry", () => {
  const regional = createRegionalState(ports, chains).Forgeport;
  regional.resourceHealth.ore = 0.2;
  regional.unrest = 64;
  const population = regional.population;
  advanceRegionalResources(
    regional,
    {
      ore: { stock: 1, target: 20, production: 4 },
      grain: { stock: 1, target: 20, production: 0 },
    },
    chains,
  );
  assert.equal(regional.industries.forge.collapsed, true);
  assert.ok(regional.unrest > 65);
  assert.ok(regional.population < population);
  const report = runRegionalIndustries(
    states(),
    chains,
    { forge: 1 },
    regional,
  )[0];
  assert.equal(report.batches, 0);
  assert.equal(report.collapsed, true);
  const restored = investInIndustry(regional, "forge", 500, "Forgeport");
  assert.equal(restored.restored, true);
  assert.equal(regional.industries.forge.collapsed, false);
});

test("evolution state normalization and consequence branches remain save compatible", () => {
  const populatedPorts = [
    {
      name: "Forgeport",
      infrastructure: 0,
      labor: 0.8,
      population: 12345,
      extractiveGoods: ["ore"],
    },
  ];
  const fresh = createRegionalState(populatedPorts, chains).Forgeport;
  assert.equal(fresh.population, 12345);
  const normalized = normalizeRegionalState(
    {
      Forgeport: {
        population: 900,
        unrest: 150,
        politicalAttention: -5,
        pirateAttention: 45,
        industries: {
          forge: {
            investment: 2,
            collapsed: true,
            magnate: "Existing Magnate",
          },
        },
      },
    },
    populatedPorts,
    chains,
  ).Forgeport;
  assert.equal(normalized.population, 1000);
  assert.equal(normalized.unrest, 100);
  assert.equal(normalized.politicalAttention, 0);
  assert.equal(normalized.pirateAttention, 45);
  assert.equal(normalized.industries.forge.magnate, "Existing Magnate");

  const noResources = createRegionalState(
    [{ name: "Quietport", labor: 1.2, extractiveGoods: [] }],
    chains,
  ).Quietport;
  const originalPopulation = noResources.population;
  advanceRegionalResources(
    noResources,
    { grain: { stock: 20, target: 20, production: 0 } },
    chains,
  );
  assert.ok(noResources.population > originalPopulation);
  assert.equal(portEvolution(noResources).crisis, false);
  assert.equal(portEvolution(noResources).foundries, false);

  noResources.labor = 1;
  noResources.population = 50000;
  advanceRegionalResources(
    noResources,
    { grain: { stock: 20, target: 20, production: 0 } },
    chains,
  );
  assert.equal(noResources.population, 50000);
  assert.equal(dockingFee({ ...noResources, unrest: 100 }), 2);

  normalized.industries.forge.collapsed = false;
  const existingMagnate = investInIndustry(
    normalized,
    "forge",
    500,
    "Forgeport",
  );
  assert.equal(existingMagnate.magnate, "Existing Magnate");
  assert.equal(
    availableMarketGoods(normalized, chains, ["ore", "iron"]).has("iron"),
    true,
  );
  normalized.industries.forge.collapsed = true;
  assert.equal(
    availableMarketGoods(normalized, chains, ["ore", "iron"]).has("iron"),
    false,
  );
  assert.equal(portEvolution(normalized).crisis, true);
});

test("infrastructure and investment produce bounded progression", () => {
  assert.equal(infrastructureCapacity(-2), 0.55);
  assert.equal(infrastructureCapacity(2), 1.35);
  assert.equal(infrastructureCapacity(8), 1.7);
  const regional = createRegionalState(ports, chains).Forgeport;
  assert.equal(investmentCost(regional.industries.forge), 90);
  assert.equal(investInIndustry(regional, "missing", 500).ok, false);
  assert.equal(investInIndustry(regional, "forge", 50).ok, false);
  const first = investInIndustry(regional, "forge", 500);
  assert.equal(first.ok, true);
  assert.equal(first.coins, 410);
  investInIndustry(regional, "forge", 500);
  const third = investInIndustry(regional, "forge", 500);
  assert.equal(third.level, 3);
  assert.equal(regional.infrastructure, 3);
  assert.equal(investInIndustry(regional, "forge", 500).ok, false);
});

test("recipes adapt to available inputs and input stocks affect quality", () => {
  const market = states();
  assert.equal(chooseRecipe(market, chains[0]).id, "standard");
  market.ore.stock = 0;
  market.iron.stock = 9;
  assert.equal(chooseRecipe(market, chains[0]).id, "scrap");
  assert.ok(inputQuality(market, chains[0].alternatives[0]) > 0.8);
  assert.equal(inputQuality({}, { inputs: {} }), 0.8);
  assert.equal(inputQuality({}, { inputs: { missing: 1 } }), 0.8);
  assert.equal(
    chooseRecipe(states(), {
      inputs: {},
    }).availability,
    0,
  );
  assert.equal(
    chooseRecipe(states(), {
      inputs: { grain: 0 },
    }).availability,
    2000,
  );
  const noScaleAlternative = chooseRecipe(
    { grain: { stock: 0 }, herbs: { stock: 5 } },
    {
      inputs: { grain: 1 },
      alternatives: [{ id: "herbs", inputs: { herbs: 1 } }],
    },
  );
  assert.equal(noScaleAlternative.id, "herbs");
});

test("regional industries consume inputs, fuel, and create quality-adjusted output", () => {
  const market = states();
  const regional = createRegionalState(ports, chains).Forgeport;
  const reports = runRegionalIndustries(market, chains, { forge: 1 }, regional);
  assert.equal(reports.length, 1);
  assert.ok(reports[0].batches > 0);
  assert.equal(reports[0].recipeId, "standard");
  assert.ok(market.ore.stock < 10);
  assert.ok(market.timber.stock < 10);
  assert.ok(market.iron.stock > 1);

  market.timber.stock = 0;
  const limited = runRegionalIndustries(
    market,
    chains,
    { forge: 1 },
    regional,
  )[0];
  assert.equal(limited.fuelLimited, true);
  assert.equal(limited.batches, 0);

  const sparseMarket = {
    grain: { stock: 10, target: 20 },
    provisions: { stock: 0, target: 20 },
  };
  const simpleChain = {
    id: "kitchen",
    inputs: { grain: 1, missing: 1 },
    outputs: { provisions: 1, absent: 1 },
    rate: 1,
  };
  const sparseRegional = {
    infrastructure: 1,
    labor: 1,
    resourceHealth: {},
    industries: {},
  };
  const sparse = runRegionalIndustries(
    sparseMarket,
    [simpleChain],
    {},
    sparseRegional,
  )[0];
  assert.equal(sparse.batches, 0);
  assert.equal(sparse.fuelLimited, false);
  assert.equal(sparse.investment, 0);

  const noScaleMarket = {
    herbs: { stock: 5 },
    medicine: { stock: 0, target: 20 },
  };
  const noScale = runRegionalIndustries(
    noScaleMarket,
    [
      {
        id: "tonic",
        inputs: { missing: 1 },
        alternatives: [{ id: "herbs", inputs: { herbs: 1 } }],
        outputs: { medicine: 1 },
        rate: 1,
      },
    ],
    { tonic: 1 },
    {
      infrastructure: 1,
      labor: 1,
      resourceHealth: {},
      industries: {},
    },
  )[0];
  assert.ok(noScaleMarket.medicine.stock > 0);
  assert.equal(noScale.recipeId, "herbs");

  const noTimber = runRegionalIndustries(
    {
      ore: { stock: 10, target: 20 },
      iron: { stock: 0, target: 20 },
    },
    chains,
    { forge: 1 },
    createRegionalState(ports, chains).Forgeport,
  )[0];
  assert.equal(noTimber.fuelLimited, true);
});

test("extractive resources deplete under pressure and labor follows shortages", () => {
  const regional = createRegionalState(ports, chains).Forgeport;
  const market = states();
  market.ore.production = 4;
  market.grain.stock = 1;
  const modifiers = advanceRegionalResources(regional, market);
  assert.ok(regional.resourceHealth.ore < 1);
  assert.ok(modifiers.ore.production < 0);
  assert.ok(regional.labor < 1.1);

  market.ore.production = 0;
  market.grain.stock = 20;
  market.ore.stock = 20;
  const previous = regional.resourceHealth.ore;
  advanceRegionalResources(regional, market);
  assert.ok(regional.resourceHealth.ore > previous);
  const missingMarket = {};
  const missingModifier = advanceRegionalResources(regional, missingMarket);
  assert.equal(missingModifier.ore.production, 0);
  advanceRegionalResources(regional, {
    ore: { stock: 20, production: 1 },
  });
  const summary = regionalSummary(regional);
  assert.equal(summary.infrastructure, "Industrial");
  assert.ok(summary.laborPercent > 0);
  assert.ok(summary.resourcePercent <= 100);
  assert.equal(
    regionalSummary({
      infrastructure: -1,
      labor: 1,
      resourceHealth: {},
    }).infrastructure,
    "Subsistence",
  );
});
