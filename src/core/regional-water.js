import { clamp, nearestWrapped, wrappedDistance } from "./math.js";
import { rayIntersectsBounds, raySegmentDistance } from "./geometry.js";
import { seasonAtDay, seasonalSeaPalette, mixSeasonColor } from "./seasons.js";

const REACH = 320;
const bearings = Array.from({ length: 12 }, (_, index) => {
  const angle = (index * Math.PI) / 6;
  return { x: Math.cos(angle), y: Math.sin(angle), angle };
});
const ease = (value) => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

// Sample the actual generated coastline, rather than fixed named rectangles.
// The renderer caches this static result on each canonical wave mark.
export function createRegionalWaterSampler({ world, lands, currents = [] }) {
  const coasts = lands.map(({ poly }) => ({
    poly,
    bounds: {
      left: Math.min(...poly.map(([x]) => x)),
      right: Math.max(...poly.map(([x]) => x)),
      top: Math.min(...poly.map(([, y]) => y)),
      bottom: Math.max(...poly.map(([, y]) => y)),
    },
  }));
  return (x, y) => {
    const nearby = coasts.flatMap(({ poly, bounds }) => {
      const center = (bounds.left + bounds.right) / 2;
      const offset = nearestWrapped(center, x, world.w) - center;
      return x + REACH < bounds.left + offset ||
        x - REACH > bounds.right + offset ||
        y + REACH < bounds.top ||
        y - REACH > bounds.bottom
        ? []
        : [{ poly, bounds, px: x - offset }];
    });
    const walls = bearings.map(({ x: dx, y: dy }) => {
      let distance = REACH;
      for (const { poly, bounds, px } of nearby) {
        if (!rayIntersectsBounds(px, y, dx, dy, bounds, REACH)) continue;
        for (let index = 0; index < poly.length; index++) {
          const a = poly[index],
            b = poly[(index + 1) % poly.length];
          const hit = raySegmentDistance(px, y, dx, dy, ...a, ...b, REACH);
          if (hit !== null) distance = Math.min(distance, hit);
        }
      }
      return ease(1 - distance / REACH);
    });
    let channel = 0,
      angle = 0;
    for (let index = 0; index < 6; index++) {
      // Two opposing shores with open water in BOTH directions form a
      // channel. A closed bay has only one mouth and remains quiet.
      const across = Math.sqrt(walls[index] * walls[index + 6]);
      const along =
        1 - Math.max(walls[(index + 3) % 12], walls[(index + 9) % 12]);
      const strength = across * along;
      if (strength > channel) {
        channel = strength;
        angle = bearings[index].angle + Math.PI / 2;
      }
    }
    const enclosure = walls.reduce((sum, wall) => sum + wall, 0) / 12;
    const shelter = ease((enclosure - 0.16) / 0.42) * (1 - channel);
    for (const [cx, cy, direction] of currents) {
      const strength =
        ease(1 - wrappedDistance(x, y, cx, cy, world.w) / REACH) *
        (1 - shelter);
      if (strength > channel) {
        channel = strength;
        angle = direction;
      }
    }
    // North is geographic and persists through summer; winter strengthens
    // its sparse silver ink without turning every temperate sea into a fjord.
    return {
      shelter,
      channel,
      angle,
      north: ease((0.22 - y / world.h) / 0.14),
    };
  };
}

export function regionalWaveProfile({ shelter, channel, north }, day = 1) {
  const [, summer, autumn, winter] = seasonAtDay(day).weights;
  return {
    length:
      (1 + shelter * 0.55 - channel * 0.3 - north * 0.3) * (1 + autumn * 0.08),
    amplitude: Math.max(
      0.12,
      (1 - shelter * 0.82 + channel * 0.6 - north * 0.5) * (1 + autumn * 0.12),
    ),
    speed: Math.max(
      0.18,
      (1 - shelter * 0.62 + channel * 0.65 - north * 0.32) *
        (1 - summer * 0.12 + autumn * 0.15),
    ),
    density: Math.max(0.18, 1 - shelter * 0.35 - north * (0.55 + winter * 0.1)),
    contrast: 1 - shelter * 0.48 + channel * 0.35 - north * 0.3,
    crestThreshold: 0.65 + shelter * 0.3 + north * 0.13 - channel * 0.13,
  };
}

export function regionalWaterInk(day = 1) {
  const [, , autumn, winter] = seasonAtDay(day).weights;
  const rgb = (hex) =>
    [1, 3, 5]
      .map((offset) => parseInt(hex.slice(offset, offset + 2), 16))
      .join(",");
  return {
    shadow: rgb(
      mixSeasonColor(
        "#25514e",
        seasonalSeaPalette(day)[2],
        (autumn + winter) * 0.4,
      ),
    ),
    glint: rgb(
      mixSeasonColor(
        mixSeasonColor("#f7edc5", "#efd7ad", autumn * 0.6),
        "#e0edf2",
        winter * 0.75,
      ),
    ),
    silver: rgb(mixSeasonColor("#dce9ef", "#f4f8fb", winter * 0.65)),
  };
}
