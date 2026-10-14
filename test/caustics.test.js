import assert from "node:assert/strict";
import test from "node:test";
import { causticContours } from "../src/core/caustics.js";

const bounds = { left: -150, right: 650, top: 100, bottom: 700 };
const length = (path) =>
  path
    .slice(1)
    .reduce(
      (sum, point, i) =>
        sum + Math.hypot(point.x - path[i].x, point.y - path[i].y),
      0,
    );

test("wave-light contours are deterministic, irregular, and broken into unequal ribbons", () => {
  const paths = causticContours(bounds, 0, 1000);
  assert.deepEqual(paths, causticContours(bounds, 0, 1000));
  assert.notDeepEqual(paths, causticContours(bounds, 1, 1000));
  assert.ok(paths.length > 10);
  assert.ok(paths.every((path) => path.length >= 3));
  const lengths = paths.map(length);
  assert.ok(Math.max(...lengths) > Math.min(...lengths) * 4);
  const open = paths.filter(
    (path) =>
      Math.hypot(path[0].x - path.at(-1).x, path[0].y - path.at(-1).y) > 1,
  );
  assert.ok(
    open.length > paths.length / 2,
    "light dissolves into open arcs rather than a closed lattice",
  );
  assert.ok(new Set(paths.map((path) => path.length)).size > 6);
});

test("light ribbons match across positive and negative copies of the world seam", () => {
  const original = causticContours(bounds, 2.7, 1000);
  for (const offset of [-2000, 1000, 3000]) {
    const shifted = causticContours(
      { ...bounds, left: bounds.left + offset, right: bounds.right + offset },
      2.7,
      1000,
    );
    assert.equal(shifted.length, original.length);
    shifted.forEach((path, i) => {
      assert.equal(path.length, original[i].length);
      path.forEach((point, j) => {
        assert.ok(Math.abs(point.x - original[i][j].x - offset) < 1e-8);
        assert.ok(Math.abs(point.y - original[i][j].y) < 1e-8);
      });
    });
  }
});

test("contour crossings stay finite and connected while light fronts merge and separate", () => {
  for (const worldWidth of [40, 1000, 4800]) {
    for (const time of [-2, 0, 1.2, 3.5, 7]) {
      const region =
        worldWidth === 40
          ? { left: -20, right: 70, top: 100, bottom: 170 }
          : bounds;
      const paths = causticContours(region, time, worldWidth);
      const spacing = worldWidth / Math.max(2, Math.ceil(worldWidth / 16));
      for (const path of paths) {
        for (const [i, point] of path.entries()) {
          assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
          assert.ok(
            point.x >= region.left - spacing &&
              point.x <= region.right + spacing,
          );
          assert.ok(
            point.y >= region.top - spacing &&
              point.y <= region.bottom + spacing,
          );
          if (i)
            assert.ok(
              Math.hypot(point.x - path[i - 1].x, point.y - path[i - 1].y) <=
                Math.SQRT2 * spacing + 1e-8,
            );
        }
      }
    }
  }
});

test("lower detail reduces tracing work and empty or invalid regions produce no ribbons", () => {
  const fine = causticContours(bounds, 0, 1000);
  const coarse = causticContours(bounds, 0, 1000, 0.6);
  const count = (paths) => paths.reduce((sum, path) => sum + path.length, 0);
  assert.ok(count(coarse) < count(fine));
  assert.deepEqual(causticContours(bounds, 0, 0), []);
  assert.deepEqual(causticContours(bounds, 0, -1), []);
  assert.deepEqual(
    causticContours({ ...bounds, right: bounds.left }, 0, 1000),
    [],
  );
  assert.deepEqual(
    causticContours({ ...bounds, bottom: bounds.top }, 0, 1000),
    [],
  );
  assert.deepEqual(
    causticContours({ ...bounds, left: 1000, right: 500 }, 0, 1000),
    [],
  );
  assert.deepEqual(
    causticContours({ ...bounds, top: 1000, bottom: 500 }, 0, 1000),
    [],
  );
});
