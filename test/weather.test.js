import assert from "node:assert/strict";
import test from "node:test";

import {
  directionalVisibilityRadius,
  localWeatherAtBearing,
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
