import assert from "node:assert/strict";
import test from "node:test";
import {
  createVoyageLedger,
  normalizeVoyageLedger,
  beginVoyageReceipt,
  recordVoyageEntry,
  arriveVoyageReceipt,
  voyageProfit,
} from "../src/core/voyage-ledger.js";

test("receipts include preparation, arrival sales, cost basis and operating costs once", () => {
  const ledger = createVoyageLedger();
  recordVoyageEntry(ledger, "supplies", 12, "A");
  beginVoyageReceipt(ledger, "A", 1);
  beginVoyageReceipt(ledger, "Wrong", 2);
  recordVoyageEntry(ledger, "wages", 18);
  recordVoyageEntry(ledger, "harbor", 2);
  const receipt = arriveVoyageReceipt(ledger, "A", "B", 3);
  recordVoyageEntry(ledger, "commissions", 150, "B");
  recordVoyageEntry(ledger, "sales", 100, "B");
  recordVoyageEntry(ledger, "cargoCost", 40, "B");
  recordVoyageEntry(ledger, "repairs", 10, "B");
  recordVoyageEntry(ledger, "cargoLost", 5, "B");
  assert.equal(voyageProfit(receipt), 163);
  assert.equal(receipt.origin, "A");
  assert.equal(receipt.departedDay, 1);
  assert.equal(receipt.arrivedDay, 3);
  beginVoyageReceipt(ledger, "B", 3);
  recordVoyageEntry(ledger, "harbor", 3);
  assert.equal(
    voyageProfit(receipt),
    163,
    "New voyages cannot change archived receipts",
  );
  assert.equal(ledger.active.entries.harbor, 3);
});

test("receipt normalization handles old saves, malformed records and history limits", () => {
  assert.deepEqual(normalizeVoyageLedger(), createVoyageLedger());
  const ledger = normalizeVoyageLedger({
    pending: null,
    active: {
      origin: "A",
      departedDay: Infinity,
      entries: { repairs: -4, wages: NaN },
    },
    history: [
      null,
      {},
      { origin: "A", destination: 5, departedDay: -8, arrivedDay: 2.5 },
    ],
  });
  assert.equal(ledger.active.departedDay, 1);
  assert.equal(ledger.active.entries.repairs, 0);
  assert.equal(ledger.history.length, 1);
  assert.equal(ledger.history[0].departedDay, 1);
  assert.equal(ledger.history[0].arrivedDay, 2);
  assert.equal(ledger.history[0].destination, null);
  recordVoyageEntry(ledger, "missing", 1);
  recordVoyageEntry(ledger, "sales", NaN);
  recordVoyageEntry(ledger, "sales", -1);
  recordVoyageEntry(ledger, "sales", 0);
  assert.equal(ledger.active.entries.sales, 0);
  for (let i = 0; i < 15; i++) {
    arriveVoyageReceipt(ledger, "A", "B", i + 1);
  }
  assert.equal(ledger.history.length, 12);
  assert.equal(normalizeVoyageLedger(ledger).history.length, 12);
  const restored = normalizeVoyageLedger(JSON.parse(JSON.stringify(ledger)));
  assert.deepEqual(restored, ledger);
  recordVoyageEntry(restored, "sales", 10, "Other harbor");
  assert.equal(restored.pending.sales, 10);
});
