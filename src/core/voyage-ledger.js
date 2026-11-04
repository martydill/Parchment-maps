export const VOYAGE_ENTRIES = Object.freeze({
  sales: "Cargo sales",
  cargoCost: "Cost of cargo sold",
  cargoLost: "Lost or seized cargo",
  commissions: "Commission rewards",
  harbor: "Harbor dues",
  customs: "Customs fines & fees",
  supplies: "Provisions",
  repairs: "Repairs",
  wages: "Crew wages paid",
  leave: "Shore leave",
  encounters: "Encounter losses",
  salvage: "Salvage rewards",
});
const amounts = (value = {}) =>
  Object.fromEntries(
    Object.keys(VOYAGE_ENTRIES).map((key) => [
      key,
      Number.isFinite(value?.[key]) ? Math.max(0, value[key]) : 0,
    ]),
  );

export function createVoyageLedger() {
  return { pending: amounts(), active: null, history: [] };
}

export function normalizeVoyageLedger(value) {
  const receipt = (entry) =>
    entry && typeof entry.origin === "string"
      ? {
          origin: entry.origin,
          destination:
            typeof entry.destination === "string" ? entry.destination : null,
          departedDay: Number.isFinite(entry.departedDay)
            ? Math.max(1, Math.floor(entry.departedDay))
            : 1,
          arrivedDay: Number.isFinite(entry.arrivedDay)
            ? Math.max(0, Math.floor(entry.arrivedDay))
            : 0,
          entries: amounts(entry.entries),
        }
      : null;
  return {
    pending: amounts(value?.pending),
    active: receipt(value?.active),
    history: (Array.isArray(value?.history) ? value.history : [])
      .map(receipt)
      .filter(Boolean)
      .slice(0, 12),
  };
}

export function beginVoyageReceipt(ledger, origin, day) {
  if (ledger.active) return;
  ledger.active = {
    origin,
    destination: null,
    departedDay: day,
    arrivedDay: 0,
    entries: ledger.pending,
  };
  ledger.pending = amounts();
}

export function recordVoyageEntry(ledger, key, amount, port = null) {
  if (
    !Object.hasOwn(VOYAGE_ENTRIES, key) ||
    !Number.isFinite(amount) ||
    amount <= 0
  )
    return;
  const arrived = ledger.history[0];
  const entries =
    ledger.active?.entries ||
    (port && arrived?.destination === port ? arrived.entries : ledger.pending);
  entries[key] += amount;
}

export function arriveVoyageReceipt(ledger, origin, destination, day) {
  beginVoyageReceipt(ledger, origin, day);
  ledger.active.destination = destination;
  ledger.active.arrivedDay = day;
  ledger.history.unshift(ledger.active);
  ledger.history = ledger.history.slice(0, 12);
  ledger.active = null;
  return ledger.history[0];
}

export function voyageProfit(receipt) {
  const e = receipt.entries;
  return (
    e.sales +
    e.commissions +
    e.salvage -
    Object.keys(VOYAGE_ENTRIES)
      .filter((key) => !["sales", "commissions", "salvage"].includes(key))
      .reduce((sum, key) => sum + e[key], 0)
  );
}
