import assert from "node:assert/strict";
import test from "node:test";

import {
  createRoughSeaParticles,
  isLandPoint,
  shipDrawProfile,
  wrappedCircleIntersectsViewport,
} from "../src/rendering.js";
import { SHIP_CLASSES } from "../src/core/upgrades.js";

const seas = [
  { x: 100, y: 200, rx: 80, ry: 40, strength: 1, angle: 0.3 },
  { x: 500, y: 600, rx: 120, ry: 90, strength: 0.5, angle: -0.2 },
];

test("rough sea particles are deterministic and grouped by sea", () => {
  const particles = createRoughSeaParticles(seas, () => false);

  assert.deepEqual(
    createRoughSeaParticles(seas, () => false),
    particles,
  );
  assert.equal(particles.length, seas.length);
  assert.equal(particles[0].length, 22);
  assert.equal(particles[1].length, 11);
  assert.ok(
    particles
      .flat()
      .every((particle) =>
        [
          particle.baseX,
          particle.baseY,
          particle.phaseOffset,
          particle.rotation,
          particle.scale,
          particle.speed,
          particle.swell,
        ].every(Number.isFinite),
      ),
  );
});

test("rough sea particles omit samples placed on land", () => {
  assert.deepEqual(
    createRoughSeaParticles(seas, () => true),
    [[], []],
  );
});

test("map land checks include horizontally wrapped coordinates", () => {
  const landShapes = [
    {
      poly: [
        [10, 10],
        [30, 10],
        [30, 30],
        [10, 30],
      ],
    },
  ];

  assert.equal(isLandPoint(20, 20, 100, landShapes), true);
  assert.equal(isLandPoint(120, 20, 100, landShapes), true);
  assert.equal(isLandPoint(-80, 20, 100, landShapes), true);
  assert.equal(isLandPoint(50, 20, 100, landShapes), false);
});

test("map land checks include land polygons crossing the world seam", () => {
  const landShapes = [
    {
      poly: [
        [88, 10],
        [112, 10],
        [112, 30],
        [88, 30],
      ],
    },
    {
      poly: [
        [-14, 50],
        [18, 50],
        [18, 70],
        [-14, 70],
      ],
    },
  ];

  assert.equal(isLandPoint(6, 20, 100, landShapes), true);
  assert.equal(isLandPoint(94, 60, 100, landShapes), true);
  assert.equal(isLandPoint(50, 60, 100, landShapes), false);
});

test("wrapped viewport checks cull off-screen objects while respecting seams", () => {
  assert.equal(
    wrappedCircleIntersectsViewport(980, 50, 15, -10, 50, 200, 120, 1, 1000),
    true,
  );
  assert.equal(
    wrappedCircleIntersectsViewport(260, 50, 15, 0, 50, 200, 120, 1, 1000),
    false,
  );
  assert.equal(
    wrappedCircleIntersectsViewport(95, 118, 20, 100, 50, 200, 120, 1, 1000),
    true,
  );
  assert.equal(
    wrappedCircleIntersectsViewport(95, 145, 20, 100, 50, 200, 120, 1, 1000),
    false,
  );
});

test("every ship class maps to a visually distinct drawing profile", () => {
  const classIds = Object.keys(SHIP_CLASSES);
  const profiles = classIds.map((id) => shipDrawProfile(id));

  assert.equal(
    new Set(profiles.map((profile) => JSON.stringify(profile))).size,
    classIds.length,
  );
  for (const profile of profiles) {
    assert.ok(profile.rig);
    assert.ok(Array.isArray(profile.masts) && profile.masts.length > 0);
    assert.ok(profile.bow < profile.deckY && profile.deckY < profile.stern);
  }
});

test("unknown vessel classes fall back to a stable drawing profile", () => {
  assert.equal(shipDrawProfile("cutter"), shipDrawProfile("cutter", 12));
  assert.deepEqual(
    shipDrawProfile("sea-monster", 3),
    shipDrawProfile("sea-monster", 9),
  );
});
