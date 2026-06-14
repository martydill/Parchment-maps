import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceEconomyState,
  buyPrice,
  createEconomyState,
  economyCondition,
  marketReferenceValue,
  sellPrice,
} from "../src/core/economy.js";

const baseOptions = {
  state: { stock: 26, target: 26, production: 1, consumption: 1 },
  good: { key: "iron", base: 18 },
  bias: 1,
  day: 1,
  portName: "Goldhaven",
};

test("createEconomyState builds bounded state for every port and good", () => {
  const result = createEconomyState(
    [{ name: "Port", bias: { iron: 1, silk: 0.5 } }],
    { iron: {}, silk: {} },
  );
  assert.deepEqual(Object.keys(result.Port), ["iron", "silk"]);
  assert.equal(result.Port.iron.target, 26);
  assert.ok(result.Port.silk.stock <= 52);
  assert.ok(result.Port.iron.production >= 0.2);
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
