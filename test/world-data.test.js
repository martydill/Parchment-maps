import assert from "node:assert/strict";
import test from "node:test";

import { discoverySites, goods, productionChains } from "../src/world-data.js";

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

test("the world contains one hundred varied, uniquely identified discoveries", () => {
  assert.equal(discoverySites.length, 100);
  assert.equal(new Set(discoverySites.map((site) => site.id)).size, 100);
  assert.equal(new Set(discoverySites.map((site) => site.name)).size, 100);
  assert.ok(new Set(discoverySites.map((site) => site.type)).size >= 10);

  for (const site of discoverySites) {
    assert.ok(site.description);
    assert.ok(site.benefit);
    assert.ok(site.route);
    assert.ok(goods[site.route.good], `${site.name} uses a known trade good`);
  }
});
