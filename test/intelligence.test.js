import assert from "node:assert/strict";
import test from "node:test";

import {
  bestTradeOpportunity,
  intelActionLabel,
  intelEffectText,
  upcomingEvents,
} from "../src/core/intelligence.js";

test("upcomingEvents filters started and out-of-window events then sorts them", () => {
  const events = [
    { id: "late", startDay: 20, started: false },
    { id: "second", startDay: 15, started: false },
    { id: "started", startDay: 12, started: true },
    { id: "past", startDay: 10, started: false },
    { id: "first", startDay: 11, started: false },
  ];

  assert.deepEqual(
    upcomingEvents(events, 10).map((event) => event.id),
    ["first", "second"],
  );
  assert.deepEqual(upcomingEvents(events, 10, 0), []);
});

test("bestTradeOpportunity compares executable prices across distinct ports", () => {
  const ports = [{ name: "A" }, { name: "B" }];
  const buyPrices = { "A:tea": 8, "B:tea": 11, "A:silk": 20, "B:silk": 12 };
  const sellPrices = {
    "A:tea": 9,
    "B:tea": 14,
    "A:silk": 25,
    "B:silk": 15,
  };

  assert.deepEqual(
    bestTradeOpportunity(
      ["tea", "silk"],
      ports,
      (port, good) => buyPrices[`${port.name}:${good}`],
      (port, good) => sellPrices[`${port.name}:${good}`],
    ),
    { key: "silk", buy: "B", sell: "A", margin: 13 },
  );
  assert.equal(
    bestTradeOpportunity(
      [],
      ports,
      () => 0,
      () => 0,
    ),
    null,
  );
});

test("intelligence report helpers describe every report type", () => {
  assert.equal(
    intelEffectText({ type: "forecast", affectedPort: "Orvessa Quay" }),
    "Orvessa Quay has been marked on your chart, and the confidential forecast now appears in that town’s political record.",
  );
  assert.match(
    intelEffectText({
      type: "market",
      buyPort: "Near",
      sellPort: "Far",
    }),
    /Near → Far/,
  );
  assert.match(intelEffectText({ type: "shipping", expiresDay: 17 }), /Day 17/);
  assert.equal(
    intelEffectText({ type: "other" }),
    "The report has been saved in your captain’s ledger.",
  );

  assert.equal(
    intelActionLabel({ type: "forecast", affectedPort: "Orvessa Quay" }),
    "Inspect Orvessa Quay",
  );
  assert.equal(
    intelActionLabel({ type: "market", sellPort: "Far" }),
    "Inspect Far",
  );
  assert.equal(
    intelActionLabel({ type: "shipping" }),
    "Inspect Tracked Vessel",
  );
  assert.equal(intelActionLabel({ type: "other" }), "Open Ledger");
});
