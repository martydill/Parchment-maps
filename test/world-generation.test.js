import assert from "node:assert/strict";
import test from "node:test";

import { createMapTransform } from "../src/core/map-generation.js";
import { pointInPolygon, pointInWrappedPolygon } from "../src/core/geometry.js";
import {
  generateWorldMap,
  landPolygonsTooClose,
} from "../src/core/world-generation.js";
import {
  lands,
  HOME_PORT,
  explorationSites,
  discoverySites,
  ports,
} from "../src/world-data.js";

const square = (x, y, size = 20) => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
];
const identity = {
  width: 600,
  height: 400,
  sourceWidth: 600,
  regionPoint: (x, y) => ({ x, y }),
  regionOffset: (x, y, _key, center) => ({ x: x - center.x, y: y - center.y }),
  point: (x, y) => ({ x, y }),
};

function assertSeparated(world, width, gap) {
  for (let a = 0; a < world.lands.length; a++) {
    for (let b = a + 1; b < world.lands.length; b++) {
      assert.equal(
        landPolygonsTooClose(
          world.lands[a].poly,
          world.lands[b].poly,
          width,
          gap,
        ),
        false,
        `${world.lands[a].name || a} and ${world.lands[b].name || b} must have a sea passage`,
      );
    }
  }
}

function assertSimple(poly) {
  const cross = (a, b, c) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (let i = 0; i < poly.length; i++) {
    for (let j = i + 2; j < poly.length; j++) {
      if (i === 0 && j === poly.length - 1) continue;
      const a = poly[i],
        b = poly[(i + 1) % poly.length],
        c = poly[j],
        d = poly[(j + 1) % poly.length];
      assert.ok(
        !(
          cross(a, b, c) * cross(a, b, d) < 0 &&
          cross(c, d, a) * cross(c, d, b) < 0
        ),
        "Coastlines must not fold across themselves",
      );
    }
  }
}

test("land clearance detects crossings, containment, touching, and narrow straits", () => {
  const coast = square(50, 50, 100);
  assert.equal(landPolygonsTooClose(coast, square(80, 80), 600), true);
  assert.equal(landPolygonsTooClose(coast, square(140, 70, 40), 600), true);
  assert.equal(landPolygonsTooClose(coast, square(150, 70), 600), true);
  assert.equal(landPolygonsTooClose(coast, square(170, 70), 600, 20), true);
  assert.equal(landPolygonsTooClose(coast, square(170, 70), 600, 19), false);
  assert.equal(landPolygonsTooClose(coast, square(70, 170), 600, 19), false);
  assert.equal(landPolygonsTooClose(coast, square(170, 170), 600, 29), true);
  assert.equal(landPolygonsTooClose(coast, square(170, 170), 600, 28), false);
  const horizontal = [
    [0, 45],
    [100, 45],
    [100, 55],
    [0, 55],
  ];
  const vertical = [
    [45, 0],
    [55, 0],
    [55, 100],
    [45, 100],
  ];
  assert.equal(landPolygonsTooClose(horizontal, vertical, 600), true);
  assert.equal(
    landPolygonsTooClose(square(0, 0), square(0, 0, 100), 600),
    true,
  );
  assert.equal(landPolygonsTooClose([], coast, 600), false);
  assert.equal(landPolygonsTooClose(coast, [[0, 0]], 600), false);
  assert.equal(
    landPolygonsTooClose([[50, 50], ...coast], square(150, 50), 600),
    true,
  );
});

test("clearance permits islands in concave bays despite overlapping bounds", () => {
  const bay = [
    [0, 0],
    [100, 0],
    [100, 100],
    [70, 100],
    [70, 30],
    [30, 30],
    [30, 100],
    [0, 100],
  ];
  assert.equal(landPolygonsTooClose(bay, square(40, 60, 20), 600, 9), false);
  assert.equal(landPolygonsTooClose(bay, square(40, 60, 20), 600, 10), true);
});

test("clearance considers continuous seam-crossing polygons and distant longitude copies", () => {
  assert.equal(
    landPolygonsTooClose(square(-10, 30), square(590, 30), 600),
    true,
  );
  assert.equal(
    landPolygonsTooClose(square(580, 30), square(10, 30), 600, 9),
    false,
  );
  assert.equal(
    landPolygonsTooClose(square(580, 30), square(10, 30), 600, 10),
    true,
  );
  assert.equal(
    landPolygonsTooClose(square(1800, 30), square(0, 30), 600),
    true,
  );
});

test("placement separates contained and seam-crossing land without changing source data", () => {
  const source = [
    { name: "Continent", poly: square(510, 30, 110) },
    { name: "Interior Island", poly: square(560, 40) },
    { name: "Across the Seam", poly: square(0, 35) },
    { name: "Polar Island", poly: square(200, -10, 50) },
  ];
  const original = structuredClone(source);
  const generated = generateWorldMap(source, identity, { gap: 30, margin: 20 });
  assert.deepEqual(source, original);
  assertSeparated(generated, 600, 29.999);
  assert.ok(generated.lands.some((land) => land.poly.some(([x]) => x > 600)));
  for (const land of generated.lands) {
    assert.ok(land.poly.every(([, y]) => y >= 20 && y <= 380));
  }
  const island = generated.point(570, 50, "Interior Island");
  assert.ok(
    pointInWrappedPolygon(island.x, island.y, generated.lands[1].poly, 600),
  );
});

test("annotations follow containing polygons, explicit named regions, and the nearest wrapped region", () => {
  const source = [
    { name: "Bay", poly: square(30, 30, 100) },
    { name: "Island", poly: square(300, 30) },
    { name: "", satellite: true, poly: square(140, 50) },
  ];
  const world = generateWorldMap(source, identity, { gap: 12, margin: 20 });
  assert.deepEqual(world.point(80, 80), { x: 80, y: 80 });
  const satellite = world.point(150, 60);
  assert.ok(
    pointInWrappedPolygon(satellite.x, satellite.y, world.lands[2].poly, 600),
  );
  assert.deepEqual(world.point(280, 60, "Bay"), { x: 280, y: 60 });
  assert.deepEqual(world.point(280, 60), { x: 280, y: 60 });
  assert.deepEqual(world.point(610, 60), { x: 10, y: 60 });
  // The generated mapper retains source geometry after the caller installs the map.
  source[0].poly = square(450, 200);
  assert.deepEqual(world.point(80, 80), { x: 80, y: 80 });
  const empty = generateWorldMap([], identity, { gap: 12, margin: 20 });
  assert.deepEqual(empty.lands, []);
  assert.deepEqual(empty.point(42, 70), { x: 42, y: 70 });
});

test("offshore islets follow their relocated continent and keep its departure water open", () => {
  const source = [
    { name: "Continent", poly: square(100, 100, 100) },
    { name: "", satellite: true, poly: square(230, 130) },
  ];
  const transform = {
    ...identity,
    regionPoint: (x, y, key) => ({ x: key === "Continent" ? 400 : x, y }),
  };
  const world = generateWorldMap(source, transform, { gap: 12, margin: 20 });
  assert.deepEqual(world.point(240, 140), { x: 490, y: 140 });
  const protectedWorld = generateWorldMap(source, transform, {
    gap: 12,
    margin: 20,
    anchorages: [{ land: "Continent", x: 250, y: 140 }],
  });
  assertSeparated(protectedWorld, 600, 11.999);
  const departure = protectedWorld.point(250, 140, "Continent");
  assert.equal(
    protectedWorld.lands.some((l) =>
      pointInWrappedPolygon(departure.x, departure.y, l.poly, 600),
    ),
    false,
  );
});

test("standalone unnamed islets generate without a continental parent", () => {
  const world = generateWorldMap(
    [{ name: "", poly: square(100, 100) }],
    identity,
    { margin: 20 },
  );
  assert.deepEqual(world.lands[0].poly, square(100, 100));
  assert.deepEqual(world.point(110, 110), { x: 110, y: 110 });
  assert.throws(
    () => generateWorldMap([], { ...identity, width: Infinity }),
    RangeError,
  );
});

test("crowded worlds search beyond local placement and shrink only when necessary", () => {
  const large = [{ name: "Large", poly: square(100, 100, 700) }];
  const fitted = generateWorldMap(large, identity, { gap: 20, margin: 20 });
  assert.ok(fitted.lands[0].poly.every(([, y]) => y >= 20 && y <= 380));
  const width =
    Math.max(...fitted.lands[0].poly.map(([x]) => x)) -
    Math.min(...fitted.lands[0].poly.map(([x]) => x));
  assert.ok(width <= 320.001);
  const crowded = Array.from({ length: 10 }, (_, i) => ({
    name: `Land ${i}`,
    poly: square(100, 100, 100),
  }));
  const world = generateWorldMap(
    crowded,
    { ...identity, width: 800, height: 800, sourceWidth: 800 },
    { gap: 36, margin: 20 },
  );
  assertSeparated(world, 800, 35.999);
});

test("impossible placement and malformed polygons fail explicitly instead of leaving overlaps", () => {
  assert.throws(() => generateWorldMap([], identity, { gap: 300 }), RangeError);
  assert.throws(
    () => generateWorldMap([], identity, { margin: 190, gap: 12 }),
    RangeError,
  );
  assert.throws(() => generateWorldMap([], identity, { gap: -1 }), RangeError);
  assert.throws(
    () => generateWorldMap([], identity, { margin: -1 }),
    RangeError,
  );
  assert.throws(
    () =>
      generateWorldMap(
        [
          {
            poly: [
              [0, 0],
              [10, 10],
            ],
          },
        ],
        identity,
      ),
    TypeError,
  );
  assert.throws(
    () =>
      generateWorldMap(
        [
          {
            poly: [
              [0, 0],
              [Infinity, 10],
              [10, 0],
            ],
          },
        ],
        identity,
      ),
    TypeError,
  );
  assert.throws(
    () =>
      generateWorldMap(
        [
          {
            poly: [
              [0, 0],
              [10, 10],
              [20, 20],
            ],
          },
        ],
        identity,
      ),
    TypeError,
  );
  assert.throws(
    () =>
      generateWorldMap(
        Array.from({ length: 20 }, (_, i) => ({
          name: String(i),
          poly: square(100, 100),
        })),
        { ...identity, width: 180, height: 180, sourceWidth: 180 },
        { gap: 60, margin: 10 },
      ),
    RangeError,
  );
});

test("real world generation is deterministic and seed-sensitive with stable land identifiers", () => {
  const original = structuredClone(lands);
  const first = generateWorldMap(lands, createMapTransform("north-star"));
  const repeat = generateWorldMap(lands, createMapTransform("north-star"));
  const different = generateWorldMap(
    lands,
    createMapTransform("southern-cross"),
  );
  assert.deepEqual(first.lands, repeat.lands);
  assert.notDeepEqual(first.lands, different.lands);
  assert.deepEqual(
    first.lands.map((l) => l.name),
    lands.map((l) => l.name),
  );
  assert.deepEqual(lands, original);
  for (const land of first.lands) assertSimple(land.poly);
});

test("many complete seeded worlds retain navigable straits, polar margins, surveys, and home departure", () => {
  for (let seed = 0; seed < 32; seed++) {
    const transform = createMapTransform(`navigation-${seed}`);
    const world = generateWorldMap(lands, transform, {
      anchorages: [
        {
          land: lands[0].name,
          x: HOME_PORT.spawnX,
          y: HOME_PORT.spawnY,
          radius: 45,
        },
      ],
    });
    assertSeparated(world, transform.width, 35.999);
    for (const land of world.lands) {
      assertSimple(land.poly);
      assert.ok(
        land.poly.every(
          ([x, y]) =>
            Number.isFinite(x) && y >= 89.999 && y <= transform.height - 89.999,
        ),
      );
      const xs = land.poly.map(([x]) => x);
      assert.ok(Math.max(...xs) - Math.min(...xs) < transform.width);
    }
    const spawn = world.point(
      HOME_PORT.spawnX,
      HOME_PORT.spawnY,
      lands[0].name,
    );
    assert.equal(
      world.lands.some((l) =>
        pointInWrappedPolygon(spawn.x, spawn.y, l.poly, transform.width),
      ),
      false,
    );
    for (const site of explorationSites.filter((s) => s.land)) {
      const source = lands.find((l) => l.name === site.land);
      if (!pointInPolygon(site.x, site.y, source.poly)) continue;
      const location = world.point(site.x, site.y, site.land);
      const target = world.lands.find((l) => l.name === site.land);
      assert.ok(
        pointInWrappedPolygon(
          location.x,
          location.y,
          target.poly,
          transform.width,
        ),
      );
    }
    for (const port of [...ports, ...discoverySites]) {
      const location = world.point(port.x, port.y, port.land);
      assert.ok(Number.isFinite(location.x) && Number.isFinite(location.y));
      assert.ok(location.y >= 90 && location.y <= transform.height - 90);
    }
  }
});
