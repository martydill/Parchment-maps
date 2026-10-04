import assert from "node:assert/strict";
import test from "node:test";
import { planMarketOrder } from "../src/core/market-order.js";
import { buyPrice, sellPrice } from "../src/core/economy.js";
import { createLegalState, tradeQuote } from "../src/core/jurisdictions.js";
import { cargoValueMultiplier, createCargoLot } from "../src/core/cargo.js";

function order(overrides = {}) {
  return {
    direction: "buy",
    quantity: 3,
    pricing: {
      state: { stock: 12, target: 26 },
      good: { key: "silk", base: 34 },
      bias: 1,
      day: 1,
      portName: "Test Port",
    },
    legal: createLegalState(),
    status: "legal",
    lots: [],
    coins: 1000,
    holdUsed: 0,
    holdMax: 18,
    ...overrides,
  };
}

test("bulk buying quotes marginal stock without mutating input", () => {
  const input = order();
  const before = structuredClone(input);
  const result = planMarketOrder(input);
  const expected = [12, 11, 10].map((stock) =>
    buyPrice({ ...input.pricing, state: { ...input.pricing.state, stock } }),
  );
  assert.deepEqual(result.prices, expected);
  assert.equal(
    result.total,
    expected.reduce((sum, price) => sum + price, 0),
  );
  assert.equal(result.coinsAfter, 1000 - result.total);
  assert.equal(result.holdAfter, 3);
  assert.equal(result.stockAfter, 9);
  assert.deepEqual(result.soldLots, []);
  assert.deepEqual(input, before);
});

test("selling values each FIFO cargo lot and changes stock for each unit", () => {
  const input = order({
    direction: "sell",
    quantity: 2,
    holdUsed: 4,
    status: "taxed",
  });
  input.lots = [0, 1].map((sequence) =>
    createCargoLot({
      key: "silk",
      cost: 20,
      origin: "Source",
      day: 1,
      sequence,
      good: input.pricing.good,
    }),
  );
  input.lots[1].quality = "fine";
  const unrelated = createCargoLot({
    key: "grain",
    cost: 2,
    origin: "Source",
    day: 1,
    sequence: 2,
    good: { base: 9 },
  });
  input.lots.unshift(unrelated);
  const before = structuredClone(input);
  const result = planMarketOrder(input);
  const expected = input.lots.slice(1).map((lot, index) =>
    Math.max(
      1,
      Math.round(
        tradeQuote(
          sellPrice({
            ...input.pricing,
            state: { ...input.pricing.state, stock: 12 + index },
          }),
          "taxed",
          "sell",
        ) * cargoValueMultiplier(lot, "Test Port", input.pricing.good),
      ),
    ),
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.prices, expected);
  assert.deepEqual(result.soldLots, input.lots.slice(1));
  assert.equal(result.coinsAfter, 1000 + result.total);
  assert.equal(result.holdAfter, 2);
  assert.equal(result.stockAfter, 14);
  assert.deepEqual(input, before);
});

test("rejects invalid directions and quantities", () => {
  assert.equal(planMarketOrder(order({ direction: "transfer" })).ok, false);
  for (const quantity of [0, -1, 1.5, NaN, 71])
    assert.equal(planMarketOrder(order({ quantity })).ok, false);
});

test("rejects unavailable cargo, stock, hold space and unaffordable orders", () => {
  assert.match(planMarketOrder(order({ direction: "sell" })).reason, /aboard/);
  assert.match(planMarketOrder(order({ holdUsed: 17 })).reason, /hold/);
  assert.match(planMarketOrder(order({ quantity: 13 })).reason, /stock/);
  const result = planMarketOrder(order({ coins: 0 }));
  assert.equal(result.ok, false);
  assert.match(result.reason, /crowns/);
  assert.ok(result.total > 0);
  assert.equal(planMarketOrder(order({ coins: result.total })).ok, true);
});

test("respects bans, permits, prohibitions and per-unit rations", () => {
  for (const status of ["prohibited", "licensed"])
    assert.equal(planMarketOrder(order({ status })).ok, false);
  const legal = createLegalState();
  legal.portBans["Test Port"] = 1;
  assert.equal(planMarketOrder(order({ legal })).ok, false);
  legal.portBans = {};
  legal.permits["Test Port:silk"] = 30;
  assert.equal(planMarketOrder(order({ legal, status: "licensed" })).ok, true);
  assert.equal(
    planMarketOrder(order({ status: "rationed", quantity: 2 })).ok,
    true,
  );
  assert.equal(
    planMarketOrder(order({ status: "rationed", quantity: 3 })).ok,
    false,
  );
  assert.equal(
    planMarketOrder(order({ quantity: 12, holdMax: 12 })).stockAfter,
    0,
  );
  assert.equal(
    planMarketOrder(
      order({
        quantity: 70,
        holdMax: 70,
        coins: 10000,
        pricing: { ...order().pricing, state: { stock: 70, target: 26 } },
      }),
    ).ok,
    true,
  );
});
