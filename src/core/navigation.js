import { wrappedDelta } from "./math.js";
import { findCoursePath, segmentClear } from "./navfield.js";
import { unwrapPath } from "./routes.js";

// Reuse the route between nearby frames, but only attach the moving ship when
// its new first leg is still clear. Both map views consume this same planner.
export function createCoursePlanner(field) {
  let cached = null;
  return (origin, destination) => {
    const reusable =
      cached &&
      cached.destination.x === destination.x &&
      cached.destination.y === destination.y &&
      Math.hypot(
        wrappedDelta(origin.x, cached.origin.x, field.width),
        origin.y - cached.origin.y,
      ) <
        field.cellSize * 4;
    if (
      reusable &&
      origin.x === cached.origin.x &&
      origin.y === cached.origin.y
    ) {
      return unwrapPath(cached.points, origin.x, field.width);
    }
    const next = reusable && cached.points[1];
    if (next && segmentClear(field, origin.x, origin.y, ...next)) {
      return unwrapPath(
        [[origin.x, origin.y], ...cached.points.slice(1)],
        origin.x,
        field.width,
      );
    }
    if (!reusable || next) {
      cached = {
        origin: { x: origin.x, y: origin.y },
        destination: { x: destination.x, y: destination.y },
        points: findCoursePath(field, origin, destination),
      };
    }
    return unwrapPath(cached.points, origin.x, field.width);
  };
}

export function createNavigationState() {
  return { destination: null };
}

export function normalizeNavigationState(value, portNames = []) {
  const destination =
    value && typeof value.destination === "string" ? value.destination : null;
  return {
    destination: portNames.includes(destination) ? destination : null,
  };
}

export function plotCourse(state, destination, portNames = []) {
  if (!portNames.includes(destination)) return false;
  state.destination = destination;
  return true;
}

export function clearCourse(state) {
  state.destination = null;
}

export function courseBearing(origin, destination, worldWidth) {
  const dx = wrappedDelta(destination.x, origin.x, worldWidth);
  const dy = destination.y - origin.y;
  return {
    angle: Math.atan2(dy, dx),
    distance: Math.hypot(dx, dy),
    destinationX: origin.x + dx,
  };
}

export function compassDirection(angle) {
  const directions = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
  const normalized = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return directions[
    Math.round((normalized / (Math.PI * 2)) * directions.length) %
      directions.length
  ];
}
