export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function wrap(value, size) {
  return ((value % size) + size) % size;
}

export function wrappedDelta(target, origin, size) {
  let delta = wrap(target, size) - wrap(origin, size);
  if (delta > size / 2) delta -= size;
  if (delta < -size / 2) delta += size;
  return delta;
}

export function nearestWrapped(value, reference, size) {
  return reference + wrappedDelta(value, reference, size);
}

export function wrappedDistance(x1, y1, x2, y2, width) {
  return Math.hypot(wrappedDelta(x1, x2, width), y1 - y2);
}

export function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}
