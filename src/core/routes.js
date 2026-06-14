import { nearestWrapped, wrappedDelta } from "./math.js";

export function pathLength(points) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(
      points[index][0] - points[index - 1][0],
      points[index][1] - points[index - 1][1],
    );
  }
  return total;
}

export function pointAlongPath(points, distance) {
  if (points.length < 2) {
    const [x = 0, y = 0] = points[0] || [];
    return { x, y, angle: 0 };
  }

  let remaining = Math.max(0, distance);
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
    if (remaining <= length) {
      const progress = length ? remaining / length : 0;
      return {
        x: start[0] + (end[0] - start[0]) * progress,
        y: start[1] + (end[1] - start[1]) * progress,
        angle: Math.atan2(end[1] - start[1], end[0] - start[0]),
      };
    }
    remaining -= length;
  }

  const start = points.at(-2);
  const end = points.at(-1);
  return {
    x: end[0],
    y: end[1],
    angle: Math.atan2(end[1] - start[1], end[0] - start[0]),
  };
}

export function unwrapPath(points, startReference, worldWidth) {
  if (!points.length) return [];

  const output = [];
  let previousX = nearestWrapped(points[0][0], startReference, worldWidth);
  output.push([previousX, points[0][1]]);
  for (let index = 1; index < points.length; index += 1) {
    previousX += wrappedDelta(points[index][0], previousX, worldWidth);
    output.push([previousX, points[index][1]]);
  }
  return output;
}

export function orientRoute(route, origin, destination, originX, worldWidth) {
  const ordered =
    route.a === origin && route.b === destination
      ? route.points
      : route.points.slice().reverse();
  return unwrapPath(ordered, originX ?? ordered[0][0], worldWidth);
}

export function routesFrom(routes, portName) {
  return routes.filter((route) => route.a === portName || route.b === portName);
}
