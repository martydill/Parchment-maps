import assert from "node:assert/strict";
import test from "node:test";

import {
  createMaritimeHazardState,
  currentAtPosition,
  hazardAhead,
  markHazardEncounter,
  normalizeMaritimeHazardState,
  resolveShoalAction,
  resolveStormAction,
  resolveUnderwayHazard,
  roughSeaAtPosition,
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
      lastStormDay: 9.7,
      lastShoalDistance: 140.5,
      encounters: -3,
    }),
    {
      lastStormCycle: 2,
      lastStormDay: 9,
      lastShoalDistance: 140.5,
      encounters: 0,
    },
  );
  assert.deepEqual(
    normalizeMaritimeHazardState({}),
    createMaritimeHazardState(),
  );
});

test("rough sea exposure follows visible zones across the world seam", () => {
  const seas = [
    { x: 990, y: 100, rx: 80, ry: 40, strength: 1.2 },
    { x: 15, y: 100, rx: 20, ry: 20 },
  ];
  assert.deepEqual(roughSeaAtPosition({ x: 10, y: 100 }, seas, 1000), {
    index: 0,
    exposure: 0.75,
    strength: 1.2,
  });
  assert.equal(roughSeaAtPosition({ x: 400, y: 400 }, seas, 1000), null);
});

test("lookouts warn about the first hazard on the current heading", () => {
  const options = {
    position: { x: 0, y: 100 },
    heading: 0,
    distance: 200,
    shoals: [[160, 100, 30, 30, "Needle Bank"]],
    roughSeas: [{ x: 90, y: 100, rx: 40, ry: 40 }],
    worldWidth: 1000,
  };
  assert.deepEqual(hazardAhead(options), {
    type: "storm",
    name: "Squall waters",
    distance: 75,
  });
  assert.deepEqual(hazardAhead({ ...options, roughSeas: [] }), {
    type: "shoal",
    name: "Needle Bank",
    distance: 150,
  });
  assert.equal(hazardAhead({ ...options, heading: Math.PI }), null);
});

test("slowing or steering clear avoids underway damage", () => {
  assert.equal(
    resolveUnderwayHazard({ type: "shoal", exposure: 0.9, speed: 45 }),
    null,
  );
  assert.equal(
    resolveUnderwayHazard({ type: "shoal", exposure: 0.39, speed: 175 }),
    null,
  );
  assert.equal(
    resolveUnderwayHazard({ type: "storm", exposure: 0.9, speed: 95 }),
    null,
  );
  assert.equal(
    resolveUnderwayHazard({ type: "storm", exposure: 0.54, speed: 175 }),
    null,
  );
  assert.equal(
    resolveUnderwayHazard({ type: "unknown", exposure: 1, speed: 175 }),
    null,
  );
  const grounded = resolveUnderwayHazard({
    type: "shoal",
    exposure: 0.9,
    speed: 130,
  });
  assert.ok(grounded.componentDamage.hull > 0);
  assert.ok(grounded.componentDamage.rudder > 0);
  assert.ok(grounded.speedMultiplier < 1);
  const squall = resolveUnderwayHazard({
    type: "storm",
    exposure: 0.8,
    speed: 150,
    stormResistance: 1.4,
    seamanship: 0.5,
  });
  assert.ok(squall.componentDamage.rigging > 0);
  assert.ok(squall.speedMultiplier < 1);
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
  assert.equal(stormCycle(4, 400), 1);
  assert.equal(
    shouldTriggerStorm(createMaritimeHazardState(), {
      day: 1,
      voyageDistance: 0,
      roughness: 0.6,
    }),
    true,
  );
  assert.equal(
    shouldTriggerStorm(
      { lastStormCycle: 0, lastStormDay: -10 },
      {
        day: 1,
        voyageDistance: 0,
        roughness: 0.6,
      },
    ),
    false,
  );
  assert.equal(
    shouldTriggerStorm(
      { lastStormCycle: -1, lastStormDay: 1 },
      {
        day: 3,
        voyageDistance: 0,
        roughness: 0.6,
      },
    ),
    false,
  );
  assert.equal(
    shouldTriggerStorm(createMaritimeHazardState(), {
      day: 1,
      voyageDistance: 0,
      roughness: 0.5,
    }),
    false,
  );
});

test("hazard encounters update the matching persistent cooldown", () => {
  const storm = markHazardEncounter(createMaritimeHazardState(), {
    type: "storm",
    cycle: 3,
    voyageDistance: 400,
    day: 12,
  });
  assert.deepEqual(storm, {
    lastStormCycle: 3,
    lastStormDay: 12,
    lastShoalDistance: -1_000_000_000,
    encounters: 1,
  });
  assert.deepEqual(
    markHazardEncounter(storm, {
      type: "shoal",
      cycle: 4,
      voyageDistance: 700,
    }),
    {
      lastStormCycle: 3,
      lastStormDay: 12,
      lastShoalDistance: 700,
      encounters: 2,
    },
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
  assert.equal(heave.daysLost, 1);
  assert.ok(heave.componentDamage.hull >= 1);
  const shelter = resolveStormAction({
    action: "seek-lee",
    roughness: 0.8,
    stormResistance: 1,
  });
  assert.equal(shelter.moraleChange, 3);
  assert.equal(shelter.provisionsUsed, 2);
  assert.equal(shelter.daysLost, 2);
  const dangerousRun = resolveStormAction({
    action: "run",
    roughness: 1,
    stormResistance: 0.5,
  });
  assert.equal(dangerousRun.moraleChange, -5);
  assert.ok(dangerousRun.componentDamage.rigging > 1);
  assert.equal(dangerousRun.daysLost, 0);
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
