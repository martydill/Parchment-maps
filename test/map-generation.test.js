import assert from "node:assert/strict";
import test from "node:test";

import {
  createDistinctMapSeed,
  createMapTransform,
  transformPath,
  transformPointRecord,
  transformTuple,
} from "../src/core/map-generation.js";

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
    first.regionPoint(x, y, "Avelorn", center),
  );
  const matchingShape = source.map(([x, y]) =>
    matching.regionPoint(x, y, "Avelorn", center),
  );
  const differentShape = source.map(([x, y]) =>
    different.regionPoint(x, y, "Avelorn", center),
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

  assert.ok(above.x >= 0 && above.x <= 80);
  assert.ok(below.x >= 0 && below.x <= 80);
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
