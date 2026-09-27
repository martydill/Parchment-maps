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
