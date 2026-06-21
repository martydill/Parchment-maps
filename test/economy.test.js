import { PORT_NAMES } from "../src/names.js";
import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceEconomyState,
  buyPrice,
  createEconomyState,
  economyCondition,
  marketReferenceValue,
  runProductionChains,
  sellPrice,
} from "../src/core/economy.js";

const baseOptions = {
  state: { stock: 26, target: 26, production: 1, consumption: 1 },
  good: { key: "iron", base: 18 },
  bias: 1,
  day: 1,
  portName: PORT_NAMES.orvessaQuay,
};

test("createEconomyState builds bounded state for every port and good", () => {
  const result = createEconomyState(
    [{ name: "Port", bias: { iron: 1, silk: 0.5 } }],
    { iron: {}, silk: {}, grain: {} },
  );
  assert.deepEqual(Object.keys(result.Port), ["iron", "silk", "grain"]);
  assert.equal(result.Port.iron.target, 26);
  assert.ok(result.Port.silk.stock <= 52);
  assert.ok(result.Port.iron.production >= 0.2);
});

test("processed goods depend on chains instead of appearing as native production", () => {
  const result = createEconomyState(
    [{ name: "Port", bias: { ore: 0.8, iron: 1.2 } }],
    { ore: {}, iron: { processed: true, target: 30 } },
  );
  assert.ok(result.Port.ore.production > 0);
  assert.equal(result.Port.iron.production, 0);
  assert.equal(result.Port.iron.target, 30);
});

test("economyCondition classifies stock ratios at every band", () => {
  const condition = (stock) => economyCondition({ stock, target: 100 });
  assert.equal(condition(20), "Shortage");
  assert.equal(condition(50), "Tight");
  assert.equal(condition(100), "Stable");
  assert.equal(condition(120), "Surplus");
  assert.equal(condition(150), "Glut");
});

test("marketReferenceValue responds to scarcity and multipliers", () => {
  const normal = marketReferenceValue(baseOptions);
  const scarce = marketReferenceValue({ ...baseOptions, stock: 5 });
  const event = marketReferenceValue({ ...baseOptions, eventMultiplier: 1.5 });
  assert.ok(scarce > normal);
  assert.ok(Math.abs(event / normal - 1.5) < 1e-12);
});

test("buy and sell quotes enforce a loss on an immediate round trip", () => {
  assert.ok(buyPrice(baseOptions) > sellPrice(baseOptions));
});

test("advanceEconomyState applies modifiers and clamps stock", () => {
  const state = { stock: 10, production: 2, consumption: 1 };
  assert.equal(
    advanceEconomyState(state, { production: 1, consumption: 0.5 }).stock,
    11.5,
  );
  assert.equal(
    advanceEconomyState({ stock: 69, production: 5, consumption: 0 }).stock,
    70,
  );
  assert.equal(
    advanceEconomyState({ stock: 1, production: 0, consumption: 5 }).stock,
    0,
  );
});

test("production chains consume inputs and create downstream goods", () => {
  const states = {
    ore: { stock: 10 },
    iron: { stock: 2 },
  };
  const reports = runProductionChains(
    states,
    [
      {
        id: "forge",
        inputs: { ore: 2 },
        outputs: { iron: 1 },
        rate: 3,
      },
    ],
    { forge: 1 },
  );
  assert.equal(states.ore.stock, 4);
  assert.equal(states.iron.stock, 5);
  assert.deepEqual(reports, [{ id: "forge", batches: 3, utilization: 1 }]);
});

test("production chains bottleneck on scarce inputs and honor disabled industries", () => {
  const states = {
    timber: { stock: 1 },
    iron: { stock: 20 },
    fittings: { stock: 69.8 },
  };
  const recipes = [
    {
      id: "shipwright",
      inputs: { timber: 2, iron: 1 },
      outputs: { fittings: 1 },
      rate: 2,
    },
    {
      id: "disabled",
      inputs: { iron: 1 },
      outputs: { fittings: 1 },
      rate: 1,
    },
  ];
  const reports = runProductionChains(states, recipes, {
    shipwright: 3,
    disabled: 0,
  });
  assert.equal(states.timber.stock, 0);
  assert.equal(states.iron.stock, 19.5);
  assert.equal(states.fittings.stock, 70);
  assert.equal(reports[0].batches, 0.5);
  assert.equal(reports[0].utilization, 0.125);
  assert.equal(reports.length, 1);
});

test("production chains handle missing inputs, capped efficiency, and zero-rate recipes", () => {
  const states = {
    ore: { stock: 3 },
    iron: { stock: 0 },
  };
  const reports = runProductionChains(
    states,
    [
      {
        id: "missing-input",
        inputs: { coal: 1 },
        outputs: { iron: 1 },
        rate: 1,
      },
      {
        id: "zero-rate",
        inputs: { ore: 1 },
        outputs: { iron: 1, slag: 1 },
        rate: 0,
      },
      {
        id: "unspecified",
        inputs: { ore: 1 },
        outputs: { iron: 1 },
        rate: 1,
      },
    ],
    { "missing-input": 5, "zero-rate": 1 },
  );
  assert.deepEqual(reports, [
    { id: "missing-input", batches: 0, utilization: 0 },
    { id: "zero-rate", batches: 0, utilization: 0 },
  ]);
  assert.equal(states.ore.stock, 3);
  assert.equal(states.iron.stock, 0);
});
