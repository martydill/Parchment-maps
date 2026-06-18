import assert from "node:assert/strict";
import test from "node:test";

import {
  activeDiscoveryTrade,
  advanceDiscoveryConsequences,
  createDiscoveryState,
  discoverySample,
  normalizeDiscoveryState,
  recordDiscovery,
  resolveDiscovery,
  seasonalSiteActive,
} from "../src/core/discoveries.js";

const catalog = [
  {
    id: "reef-cut",
    x: 10,
    y: 10,
    radius: 5,
    saleValue: 80,
    faction: "Navigators",
    standingValue: 6,
    route: {
      origin: "West",
      destination: "East",
      good: "spice",
      units: 1.5,
      delay: 3,
    },
  },
];

test("recordDiscovery records a find once and preserves existing records", () => {
  const state = createDiscoveryState();
  const first = recordDiscovery(state, "reef-cut", 1);
  assert.equal(first.id, "reef-cut");
  assert.equal(first.foundDay, 1);
  assert.equal(first.disposition, null);
  assert.equal(first.resolvedDay, null);

  const again = recordDiscovery(state, "reef-cut", 9);
  assert.equal(again, first);
  assert.equal(again.foundDay, 1);
  assert.equal(Object.keys(state.found).length, 1);
});

test("selling a discovery pays and schedules a public route consequence", () => {
  const state = createDiscoveryState();
  recordDiscovery(state, "reef-cut", 1);
  const result = resolveDiscovery(state, catalog, "reef-cut", "sell", 4);
  assert.equal(result.ok, true);
  assert.equal(result.consequence.coins, 80);
  assert.equal(result.consequence.route.maturesDay, 7);
  assert.equal(
    resolveDiscovery(state, catalog, "reef-cut", "secret", 5).ok,
    false,
  );
  assert.deepEqual(advanceDiscoveryConsequences(state, 6), []);
  assert.equal(advanceDiscoveryConsequences(state, 7).length, 1);
  assert.equal(activeDiscoveryTrade(state).length, 1);
});

test("sharing grants standing while secrecy prevents public routes", () => {
  const shared = createDiscoveryState();
  recordDiscovery(shared, "reef-cut", 1);
  const result = resolveDiscovery(shared, catalog, "reef-cut", "share", 2);
  assert.deepEqual(result.consequence.standing, {
    faction: "Navigators",
    amount: 6,
  });

  const secret = createDiscoveryState();
  recordDiscovery(secret, "reef-cut", 1);
  const hidden = resolveDiscovery(secret, catalog, "reef-cut", "secret", 2);
  assert.equal(hidden.consequence.public, false);
  assert.equal(secret.routeConsequences.length, 0);
  assert.equal(
    resolveDiscovery(secret, catalog, "missing", "sell", 2).ok,
    false,
  );
  assert.equal(
    resolveDiscovery(createDiscoveryState(), catalog, "reef-cut", "bad", 2).ok,
    false,
  );
  const orphaned = createDiscoveryState();
  orphaned.found.orphaned = { id: "orphaned" };
  assert.equal(
    resolveDiscovery(orphaned, catalog, "orphaned", "sell", 2).ok,
    false,
  );
  const invalid = createDiscoveryState();
  recordDiscovery(invalid, "reef-cut", 1);
  assert.equal(
    resolveDiscovery(invalid, catalog, "reef-cut", "bad", 2).ok,
    false,
  );

  const routeFreeCatalog = [
    {
      ...catalog[0],
      id: "ruin",
      route: null,
    },
  ];
  const routeFree = createDiscoveryState();
  recordDiscovery(routeFree, "ruin", 1);
  assert.equal(
    resolveDiscovery(routeFree, routeFreeCatalog, "ruin", "sell", 2).consequence
      .route,
    undefined,
  );
});

test("normalization and seasonal windows handle old saves and cycle boundaries", () => {
  assert.deepEqual(normalizeDiscoveryState(null), createDiscoveryState());
  assert.deepEqual(normalizeDiscoveryState("old-save"), createDiscoveryState());
  assert.deepEqual(normalizeDiscoveryState({ found: { a: {} } }).found, {
    a: {},
  });
  assert.deepEqual(
    normalizeDiscoveryState({
      found: {},
      routeConsequences: [{ active: true }],
    }).routeConsequences,
    [{ active: true }],
  );
  assert.deepEqual(
    normalizeDiscoveryState({ found: null, routeConsequences: {} }),
    createDiscoveryState(),
  );
  const seasonal = { season: { cycle: 12, start: 3, end: 5 } };
  assert.equal(seasonalSiteActive({}, 99), true);
  assert.equal(seasonalSiteActive(seasonal, 3), true);
  assert.equal(seasonalSiteActive(seasonal, 5), true);
  assert.equal(seasonalSiteActive(seasonal, 6), false);
  assert.equal(seasonalSiteActive(seasonal, 15), true);
});

test("discovery samples recover goods only from resource finds, deterministically", () => {
  const resourceTypes = [
    "Hidden resource deposit",
    "Salvage site",
    "Smuggler cove",
    "Rare ecosystem",
  ];
  for (const type of resourceTypes) {
    const site = {
      id: `site-${type}`,
      type,
      route: { good: "ore", units: 1.5 },
    };
    const sample = discoverySample(site);
    assert.equal(sample.good, "ore");
    assert.ok(
      sample.units >= 1 && sample.units <= 3,
      `${type} yielded out-of-range units`,
    );
    assert.equal(discoverySample(site).units, sample.units);
  }

  const nonResource = {
    id: "beacon",
    type: "Navigational landmark",
    route: { good: "ore", units: 1.5 },
  };
  assert.equal(discoverySample(nonResource), null);

  const routeFree = { id: "bare-deposit", type: "Hidden resource deposit" };
  assert.equal(discoverySample(routeFree), null);
  assert.equal(discoverySample(null), null);
});
