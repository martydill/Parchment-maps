import { clamp, wrappedDelta } from "./math.js";
import { nearestOpenHeading } from "./sailing.js";

export function createSeaRaidState() {
  return { raider: null, checkedThisVoyage: false };
}

export function normalizeSeaRaidState(value) {
  const fresh = createSeaRaidState();
  if (!value || typeof value !== "object") return fresh;
  const raider = value.raider;
  const validRaider =
    raider &&
    ["patrol", "chase"].includes(raider.mode) &&
    [raider.x, raider.y, raider.angle, raider.seed].every(Number.isFinite);
  return {
    checkedThisVoyage: Boolean(value.checkedThisVoyage),
    raider: validRaider
      ? {
          x: raider.x,
          y: raider.y,
          angle: raider.angle,
          seed: raider.seed,
          attackStrength: clamp(Math.floor(raider.attackStrength || 1), 1, 3),
          mode: raider.mode,
        }
      : null,
  };
}

export function raidChance({ risk = 0.2, cargoValue = 0, deterrence = 1 }) {
  return clamp((0.12 + risk * 1.15 + cargoValue / 600) * deterrence, 0.08, 0.7);
}

export function spawnRaider({
  player,
  worldWidth,
  isOpen,
  seed,
  attackStrength = 1,
}) {
  const side = Math.sin(seed * 2.31) >= 0 ? 1 : -1;
  const forward = { x: Math.cos(player.angle), y: Math.sin(player.angle) };
  const cross = { x: -forward.y, y: forward.x };
  for (const lateral of [side * 110, -side * 110, side * 210, -side * 210, 0]) {
    const x = player.x + forward.x * 760 + cross.x * lateral;
    const y = player.y + forward.y * 760 + cross.y * lateral;
    if (!isOpen(x, y)) continue;
    const towardPlayer = Math.atan2(
      player.y - y,
      wrappedDelta(player.x, x, worldWidth),
    );
    return {
      x,
      y,
      angle: towardPlayer,
      seed,
      attackStrength: clamp(Math.floor(attackStrength), 1, 3),
      mode: "patrol",
    };
  }
  return null;
}

export function advanceRaider({
  raider,
  player,
  dt,
  worldWidth,
  sightRange,
  hasSight,
  isOpen,
}) {
  const next = { ...raider };
  const dx = wrappedDelta(player.x, next.x, worldWidth);
  const dy = player.y - next.y;
  const distance = Math.hypot(dx, dy);
  let event = null;
  if (next.mode === "patrol" && distance <= sightRange && hasSight) {
    next.mode = "chase";
    event = "spotted";
  }
  if (next.mode === "chase") {
    if (distance <= 34) return { raider: null, event: "caught" };
    if (distance > 600) return { raider: null, event: "escaped" };
    const target = Math.atan2(dy, dx);
    const turn = Math.atan2(
      Math.sin(target - next.angle),
      Math.cos(target - next.angle),
    );
    next.angle += clamp(turn, -2.2 * dt, 2.2 * dt);
  } else if (distance > 1150) {
    return { raider: null, event: "passed" };
  }
  const speed = next.mode === "chase" ? 118 : 44;
  const heading = nearestOpenHeading({
    x: next.x,
    y: next.y,
    preferAngle: next.angle,
    isOpen,
    lookaheads: [speed * dt + 20, speed * dt + 8],
  });
  next.angle = heading;
  const x = next.x + Math.cos(heading) * speed * dt;
  const y = next.y + Math.sin(heading) * speed * dt;
  if (isOpen(x, y)) {
    next.x = x;
    next.y = y;
  }
  return { raider: next, event };
}
