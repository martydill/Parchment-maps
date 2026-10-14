import { raySegmentDistance } from "./geometry.js";
import { sceneLighting } from "./lighting.js";

const clamp01 = (value) =>
  Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

// Trace toward the sun in unwrapped island coordinates. A headland can block
// light even when the local shore faces the sun, leaving sheltered water cool.
export function coastalExposure(
  poly,
  segment,
  depth,
  lighting = sceneLighting(),
) {
  const { nx, ny, a, b } = segment;
  const shadow = lighting.shadow ?? sceneLighting().shadow;
  const offset = Math.max(6, depth * 0.45);
  const x = (a.x + b.x) / 2 + nx * offset;
  const y = (a.y + b.y) / 2 + ny * offset;
  const reach = Math.max(0, depth) * shadow.length;
  let distance = reach;
  for (let index = 0; index < poly.length; index++) {
    const first = poly[index];
    const next = poly[(index + 1) % poly.length];
    const hit = raySegmentDistance(
      x,
      y,
      -shadow.x,
      -shadow.y,
      first[0],
      first[1],
      next[0],
      next[1],
      reach,
    );
    if (hit !== null) distance = Math.min(distance, hit);
  }
  const shelter = reach > 0 ? 1 - distance / reach : 0;
  const direct = clamp01(-nx * shadow.x - ny * shadow.y) * (1 - shelter);
  return { x, y, direct, shelter, reach };
}

// Sparse cloud patches drift in world space, with long, overlapping clear
// intervals. Their identities never depend on the camera or frame rate.
export function cloudShadowSamples({
  world,
  time = 0,
  lighting = sceneLighting(),
  cloud = 0,
  detail = 1,
  reducedMotion = false,
}) {
  if (world.w <= 0 || world.h <= 0 || detail <= 0 || reducedMotion) return [];
  const strength = (lighting.shadow ?? sceneLighting().shadow).strength;
  if (strength <= 0.001) return [];
  const seconds = Math.max(0, Number.isFinite(time) ? time : 0) / 1000;
  const count = Math.ceil(
    Math.min(24, (world.w * world.h) / 650_000) * clamp01(detail),
  );
  const wrap = (value, span) => ((value % span) + span) % span;
  return Array.from({ length: count }, (_, index) => {
    const phase = index * 2.39996;
    const angle = -0.12 + (index % 3) * 0.12;
    const speed = 7 + (index % 4) * 1.7;
    const envelope =
      Math.max(0, Math.sin((seconds * Math.PI * 2) / 140 + phase)) ** 2;
    return {
      x: wrap(
        world.w * wrap(index * 0.618 + 0.19, 1) +
          Math.cos(angle) * seconds * speed,
        world.w,
      ),
      y: wrap(
        world.h * wrap(index * 0.381 + 0.37, 1) +
          Math.sin(angle) * seconds * speed,
        world.h,
      ),
      radius: 150 + (index % 5) * 27,
      aspect: 0.55 + (index % 3) * 0.12,
      alpha: envelope * strength * (0.09 + clamp01(cloud) * 0.12),
    };
  });
}
