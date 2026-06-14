export const DISCOVERY_DISPOSITIONS = {
  secret: { label: "Keep secret" },
  sell: { label: "Sell the chart" },
  share: { label: "Share with faction" },
};

export function createDiscoveryState() {
  return {
    found: {},
    routeConsequences: [],
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
  };
}

export function discoverNearby(state, catalog, position, day, distance) {
  const discovered = [];
  for (const site of catalog) {
    if (site.requiresExpedition) continue;
    if (state.found[site.id]) continue;
    if (distance(position.x, position.y, site.x, site.y) > site.radius)
      continue;
    const record = {
      id: site.id,
      foundDay: day,
      disposition: null,
      resolvedDay: null,
    };
    state.found[site.id] = record;
    discovered.push({ site, record });
  }
  return discovered;
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
