import assert from "node:assert/strict";
import test from "node:test";
import { layoutMapLabels } from "../src/core/label-layout.js";

test("important labels claim space first and avoid the ship", () => {
  const labels = [
    { id: "minor", x: 100, y: 100, width: 80, height: 20, priority: 1 },
    { id: "major", x: 100, y: 100, width: 80, height: 20, priority: 2 },
  ];
  const blockers = [{ x: 55, y: 116, width: 90, height: 22 }];
  const placed = layoutMapLabels(labels, blockers, 250, 250);
  assert.equal(placed[0].id, "major");
  assert.equal(placed[0].y, 60);
  assert.equal(placed[1].id, "minor");
  assert.equal(placed[1].x, 119);
});

test("labels stay in the viewport and disappear when all sides are blocked", () => {
  const edge = { id: "edge", x: 14, y: 20, width: 35, height: 18, priority: 1 };
  assert.deepEqual(layoutMapLabels([edge], [], 120, 100), [
    { ...edge, x: 33, y: 11 },
  ]);
  assert.deepEqual(
    layoutMapLabels(
      [{ id: "blocked", x: 50, y: 50, width: 60, height: 20, priority: 1 }],
      [{ x: 0, y: 0, width: 120, height: 120 }],
      120,
      120,
    ),
    [],
  );
});

test("a nearby ship can push a port label farther without hiding it", () => {
  const port = {
    id: "port",
    x: 100,
    y: 100,
    width: 110,
    height: 27,
    priority: 1,
  };
  const ship = { x: 60, y: 54, width: 80, height: 94 };
  assert.deepEqual(layoutMapLabels([port], [ship], 220, 220), [
    { ...port, x: 45, y: 154 },
  ]);
});
