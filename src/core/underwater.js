import { createWrappedPolygonLookup } from "./geometry.js";
import { clamp, nearestWrapped, wrap } from "./math.js";

export function underwaterNoise(index, salt = 0) {
  const n = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

// These are scenery, not discoveries or navigational hazards. Derive them from
// the chart so old saves, reloads, and neighboring copies share one seabed.
export function planUnderwaterSites(world, lands, shoals = []) {
  if (world.w <= 0 || world.h <= 0) return [];
  const onLand = createWrappedPolygonLookup(
    lands.map(({ poly }) => poly),
    world.w,
  );
  const sites = [];
  const kinds = ["reef", "kelp", "reef", "wreck", "kelp", "reef", "ruins"];
  function add(x, y, seed, kind, radius) {
    x = wrap(x, world.w);
    if (y < radius || y > world.h - radius || onLand(x, y)) return;
    if (
      sites.some(
        (site) =>
          Math.hypot(nearestWrapped(site.x, x, world.w) - x, site.y - y) <
          (site.radius + radius) * 0.8,
      )
    )
      return;
    sites.push({
      x,
      y,
      seed,
      kind,
      radius,
      angle: underwaterNoise(seed, 7) * Math.PI * 2,
      depth: 0.25 + underwaterNoise(seed, 8) * 0.65,
    });
  }
  lands.forEach(({ poly }, island) => {
    let area = 0;
    let perimeter = 0;
    const edges = poly.map(([x, y], i) => {
      const [bx, by] = poly[(i + 1) % poly.length];
      area += x * by - bx * y;
      const length = Math.hypot(bx - x, by - y);
      perimeter += length;
      return { x, y, dx: bx - x, dy: by - y, length };
    });
    const facing = Math.sign(area) || 1;
    const spacing = Math.max(155, perimeter / 18);
    let next = spacing * 0.4;
    let traveled = 0;
    let mark = 0;
    for (const edge of edges) {
      while (edge.length > 0 && next < traveled + edge.length) {
        const seed = island * 101 + mark++;
        const t = (next - traveled) / edge.length;
        const setback = 48 + underwaterNoise(seed, 1) * 44;
        add(
          edge.x + edge.dx * t + (facing * edge.dy * setback) / edge.length,
          edge.y + edge.dy * t - (facing * edge.dx * setback) / edge.length,
          seed,
          kinds[(island * 3 + mark) % kinds.length],
          43 + underwaterNoise(seed, 2) * 26,
        );
        next += spacing;
      }
      traveled += edge.length;
    }
  });
  shoals.forEach(([x, y, rx, ry], i) => {
    for (let j = 0; j < 3; j++) {
      const seed = 10000 + i * 3 + j;
      add(
        x + (j - 1) * rx * 0.43,
        y + Math.sin(i + j * 2.4) * ry * 0.28,
        seed,
        j === 1 ? kinds[(i + 3) % kinds.length] : "reef",
        clamp(Math.min(rx, ry) * 0.62, 30, 72),
      );
    }
  });
  return sites;
}

// Local, slowly traveling windows of clarity reveal only parts of an object.
// Longitude uses whole periods so refraction agrees across the map seam.
export function sampleUnderwaterVeil(
  site,
  localY,
  time,
  worldWidth,
  { lighting = {}, roughness = 0, reducedMotion = false } = {},
) {
  const seconds = reducedMotion ? 0 : time / 1000;
  const longitude = (wrap(site.x, worldWidth) / worldWidth) * Math.PI * 2;
  const phase = longitude * 19 + site.seed * 1.73;
  const wave =
    Math.sin(localY * 0.073 + phase - seconds * 0.43) * 0.68 +
    Math.sin(localY * 0.129 - phase * 0.7 + seconds * 0.29) * 0.32;
  const clarity = clamp((wave + 0.32) / 1.12, 0, 1);
  const light =
    (lighting.daylight ?? 1) * 0.94 +
    (lighting.night ?? 0) * (lighting.moon ?? 0.32) * 0.2;
  const transmission =
    (1 - clamp(roughness, 0, 1) * 0.72) *
    (1 - clamp(lighting.storm ?? 0, 0, 1) * 0.76);
  return {
    alpha:
      (0.035 + clarity * clarity * 0.25) *
      (1 - site.depth * 0.48) *
      light *
      transmission,
    shift:
      (Math.sin(localY * 0.095 + phase + seconds * 0.51) * 1.3 +
        Math.cos(localY * 0.041 - phase - seconds * 0.37) * 0.65) *
      (0.6 + site.depth),
  };
}
