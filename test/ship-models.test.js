import test from "node:test";
import assert from "node:assert/strict";
import {
  getShipModelProfile,
  SHIP_MODEL_IDS,
  SHIP_MODEL_PROFILES,
} from "../src/core/ship-models.js";

test("every ship class has a distinct, immutable 3D rig and hull profile", () => {
  assert.deepEqual(SHIP_MODEL_IDS, [
    "cutter",
    "sloop",
    "carrack",
    "barque",
    "brig",
    "dhow",
  ]);
  for (const id of SHIP_MODEL_IDS) {
    const profile = SHIP_MODEL_PROFILES[id];
    assert.ok(profile.length > 0);
    assert.ok(profile.beam > 0);
    assert.ok(profile.masts.length > 0);
    assert.ok(Object.isFrozen(profile));
    assert.ok(Object.isFrozen(profile.masts));
    assert.ok(profile.masts.every(Object.isFrozen));
    assert.equal(getShipModelProfile(id), profile);
  }
  assert.notEqual(
    SHIP_MODEL_PROFILES.carrack.length,
    SHIP_MODEL_PROFILES.sloop.length,
  );
  assert.equal(SHIP_MODEL_PROFILES.dhow.outrigger, true);
  assert.equal(SHIP_MODEL_PROFILES.brig.guns, true);
});

test("unknown ship classes choose a stable seeded profile with safe fallback", () => {
  assert.equal(
    getShipModelProfile("unknown", 3),
    getShipModelProfile("unknown", 3),
  );
  assert.equal(getShipModelProfile("unknown", 0), SHIP_MODEL_PROFILES.cutter);
  assert.equal(getShipModelProfile("unknown", -1), SHIP_MODEL_PROFILES.sloop);
  assert.equal(
    getShipModelProfile("unknown", Number.NaN),
    SHIP_MODEL_PROFILES.cutter,
  );
  assert.equal(
    getShipModelProfile("unknown", Infinity),
    SHIP_MODEL_PROFILES.cutter,
  );
});
