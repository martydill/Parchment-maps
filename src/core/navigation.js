import { wrappedDelta } from "./math.js";

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
