import { clamp, nearestWrapped, wrappedDistance } from "./math.js";
import { raySegmentDistance } from "./geometry.js";

export const WAKE_LIFETIME = 12000;
export const CROSSING_LIFETIME = 6500;
const MAX_POINTS = 128;
const MAX_CROSSINGS = 64;

// Intersect locally unwrapped segments. Nearly parallel traffic should leave
// braided wakes rather than repeatedly triggering a crossing along a lane.
export function intersectWakes(a, b, c, d, worldWidth) {
  const bx = nearestWrapped(b.x, a.x, worldWidth);
  const cx = nearestWrapped(c.x, a.x, worldWidth);
  const dx = nearestWrapped(d.x, cx, worldWidth);
  const ux = bx - a.x,
    uy = b.y - a.y;
  const vx = dx - cx,
    vy = d.y - c.y;
  const lengths = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  if (lengths < 0.01) return null;
  const energy = Math.abs(ux * vy - uy * vx) / lengths;
  if (energy < 0.22) return null;
  const along = raySegmentDistance(a.x, a.y, ux, uy, cx, c.y, dx, d.y, 1);
  if (along === null) return null;
  return {
    x: a.x + ux * along,
    y: a.y + uy * along,
    angle: Math.atan2(uy, ux),
    energy,
  };
}

// Presentation state only: never added to a save. Samples require actual
// displacement, so paused, berthed and anchored vessels cannot stamp foam.
export function createWakeSystem(worldWidth) {
  const trails = new Map();
  const crossings = [];
  return {
    trails,
    crossings,
    clear() {
      trails.clear();
      crossings.length = 0;
    },
    update(vessels, time) {
      const fresh = [];
      const seen = new Set();
      while (crossings.length && time - crossings[0].time >= CROSSING_LIFETIME)
        crossings.shift();
      for (const vessel of vessels) {
        const { id, x, y, angle = 0, stern = 15 } = vessel;
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        seen.add(id);
        let trail = trails.get(id);
        if (!trail) {
          trail = { id, points: [], interrupted: true };
          trails.set(id, trail);
        }
        if (vessel.active === false || vessel.anchored) {
          trail.interrupted = true;
          continue;
        }
        const point = {
          x: x - Math.cos(angle) * stern,
          y: y - Math.sin(angle) * stern,
        };
        const previous = trail.points[0];
        const distance = previous
          ? wrappedDistance(
              point.x,
              point.y,
              previous.x,
              previous.y,
              worldWidth,
            )
          : 0;
        if (previous && (time - previous.time < 90 || distance < 2.5)) continue;
        point.time = time;
        point.lifetime = WAKE_LIFETIME;
        point.strength = clamp(
          (vessel.speed ?? 30) / (vessel.maxSpeed ?? 55),
          0.25,
          1,
        );
        point.breakBefore =
          trail.interrupted ||
          !previous ||
          distance > 100 ||
          time - previous.time > 600;
        trail.points.unshift(point);
        trail.interrupted = false;
        if (!point.breakBefore) fresh.push({ trail, a: previous, b: point });
      }
      for (const [id, trail] of trails) {
        while (
          trail.points.length &&
          (time - trail.points.at(-1).time >= WAKE_LIFETIME ||
            trail.points.length > MAX_POINTS)
        )
          trail.points.pop();
        if (!seen.has(id)) trail.interrupted = true;
        if (!trail.points.length) trails.delete(id);
      }
      // Only newly laid segments can create an event. Historical intersections
      // never retrigger each frame; nearby events from the same pair coalesce.
      for (const { trail, a, b } of fresh) {
        for (const other of trails.values()) {
          if (other === trail) continue;
          for (let i = 1; i < other.points.length; i++) {
            const c = other.points[i - 1],
              d = other.points[i];
            if (c.breakBefore || time - c.time > WAKE_LIFETIME * 0.8) continue;
            // Cheap bounds rejection before the wrapped intersection test.
            const cx = nearestWrapped(c.x, a.x, worldWidth);
            const dx = nearestWrapped(d.x, cx, worldWidth);
            const bx = nearestWrapped(b.x, a.x, worldWidth);
            if (
              Math.max(cx, dx) < Math.min(a.x, bx) ||
              Math.min(cx, dx) > Math.max(a.x, bx) ||
              Math.max(c.y, d.y) < Math.min(a.y, b.y) ||
              Math.min(c.y, d.y) > Math.max(a.y, b.y)
            )
              continue;
            const hit = intersectWakes(a, b, c, d, worldWidth);
            if (!hit) continue;
            if (
              crossings.some(
                (event) =>
                  ((event.first === trail.id && event.second === other.id) ||
                    (event.second === trail.id && event.first === other.id)) &&
                  wrappedDistance(hit.x, hit.y, event.x, event.y, worldWidth) <
                    36,
              )
            )
              continue;
            crossings.push({
              ...hit,
              first: trail.id,
              second: other.id,
              time,
              seed: (b.time + d.time) * 0.001,
              strength:
                Math.sqrt(b.strength * c.strength) *
                hit.energy *
                (1 - (time - c.time) / WAKE_LIFETIME),
            });
            if (crossings.length > MAX_CROSSINGS) crossings.shift();
          }
        }
      }
    },
  };
}

export function sampleWakeCrossing(event, time, reducedMotion = false) {
  const age = clamp((time - event.time) / CROSSING_LIFETIME, 0, 1);
  const motion = reducedMotion ? 0.28 : age;
  return {
    radius: 7 + Math.sqrt(motion) * 46,
    breakup: motion,
    alpha:
      clamp((time - event.time) / 180, 0, 1) *
      (1 - age) ** 1.8 *
      event.strength,
    foam: (1 - age) ** 4 * event.strength,
  };
}

// Break the original ribbons locally as the intersecting crests shed ripples.
export function wakeDisruption(point, crossings, time, worldWidth) {
  let disruption = 0;
  for (const event of crossings) {
    const age = (time - event.time) / CROSSING_LIFETIME;
    if (age < 0 || age >= 1) continue;
    const distance = wrappedDistance(
      point.x,
      point.y,
      event.x,
      event.y,
      worldWidth,
    );
    disruption = Math.max(
      disruption,
      clamp(1 - distance / 46, 0, 1) *
        Math.min(1, age * 10) *
        (1 - age) *
        event.strength,
    );
  }
  return disruption;
}
