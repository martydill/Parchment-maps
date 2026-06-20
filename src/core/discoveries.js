import { hash } from "./cargo.js";
import { normalizeRumorLeads } from "./rumors.js";

export const DISCOVERY_DISPOSITIONS = {
  secret: { label: "Keep secret" },
  sell: { label: "Sell the chart" },
  share: { label: "Share with faction" },
};

// Discovery types whose flavor promises recoverable goods. Finding one of
// these grants a small cargo sample of the site's trade good.
export const RESOURCE_DISCOVERY_TYPES = Object.freeze(
  new Set([
    "Hidden resource deposit",
    "Salvage site",
    "Smuggler cove",
    "Rare ecosystem",
  ]),
);

// A one-time sample recovered on find: the route's good and a deterministic
// 1-3 units (per-site, so every save shares the same haul). Returns null when
// the find yields no recoverable goods.
export function discoverySample(site) {
  if (!site || !RESOURCE_DISCOVERY_TYPES.has(site.type) || !site.route) {
    return null;
  }
  return {
    good: site.route.good,
    units: 1 + (hash(site.id) % 3),
  };
}

export function createDiscoveryState() {
  return {
    found: {},
    routeConsequences: [],
    rumorLeads: [],
  };
}

export function normalizeDiscoveryState(value) {
  const fresh = createDiscoveryState();
  if (!value || typeof value !== "object") return fresh;
  return {
    found:
      value.found && typeof value.found === "object"
        ? value.found
        : fresh.found,
    routeConsequences: Array.isArray(value.routeConsequences)
      ? value.routeConsequences
      : fresh.routeConsequences,
    rumorLeads: normalizeRumorLeads(value.rumorLeads),
  };
}

// Records that a discovery has been found (by clicking it, or as an expedition
// reward). Creates the record if it is new, or returns the existing one.
export function recordDiscovery(state, id, day) {
  if (state.found[id]) return state.found[id];
  const record = {
    id,
    foundDay: day,
    disposition: null,
    resolvedDay: null,
  };
  state.found[id] = record;
  return record;
}

export function resolveDiscovery(state, catalog, id, disposition, day) {
  const record = state.found[id];
  const site = catalog.find((entry) => entry.id === id);
  if (!record || !site)
    return { ok: false, reason: "That discovery is not recorded." };
  if (record.disposition)
    return { ok: false, reason: "This discovery has already been handled." };
  if (!DISCOVERY_DISPOSITIONS[disposition])
    return { ok: false, reason: "Unknown disposition." };

  record.disposition = disposition;
  record.resolvedDay = day;
  const consequence = {
    coins: disposition === "sell" ? site.saleValue : 0,
    standing:
      disposition === "share"
        ? { faction: site.faction, amount: site.standingValue }
        : null,
    public: disposition !== "secret",
  };
  if (consequence.public && site.route) {
    const route = {
      discoveryId: id,
      origin: site.route.origin,
      destination: site.route.destination,
      good: site.route.good,
      units: site.route.units,
      maturesDay: day + site.route.delay,
      active: false,
    };
    state.routeConsequences.push(route);
    consequence.route = route;
  }
  return { ok: true, site, record, consequence };
}

export function advanceDiscoveryConsequences(state, day) {
  const activated = [];
  for (const route of state.routeConsequences) {
    if (!route.active && day >= route.maturesDay) {
      route.active = true;
      activated.push(route);
    }
  }
  return activated;
}

export function activeDiscoveryTrade(state) {
  return state.routeConsequences.filter((route) => route.active);
}

export function seasonalSiteActive(site, day) {
  if (!site.season) return true;
  const cycleDay = ((day - 1) % site.season.cycle) + 1;
  return cycleDay >= site.season.start && cycleDay <= site.season.end;
}
