import assert from "node:assert/strict";
import test from "node:test";

import {
  edgeInwardVector,
  hullSpeedKnots,
  limitOutwardWind,
  nearestOpenHeading,
  readSailingInput,
  recoverFromShallows,
  shipSpeedKnots,
} from "../src/core/sailing.js";

test("hull speed follows waterline length and scales world speed to knots", () => {
  const cutterHullSpeed = 1.34 * Math.sqrt(45);
  assert.equal(hullSpeedKnots(45), cutterHullSpeed);
  assert.equal(hullSpeedKnots(-10), 0);
  assert.equal(shipSpeedKnots(175, 45), cutterHullSpeed);
  assert.equal(shipSpeedKnots(-87.5, 45), cutterHullSpeed / 2);
});

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

test("nearestOpenHeading preserves course when every probe is blocked", () => {
  const preferAngle = 1.25;

  assert.equal(
    nearestOpenHeading({
      x: 50,
      y: 50,
      preferAngle,
      isOpen: () => false,
    }),
    preferAngle,
  );
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

test("recoverFromShallows never strands the hull on land across random coasts", () => {
  // Deterministic PRNG so the regression stays stable run to run. Land is a few
  // overlapping disks (islands); wherever they nearly touch they carve the same
  // concave pinch points that ruggedCoast produces, which is what used to park a
  // nosed-in hull onshore for good.
  let seed = 0x9e3779b9;
  const rnd = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed / 4294967296;
  };
  const standoff = 24;
  for (let iter = 0; iter < 4000; iter++) {
    const islands = [];
    const count = 2 + Math.floor(rnd() * 3);
    for (let i = 0; i < count; i++)
      islands.push({
        x: 200 + rnd() * 600,
        y: 200 + rnd() * 600,
        r: 40 + rnd() * 120,
      });
    const isOpen = (x, y) =>
      islands.every((d) => Math.hypot(x - d.x, y - d.y) > d.r);

    const x = 100 + rnd() * 800;
    const y = 100 + rnd() * 800;
    if (!isOpen(x, y)) continue;

    // Walk from open water toward the nearest island until the step is blocked,
    // then back off one step so the hull starts on its last open cell.
    let nearest = null;
    for (const d of islands) {
      const dist = Math.hypot(x - d.x, y - d.y) - d.r;
      if (!nearest || dist < nearest.dist) nearest = { d, dist };
    }
    const ang = Math.atan2(nearest.d.y - y, nearest.d.x - x);
    let bx = x;
    let by = y;
    for (let i = 0; i < 400 && isOpen(bx, by); i++) {
      bx += Math.cos(ang) * 2;
      by += Math.sin(ang) * 2;
    }
    if (isOpen(bx, by)) continue;
    const sx = bx - Math.cos(ang) * 2;
    const sy = by - Math.sin(ang) * 2;
    if (!isOpen(sx, sy)) continue;

    const recovered = recoverFromShallows({
      x: sx,
      y: sy,
      blockedX: bx,
      blockedY: by,
      isOpen,
    });
    assert.ok(
      isOpen(recovered.x, recovered.y),
      `hull parked on land at iter ${iter}: ${JSON.stringify(recovered)}`,
    );
    assert.ok(
      isOpen(
        recovered.x + Math.cos(recovered.heading) * standoff,
        recovered.y + Math.sin(recovered.heading) * standoff,
      ),
      `no clear water ahead at iter ${iter}: ${JSON.stringify(recovered)}`,
    );
  }
});

test("recoverFromShallows escapes a specific three-island pinch that once trapped the hull", () => {
  // Captured from the pre-fix fuzzer: three islands whose coastlines nearly
  // meet. The old march ground past the open water and left the hull on land.
  const islands = [
    { x: 204.15840912610292, y: 265.60342903248966, r: 132.32593236491084 },
    { x: 567.5918050576001, y: 618.1315828114748, r: 89.68882548622787 },
    { x: 350.98668495193124, y: 436.4699380937964, r: 54.1424522921443 },
  ];
  const isOpen = (x, y) =>
    islands.every((d) => Math.hypot(x - d.x, y - d.y) > d.r);
  const recovered = recoverFromShallows({
    x: 279.31768131548205,
    y: 376.3177406987129,
    blockedX: 278.1943540544637,
    blockedY: 374.66300934146693,
    isOpen,
  });
  assert.ok(isOpen(recovered.x, recovered.y), "hull left on open water");
  assert.ok(
    isOpen(
      recovered.x + Math.cos(recovered.heading) * 24,
      recovered.y + Math.sin(recovered.heading) * 24,
    ),
    "clear water ahead to sail into",
  );
});

test("recoverFromShallows holds the open cell and points seaward when fully boxed in", () => {
  // Every probe blocked — a fully enclosed position the coastline data never
  // produces, but recovery must still never move the hull onto land.
  const recovered = recoverFromShallows({
    x: 100,
    y: 100,
    blockedX: 101,
    blockedY: 100,
    isOpen: () => false,
  });
  assert.deepEqual(recovered, { x: 100, y: 100, heading: Math.PI });
});
