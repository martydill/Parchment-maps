import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_PITCH,
  MIN_PITCH,
  cameraEye,
  clampCamera,
  createCamera3D,
  distanceForZoom,
  normalizeOrbitAngle,
  perspectiveMatrix,
  projectWorldPoint,
  seaPixelsPerUnit,
  screenPointToSea,
  viewBoundsOnSea,
  worldCopiesInView,
} from "../src/core/camera3d.js";

const VIEW = { width: 1600, height: 900 };

test("a top-down camera reproduces the flat chart orientation", () => {
  const camera = createCamera3D({ x: 1000, y: 800, pitch: MAX_PITCH });
  const east = projectWorldPoint(camera, VIEW.width, VIEW.height, 1010, 800);
  const west = projectWorldPoint(camera, VIEW.width, VIEW.height, 990, 800);
  const south = projectWorldPoint(camera, VIEW.width, VIEW.height, 1000, 810);
  const north = projectWorldPoint(camera, VIEW.width, VIEW.height, 1000, 790);
  assert.ok(east.x > west.x, "east renders to the right of west");
  assert.ok(south.y > north.y, "south renders below north");
  const center = projectWorldPoint(camera, VIEW.width, VIEW.height, 1000, 800);
  assert.ok(Math.abs(center.x - VIEW.width / 2) < 0.001);
  assert.ok(Math.abs(center.y - VIEW.height / 2) < 0.001);
});

test("screen picking inverts the projection across the whole sea plane", () => {
  const camera = createCamera3D({
    x: 1200,
    y: 900,
    yaw: 0.4,
    pitch: 0.9,
    distance: 1600,
  });
  for (const [px, py] of [
    [VIEW.width / 2, VIEW.height / 2],
    [300, 200],
    [1300, 750],
  ]) {
    const world = screenPointToSea(camera, VIEW.width, VIEW.height, px, py);
    const screen = projectWorldPoint(
      camera,
      VIEW.width,
      VIEW.height,
      world.x,
      world.y,
    );
    assert.ok(Math.abs(screen.x - px) < 0.01, `x round trip at ${px}`);
    assert.ok(Math.abs(screen.y - py) < 0.01, `y round trip at ${py}`);
  }
});

test("rays above the horizon never strike the sea", () => {
  const camera = createCamera3D({
    x: 0,
    y: 0,
    pitch: 0.32,
    distance: 900,
  });
  const hit = screenPointToSea(
    camera,
    VIEW.width,
    VIEW.height,
    VIEW.width / 2,
    4,
  );
  assert.equal(hit, null);
  const lower = screenPointToSea(
    camera,
    VIEW.width,
    VIEW.height,
    VIEW.width / 2,
    VIEW.height - 4,
  );
  assert.ok(lower && Number.isFinite(lower.x) && Number.isFinite(lower.y));
});

test("sea pixels per unit matches the 2D zoom contract", () => {
  const height = 1000;
  const camera = createCamera3D({ distance: distanceForZoom(1.25, height) });
  const pixels = seaPixelsPerUnit(camera, height);
  assert.ok(Math.abs(pixels - 1.25) < 0.001);
  const close = createCamera3D({ distance: 400 });
  const far = createCamera3D({ distance: 2400 });
  assert.ok(seaPixelsPerUnit(close, height) > seaPixelsPerUnit(far, height));
});

test("view bounds on the sea plane contain every projected corner", () => {
  const camera = createCamera3D({
    x: 2000,
    y: 1400,
    yaw: -0.7,
    pitch: 0.72,
    distance: 1700,
  });
  const bounds = viewBoundsOnSea(camera, VIEW.width, VIEW.height, 40);
  assert.ok(bounds.left < bounds.right);
  assert.ok(bounds.top < bounds.bottom);
  for (const [px, py] of [
    [10, 10],
    [VIEW.width - 10, 10],
    [VIEW.width - 10, VIEW.height - 10],
    [10, VIEW.height - 10],
    [VIEW.width / 2, VIEW.height / 2],
  ]) {
    const world = screenPointToSea(camera, VIEW.width, VIEW.height, px, py);
    if (!world) continue;
    assert.ok(
      world.x >= bounds.left - 1 &&
        world.x <= bounds.right + 1 &&
        world.y >= bounds.top - 1 &&
        world.y <= bounds.bottom + 1,
      `corner ${px},${py} outside bounds`,
    );
  }
});

test("world copies in view cover the horizon-clamped extent", () => {
  const camera = createCamera3D({
    x: 100,
    y: 1600,
    pitch: 0.35,
    distance: 1400,
  });
  const copies = worldCopiesInView(camera, VIEW.width, VIEW.height, 4800, 0);
  assert.ok(copies.length >= 1);
  assert.ok(copies.includes(0) || copies.includes(-4800));
  const centered = worldCopiesInView(
    createCamera3D({ x: 2400, y: 1600, pitch: MAX_PITCH, distance: 1800 }),
    VIEW.width,
    VIEW.height,
    4800,
    0,
  );
  assert.deepEqual(centered, [0]);
  assert.deepEqual(
    worldCopiesInView(camera, VIEW.width, VIEW.height, 0, 0),
    [0],
  );
});

test("clamping keeps the camera inside its orbit envelope", () => {
  const camera = createCamera3D({ distance: -50, pitch: 9, yaw: 19 });
  clampCamera(camera);
  assert.equal(camera.distance, camera.minDistance);
  const distant = createCamera3D({ distance: 99999 });
  clampCamera(distant);
  assert.equal(distant.distance, distant.maxDistance);
  assert.ok(camera.pitch <= MAX_PITCH && camera.pitch >= MIN_PITCH);
  assert.ok(Math.abs(camera.yaw) <= Math.PI + 0.0001);
  const flat = createCamera3D({ pitch: 0.001 });
  clampCamera(flat);
  assert.equal(flat.pitch, MIN_PITCH);
  const nan = createCamera3D({ pitch: NaN });
  clampCamera(nan);
  assert.equal(nan.pitch, MAX_PITCH);
});

test("normalizeOrbitAngle wraps to the shortest representation", () => {
  assert.ok(Math.abs(normalizeOrbitAngle(3 * Math.PI) - Math.PI) < 0.0001);
  assert.ok(Math.abs(normalizeOrbitAngle(-3 * Math.PI) + Math.PI) < 0.0001);
  assert.equal(normalizeOrbitAngle(NaN), 0);
});

test("the eye stays above the sea plane and looks at the focus", () => {
  const camera = createCamera3D({ x: 500, y: 700, pitch: 0.6, distance: 1200 });
  const eye = cameraEye(camera);
  assert.ok(eye[2] > 0);
  assert.ok(
    Math.abs(Math.hypot(eye[0] - 500, eye[1] - 700) - 1200 * Math.cos(0.6)) <
      0.001,
  );
  const overhead = createCamera3D({ pitch: MAX_PITCH, distance: 800 });
  assert.ok(Math.abs(cameraEye(overhead)[0] - overhead.x) < 0.0001);
});

test("perspective matrix keeps near and far planes finite", () => {
  const projection = perspectiveMatrix(0.7, 1.6, 20, 9000);
  const x = projection[8] * -20 + projection[12];
  const w = projection[10] * -20 + projection[14];
  assert.ok(x / w < 1);
  assert.ok(Number.isFinite(x / w));
});

test("horizon-level corners clamp to a bounded extent ahead of the camera", () => {
  const camera = createCamera3D({
    x: 2000,
    y: 2000,
    pitch: MIN_PITCH,
    distance: 1200,
    yaw: 0.5,
  });
  const bounds = viewBoundsOnSea(camera, VIEW.width, VIEW.height, 0);
  assert.ok(Number.isFinite(bounds.left) && Number.isFinite(bounds.right));
  assert.ok(Number.isFinite(bounds.top) && Number.isFinite(bounds.bottom));
  assert.ok(bounds.right > bounds.left);
  // The far edge reaches ahead of the camera but stays bounded.
  assert.ok(bounds.right - bounds.left < camera.distance * 12);
});
