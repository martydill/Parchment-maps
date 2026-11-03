import { PORT_NAMES } from "../src/names.js";
import assert from "node:assert/strict";
import test from "node:test";

import {
  clearCourse,
  compassDirection,
  courseBearing,
  createNavigationState,
  createCoursePlanner,
  normalizeNavigationState,
  plotCourse,
} from "../src/core/navigation.js";
import { buildSeaField, segmentClear } from "../src/core/navfield.js";

test("course planning follows a moving ship and changing destinations", () => {
  const field = buildSeaField([], { width: 1000, height: 800 });
  const plan = createCoursePlanner(field);
  const origin = { x: 100, y: 400 };
  const destination = { x: 400, y: 400 };
  assert.deepEqual(plan(origin, destination), [
    [100, 400],
    [400, 400],
  ]);
  assert.deepEqual(plan(origin, destination), [
    [100, 400],
    [400, 400],
  ]);
  origin.x += 5;
  assert.deepEqual(plan(origin, destination), [
    [105, 400],
    [400, 400],
  ]);
  origin.x += 50;
  assert.deepEqual(plan(origin, destination), [
    [155, 400],
    [400, 400],
  ]);
  destination.y += 20;
  assert.deepEqual(plan(origin, destination), [
    [155, 400],
    [400, 420],
  ]);
  destination.x += 20;
  assert.deepEqual(plan(origin, destination), [
    [155, 400],
    [420, 420],
  ]);
});

test("course planning keeps wrapped island detours continuous after multiple world crossings", () => {
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
  const plan = createCoursePlanner(field);
  for (const origin of [
    { x: 2900, y: 400 },
    { x: 2905, y: 405 },
    { x: -1090, y: 410 },
  ]) {
    const points = plan(origin, { x: 100, y: 400 });
    assert.ok(points.length > 2);
    assert.deepEqual(points[0], [origin.x, origin.y]);
    for (let i = 1; i < points.length; i += 1) {
      assert.ok(Math.abs(points[i][0] - points[i - 1][0]) < 500);
      assert.equal(segmentClear(field, ...points[i - 1], ...points[i]), true);
    }
  }
});

test("cached course connectors are rechecked when moving behind a coastline", () => {
  const field = buildSeaField(
    [
      {
        poly: [
          [200, 200],
          [240, 200],
          [240, 240],
          [200, 240],
        ],
      },
    ],
    { width: 1000, height: 800 },
  );
  const plan = createCoursePlanner(field);
  const destination = { x: 400, y: 205 };
  assert.equal(plan({ x: 190, y: 190 }, destination).length, 2);
  const points = plan({ x: 190, y: 225 }, destination);
  assert.ok(points.length > 2);
  for (let i = 1; i < points.length; i += 1) {
    assert.equal(segmentClear(field, ...points[i - 1], ...points[i]), true);
  }
});

test("unreachable courses stay empty across repeated frames and coastal starts remain safe", () => {
  const field = buildSeaField(
    [
      {
        poly: [
          [0, 0],
          [1000, 0],
          [1000, 800],
          [0, 800],
        ],
      },
    ],
    { width: 1000, height: 800 },
  );
  const plan = createCoursePlanner(field);
  assert.deepEqual(plan({ x: 100, y: 400 }, { x: 500, y: 400 }), []);
  assert.deepEqual(plan({ x: 105, y: 400 }, { x: 500, y: 400 }), []);
  const coastal = buildSeaField(
    [
      {
        poly: [
          [200, 200],
          [240, 200],
          [240, 240],
          [200, 240],
        ],
      },
    ],
    { width: 1000, height: 800 },
  );
  const coastalPlan = createCoursePlanner(coastal);
  for (const x of [205, 205, 210]) {
    const points = coastalPlan({ x, y: 220 }, { x: 400, y: 220 });
    assert.ok(points.length >= 2);
    for (let i = 1; i < points.length; i += 1) {
      assert.equal(segmentClear(coastal, ...points[i - 1], ...points[i]), true);
    }
  }
});

test("navigation state plots and clears known destinations", () => {
  const state = createNavigationState();
  assert.deepEqual(state, { destination: null });
  assert.equal(
    plotCourse(state, PORT_NAMES.narthkel, [
      PORT_NAMES.orvessaQuay,
      PORT_NAMES.narthkel,
    ]),
    true,
  );
  assert.equal(state.destination, PORT_NAMES.narthkel);
  clearCourse(state);
  assert.equal(state.destination, null);
});

test("plotCourse rejects unknown destinations without changing the course", () => {
  const state = { destination: PORT_NAMES.orvessaQuay };
  assert.equal(
    plotCourse(state, "Hidden Cay", [PORT_NAMES.orvessaQuay]),
    false,
  );
  assert.equal(state.destination, PORT_NAMES.orvessaQuay);
});

test("navigation normalization repairs legacy and invalid saves", () => {
  const ports = [PORT_NAMES.orvessaQuay, PORT_NAMES.narthkel];
  assert.deepEqual(normalizeNavigationState(undefined, ports), {
    destination: null,
  });
  assert.deepEqual(normalizeNavigationState("old-save", ports), {
    destination: null,
  });
  assert.deepEqual(
    normalizeNavigationState({ destination: PORT_NAMES.narthkel }, ports),
    { destination: PORT_NAMES.narthkel },
  );
  assert.deepEqual(
    normalizeNavigationState({ destination: "Unknown" }, ports),
    { destination: null },
  );
});

test("course bearing chooses the shortest path across the world seam", () => {
  const bearing = courseBearing({ x: 980, y: 100 }, { x: 20, y: 130 }, 1000);
  assert.equal(bearing.destinationX, 1020);
  assert.equal(bearing.distance, 50);
  assert.equal(bearing.angle, Math.atan2(30, 40));
});

test("compass directions cover cardinal, diagonal, and wrapped angles", () => {
  assert.equal(compassDirection(0), "E");
  assert.equal(compassDirection(Math.PI / 4), "SE");
  assert.equal(compassDirection(Math.PI / 2), "S");
  assert.equal(compassDirection(Math.PI), "W");
  assert.equal(compassDirection(-Math.PI / 2), "N");
});
