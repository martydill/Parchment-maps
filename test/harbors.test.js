import test from "node:test";
import assert from "node:assert/strict";
import { harborDevelopment, harborProfile } from "../src/core/harbors.js";
import { PORT_NAMES } from "../src/names.js";

test("every named harbor has a stable architectural identity", () => {
  const kinds = new Set();
  for (const name of Object.values(PORT_NAMES)) {
    const profile = harborProfile(name);
    assert.ok(profile);
    assert.equal(harborProfile(name), profile);
    assert.ok(Object.isFrozen(profile));
    assert.ok(Number.isInteger(profile.variant));
    kinds.add(profile.kind);
  }
  assert.equal(kinds.size, 11);
  assert.equal(harborProfile("Unknown"), null);
  assert.equal(harborProfile(), null);
  assert.equal(harborProfile(PORT_NAMES.velquorin).kind, "canals");
  assert.equal(harborProfile(PORT_NAMES.mirelune).kind, "marsh");
  assert.notEqual(
    harborProfile(PORT_NAMES.velquorin).variant,
    harborProfile(PORT_NAMES.verdigate).variant,
  );
});

test("harbor development defaults safely for older evolution callers", () => {
  const expected = {
    level: 1,
    crisis: false,
    docks: 1,
    cargo: 4,
    workers: 5,
    boats: 2,
    warehouses: false,
    cranes: false,
    foundries: false,
    fortifications: false,
  };
  assert.deepEqual(harborDevelopment(), expected);
  for (const level of [undefined, NaN, Infinity, "3"])
    assert.deepEqual(harborDevelopment({ level }), expected);
  assert.notEqual(harborDevelopment(), harborDevelopment());
});

test("prosperity increases docks, freight and activity with bounded levels", () => {
  const poor = harborDevelopment({ level: -10 });
  const rich = harborDevelopment({ level: 100 });
  assert.equal(poor.level, 0);
  assert.equal(rich.level, 3);
  assert.equal(harborDevelopment({ level: 2.9 }).level, 2);
  for (const channel of ["docks", "cargo", "workers", "boats"])
    assert.ok(rich[channel] > poor[channel]);
  for (const channel of ["warehouses", "cranes", "fortifications"])
    assert.equal(rich[channel], true);
  assert.equal(rich.foundries, false);
});

test("investment remains visible during crises but harbor activity contracts", () => {
  const input = {
    level: 0,
    warehouses: true,
    cranes: true,
    foundries: true,
    fortifications: true,
    crisis: true,
  };
  const development = harborDevelopment(input);
  assert.equal(development.cargo, 1);
  assert.equal(development.workers, 2);
  assert.equal(development.boats, 1);
  for (const channel of ["warehouses", "cranes", "foundries", "fortifications"])
    assert.equal(development[channel], true);
  assert.equal(input.level, 0);
});
