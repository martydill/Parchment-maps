import { PORT_NAMES, LAND_NAMES } from "../src/names.js";
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
    [PORT_NAMES.orvessaQuay]: { leased: true, capacity: "8", lots: [lot] },
    [PORT_NAMES.narthkel]: { leased: false, capacity: 0, lots: "invalid" },
    [LAND_NAMES.lunemire]: null,
  });
  assert.deepEqual(state[PORT_NAMES.orvessaQuay], {
    leased: true,
    capacity: 8,
    lots: [lot],
  });
  assert.deepEqual(state[PORT_NAMES.narthkel], {
    leased: false,
    capacity: 24,
    lots: [],
  });
  assert.deepEqual(state[LAND_NAMES.lunemire], {
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
  assert.deepEqual(leaseWarehouse(state, PORT_NAMES.orvessaQuay, 29, 10), {
    ok: false,
    reason: "Not enough crowns.",
    coins: 29,
    cost: 30,
  });
  const leased = leaseWarehouse(state, PORT_NAMES.orvessaQuay, 80, 10);
  assert.equal(leased.ok, true);
  assert.equal(leased.coins, 50);
  assert.equal(leased.warehouse.capacity, 24);
  assert.equal(warehouseAt(state, PORT_NAMES.orvessaQuay), leased.warehouse);
  assert.deepEqual(leaseWarehouse(state, PORT_NAMES.orvessaQuay, 50), {
    ok: false,
    reason: "You already lease a warehouse at this port.",
    coins: 50,
  });
  const reservedLot = { id: "reserved" };
  state[PORT_NAMES.narthkel] = {
    leased: false,
    capacity: 12,
    lots: [reservedLot],
  };
  const resumed = leaseWarehouse(state, PORT_NAMES.narthkel, 60);
  assert.equal(resumed.warehouse.lots[0], reservedLot);
});

test("cargo deposits and withdrawals preserve individual lots", () => {
  const lot = { id: "lot-1", key: "silk", age: 2 };
  const shipLots = [lot];
  const state = {};
  assert.equal(
    depositCargo(state, PORT_NAMES.orvessaQuay, shipLots, lot.id).ok,
    false,
  );
  leaseWarehouse(state, PORT_NAMES.orvessaQuay, 60);
  assert.equal(
    depositCargo(state, PORT_NAMES.orvessaQuay, shipLots, "missing").ok,
    false,
  );
  const deposited = depositCargo(
    state,
    PORT_NAMES.orvessaQuay,
    shipLots,
    lot.id,
  );
  assert.equal(deposited.ok, true);
  assert.deepEqual(shipLots, []);
  assert.equal(deposited.warehouse.lots[0], lot);
  assert.equal(
    withdrawCargo(state, PORT_NAMES.narthkel, shipLots, lot.id, 1).ok,
    false,
  );
  assert.equal(
    withdrawCargo(state, PORT_NAMES.orvessaQuay, shipLots, lot.id, 0).reason,
    "The ship's hold is full.",
  );
  assert.equal(
    withdrawCargo(state, PORT_NAMES.orvessaQuay, shipLots, "missing", 1).ok,
    false,
  );
  const withdrawn = withdrawCargo(
    state,
    PORT_NAMES.orvessaQuay,
    shipLots,
    lot.id,
    1,
  );
  assert.equal(withdrawn.ok, true);
  assert.equal(shipLots[0], lot);
  assert.deepEqual(withdrawn.warehouse.lots, []);
});

test("full warehouses reject deposits", () => {
  const state = {
    [PORT_NAMES.orvessaQuay]: {
      leased: true,
      capacity: 1,
      lots: [{ id: "stored" }],
    },
  };
  const shipLots = [{ id: "aboard" }];
  const result = depositCargo(
    state,
    PORT_NAMES.orvessaQuay,
    shipLots,
    "aboard",
  );
  assert.equal(result.reason, "The warehouse is full.");
  assert.equal(shipLots.length, 1);
});

test("stored cargo ages slowly and malformed entries are ignored", () => {
  const state = {
    [PORT_NAMES.orvessaQuay]: {
      leased: true,
      lots: [{ age: 1 }, { age: "invalid" }],
    },
    [PORT_NAMES.narthkel]: { leased: false, lots: [{ age: 4 }] },
    [LAND_NAMES.lunemire]: { leased: true, lots: "invalid" },
  };
  assert.equal(ageWarehouseCargo(state, -2), state);
  ageWarehouseCargo(state);
  ageWarehouseCargo(state, 4);
  assert.equal(state[PORT_NAMES.orvessaQuay].lots[0].age, 2);
  assert.equal(state[PORT_NAMES.orvessaQuay].lots[1].age, 1);
  assert.equal(state[PORT_NAMES.narthkel].lots[0].age, 4);
});
