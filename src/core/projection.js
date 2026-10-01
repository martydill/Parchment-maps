// A shallow orthographic camera keeps the chart readable while revealing
// vertical terrain faces. The sea remains the z = 0 interaction plane.
export const MAP_TILT = Math.PI / 7;
export const MAP_TILT_COS = Math.cos(MAP_TILT);
export const MAP_TILT_SIN = Math.sin(MAP_TILT);
export const MAP_TILT_TAN = Math.tan(MAP_TILT);

export function unprojectMapPoint(
  screenX,
  screenY,
  cameraX,
  cameraY,
  zoom,
  viewportWidth,
  viewportHeight,
) {
  return {
    x: (screenX - viewportWidth / 2) / zoom + cameraX,
    y: (screenY - viewportHeight / 2) / (zoom * MAP_TILT_COS) + cameraY,
  };
}

export function visibleWorldCopies(cameraX, viewportWidth, zoom, worldWidth) {
  if (zoom <= 0 || worldWidth <= 0 || viewportWidth <= 0) {
    const base =
      worldWidth > 0 ? Math.floor(cameraX / worldWidth) * worldWidth : 0;
    return [base];
  }
  const halfWidth = viewportWidth / (2 * zoom);
  const left = cameraX - halfWidth;
  const right = cameraX + halfWidth;
  const minCopy = Math.floor(left / worldWidth);
  const maxCopy = Math.ceil(right / worldWidth) - 1;
  const copies = [];
  for (let copy = minCopy; copy <= maxCopy; copy++) {
    copies.push(copy * worldWidth);
  }
  return copies;
}
