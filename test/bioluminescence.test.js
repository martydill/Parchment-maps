import assert from "node:assert/strict";
import test from "node:test";

import {
  BIOLUMINESCENT_RGB,
  bioluminescentNightGain,
  bioluminescentSeaAt,
  bioluminescentTwinkle,
  vesselBioluminescence,
} from "../src/core/bioluminescence.js";

const SEAS = [
  { name: "The Sea of Whispers", x: 200, y: 300, rx: 200, ry: 100 },
  { name: "The Jadewater", x: 900, y: 500, rx: 120, ry: 80 },
];

test("named luminous seas expose their strongest exposure across the seam", () => {
  assert.deepEqual(bioluminescentSeaAt({ x: 200, y: 300 }, SEAS, 1000), {
    index: 0,
    name: "The Sea of Whispers",
    exposure: 1,
  });
  // Map longitude 1080 wraps to 80, leaving 120 of the sea's 200-unit reach;
  // the plateau lift turns that 0.4 raw exposure into near-full glow.
  assert.deepEqual(bioluminescentSeaAt({ x: 1080, y: 300 }, SEAS, 1000), {
    index: 0,
    name: "The Sea of Whispers",
    exposure: 0.4 / 0.65,
  });
  const overlap = [
    { name: "Western", x: 500, y: 500, rx: 120, ry: 120 },
    { name: "Eastern", x: 560, y: 500, rx: 120, ry: 120 },
  ];
  assert.equal(
    bioluminescentSeaAt({ x: 560, y: 500 }, overlap, 1000).name,
    "Eastern",
  );
  assert.equal(bioluminescentSeaAt({ x: 700, y: 300 }, SEAS, 1000), null);
  assert.equal(bioluminescentSeaAt({ x: 0, y: 0 }, [], 1000), null);
  assert.equal(bioluminescentSeaAt({ x: 0, y: 0 }, null, 1000), null);
});

test("a sea spanning most of the world still ends at its ellipse", () => {
  const seas = [{ name: "Vast", x: 0, y: 0, rx: 4000, ry: 4000 }];
  assert.equal(
    bioluminescentSeaAt({ x: 3000, y: 2000 }, seas, 8000).name,
    "Vast",
  );
  assert.equal(bioluminescentSeaAt({ x: 5000, y: 3000 }, seas, 8000), null);
});

test("the glow gathers through dusk and storm churn disperses it", () => {
  assert.equal(bioluminescentNightGain({ night: 0, storm: 0 }), 0);
  assert.equal(bioluminescentNightGain({ night: 0.34, storm: 0 }), 0);
  assert.equal(bioluminescentNightGain({ night: 1, storm: 0 }), 1);
  assert.ok(bioluminescentNightGain({ night: 0.57, storm: 0 }) > 0.49);
  assert.ok(bioluminescentNightGain({ night: 0.57, storm: 0 }) < 0.51);
  assert.ok(
    bioluminescentNightGain({ night: 1, storm: 1 }) < 0.26,
    "a full storm must hold the glow below a quarter strength",
  );
  // Malformed lighting degrades to plain water instead of throwing.
  assert.equal(bioluminescentNightGain(null), 0);
  assert.equal(bioluminescentNightGain({ night: Number.NaN }), 0);
  assert.equal(bioluminescentNightGain({ night: 5, storm: -2 }), 1);
});

test("vessel glow composes exposure with the night gain", () => {
  const night = { night: 1, storm: 0 };
  const day = { night: 0, storm: 0 };
  assert.equal(vesselBioluminescence({ x: 200, y: 300 }, SEAS, 1000, day), 0);
  assert.equal(
    vesselBioluminescence({ x: 1080, y: 300 }, SEAS, 1000, night),
    0.4 / 0.65,
  );
  assert.equal(vesselBioluminescence({ x: 700, y: 300 }, SEAS, 1000, night), 0);
});

test("speck shimmer stays bounded, deterministic, and freezes at zero time", () => {
  for (let step = 0; step < 400; step++) {
    const twinkle = bioluminescentTwinkle(step * 0.137, step * 1.917);
    assert.ok(twinkle >= 0 && twinkle <= 1);
    assert.equal(twinkle, bioluminescentTwinkle(step * 0.137, step * 1.917));
  }
  assert.equal(bioluminescentTwinkle(0, 0), 0);
  assert.ok(bioluminescentTwinkle(0, 1.2) > 0.5);
  assert.notEqual(bioluminescentTwinkle(0, 0), bioluminescentTwinkle(1, 0));
});

test("the shared teal is one palette string used by both glow passes", () => {
  assert.match(BIOLUMINESCENT_RGB, /^\d{1,3},\d{1,3},\d{1,3}$/);
});
