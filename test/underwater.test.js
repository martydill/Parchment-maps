import test from "node:test";
import assert from "node:assert/strict";
import {
  planUnderwaterSites,
  sampleUnderwaterVeil,
  underwaterNoise,
} from "../src/core/underwater.js";
import { pointInWrappedPolygon } from "../src/core/geometry.js";

const world = { w: 1800, h: 1200 };
const poly = [
  [300, 300],
  [1000, 300],
  [1000, 800],
  [300, 800],
];
const lands = [{ poly }];
const site = { x: 1780, y: 500, seed: 17, depth: 0.5 };

test("seabed placement is stable, varied, bounded, and outside land", () => {
  const sites = planUnderwaterSites(world, lands);
  assert.ok(sites.length > 7);
  assert.deepEqual(sites, planUnderwaterSites(world, lands));
  assert.deepEqual(
    new Set(sites.map(({ kind }) => kind)),
    new Set(["reef", "kelp", "wreck", "ruins"]),
  );
  for (const s of sites) {
    assert.ok(s.x >= 0 && s.x < world.w);
    assert.ok(s.y >= s.radius && s.y <= world.h - s.radius);
    assert.equal(pointInWrappedPolygon(s.x, s.y, poly, world.w), false);
    assert.ok(s.radius >= 43 && s.radius <= 69);
  }
  assert.deepEqual(
    planUnderwaterSites(world, [{ poly: [...poly].reverse() }]).map(
      ({ x, y }) => pointInWrappedPolygon(x, y, poly, world.w),
    ),
    Array(sites.length).fill(false),
  );
});

test("shoals carry scenery without islands and reject land, overlap, and polar edges", () => {
  const shoals = [
    [1700, 600, 170, 100],
    [400, 1100, 80, 45],
    [500, 500, 200, 100],
    [500, 0, 100, 100],
    [500, 1200, 100, 100],
  ];
  const sites = planUnderwaterSites(world, lands, shoals);
  const shoalSites = sites.filter(({ seed }) => seed >= 10000);
  assert.ok(shoalSites.length >= 3);
  assert.ok(shoalSites.some(({ radius }) => radius === 30));
  assert.ok(
    shoalSites.every(({ x, y }) => !pointInWrappedPolygon(x, y, poly, world.w)),
  );
  assert.deepEqual(planUnderwaterSites({ w: 0, h: 1 }, lands), []);
  assert.deepEqual(planUnderwaterSites({ w: 1, h: 0 }, lands), []);
  assert.deepEqual(planUnderwaterSites(world, []), []);
  assert.deepEqual(
    planUnderwaterSites(world, [
      {
        poly: [
          [100, 100],
          [100, 100],
        ],
      },
    ]),
    [],
  );
});

test("underwater sites wrap, handle either winding, and skip degenerate edges", () => {
  const island = [
    [-100, 300],
    [150, 300],
    [150, 700],
    [-100, 700],
    [-100, 700],
  ];
  for (const p of [island, [...island].reverse()]) {
    const sites = planUnderwaterSites(world, [{ poly: p }]);
    assert.ok(sites.some(({ x }) => x > 1600));
    assert.ok(
      sites.every(
        ({ x, y }) =>
          x >= 0 && x < world.w && !pointInWrappedPolygon(x, y, p, world.w),
      ),
    );
  }
  assert.equal(underwaterNoise(1, 2), underwaterNoise(1, 2));
  assert.ok(underwaterNoise(1) >= 0 && underwaterNoise(1) < 1);
});

test("moving water reveals fragments rather than fading the whole silhouette", () => {
  const sample = (y, time) => sampleUnderwaterVeil(site, y, time, world.w);
  const fragments = Array.from({ length: 25 }, (_, i) =>
    sample(i * 4 - 48, 1000),
  );
  assert.ok(
    Math.max(...fragments.map(({ alpha }) => alpha)) >
      Math.min(...fragments.map(({ alpha }) => alpha)) * 4,
  );
  assert.notDeepEqual(sample(0, 0), sample(0, 6000));
  assert.ok(
    fragments.every(
      ({ alpha, shift }) => alpha >= 0 && alpha <= 0.285 && Math.abs(shift) < 3,
    ),
  );
  const near = sampleUnderwaterVeil({ ...site, depth: 0.1 }, 0, 1000, world.w);
  const deep = sampleUnderwaterVeil({ ...site, depth: 0.9 }, 0, 1000, world.w);
  assert.ok(near.alpha > deep.alpha);
});

test("refraction agrees at the meridian and reduced motion freezes every fragment", () => {
  const sample = (s, time, options) =>
    sampleUnderwaterVeil(s, 14, time, world.w, options);
  assert.deepEqual(
    sample(site, 4300),
    sample({ ...site, x: site.x - world.w }, 4300),
  );
  assert.deepEqual(
    sample(site, 0),
    sample({ ...site, x: site.x + world.w }, 0),
  );
  assert.deepEqual(
    sample(site, 1000, { reducedMotion: true }),
    sample(site, 99000, { reducedMotion: true }),
  );
});

test("depth disappears into storms and darkness while moonlight gives a faint glimpse", () => {
  const alpha = (options) =>
    sampleUnderwaterVeil(site, 0, 1000, world.w, options).alpha;
  const clear = alpha({});
  assert.equal(alpha({ lighting: { daylight: 0 } }), 0);
  const moon = alpha({ lighting: { daylight: 0, night: 1, moon: 1 } });
  assert.ok(moon > 0 && moon < clear * 0.25);
  assert.ok(alpha({ lighting: { daylight: 0, night: 1 } }) < moon);
  assert.ok(alpha({ roughness: 1, lighting: { storm: 1 } }) < clear * 0.1);
  assert.equal(alpha({ roughness: -3, lighting: { storm: -2 } }), clear);
  assert.equal(
    alpha({ roughness: 3, lighting: { storm: 2 } }),
    alpha({ roughness: 1, lighting: { storm: 1 } }),
  );
});
