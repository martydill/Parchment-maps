import assert from "node:assert/strict";
import test from "node:test";

import {
  createMaritimeHazardState,
  currentAtPosition,
  markHazardEncounter,
  normalizeMaritimeHazardState,
  resolveShoalAction,
  resolveStormAction,
  shoalAtPosition,
  shouldTriggerStorm,
  stormCycle,
} from "../src/core/maritime-hazards.js";

test("maritime hazard state normalizes legacy and malformed saves", () => {
  assert.deepEqual(
    normalizeMaritimeHazardState(null),
    createMaritimeHazardState(),
  );
  assert.deepEqual(
    normalizeMaritimeHazardState("bad"),
    createMaritimeHazardState(),
  );
  assert.deepEqual(
    normalizeMaritimeHazardState({
      lastStormCycle: 2.8,
      lastShoalDistance: 140.5,
      encounters: -3,
    }),
    { lastStormCycle: 2, lastShoalDistance: 140.5, encounters: 0 },
  );
  assert.deepEqual(
    normalizeMaritimeHazardState({}),
    createMaritimeHazardState(),
  );
});

test("currents blend nearby vectors and wrap across the world seam", () => {
  const currents = [
    [990, 100, 0, "East Stream"],
    [100, 100, Math.PI / 2, "North Drift"],
  ];
  const result = currentAtPosition({ x: 10, y: 100 }, currents, 1000, 200);
  assert.ok(result.x > 0);
  assert.ok(result.y > 0);
  assert.equal(result.label, "East Stream");
  assert.deepEqual(currentAtPosition({ x: 500, y: 500 }, currents, 1000, 50), {
    x: 0,
    y: 0,
    strength: 0,
    label: null,
  });
});

test("shoal exposure uses elliptical bounds and wrapped longitude", () => {
  const shoals = [
    [990, 100, 40, 20, "Seam Bank"],
    [300, 300, 30, 30, null],
  ];
  const seam = shoalAtPosition({ x: 10, y: 100 }, shoals, 1000);
  assert.equal(seam.name, "Seam Bank");
  assert.equal(seam.exposure, 0.5);
  assert.equal(
    shoalAtPosition({ x: 300, y: 300 }, shoals, 1000).name,
    "Unmarked shallows",
  );
  assert.equal(shoalAtPosition({ x: 500, y: 500 }, shoals, 1000), null);
  const overlapping = shoalAtPosition(
    { x: 100, y: 100 },
    [
      [110, 100, 40, 40, "Outer Bank"],
      [100, 100, 20, 20, "Inner Bank"],
      [115, 100, 40, 40, "Lesser Bank"],
    ],
    1000,
  );
  assert.equal(overlapping.name, "Inner Bank");
});

test("storms trigger once per sufficiently rough weather cycle", () => {
  assert.equal(stormCycle(1, 0), 0);
  assert.equal(stormCycle(2, 500), 1);
  assert.equal(
    shouldTriggerStorm(createMaritimeHazardState(), {
      day: 1,
      voyageDistance: 0,
      roughness: 0.5,
    }),
    true,
  );
  assert.equal(
    shouldTriggerStorm(
      { lastStormCycle: 0 },
      {
        day: 1,
        voyageDistance: 0,
        roughness: 0.5,
      },
    ),
    false,
  );
  assert.equal(
    shouldTriggerStorm(createMaritimeHazardState(), {
      day: 1,
      voyageDistance: 0,
      roughness: 0.2,
    }),
    false,
  );
});

test("hazard encounters update the matching persistent cooldown", () => {
  const storm = markHazardEncounter(createMaritimeHazardState(), {
    type: "storm",
    cycle: 3,
    voyageDistance: 400,
  });
  assert.deepEqual(storm, {
    lastStormCycle: 3,
    lastShoalDistance: -1_000_000_000,
    encounters: 1,
  });
  assert.deepEqual(
    markHazardEncounter(storm, {
      type: "shoal",
      cycle: 4,
      voyageDistance: 700,
    }),
    { lastStormCycle: 3, lastShoalDistance: 700, encounters: 2 },
  );
});

test("shoal decisions trade speed, safety, morale, and cargo risk", () => {
  const safe = resolveShoalAction({
    action: "soundings",
    exposure: 0.2,
    speed: 20,
    seamanship: 2,
  });
  assert.deepEqual(safe.componentDamage, {});
  assert.equal(safe.speedMultiplier, 0.32);
  const hardSoundings = resolveShoalAction({
    action: "soundings",
    exposure: 1,
    speed: 175,
  });
  assert.deepEqual(hardSoundings.componentDamage, { hull: 1 });
  assert.equal(
    resolveShoalAction({
      action: "back-sails",
      exposure: 1,
      speed: 175,
    }).speedMultiplier,
    0,
  );
  const forced = resolveShoalAction({
    action: "force",
    exposure: 0.8,
    speed: 150,
  });
  assert.ok(forced.componentDamage.hull > 1);
  assert.equal(forced.moraleChange, -7);
  assert.ok(forced.cargoLossRisk > 0);
  assert.equal(
    resolveShoalAction({
      action: "force",
      exposure: 0.05,
      speed: 5,
      seamanship: 2,
    }).moraleChange,
    -3,
  );
});

test("storm decisions distinguish shelter, endurance, and speed", () => {
  const heave = resolveStormAction({
    action: "heave-to",
    roughness: 0.5,
    stormResistance: 2,
    seamanship: 2,
  });
  assert.equal(heave.speedMultiplier, 0);
  assert.equal(heave.provisionsUsed, 1);
  const shelter = resolveStormAction({
    action: "seek-lee",
    roughness: 0.8,
    stormResistance: 1,
  });
  assert.equal(shelter.moraleChange, 3);
  assert.equal(shelter.provisionsUsed, 2);
  const dangerousRun = resolveStormAction({
    action: "run",
    roughness: 1,
    stormResistance: 0.5,
  });
  assert.equal(dangerousRun.moraleChange, -5);
  assert.ok(dangerousRun.componentDamage.rigging > 1);
  assert.equal(
    resolveStormAction({
      action: "run",
      roughness: 0.2,
      stormResistance: 2,
      seamanship: 2,
    }).moraleChange,
    2,
  );
});
