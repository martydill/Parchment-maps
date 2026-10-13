// Orbit camera over the chart diorama. The sea is the z = 0 plane, matching
// the flat 2D chart interaction surface; land rises along +z. Yaw 0 and pitch
// PI/2 reproduce the old top-down chart orientation: east right, south down.
export const DEFAULT_FOV = (38 * Math.PI) / 180;
export const MIN_PITCH = 0.3;
export const MAX_PITCH = Math.PI / 2;

export function createCamera3D({
  x = 0,
  y = 0,
  yaw = 0,
  pitch = Math.PI / 2,
  distance = 1500,
  fov = DEFAULT_FOV,
  minDistance = 140,
  maxDistance = 4600,
} = {}) {
  return {
    x,
    y,
    yaw,
    pitch,
    distance,
    fov,
    minDistance,
    maxDistance,
  };
}

export function clampCamera(camera) {
  camera.yaw = normalizeOrbitAngle(camera.yaw);
  camera.pitch = Math.min(
    MAX_PITCH,
    Math.max(
      MIN_PITCH,
      Number.isFinite(camera.pitch) ? camera.pitch : MAX_PITCH,
    ),
  );
  camera.distance = Math.min(
    camera.maxDistance,
    Math.max(camera.minDistance, camera.distance),
  );
  return camera;
}

export function normalizeOrbitAngle(angle) {
  const value = Number.isFinite(angle) ? angle : 0;
  return Math.atan2(Math.sin(value), Math.cos(value));
}

// Eye offset grows southward with yaw 0 so an oblique view looks from the
// bottom edge of the chart, matching the old squashed-tilt presentation.
export function cameraEye(camera) {
  const cosPitch = Math.cos(camera.pitch);
  return [
    camera.x + camera.distance * cosPitch * Math.sin(camera.yaw),
    camera.y + camera.distance * cosPitch * Math.cos(camera.yaw),
    camera.distance * Math.sin(camera.pitch),
  ];
}

// Map coordinates (x east, y south, z up) are left-handed, so the view is
// built in a y-mirrored, right-handed space: yaw 0 top-down then shows north
// at the top of the screen with east to the right, exactly like the flat
// chart. World coordinates never leak into GL with this flip applied.
export function cameraViewBasis(camera) {
  const eye = cameraEye(camera);
  const flippedEye = [eye[0], -eye[1], eye[2]];
  const flippedTarget = [camera.x, -camera.y, 0];
  // Forward from the eye toward the focus point on the sea plane.
  const fx = flippedTarget[0] - flippedEye[0];
  const fy = flippedTarget[1] - flippedEye[1];
  const fz = -flippedEye[2];
  const fl = Math.hypot(fx, fy, fz) || 1;
  const forwardX = fx / fl;
  const forwardY = fy / fl;
  const forwardZ = fz / fl;
  // Up vector lies in the vertical plane through eye and target, leaning away
  // from the viewer, so the chart horizon stays level at every yaw.
  const sinPitch = Math.sin(camera.pitch);
  const upX = -Math.sin(camera.yaw) * sinPitch;
  const upY = Math.cos(camera.yaw) * sinPitch;
  const upZ = Math.cos(camera.pitch);
  const rightX = forwardY * upZ - forwardZ * upY;
  const rightY = forwardZ * upX - forwardX * upZ;
  const rightZ = forwardX * upY - forwardY * upX;
  const rightLength = Math.hypot(rightX, rightY, rightZ) || 1;
  const sx = rightX / rightLength;
  const sy = rightY / rightLength;
  const sz = rightZ / rightLength;
  const ux = sy * forwardZ - sz * forwardY;
  const uy = sz * forwardX - sx * forwardZ;
  const uz = sx * forwardY - sy * forwardX;
  return {
    eye: flippedEye,
    forwardX,
    forwardY,
    forwardZ,
    sx,
    sy,
    sz,
    ux,
    uy,
    uz,
  };
}

// Column-major 4x4, ready for uniformMatrix4fv.
export function cameraViewMatrix(camera) {
  const basis = cameraViewBasis(camera);
  const { eye } = basis;
  const { sx, sy, sz, ux, uy, uz, forwardX, forwardY, forwardZ } = basis;
  return new Float32Array([
    sx,
    ux,
    -forwardX,
    0,
    sy,
    uy,
    -forwardY,
    0,
    sz,
    uz,
    -forwardZ,
    0,
    -(sx * eye[0] + sy * eye[1] + sz * eye[2]),
    -(ux * eye[0] + uy * eye[1] + uz * eye[2]),
    forwardX * eye[0] + forwardY * eye[1] + forwardZ * eye[2],
    1,
  ]);
}

export function perspectiveMatrix(fov, aspect, near, far) {
  const focal = 1 / Math.tan(fov / 2);
  const range = near - far;
  return new Float32Array([
    focal / aspect,
    0,
    0,
    0,
    0,
    focal,
    0,
    0,
    0,
    0,
    (far + near) / range,
    -1,
    0,
    0,
    (2 * far * near) / range,
    0,
  ]);
}

export function transformPoint(matrix, x, y, z) {
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
    matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15],
  ];
}

// Project a world point to CSS-pixel screen coordinates. Points behind the
// camera report behind: true; their x/y are not meaningful.
export function projectWorldPoint(
  camera,
  viewportWidth,
  viewportHeight,
  x,
  y,
  z = 0,
) {
  const view = cameraViewMatrix(camera);
  const projection = perspectiveMatrix(
    camera.fov,
    viewportWidth / Math.max(1, viewportHeight),
    24,
    camera.distance * 6 + 4000,
  );
  const clip = transformPoint(multiply4x4(projection, view), x, -y, z);
  const w = clip[3];
  if (w <= 0.0001) return { x: 0, y: 0, depth: Infinity, behind: true };
  return {
    x: ((clip[0] / w) * 0.5 + 0.5) * viewportWidth,
    y: (0.5 - (clip[1] / w) * 0.5) * viewportHeight,
    depth: clip[2] / w,
    behind: false,
  };
}

// Pixels per world unit measured at the focus point. This is the 3D stand-in
// for the old 2D camera.zoom, so size-driven presentation keeps its meaning.
export function seaPixelsPerUnit(camera, viewportHeight) {
  return viewportHeight / 2 / (Math.tan(camera.fov / 2) * camera.distance);
}

export function distanceForZoom(zoom, viewportHeight, fov = DEFAULT_FOV) {
  const safeZoom = Math.max(0.0001, Number(zoom) || 0.0001);
  return viewportHeight / 2 / (Math.tan(fov / 2) * safeZoom);
}

// Cast a ray from a screen point and intersect the sea plane. Returns null
// when the ray never reaches z = 0 (looking above the horizon).
export function screenPointToSea(
  camera,
  viewportWidth,
  viewportHeight,
  pixelX,
  pixelY,
) {
  const aspect = viewportWidth / Math.max(1, viewportHeight);
  const focal = 1 / Math.tan(camera.fov / 2);
  const ndcX = (pixelX / viewportWidth) * 2 - 1;
  const ndcY = 1 - (pixelY / viewportHeight) * 2;
  const basis = cameraViewBasis(camera);
  const flippedX =
    basis.sx * ndcX * aspect + basis.ux * ndcY + basis.forwardX * focal;
  const flippedY =
    basis.sy * ndcX * aspect + basis.uy * ndcY + basis.forwardY * focal;
  const directionZ =
    basis.sz * ndcX * aspect + basis.uz * ndcY + basis.forwardZ * focal;
  if (directionZ >= -0.000001) return null;
  const t = -basis.eye[2] / directionZ;
  return {
    x: basis.eye[0] + flippedX * t,
    y: -basis.eye[1] - flippedY * t,
  };
}

// Axis-aligned slice of the sea plane covered by the viewport, padded by a
// margin in world units. Rays that exit over the horizon clamp to a multiple
// of the camera distance, so oblique views keep a bounded, generous extent.
export function viewBoundsOnSea(
  camera,
  viewportWidth,
  viewportHeight,
  margin = 0,
) {
  const clampDistance = camera.distance * 4;
  const probe = (pixelX, pixelY) => {
    const hit = screenPointToSea(
      camera,
      viewportWidth,
      viewportHeight,
      pixelX,
      pixelY,
    );
    if (hit && Number.isFinite(hit.x) && Number.isFinite(hit.y))
      return [hit.x, hit.y];
    const basis = cameraViewBasis(camera);
    const aspect = viewportWidth / Math.max(1, viewportHeight);
    const focal = 1 / Math.tan(camera.fov / 2);
    const ndcX = (pixelX / viewportWidth) * 2 - 1;
    const ndcY = 1 - (pixelY / viewportHeight) * 2;
    const flippedX =
      basis.sx * ndcX * aspect + basis.ux * ndcY + basis.forwardX * focal;
    const flippedY =
      basis.sy * ndcX * aspect + basis.uy * ndcY + basis.forwardY * focal;
    const flippedZ =
      basis.sz * ndcX * aspect + basis.uz * ndcY + basis.forwardZ * focal;
    // Normalize so the clamp distance is a true world-unit reach even for
    // rays that exit over the horizon.
    const length = Math.hypot(flippedX, flippedY, flippedZ) || 1;
    const reach = clampDistance / length;
    return [basis.eye[0] + flippedX * reach, -basis.eye[1] - flippedY * reach];
  };
  const corners = [
    probe(0, 0),
    probe(viewportWidth, 0),
    probe(viewportWidth, viewportHeight),
    probe(0, viewportHeight),
    probe(viewportWidth / 2, viewportHeight / 2),
  ];
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const [x, y] of corners) {
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }
  return {
    left: left - margin,
    right: right + margin,
    top: top - margin,
    bottom: bottom + margin,
  };
}

// Copies of the wrapping world whose x range intersects the sea-plane view.
export function worldCopiesInView(
  camera,
  viewportWidth,
  viewportHeight,
  worldWidth,
  margin = 0,
) {
  if (!(worldWidth > 0)) return [0];
  const bounds = viewBoundsOnSea(camera, viewportWidth, viewportHeight, margin);
  const minCopy = Math.floor(bounds.left / worldWidth);
  const maxCopy = Math.ceil(bounds.right / worldWidth) - 1;
  const copies = [];
  for (let copy = minCopy; copy <= maxCopy; copy++)
    copies.push(copy * worldWidth);
  return copies.length ? copies : [0];
}

export function multiply4x4(a, b) {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      out[column * 4 + row] =
        a[row] * b[column * 4] +
        a[4 + row] * b[column * 4 + 1] +
        a[8 + row] * b[column * 4 + 2] +
        a[12 + row] * b[column * 4 + 3];
    }
  }
  return out;
}
