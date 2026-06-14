import assert from "node:assert/strict";
import test from "node:test";

import { createRoughSeaParticles } from "../src/rendering.js";

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
