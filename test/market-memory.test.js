import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeMarketNotes,
  rememberedSellPrice,
} from "../src/core/market-memory.js";

test("market memory filters invalid saved ports, goods, days, and quotes", () => {
  assert.deepEqual(normalizeMarketNotes(null, ["A"], ["iron"]), {});
  const notes = normalizeMarketNotes(
    {
      A: { day: 2, prices: { iron: 20, grain: -1, bad: 9 } },
      B: { day: -1 },
      C: { day: Infinity },
      Secret: { day: 1 },
    },
    ["A", "B", "C"],
    ["iron", "grain"],
  );
  assert.deepEqual(notes, { A: { day: 2, prices: { iron: 20 } } });
  assert.deepEqual(normalizeMarketNotes({ A: { day: 1 } }, ["A"], ["iron"]), {
    A: { day: 1, prices: {} },
  });
});

test("remembered prices age out and only fresh purchased circulars supersede visits", () => {
  const notes = { A: { day: 2, prices: { iron: 20 } } };
  assert.equal(rememberedSellPrice(notes, [], "A", "iron", 2), 20);
  assert.equal(rememberedSellPrice(notes, [], "A", "iron", 4), 19);
  assert.equal(rememberedSellPrice(notes, [], "A", "iron", 10), null);
  assert.equal(rememberedSellPrice(notes, [], "A", "iron", 1), null);
  assert.equal(rememberedSellPrice(notes, [], "Hidden", "iron", 2), null);
  assert.equal(
    rememberedSellPrice({ A: { prices: { iron: 0 } } }, [], "A", "iron", 1),
    null,
  );
  const report = {
    type: "market",
    sellPort: "A",
    goodKey: "iron",
    sellQuote: 30,
    boughtDay: 4,
    expiresDay: 7,
  };
  assert.equal(rememberedSellPrice(notes, [report], "A", "iron", 4), 30);
  for (const invalid of [
    { type: "forecast" },
    { sellPort: "B" },
    { goodKey: "grain" },
    { expiresDay: 3 },
    { boughtDay: 1 },
    { sellQuote: NaN },
  ])
    assert.equal(
      rememberedSellPrice(notes, [{ ...report, ...invalid }], "A", "iron", 4),
      19,
    );
});
