import { PORT_NAMES } from "../src/names.js";
import assert from "node:assert/strict";
import test from "node:test";

import {
  clearCourse,
  compassDirection,
  courseBearing,
  createNavigationState,
  normalizeNavigationState,
  plotCourse,
} from "../src/core/navigation.js";

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
