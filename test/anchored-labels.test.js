import assert from "node:assert/strict";
import test from "node:test";
import { anchorMapLabels } from "../src/core/label-layout.js";

const town = {
  id: "town",
  x: 100,
  y: 100,
  width: 80,
  height: 26,
  priority: 1,
};

test("sailing labels keep the same offset as the camera moves", () => {
  const [before] = anchorMapLabels([town], 250, 250);
  const moved = { ...town, x: town.x - 35, y: town.y + 12 };
  const [after] = anchorMapLabels([moved], 250, 250);
  assert.deepEqual(before, { ...town, x: 60, y: 118 });
  assert.equal(after.x - before.x, moved.x - town.x);
  assert.equal(after.y - before.y, moved.y - town.y);
  assert.equal(town.x, 100);
  assert.equal(town.y, 100);
});

test("overlapping labels and changing priorities never move a town's name", () => {
  const neighbor = { ...town, id: "neighbor", x: 110, priority: 100 };
  const [alone] = anchorMapLabels([town], 250, 250);
  const [withNeighbor] = anchorMapLabels([town, neighbor], 250, 250);
  const [selected] = anchorMapLabels([{ ...town, priority: 100 }], 250, 250);
  assert.deepEqual(withNeighbor, alone);
  assert.deepEqual(selected, { ...alone, priority: 100 });
});

test("labels clip naturally at every viewport edge without repositioning", () => {
  const labels = [
    { ...town, id: "left", x: 10 },
    { ...town, id: "right", x: 245 },
    { ...town, id: "top", y: -30 },
    { ...town, id: "bottom", y: 225 },
  ];
  const placed = anchorMapLabels(labels, 250, 250);
  assert.deepEqual(
    placed,
    labels.map((label) => ({ ...label, x: label.x - 40, y: label.y + 18 })),
  );
  assert.deepEqual(anchorMapLabels(labels, 260, 260), placed);
});

test("only labels fully outside the viewport are culled", () => {
  assert.deepEqual(anchorMapLabels([], 250, 250), []);
  for (const position of [{ x: -40 }, { x: 290 }, { y: -44 }, { y: 232 }]) {
    assert.deepEqual(anchorMapLabels([{ ...town, ...position }], 250, 250), []);
  }
});
