import assert from "node:assert/strict";
import test from "node:test";

import {
  activeDiscoveryTrade,
  advanceDiscoveryConsequences,
  createDiscoveryState,
  discoverNearby,
  normalizeDiscoveryState,
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
const distance = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

test("nearby discoveries are recorded once", () => {
  const state = createDiscoveryState();
  assert.equal(
    discoverNearby(state, catalog, { x: 20, y: 20 }, 2, distance).length,
    0,
  );
  const found = discoverNearby(state, catalog, { x: 12, y: 12 }, 3, distance);
  assert.equal(found[0].record.foundDay, 3);
  assert.equal(
    discoverNearby(state, catalog, { x: 10, y: 10 }, 4, distance).length,
    0,
  );
});

test("expedition discoveries are not revealed by sailing nearby", () => {
  const state = createDiscoveryState();
  const expeditionCatalog = [{ ...catalog[0], requiresExpedition: true }];
  assert.deepEqual(
    discoverNearby(state, expeditionCatalog, { x: 10, y: 10 }, 1, distance),
    [],
  );
});

test("selling a discovery pays and schedules a public route consequence", () => {
  const state = createDiscoveryState();
  discoverNearby(state, catalog, { x: 10, y: 10 }, 1, distance);
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
  discoverNearby(shared, catalog, { x: 10, y: 10 }, 1, distance);
  const result = resolveDiscovery(shared, catalog, "reef-cut", "share", 2);
  assert.deepEqual(result.consequence.standing, {
    faction: "Navigators",
    amount: 6,
  });

  const secret = createDiscoveryState();
  discoverNearby(secret, catalog, { x: 10, y: 10 }, 1, distance);
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
  discoverNearby(invalid, catalog, { x: 10, y: 10 }, 1, distance);
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
  discoverNearby(routeFree, routeFreeCatalog, { x: 10, y: 10 }, 1, distance);
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
