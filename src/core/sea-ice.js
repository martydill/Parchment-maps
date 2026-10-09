import { clamp, nearestWrapped, wrap, wrappedDistance } from "./math.js";
import { seasonAtDay } from "./seasons.js";

export function seaIceStrength(day, biome = "temperate") {
  if (["tropical", "arid", "volcanic"].includes(biome)) return 0;
  const { id, dayOfSeason } = seasonAtDay(day);
  if (id !== "winter") return 0;
  // Freeze in the first week, pack ice in the middle fortnight, then thaw.
  const cold = clamp(
    Math.min((dayOfSeason - 2) / 5, (24 - dayOfSeason) / 7),
    0,
    1,
  );
  return cold * (biome === "alpine" ? 1 : biome === "marsh" ? 0.65 : 0.8);
}

export function seaIceCoastClear(x, y, coastlines, worldWidth, clearance = 65) {
  for (const poly of coastlines) {
    for (let i = 0; i < poly.length; i++) {
      const [ax, ay] = poly[i];
      const [bx, by] = poly[(i + 1) % poly.length];
      const px = nearestWrapped(x, (ax + bx) / 2, worldWidth);
      const dx = bx - ax,
        dy = by - ay;
      const t = clamp(
        ((px - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1),
        0,
        1,
      );
      if (Math.hypot(px - ax - t * dx, y - ay - t * dy) < clearance)
        return false;
    }
  }
  return true;
}

export function planSeaIce({
  world,
  isOnLand,
  biomeAt,
  ports = [],
  coastlines = [],
}) {
  const floes = [];
  // A few small rafts of broken ice leave most of the ocean open. Use a
  // coarse, periodic patch grid rather than filling every cold-water cell.
  const columns = Math.ceil(world.w / 550);
  const spacing = world.w / columns;
  for (let row = 0; row < Math.ceil(world.h / 550); row++) {
    for (let column = 0; column < columns; column++) {
      const patch = column * 17 + row * 31;
      const centerX = wrap(
        (column + 0.5) * spacing + Math.sin(patch) * 90,
        world.w,
      );
      const centerY =
        (row + 0.5) * (world.h / Math.ceil(world.h / 550)) +
        Math.sin(patch * 1.7) * 70;
      const biome = biomeAt(centerX, centerY);
      if (!seaIceStrength(83, biome)) continue;
      const selection =
        (((Math.sin(patch * 12.9898) * 43758.5453) % 1) + 1) % 1;
      if (selection >= (biome === "alpine" ? 0.4 : 0.16)) continue;
      for (let piece = 0; piece < 3; piece++) {
        const seed = patch * 3 + piece;
        const angle = piece * 2.4 + patch;
        const radius = 32 + piece * 13;
        const x = wrap(centerX + Math.cos(angle) * radius, world.w);
        const y = centerY + Math.sin(angle) * radius;
        if (y < 65 || y > world.h - 65) continue;
        if (
          ports.some(
            (port) => wrappedDistance(x, y, port.x, port.y, world.w) < 120,
          )
        )
          continue;
        // Reserve room for the full floe and its bounded drift, including the
        // wrap seam. A field cannot drift onto a coast or block a harbor berth.
        let clear = !isOnLand(x, y);
        if (clear) clear = seaIceCoastClear(x, y, coastlines, world.w);
        for (let sample = 0; sample < 12 && clear; sample++) {
          const angle = (sample * Math.PI) / 6;
          clear = !isOnLand(x + Math.cos(angle) * 65, y + Math.sin(angle) * 65);
        }
        if (clear) floes.push({ x, y, biome, seed, radius: 10 + (seed % 13) });
      }
    }
  }
  return floes;
}

export function seaIceFloe(floe, day, time, worldWidth) {
  const strength = seaIceStrength(day, floe.biome);
  const phase = (time / 1000) * 0.025 + floe.seed;
  return {
    ...floe,
    x: wrap(floe.x + Math.sin(phase) * 18, worldWidth),
    y: floe.y + Math.cos(phase * 0.7) * 12,
    angle: Math.sin(phase * 0.4) * 0.25,
    strength,
    radius: floe.radius * Math.sqrt(strength),
  };
}

export function seaIceAtPosition(position, floes, day, time, worldWidth) {
  if (!seaIceStrength(day, "alpine"))
    return { exposure: 0, speedMultiplier: 1 };
  let exposure = 0;
  for (const source of floes) {
    const floe = seaIceFloe(source, day, time, worldWidth);
    if (floe.radius <= 0) continue;
    const distance = wrappedDistance(
      position.x,
      position.y,
      floe.x,
      floe.y,
      worldWidth,
    );
    exposure = Math.max(
      exposure,
      clamp(1 - distance / (floe.radius + 10), 0, 1) * floe.strength,
    );
  }
  return { exposure, speedMultiplier: 1 - exposure * 0.72 };
}

export function seaIceSpeed(speed, maxSpeed, ice, seconds) {
  const drag = Math.exp(-ice.exposure * 2.6 * Math.max(0, seconds));
  return Math.max(0, Math.min(maxSpeed * ice.speedMultiplier, speed * drag));
}
