import assert from "node:assert/strict";
import test from "node:test";

import {
  ageWarehouseCargo,
  createWarehouseState,
  depositCargo,
  leaseWarehouse,
  normalizeWarehouseState,
  warehouseAt,
  warehouseLeaseCost,
  withdrawCargo,
} from "../src/core/warehouses.js";

test("warehouse state is created and legacy values are normalized", () => {
  assert.deepEqual(createWarehouseState(), {});
  assert.deepEqual(normalizeWarehouseState(null), {});
  assert.deepEqual(normalizeWarehouseState([]), {});
  const lot = { id: "stored" };
  const state = normalizeWarehouseState({
    "Orvessa Quay": { leased: true, capacity: "8", lots: [lot] },
    Narthkel: { leased: false, capacity: 0, lots: "invalid" },
    Lunemire: null,
  });
  assert.deepEqual(state["Orvessa Quay"], {
    leased: true,
    capacity: 8,
    lots: [lot],
  });
  assert.deepEqual(state.Narthkel, {
    leased: false,
    capacity: 24,
    lots: [],
  });
  assert.deepEqual(state.Lunemire, {
    leased: false,
    capacity: 24,
    lots: [],
  });
  assert.equal(warehouseAt(state, "Unknown"), null);
});

test("leases cost less for trusted captains and persist by port", () => {
  const state = createWarehouseState();
  assert.equal(warehouseLeaseCost(9), 60);
  assert.equal(warehouseLeaseCost(10), 30);
  assert.deepEqual(leaseWarehouse(state, "Orvessa Quay", 29, 10), {
    ok: false,
    reason: "Not enough crowns.",
    coins: 29,
    cost: 30,
  });
  const leased = leaseWarehouse(state, "Orvessa Quay", 80, 10);
  assert.equal(leased.ok, true);
  assert.equal(leased.coins, 50);
  assert.equal(leased.warehouse.capacity, 24);
  assert.equal(warehouseAt(state, "Orvessa Quay"), leased.warehouse);
  assert.deepEqual(leaseWarehouse(state, "Orvessa Quay", 50), {
    ok: false,
    reason: "You already lease a warehouse at this port.",
    coins: 50,
  });
  const reservedLot = { id: "reserved" };
  state.Narthkel = { leased: false, capacity: 12, lots: [reservedLot] };
  const resumed = leaseWarehouse(state, "Narthkel", 60);
  assert.equal(resumed.warehouse.lots[0], reservedLot);
});

test("cargo deposits and withdrawals preserve individual lots", () => {
  const lot = { id: "lot-1", key: "silk", age: 2 };
  const shipLots = [lot];
  const state = {};
  assert.equal(depositCargo(state, "Orvessa Quay", shipLots, lot.id).ok, false);
  leaseWarehouse(state, "Orvessa Quay", 60);
  assert.equal(
    depositCargo(state, "Orvessa Quay", shipLots, "missing").ok,
    false,
  );
  const deposited = depositCargo(state, "Orvessa Quay", shipLots, lot.id);
  assert.equal(deposited.ok, true);
  assert.deepEqual(shipLots, []);
  assert.equal(deposited.warehouse.lots[0], lot);
  assert.equal(withdrawCargo(state, "Narthkel", shipLots, lot.id, 1).ok, false);
  assert.equal(
    withdrawCargo(state, "Orvessa Quay", shipLots, lot.id, 0).reason,
    "The ship's hold is full.",
  );
  assert.equal(
    withdrawCargo(state, "Orvessa Quay", shipLots, "missing", 1).ok,
    false,
  );
  const withdrawn = withdrawCargo(state, "Orvessa Quay", shipLots, lot.id, 1);
  assert.equal(withdrawn.ok, true);
  assert.equal(shipLots[0], lot);
  assert.deepEqual(withdrawn.warehouse.lots, []);
});

test("full warehouses reject deposits", () => {
  const state = {
    "Orvessa Quay": { leased: true, capacity: 1, lots: [{ id: "stored" }] },
  };
  const shipLots = [{ id: "aboard" }];
  const result = depositCargo(state, "Orvessa Quay", shipLots, "aboard");
  assert.equal(result.reason, "The warehouse is full.");
  assert.equal(shipLots.length, 1);
});

test("stored cargo ages slowly and malformed entries are ignored", () => {
  const state = {
    "Orvessa Quay": {
      leased: true,
      lots: [{ age: 1 }, { age: "invalid" }],
    },
    Narthkel: { leased: false, lots: [{ age: 4 }] },
    Lunemire: { leased: true, lots: "invalid" },
  };
  assert.equal(ageWarehouseCargo(state, -2), state);
  ageWarehouseCargo(state);
  ageWarehouseCargo(state, 4);
  assert.equal(state["Orvessa Quay"].lots[0].age, 2);
  assert.equal(state["Orvessa Quay"].lots[1].age, 1);
  assert.equal(state.Narthkel.lots[0].age, 4);
});
