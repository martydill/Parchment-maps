import assert from "node:assert/strict";
import test from "node:test";

import {
  directionalVisibilityRadius,
  localWeatherAtBearing,
  sampleWeatherFront,
  weatherAppearance,
} from "../src/core/weather.js";

const baseWeather = { name: "Sea mist", visibilityKm: 6, roughness: 0.2 };
const position = { x: 1234, y: 567 };

test("local weather varies by bearing around the ship", () => {
  const ahead = localWeatherAtBearing({
    baseWeather,
    position,
    angle: 0,
    day: 3,
    voyageDistance: 900,
    horizonKm: 20,
  });
  const astern = localWeatherAtBearing({
    baseWeather,
    position,
    angle: Math.PI,
    day: 3,
    voyageDistance: 900,
    horizonKm: 20,
  });

  assert.notEqual(ahead.visibilityKm, astern.visibilityKm);
  assert.notEqual(ahead.roughness, astern.roughness);
});

test("directional visibility respects weather and horizon bounds", () => {
  const radius = directionalVisibilityRadius({
    baseWeather,
    position,
    angle: 1.2,
    day: 4,
    voyageDistance: 1200,
    horizonKm: 5,
    worldUnitsPerKm: 20,
  });

  assert.ok(radius > 0);
  assert.ok(radius <= 100);
});

test("local weather defaults and clamps malformed inputs", () => {
  const poor = localWeatherAtBearing({
    baseWeather: { visibilityKm: -2, roughness: 2 },
    position: null,
    angle: -2,
    horizonKm: 99,
  });
  const fallback = localWeatherAtBearing({
    angle: 2,
    horizonKm: 8,
  });

  assert.equal(fallback.name, "Fair");
  assert.ok(poor.visibilityKm >= 0);
  assert.ok(poor.visibilityKm <= 99);
  assert.ok(poor.roughness >= 0);
  assert.ok(poor.roughness <= 1);
  assert.ok(fallback.visibilityKm <= 8);
});

const patterns = [
  { name: "Clear", roughness: 0.08, visibilityKm: 24 },
  { name: "Rain squalls", roughness: 0.5, visibilityKm: 6 },
  { name: "Clear", roughness: 0.08, visibilityKm: 24 },
];

test("weather appearance combines named and physical conditions", () => {
  assert.deepEqual(weatherAppearance(), {
    storm: 0,
    fog: 0,
    cloud: 0,
    rain: 0,
    lightning: 0,
  });
  assert.equal(weatherAppearance({ name: "Sea mist" }).fog, 0.62);
  assert.equal(weatherAppearance({ name: "Mist and fog" }).fog, 0.82);
  assert.equal(weatherAppearance({ name: "High haze" }).fog, 0.26);
  assert.equal(weatherAppearance({ name: "Low cloud" }).cloud, 0.5);
  assert.equal(weatherAppearance({ name: "Rain", roughness: 0.1 }).rain, 0.4);
  assert.equal(weatherAppearance({ visibilityKm: -5 }).fog, 1);
  assert.deepEqual(
    weatherAppearance({ name: null, roughness: Infinity, visibilityKm: NaN }),
    weatherAppearance(),
  );
  const storm = weatherAppearance({ roughness: 2 });
  assert.equal(storm.storm, 1);
  assert.equal(storm.rain, 1);
  assert.equal(storm.lightning, 1);
});

test("storm approach leads with cloud, then rain, then lightning", () => {
  const approach = sampleWeatherFront(patterns, 0.35);
  const wet = sampleWeatherFront(patterns, 0.65);
  const peak = sampleWeatherFront(patterns, 1);
  assert.equal(approach.phase, "approaching");
  assert.ok(approach.cloud > 0.4);
  assert.equal(approach.rain, 0);
  assert.equal(approach.lightning, 0);
  assert.ok(wet.rain > 0);
  assert.equal(wet.lightning, 0);
  assert.equal(peak.phase, "storm");
  assert.equal(peak.storm, 1);
  assert.equal(peak.rain, 1);
  assert.equal(peak.lightning, 1);
  assert.ok(peak.seaDarkness > approach.seaDarkness);
});

test("clearing rain leaves cloud and sunlight; fog retains its own structure", () => {
  const clearing = sampleWeatherFront(patterns, 1.65);
  assert.equal(clearing.phase, "clearing");
  assert.equal(clearing.rain, 0);
  assert.equal(clearing.lightning, 0);
  assert.ok(clearing.cloud > 0.4);
  assert.ok(clearing.sunbreak > 0.5);
  const fog = sampleWeatherFront([
    { name: "Morning fog", roughness: 0.1, visibilityKm: 4 },
  ]);
  assert.equal(fog.phase, "fog");
  assert.equal(fog.sunbreak, 0);
  assert.equal(sampleWeatherFront(patterns, 2.5).phase, "fair");
});

test("front channels remain continuous across pattern boundaries and world cycles", () => {
  const channels = [
    "storm",
    "cloud",
    "rain",
    "lightning",
    "fog",
    "sunbreak",
    "seaDarkness",
  ];
  for (let boundary = 0; boundary <= 3; boundary++) {
    const before = sampleWeatherFront(patterns, boundary - 1e-7);
    const after = sampleWeatherFront(patterns, boundary + 1e-7);
    for (const channel of channels)
      assert.ok(Math.abs(before[channel] - after[channel]) < 1e-5, channel);
  }
  assert.deepEqual(
    sampleWeatherFront(patterns, -0.35),
    sampleWeatherFront(patterns, 2.65),
  );
  assert.deepEqual(
    sampleWeatherFront(patterns, NaN),
    sampleWeatherFront(patterns),
  );
  for (const malformed of [undefined, null, {}, []])
    assert.equal(sampleWeatherFront(malformed).phase, "fair");
  assert.equal(sampleWeatherFront([null, undefined], 0.5).phase, "fair");
});

test("bearing-dependent weather retains the shared visual front", () => {
  const front = sampleWeatherFront(patterns, 0.4);
  const local = localWeatherAtBearing({
    baseWeather: { ...baseWeather, front },
    position,
    angle: 0,
  });
  assert.equal(local.front, front);
});
