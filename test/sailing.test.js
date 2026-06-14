import assert from "node:assert/strict";
import test from "node:test";

import {
  edgeInwardVector,
  limitOutwardWind,
  nearestOpenHeading,
  readSailingInput,
  recoverFromShallows,
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

test("nearestOpenHeading keeps a heading whose lookahead is already open", () => {
  // Everything east of x = 0 is water.
  const isOpen = (x) => x > 0;
  assert.equal(nearestOpenHeading({ x: 50, y: 0, preferAngle: 0, isOpen }), 0);
});

test("nearestOpenHeading steers off a straight coast toward open water", () => {
  // Land is the western half-plane (x < 50); a ship pinned at the coastline
  // pointing into land must recover toward open water to the east.
  const isOpen = (x) => x >= 50;
  const angle = nearestOpenHeading({
    x: 50,
    y: 0,
    preferAngle: 0, // seaward normal points east, off the coast
    isOpen,
  });
  assert.ok(Math.cos(angle) > 0, "recovery heading faces open water");
});

test("nearestOpenHeading shortens the lookahead when wedged against land", () => {
  // Open water only within a 10px pocket to the east; blocked at the default
  // 40px lookahead. The helper must fall back to a shorter lookahead to find it.
  const probed = [];
  const isOpen = (x, y) => {
    const r = Math.hypot(x - 50, y);
    probed.push(r);
    return r <= 10;
  };
  const angle = nearestOpenHeading({
    x: 50,
    y: 0,
    preferAngle: 0,
    isOpen,
  });
  assert.ok(Math.cos(angle) > 0);
  assert.ok(Math.min(...probed) <= 10, "tried a shorter lookahead");
});

test("recoverFromShallows points the bow off a straight coast and clears the hull", () => {
  // Land is the western half-plane (x < 50); the hull sits on the coastline
  // after a westward step was blocked.
  const isOpen = (x) => x >= 50;
  const recovered = recoverFromShallows({
    x: 50,
    y: 100,
    blockedX: 49.9,
    blockedY: 100,
    isOpen,
  });
  assert.ok(Math.cos(recovered.heading) > 0, "heading faces open water");
  assert.ok(
    isOpen(recovered.x + Math.cos(recovered.heading) * 24),
    "hull has standoff clearance ahead",
  );
});

test("recoverFromShallows marches along a channel when open water is to the side", () => {
  // Open water is an 8px vertical channel (50 <= x <= 58); everything east of
  // x = 58 is also land. The hull is pinned against the west wall pointing in.
  const isOpen = (x) => x >= 50 && x <= 58;
  const recovered = recoverFromShallows({
    x: 50,
    y: 100,
    blockedX: 49.9,
    blockedY: 100,
    isOpen,
    standoff: 24,
    step: 8,
  });
  // East is blocked by the far wall, so recovery must run along the channel.
  assert.ok(
    Math.abs(Math.cos(recovered.heading)) < 0.31,
    "heading runs along the channel, not into a wall",
  );
  assert.ok(
    isOpen(recovered.x) &&
      isOpen(recovered.x + Math.cos(recovered.heading) * 24),
    "hull and its standoff point stay in the channel",
  );
});

test("a wind-pinned ship escapes once it sails toward open water", () => {
  // Land = western half-plane (x < 50); wind blows west into the coast at a
  // realistic strength. The ship starts on the coastline pointing into land.
  const isOpen = (x) => x >= 50;
  const onLand = (x) => !isOpen(x);
  const ship = { x: 50, y: 100, angle: Math.PI, speed: 0 };
  const windX = -6;
  const turnRate = 2.7;
  const accel = 120;
  const maxSpeed = 175;
  const norm = (a) => ((a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  let blocked = false;
  for (let i = 0; i < 1200 && ship.x < 300; i++) {
    const dt = 1 / 60;
    // Player holds a course toward open water (east).
    const desired = 0;
    const dTurn =
      turnRate * dt * (1.2 - Math.min(0.45, (ship.speed / maxSpeed) * 0.45));
    ship.angle += Math.max(-dTurn, Math.min(dTurn, norm(desired - ship.angle)));
    const align = Math.max(0, Math.cos(norm(desired - ship.angle)));
    const thrust = align < 0.15 ? 0 : 0.12 + 0.88 * align * align;
    ship.speed += accel * thrust * dt;
    ship.speed *= Math.pow(0.992, 60 * dt);
    ship.speed = Math.max(0, Math.min(maxSpeed, ship.speed));
    const nx = ship.x + (Math.cos(ship.angle) * ship.speed + windX) * dt;
    if (onLand(nx)) {
      blocked = true;
      const recovered = recoverFromShallows({
        x: ship.x,
        y: ship.y,
        blockedX: nx,
        blockedY: ship.y,
        isOpen,
      });
      const rTurn = turnRate * 4 * dt;
      ship.angle += Math.max(
        -rTurn,
        Math.min(rTurn, norm(recovered.heading - ship.angle)),
      );
      ship.speed = Math.min(14, ship.speed * 0.18);
      ship.x = recovered.x;
    } else {
      ship.x = nx;
    }
  }
  assert.ok(blocked, "the ship actually struck the shallows");
  assert.ok(ship.x > 200, `escaped to open water (x=${ship.x.toFixed(1)})`);
});
