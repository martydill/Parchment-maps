import assert from "node:assert/strict";
import test from "node:test";
import { drawCourseLine } from "../src/course-rendering.js";
import { drawPlottedCourse } from "../src/ui/chart-panel.js";
import { createCoursePlanner } from "../src/core/navigation.js";
import { buildSeaField } from "../src/core/navfield.js";

function recordingContext() {
  const segments = [];
  const strokes = [];
  let from;
  return {
    segments,
    strokes,
    save() {},
    restore() {},
    beginPath() {},
    setLineDash() {},
    arc() {},
    moveTo(x, y) {
      from = [x, y];
    },
    lineTo(x, y) {
      segments.push([from, [x, y]]);
      from = [x, y];
    },
    stroke() {
      strokes.push({ width: this.lineWidth, color: this.strokeStyle });
    },
  };
}

test("course drawing follows every waypoint in each wrapped copy at constant screen width", () => {
  const c = recordingContext();
  const points = [
    [980, 400],
    [1000, 300],
    [1020, 400],
  ];
  drawCourseLine(c, points, { zoom: 2, offsets: [-1000, 0] });
  assert.deepEqual(c.segments, [
    [
      [-20, 400],
      [0, 300],
    ],
    [
      [0, 300],
      [20, 400],
    ],
    [
      [980, 400],
      [1000, 300],
    ],
    [
      [1000, 300],
      [1020, 400],
    ],
  ]);
  assert.equal(c.strokes[0].width * 2, 1.5);
  assert.equal(c.strokes.length, 1);
  drawCourseLine(c, []);
  drawCourseLine(c, [[0, 0]]);
  assert.equal(c.strokes.length, 1);
});

test("the chart draws the sailing route at canonical coordinates after multiple world wraps", () => {
  const field = buildSeaField(
    [
      {
        poly: [
          [980, 300],
          [1020, 300],
          [1020, 500],
          [980, 500],
        ],
      },
    ],
    { width: 1000, height: 800 },
  );
  const planCourse = createCoursePlanner(field);
  const ship = { x: 2900, y: 400 };
  const destination = { x: 100, y: 400 };
  const points = planCourse(ship, destination);
  assert.ok(points.length > 2);
  const c = recordingContext();
  const context = {
    planCourse,
    ship,
    game: { navigation: { destination: "Harbor" } },
    getPortByName: () => destination,
    world: { w: 1000, h: 800 },
  };
  drawPlottedCourse(c, 0.5, 0.25, context);
  const canonicalCopy = c.segments.slice(
    points.length - 1,
    2 * (points.length - 1),
  );
  assert.deepEqual(canonicalCopy[0][0], [450, 100]);
  assert.deepEqual(canonicalCopy.at(-1)[1], [550, 100]);
  assert.equal(canonicalCopy.length, points.length - 1);
  for (let i = 0; i < canonicalCopy.length; i += 1) {
    assert.deepEqual(canonicalCopy[i][1], [
      (points[i + 1][0] - 2000) * 0.5,
      points[i + 1][1] * 0.25,
    ]);
  }
  const empty = recordingContext();
  drawPlottedCourse(empty, 1, 1, { ...context, getPortByName: () => null });
  assert.deepEqual(empty.strokes, []);
});
