import assert from "node:assert/strict";
import test from "node:test";

import {
  edgeInwardVector,
  limitOutwardWind,
  readSailingInput,
} from "../src/core/sailing.js";

test("readSailingInput preserves an idle heading and reads joystick input", () => {
  assert.deepEqual(
    readSailingInput(new Set(), { x: 0, y: 0, power: 0.1 }, 1.25),
    {
      active: false,
      desiredAngle: 1.25,
      power: 0,
      keyboardActive: false,
    },
  );
  assert.deepEqual(readSailingInput(new Set(), { x: 0, y: 1, power: 2 }, 0), {
    active: true,
    desiredAngle: Math.PI / 2,
    power: 1,
    keyboardActive: false,
  });
});

test("readSailingInput normalizes keyboard directions and overrides joystick input", () => {
  const result = readSailingInput(
    new Set(["arrowleft", "arrowup"]),
    { x: 1, y: 0, power: 0.5 },
    0,
  );

  assert.equal(result.active, true);
  assert.equal(result.keyboardActive, true);
  assert.equal(result.power, 1);
  assert.equal(result.desiredAngle, (-Math.PI * 3) / 4);

  const opposite = readSailingInput(
    new Set(["d", "s"]),
    { x: -1, y: 0, power: 0.5 },
    0,
  );
  assert.equal(opposite.desiredAngle, Math.PI / 4);
});

test("edgeInwardVector points into the map near either vertical edge", () => {
  assert.deepEqual(edgeInwardVector(500, 1000, 100), {
    x: 0,
    y: 0,
    strength: 0,
  });
  assert.deepEqual(edgeInwardVector(50, 1000, 100), {
    x: 0,
    y: 1,
    strength: 0.5,
  });
  assert.deepEqual(edgeInwardVector(950, 1000, 100), {
    x: 0,
    y: -1,
    strength: 0.5,
  });
  assert.deepEqual(edgeInwardVector(-50, 1000, 100), {
    x: 0,
    y: 1,
    strength: 1,
  });
});

test("limitOutwardWind attenuates only wind directed beyond nearby edges", () => {
  assert.deepEqual(limitOutwardWind(3, -4, 75, 1000, 50, 100), {
    x: 3,
    y: -2,
  });
  assert.deepEqual(limitOutwardWind(3, 4, 925, 1000, 50, 100), {
    x: 3,
    y: 2,
  });
  assert.deepEqual(limitOutwardWind(3, 0, 500, 1000, 50, 100), {
    x: 3,
    y: 0,
  });
});
