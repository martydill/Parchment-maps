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
    plotCourse(state, "Narthkel", ["Orvessa Quay", "Narthkel"]),
    true,
  );
  assert.equal(state.destination, "Narthkel");
  clearCourse(state);
  assert.equal(state.destination, null);
});

test("plotCourse rejects unknown destinations without changing the course", () => {
  const state = { destination: "Orvessa Quay" };
  assert.equal(plotCourse(state, "Hidden Cay", ["Orvessa Quay"]), false);
  assert.equal(state.destination, "Orvessa Quay");
});

test("navigation normalization repairs legacy and invalid saves", () => {
  const ports = ["Orvessa Quay", "Narthkel"];
  assert.deepEqual(normalizeNavigationState(undefined, ports), {
    destination: null,
  });
  assert.deepEqual(normalizeNavigationState("old-save", ports), {
    destination: null,
  });
  assert.deepEqual(
    normalizeNavigationState({ destination: "Narthkel" }, ports),
    { destination: "Narthkel" },
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
