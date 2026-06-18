import assert from "node:assert/strict";
import test from "node:test";

import {
  discoverySites,
  explorationSites,
  goods,
  lands,
  productionChains,
} from "../src/world-data.js";

test("the trade catalog offers a broad mix of raw, perishable, fragile, and processed goods", () => {
  assert.ok(Object.keys(goods).length >= 20);
  assert.ok(Object.values(goods).some((good) => good.perishRate));
  assert.ok(Object.values(goods).some((good) => good.fragility));
  assert.ok(Object.values(goods).some((good) => good.processed));
  assert.equal(goods.glass.processed, true);
  assert.equal(goods.ceramics.fragility, 0.4);
});

test("production chains support the expanded manufactured-goods catalog", () => {
  const outputs = new Set(
    productionChains.flatMap((chain) => Object.keys(chain.outputs)),
  );
  assert.ok(outputs.has("glass"));
  assert.ok(outputs.has("tools"));
});

test("the world contains a varied, uniquely identified set of discoveries", () => {
  assert.equal(discoverySites.length, 132);
  assert.equal(
    new Set(discoverySites.map((site) => site.id)).size,
    discoverySites.length,
  );
  assert.equal(
    new Set(discoverySites.map((site) => site.name)).size,
    discoverySites.length,
  );
  assert.ok(new Set(discoverySites.map((site) => site.type)).size >= 10);
  // The appended resource deposits are exactly the cargo-yielding types.
  const resourceTypes = new Set([
    "Hidden resource deposit",
    "Salvage site",
    "Smuggler cove",
    "Rare ecosystem",
  ]);
  for (const site of discoverySites.filter((entry) =>
    entry.id.startsWith("resource-find"),
  )) {
    assert.ok(
      resourceTypes.has(site.type),
      `${site.id} should be a resource deposit`,
    );
  }

  for (const site of discoverySites) {
    assert.ok(site.description);
    assert.ok(site.benefit);
    assert.ok(site.route);
    assert.ok(goods[site.route.good], `${site.name} uses a known trade good`);
  }
});

test("shore exploration sites are broad enough to chart every named landmass", () => {
  assert.ok(explorationSites.length >= 75);
  assert.equal(
    new Set(explorationSites.map((site) => site.id)).size,
    explorationSites.length,
  );

  const siteLands = new Set(
    explorationSites.map((site) => site.land).filter((land) => land),
  );
  for (const land of lands.filter((entry) => entry.name)) {
    assert.ok(siteLands.has(land.name), `${land.name} has a shore survey`);
  }

  for (const site of explorationSites) {
    assert.ok(site.name);
    assert.ok(site.objective);
    assert.ok(site.hazards);
    assert.ok(site.radius >= 70);
    assert.ok(site.reward > 0);
  }
});
