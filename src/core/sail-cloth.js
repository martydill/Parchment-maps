import { clamp } from "./math.js";
import { LIGHT_DIRECTION } from "./lighting.js";

// An exact critically damped spring in ship space. Presentation state only:
// neither frame rate, map wrapping, nor saving a voyage changes the response.
export function updateSailResponse(
  previous,
  {
    time = 0,
    angle = 0,
    windAngle = 0,
    windStrength = 0,
    reducedMotion = false,
  } = {},
) {
  const pressure = 0.25 + clamp(windStrength / 0.22, 0, 1) * 1.75;
  const relative = windAngle - angle;
  const target = {
    x: Math.sin(relative) * pressure,
    y: -Math.cos(relative) * pressure,
  };
  const dt = previous ? time - previous.time : 0;
  if (!previous || reducedMotion || dt < 0 || dt > 1)
    return { ...target, vx: 0, vy: 0, time };
  if (dt === 0) return previous;
  const result = { time };
  const frequency = 4.8;
  const decay = Math.exp(-frequency * dt);
  for (const axis of ["x", "y"]) {
    const velocity = `v${axis}`;
    const offset = previous[axis] - target[axis];
    const impulse = previous[velocity] + frequency * offset;
    result[axis] = target[axis] + (offset + impulse * dt) * decay;
    result[velocity] = (previous[velocity] - frequency * impulse * dt) * decay;
  }
  return result;
}

// Each fan shares its radial boundaries. Corners and the head stay attached;
// pressure rounds the belly and small traveling folds reach the loose foot.
export function sampleSailPoint(
  a,
  b,
  center,
  u,
  v,
  {
    x,
    y,
    time = 0,
    seed = 0,
    panel = 0,
    freeEdge = false,
    reducedMotion = false,
  },
) {
  const point = a.map(
    (value, axis) => value + (b[axis] - value) * u + (center[axis] - value) * v,
  );
  const pressure = Math.hypot(x, y);
  const bow = Math.sin((v * Math.PI) / 2);
  const edge = v < 1 ? Math.sin((Math.PI * u) / (1 - v)) * (1 - v) : 0;
  const foot = freeEdge ? edge : 0;
  const phase =
    time * 5.2 -
    point[2] * 0.43 +
    point[0] * 0.29 +
    seed * 2.399963 +
    panel * 1.7;
  const ripple = reducedMotion
    ? 0
    : Math.sin(phase) * Math.sin(Math.PI * v) * pressure * 0.1;
  const flutter = reducedMotion
    ? 0
    : Math.sin(phase + 0.8) * foot * pressure * 0.12;
  return [
    point[0] + x * (bow * 1.35 + foot * 0.2) - y * ripple,
    point[1] + y * (bow * 1.35 + foot * 0.2) + x * ripple + flutter,
    point[2] - foot * (0.22 + pressure * 0.1) + flutter * 0.65,
  ];
}

// Two-sided cloth responds to the normal facing the viewer. Sun behind that
// side scatters warmly through the weave; storms and night mute transmission.
export function sailBacklight(normal, facing, lighting) {
  const side = facing < 0 ? -1 : 1;
  const incidence =
    side *
    (normal[0] * LIGHT_DIRECTION.x +
      normal[1] * LIGHT_DIRECTION.y +
      normal[2] * LIGHT_DIRECTION.z);
  const transmission =
    clamp(-incidence, 0, 1) * lighting.daylight * (1 - lighting.storm * 0.85);
  return { transmission, opacity: 0.965 - transmission * 0.14 };
}

// Project a spar's shadow onto the receiving cloth plane along the shared
// sunlight direction. Parallel rays and cloth on the sunward side receive none.
export function sailShadowSegment(vertices, normal, a, b) {
  const light = [LIGHT_DIRECTION.x, LIGHT_DIRECTION.y, LIGHT_DIRECTION.z];
  const denominator = normal.reduce(
    (sum, value, axis) => sum + value * light[axis],
    0,
  );
  if (Math.abs(denominator) < 0.08) return null;
  const project = (point) => {
    const distance =
      normal.reduce(
        (sum, value, axis) => sum + value * (point[axis] - vertices[0][axis]),
        0,
      ) / denominator;
    return {
      distance,
      point: point.map(
        (value, axis) => value - light[axis] * Math.max(0, distance),
      ),
    };
  };
  const start = project(a);
  const end = project(b);
  if (start.distance <= 0 && end.distance <= 0) return null;
  // Clip the segment at the receiver before Canvas clips to its triangle.
  if (start.distance < 0 || end.distance < 0) {
    const t = start.distance / (start.distance - end.distance);
    const crossing = a.map((value, axis) => value + (b[axis] - value) * t);
    if (start.distance < 0) start.point = crossing;
    else end.point = crossing;
  }
  return [start.point, end.point];
}
