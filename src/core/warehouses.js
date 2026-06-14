export const WAREHOUSE_CAPACITY = 24;
export const WAREHOUSE_LEASE_COST = 60;
export const WAREHOUSE_TRUSTED_LEASE_COST = 30;
export const WAREHOUSE_TRUSTED_STANDING = 10;
export const WAREHOUSE_AGING_RATE = 0.25;

export function createWarehouseState() {
  return {};
}

export function normalizeWarehouseState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([portName, warehouse]) => [
      portName,
      {
        leased: warehouse?.leased === true,
        capacity: Math.max(
          1,
          Math.floor(Number(warehouse?.capacity) || WAREHOUSE_CAPACITY),
        ),
        lots: Array.isArray(warehouse?.lots) ? warehouse.lots : [],
      },
    ]),
  );
}

export function warehouseAt(state, portName) {
  return state[portName] || null;
}

export function warehouseLeaseCost(standing = 0) {
  return standing >= WAREHOUSE_TRUSTED_STANDING
    ? WAREHOUSE_TRUSTED_LEASE_COST
    : WAREHOUSE_LEASE_COST;
}

export function leaseWarehouse(state, portName, coins, standing = 0) {
  const existing = warehouseAt(state, portName);
  if (existing?.leased)
    return {
      ok: false,
      reason: "You already lease a warehouse at this port.",
      coins,
    };
  const cost = warehouseLeaseCost(standing);
  if (coins < cost)
    return { ok: false, reason: "Not enough crowns.", coins, cost };
  state[portName] = {
    leased: true,
    capacity: WAREHOUSE_CAPACITY,
    lots: existing?.lots || [],
  };
  return { ok: true, warehouse: state[portName], coins: coins - cost, cost };
}

export function depositCargo(state, portName, shipLots, lotId) {
  const warehouse = warehouseAt(state, portName);
  if (!warehouse?.leased)
    return { ok: false, reason: "No warehouse is leased at this port." };
  if (warehouse.lots.length >= warehouse.capacity)
    return { ok: false, reason: "The warehouse is full." };
  const index = shipLots.findIndex((lot) => lot.id === lotId);
  if (index < 0) return { ok: false, reason: "Cargo lot not found." };
  const [lot] = shipLots.splice(index, 1);
  warehouse.lots.push(lot);
  return { ok: true, lot, warehouse };
}

export function withdrawCargo(state, portName, shipLots, lotId, availableHold) {
  const warehouse = warehouseAt(state, portName);
  if (!warehouse?.leased)
    return { ok: false, reason: "No warehouse is leased at this port." };
  if (availableHold <= 0)
    return { ok: false, reason: "The ship's hold is full." };
  const index = warehouse.lots.findIndex((lot) => lot.id === lotId);
  if (index < 0) return { ok: false, reason: "Stored cargo lot not found." };
  const [lot] = warehouse.lots.splice(index, 1);
  shipLots.push(lot);
  return { ok: true, lot, warehouse };
}

export function ageWarehouseCargo(state, days) {
  const elapsed = Math.max(0, Number(days) || 0) * WAREHOUSE_AGING_RATE;
  for (const warehouse of Object.values(state)) {
    if (!warehouse?.leased || !Array.isArray(warehouse.lots)) continue;
    for (const lot of warehouse.lots)
      lot.age = Math.max(0, (Number(lot.age) || 0) + elapsed);
  }
  return state;
}
