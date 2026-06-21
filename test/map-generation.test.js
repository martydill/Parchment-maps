import { LAND_NAMES } from "../src/names.js";
import assert from "node:assert/strict";
import test from "node:test";

import {
  createDistinctMapSeed,
  createMapTransform,
  moveUnreachablePointsToOpenWater,
  separateWrappedPoints,
  transformPath,
  transformPointRecord,
  transformTuple,
} from "../src/core/map-generation.js";

function wrappedDistance(a, b, width) {
  let dx =
    (((b.x % width) + width) % width) - (((a.x % width) + width) % width);
  if (dx > width / 2) dx -= width;
  if (dx < -width / 2) dx += width;
  return Math.hypot(dx, b.y - a.y);
}

test("map seed generation always differs from the previous seed", () => {
  assert.equal(
    createDistinctMapSeed("ya-1yz", new Uint32Array([1234, 2555])),
    "ya-1yz-new",
  );
  assert.equal(
    createDistinctMapSeed("old", new Uint32Array([1234, 2555])),
    "ya-1yz",
  );
  assert.notEqual(createDistinctMapSeed("0-0", new Uint32Array([0, 0])), "0-0");
  assert.notEqual(createDistinctMapSeed("old"), "old");
});

test("map transforms are deterministic, seed-sensitive, and taller than wide", () => {
  const first = createMapTransform("north-star");
  const matching = createMapTransform("north-star");
  const different = createMapTransform("southern-cross");

  assert.deepEqual(first.point(2100, 900), matching.point(2100, 900));
  assert.notDeepEqual(first.point(2100, 900), different.point(2100, 900));
  assert.equal(first.width, 4800);
  assert.equal(first.height, 3200);
  assert.ok(first.scaleX < 1);
  assert.ok(first.scaleY > 1);
});

test("regional transforms create materially different continent silhouettes", () => {
  const source = [
    [180, 260],
    [440, 115],
    [730, 280],
    [610, 500],
    [265, 520],
  ];
  const center = { x: 445, y: 335 };
  const first = createMapTransform("north-star");
  const matching = createMapTransform("north-star");
  const different = createMapTransform("southern-cross");
  const firstShape = source.map(([x, y]) =>
    first.regionPoint(x, y, LAND_NAMES.orravelle, center),
  );
  const matchingShape = source.map(([x, y]) =>
    matching.regionPoint(x, y, LAND_NAMES.orravelle, center),
  );
  const differentShape = source.map(([x, y]) =>
    different.regionPoint(x, y, LAND_NAMES.orravelle, center),
  );
  const totalDifference = firstShape.reduce(
    (sum, point, index) =>
      sum +
      Math.hypot(
        point.x - differentShape[index].x,
        point.y - differentShape[index].y,
      ),
    0,
  );

  assert.deepEqual(firstShape, matchingShape);
  assert.ok(totalDifference > 500);
});

test("map transforms constrain longitude and polar margins", () => {
  const transform = createMapTransform("bounds", {
    sourceWidth: 100,
    sourceHeight: 100,
    width: 80,
    height: 160,
    margin: 20,
  });
  const above = transform.point(-250, -100);
  const below = transform.point(350, 200);
  const wrapped = transform.point(101, 0);

  assert.ok(above.x >= 0 && above.x <= 80);
  assert.ok(below.x >= 0 && below.x <= 80);
  assert.ok(wrapped.x > 0 && wrapped.x < 1);
  assert.equal(above.y, 20);
  assert.equal(below.y, 140);
  assert.equal(transform.horizontalLength(10), 8);
  assert.equal(transform.verticalLength(10), 12);
  assert.equal(transform.averageLength(10), Math.sqrt(96));
  assert.equal(transform.seed, "bounds");
  assert.equal(transform.sourceWidth, 100);
  assert.equal(transform.sourceHeight, 100);
  const regional = transform.regionPoint(-1000, 1000, "edge", { x: 50, y: 50 });
  assert.ok(regional.x >= 0 && regional.x <= 80);
  assert.ok(regional.y >= 20 && regional.y <= 140);
  const regionalUpper = transform.regionPoint(1000, -1000, "other-edge", {
    x: 50,
    y: 50,
  });
  assert.ok(regionalUpper.x >= 0 && regionalUpper.x <= 80);
  assert.ok(regionalUpper.y >= 20 && regionalUpper.y <= 140);
});

test("map helpers transform records, tuples, and paths in place", () => {
  const transform = createMapTransform(42);
  const record = { x: 100, y: 200, name: "Harbor" };
  const sizedTuple = [100, 200, 30];
  const unscaledTuple = [100, 200, 30];
  const labelTuple = [100, 200, "label"];
  const path = [
    [100, 200],
    [300, 400],
  ];

  assert.equal(transformPointRecord(record, transform), record);
  assert.equal(transformTuple(sizedTuple, transform), sizedTuple);
  assert.equal(transformTuple(unscaledTuple, transform, false), unscaledTuple);
  assert.equal(transformTuple(labelTuple, transform), labelTuple);
  assert.equal(transformPath(path, transform), path);
  assert.notDeepEqual(record, { x: 100, y: 200, name: "Harbor" });
  assert.notEqual(sizedTuple[2], 30);
  assert.equal(unscaledTuple[2], 30);
  assert.equal(labelTuple[2], "label");
  assert.notDeepEqual(path[0], [100, 200]);
  assert.notDeepEqual(path[1], [300, 400]);
});

test("point separation spaces nearby cities in a wrapping world", () => {
  const cities = [
    { name: "West", x: 12, y: 100 },
    { name: "East", x: 790, y: 100 },
    { name: "South", x: 100, y: 112 },
  ];

  assert.equal(
    separateWrappedPoints(cities, { width: 800, minDistance: 80 }),
    cities,
  );

  for (let a = 0; a < cities.length; a++) {
    for (let b = a + 1; b < cities.length; b++) {
      assert.ok(
        wrappedDistance(cities[a], cities[b], 800) >= 79.999,
        `${cities[a].name} and ${cities[b].name} should be separated`,
      );
    }
  }

  for (const city of cities) {
    assert.ok(city.x >= 0 && city.x < 800);
  }
});

test("point separation keeps locked cities fixed and clamps to map margins", () => {
  const cities = [
    { name: "Home", x: 400, y: 20, home: true },
    { name: "Neighbor", x: 400, y: 24 },
  ];

  separateWrappedPoints(cities, {
    width: 800,
    height: 200,
    minDistance: 80,
    margin: 30,
    locked: (city) => city.home,
  });

  assert.deepEqual(cities[0], { name: "Home", x: 400, y: 20, home: true });
  assert.equal(cities[1].x, 400);
  assert.equal(cities[1].y, 100);
});

test("unreachable point recovery moves inland cities to open water", () => {
  const cities = [{ name: "Inland", x: 100, y: 100 }];
  const isOpen = (x, y) =>
    wrappedDistance({ x, y }, { x: 100, y: 100 }, 500) > 100;

  assert.equal(
    moveUnreachablePointsToOpenWater(cities, {
      isOpen,
      width: 500,
      maxReach: 50,
      searchRadius: 160,
      step: 50,
      samples: 4,
    }),
    cities,
  );

  assert.deepEqual(cities, [{ name: "Inland", x: 250, y: 100 }]);
});

test("unreachable point recovery leaves reachable and locked cities unchanged", () => {
  const cities = [
    { name: "Harbor", x: 80, y: 100 },
    { name: "Near Shore", x: 100, y: 100 },
    { name: "Home", x: 300, y: 100, home: true },
  ];
  const original = structuredClone(cities);
  const isOpen = (x, y) =>
    x < 90 || wrappedDistance({ x, y }, { x: 300, y: 100 }, 500) > 100;

  moveUnreachablePointsToOpenWater(cities, {
    isOpen,
    width: 500,
    maxReach: 50,
    searchRadius: 160,
    step: 50,
    samples: 4,
    locked: (city) => city.home,
  });

  assert.deepEqual(cities, original);
});

test("unreachable point recovery keeps cities unchanged without open water or valid options", () => {
  const cities = [{ name: "Boxed", x: 100, y: 100 }];

  assert.equal(moveUnreachablePointsToOpenWater(cities), cities);
  moveUnreachablePointsToOpenWater(cities, {
    isOpen: () => false,
    width: 500,
    maxReach: 50,
    searchRadius: 60,
    step: 50,
    samples: 4,
  });

  assert.deepEqual(cities, [{ name: "Boxed", x: 100, y: 100 }]);
});

test("point separation ignores invalid settings and locked overlaps", () => {
  const invalidWidth = [{ name: "Invalid", x: 0, y: 0 }];
  assert.equal(separateWrappedPoints(invalidWidth, { width: 0 }), invalidWidth);

  const invalidDistance = [{ name: "Invalid distance", x: 0, y: 0 }];
  assert.equal(
    separateWrappedPoints(invalidDistance, { width: 100, minDistance: 0 }),
    invalidDistance,
  );

  const locked = [
    { name: "A", x: 10, y: 10 },
    { name: "B", x: 10, y: 10 },
  ];
  separateWrappedPoints(locked, {
    width: 100,
    minDistance: 20,
    locked: () => true,
  });
  assert.deepEqual(locked, [
    { name: "A", x: 10, y: 10 },
    { name: "B", x: 10, y: 10 },
  ]);
});

test("unreachable point recovery rejects each malformed search option", () => {
  const invalidOptions = [
    { isOpen: () => true, width: Number.NaN },
    { isOpen: () => true, width: 0 },
    { isOpen: () => true, width: 100, maxReach: -1 },
    { isOpen: () => true, width: 100, searchRadius: 0 },
    { isOpen: () => true, width: 100, step: 0 },
    { isOpen: () => true, width: 100, samples: 0 },
  ];

  for (const options of invalidOptions) {
    const cities = [{ name: "Harbor", x: 20, y: 30 }];
    assert.equal(moveUnreachablePointsToOpenWater(cities, options), cities);
    assert.deepEqual(cities, [{ name: "Harbor", x: 20, y: 30 }]);
  }
});

test("map seed fallback handles empty entropy and missing browser crypto", () => {
  assert.notEqual(createDistinctMapSeed("old", new Uint32Array()), "old");

  const originalCrypto = globalThis.crypto;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  try {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: undefined,
    });
    assert.notEqual(createDistinctMapSeed("old"), "old");
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "crypto", descriptor);
    else if (originalCrypto !== undefined)
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: originalCrypto,
      });
  }
});

test("point separation moves only the unlocked side of an overlap", () => {
  const firstLocked = [
    { name: "A", x: 50, y: 50, locked: true },
    { name: "B", x: 60, y: 50 },
  ];
  separateWrappedPoints(firstLocked, {
    width: 200,
    minDistance: 40,
    locked: (record) => record.locked,
  });
  assert.deepEqual(firstLocked[0], { name: "A", x: 50, y: 50, locked: true });
  assert.equal(firstLocked[1].x, 90);

  const secondLocked = [
    { name: "A", x: 50, y: 50 },
    { name: "B", x: 60, y: 50, locked: true },
  ];
  separateWrappedPoints(secondLocked, {
    width: 200,
    minDistance: 40,
    locked: (record) => record.locked,
  });
  assert.equal(secondLocked[0].x, 20);
  assert.deepEqual(secondLocked[1], { name: "B", x: 60, y: 50, locked: true });
});

test("map seed fallback still avoids matching the previous seed", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  const originalNow = Date.now;
  const originalRandom = Math.random;
  try {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: { getRandomValues: undefined },
    });
    Date.now = () => 36;
    Math.random = () => 0.5;

    assert.equal(createDistinctMapSeed("10-i"), "10-i-new");
  } finally {
    Date.now = originalNow;
    Math.random = originalRandom;
    if (descriptor) Object.defineProperty(globalThis, "crypto", descriptor);
  }
});

test("map point helpers accept their default option bags", () => {
  const separated = [{ name: "Default", x: 0, y: 0 }];
  assert.equal(separateWrappedPoints(separated), separated);

  const reachable = [{ name: "Reachable", x: 5, y: 6 }];
  assert.equal(
    moveUnreachablePointsToOpenWater(reachable, {
      isOpen: () => true,
      width: 100,
    }),
    reachable,
  );
});

test("point separation handles exact overlaps and reach checks around blocked points", () => {
  const overlapping = [
    { name: "A", x: 20, y: 20 },
    { name: "B", x: 20, y: 20 },
  ];
  separateWrappedPoints(overlapping, {
    width: 100,
    minDistance: 20,
    iterations: 1,
  });
  assert.deepEqual(overlapping, [
    { name: "A", x: 10, y: 20 },
    { name: "B", x: 30, y: 20 },
  ]);

  const nearWater = [{ name: "Near water", x: 50, y: 50 }];
  moveUnreachablePointsToOpenWater(nearWater, {
    isOpen: (x, y) => Math.hypot(x - 74, y - 50) < 1,
    width: 200,
    maxReach: 24,
    searchRadius: 100,
    step: 24,
    samples: 4,
  });
  assert.deepEqual(nearWater, [{ name: "Near water", x: 50, y: 50 }]);
});
