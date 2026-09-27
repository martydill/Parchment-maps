import assert from "node:assert/strict";
import test from "node:test";
import {
  MAP_TILT_COS,
  MAP_TILT_TAN,
  unprojectMapPoint,
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
