import assert from "node:assert/strict";
import test from "node:test";
import { sceneLighting } from "../src/core/lighting.js";
import {
  PORT_ARRIVAL_DURATION,
  portArrivalFrame,
  portLayerOffset,
  portPlateLighting,
  portScenePalette,
} from "../src/core/port-scene.js";

test("painted harbors inherit daylight, sunset, night, and storms", () => {
  const noon = portScenePalette();
  const dusk = portScenePalette(sceneLighting(0.75));
  const night = portScenePalette(sceneLighting(0));
  const storm = portScenePalette(sceneLighting(0.5, 0.8));
  assert.notDeepEqual(noon, dusk);
  assert.notDeepEqual(noon, night);
  assert.notDeepEqual(noon, storm);
  for (const palette of [noon, dusk, night, storm])
    for (const color of Object.values(palette))
      assert.match(color, /^#[0-9a-f]{6}$/);
  assert.equal(noon.sky, "#d6decb");
  assert.equal(night.sky, "#152536");
});

test("lighting cache buckets are stable, bounded, and change across the cycle", () => {
  assert.deepEqual(portPlateLighting(), portPlateLighting(sceneLighting(0.5)));
  assert.deepEqual(
    portPlateLighting(sceneLighting(0.5001)),
    portPlateLighting(sceneLighting(0.5)),
  );
  assert.notDeepEqual(
    portPlateLighting(sceneLighting(0.5)),
    portPlateLighting(sceneLighting(0)),
  );
  assert.deepEqual(
    portPlateLighting({ strength: 2, dusk: -1, storm: NaN, night: Infinity }),
    {
      strength: 1,
      dusk: 0,
      storm: 0,
      night: 0,
    },
  );
});

test("parallax separates depths, clamps input, and respects reduced motion", () => {
  assert.deepEqual(portLayerOffset(), { x: 0, y: 0 });
  assert.deepEqual(portLayerOffset({ x: 2, y: -2 }, 0.5), { x: 6, y: -3.5 });
  assert.deepEqual(portLayerOffset({ x: NaN, y: Infinity }), { x: 0, y: 0 });
  assert.deepEqual(portLayerOffset({ x: 1, y: 1 }, -1), { x: 0, y: 0 });
  assert.deepEqual(portLayerOffset({ x: 1, y: 1 }, 2, true), { x: 0, y: 0 });
  assert.ok(
    portLayerOffset({ x: 1 }, 1.7).x > portLayerOffset({ x: 1 }, 0.3).x,
  );
});

test("arrival sails to a stable berth before revealing the dock", () => {
  const start = portArrivalFrame();
  const middle = portArrivalFrame(PORT_ARRIVAL_DURATION * 0.4);
  const berthed = portArrivalFrame(PORT_ARRIVAL_DURATION * 0.8);
  const end = portArrivalFrame(PORT_ARRIVAL_DURATION);
  assert.equal(start.complete, false);
  assert.equal(start.opacity, 0);
  assert.equal(middle.reveal, 0);
  assert.ok(start.ship.x < middle.ship.x && middle.ship.x < end.ship.x);
  assert.ok(start.ship.speed > middle.ship.speed);
  assert.deepEqual(berthed.ship, end.ship);
  assert.equal(end.ship.speed, 0);
  assert.equal(end.reveal, 1);
  assert.equal(end.complete, true);
  assert.deepEqual(portArrivalFrame(-20), start);
  assert.deepEqual(portArrivalFrame(NaN), start);
  assert.deepEqual(portArrivalFrame(PORT_ARRIVAL_DURATION * 2), end);
  assert.deepEqual(portArrivalFrame(0, true), end);
});
