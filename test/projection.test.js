import assert from "node:assert/strict";
import test from "node:test";
import {
  MAP_TILT_COS,
  MAP_TILT_TAN,
  unprojectMapPoint,
  visibleWorldCopies,
} from "../src/core/projection.js";

test("the tilted chart maps its screen center to the camera", () => {
  assert.deepEqual(unprojectMapPoint(400, 300, 1200, 700, 1.5, 800, 600), {
    x: 1200,
    y: 700,
  });
});

test("screen picking reverses the shallow chart projection at its edges", () => {
  const zoom = 1.4;
  const worldX = 1275;
  const worldY = 845;
  const screenX = 500 + (worldX - 1200) * zoom;
  const screenY = 350 + (worldY - 700) * zoom * MAP_TILT_COS;
  const point = unprojectMapPoint(screenX, screenY, 1200, 700, zoom, 1000, 700);
  assert.ok(Math.abs(point.x - worldX) < 1e-10);
  assert.ok(Math.abs(point.y - worldY) < 1e-10);
  assert.ok(MAP_TILT_TAN > 0);
});

test("visibleWorldCopies returns only copies that intersect the viewport", () => {
  // Centered in a 4800-wide world with 1200px viewport at zoom 1 (visible: [1800, 3000])
  assert.deepEqual(visibleWorldCopies(2400, 1200, 1, 4800), [0]);

  // Near the left edge crossing the seam (visible: [-300, 900])
  assert.deepEqual(visibleWorldCopies(300, 1200, 1, 4800), [-4800, 0]);

  // Near the right edge crossing the seam (visible: [3900, 5100])
  assert.deepEqual(visibleWorldCopies(4500, 1200, 1, 4800), [0, 4800]);

  // Zoomed out far enough to view more than one full world width
  assert.deepEqual(visibleWorldCopies(2400, 14400, 1, 4800), [-4800, 0, 4800]);

  // Safe fallback on degenerate or missing zoom / width
  assert.deepEqual(visibleWorldCopies(2400, 1200, 0, 4800), [0]);
  assert.deepEqual(visibleWorldCopies(2400, 1200, -1, 4800), [0]);
  assert.deepEqual(visibleWorldCopies(2400, 1200, 1, 0), [0]);
  assert.deepEqual(visibleWorldCopies(2400, 1200, 1, -4800), [0]);
  assert.deepEqual(visibleWorldCopies(2400, -100, 1, 4800), [0]);
});
