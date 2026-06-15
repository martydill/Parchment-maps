import { clamp, normalizeAngle } from "./math.js";

const BASE_WORLD_SPEED = 175;

export function hullSpeedKnots(waterlineLengthFt) {
  return 1.34 * Math.sqrt(Math.max(0, waterlineLengthFt));
}

export function shipSpeedKnots(worldSpeed, waterlineLengthFt) {
  return (
    (Math.abs(worldSpeed) / BASE_WORLD_SPEED) *
    hullSpeedKnots(waterlineLengthFt)
  );
}

export function readSailingInput(keys, input, currentAngle) {
  let dx = input.x;
  let dy = input.y;
  let power = input.power;
  let keyboardX = 0;
  let keyboardY = 0;

  if (keys.has("arrowleft") || keys.has("a")) keyboardX--;
  if (keys.has("arrowright") || keys.has("d")) keyboardX++;
  if (keys.has("arrowup") || keys.has("w")) keyboardY--;
  if (keys.has("arrowdown") || keys.has("s")) keyboardY++;

  const keyboardActive = keyboardX !== 0 || keyboardY !== 0;
  if (keyboardActive) {
    const length = Math.hypot(keyboardX, keyboardY);
    dx = keyboardX / length;
    dy = keyboardY / length;
    power = 1;
  }

  if (power < 0.14) {
    return {
      active: false,
      desiredAngle: currentAngle,
      power: 0,
      keyboardActive,
    };
  }
  return {
    active: true,
    desiredAngle: Math.atan2(dy, dx),
    power: Math.min(1, power),
    keyboardActive,
  };
}

export function edgeInwardVector(y, worldHeight, recoveryZone) {
  let inwardY = 0;
  let strength = 0;
  if (y < recoveryZone) {
    const topStrength = (recoveryZone - y) / recoveryZone;
    inwardY += topStrength;
    strength = Math.max(strength, topStrength);
  }
  if (y > worldHeight - recoveryZone) {
    const bottomStrength = (y - (worldHeight - recoveryZone)) / recoveryZone;
    inwardY -= bottomStrength;
    strength = Math.max(strength, bottomStrength);
  }
  return {
    x: 0,
    y: inwardY ? Math.sign(inwardY) : 0,
    strength: clamp(strength, 0, 1),
  };
}

export function limitOutwardWind(
  windX,
  windY,
  y,
  worldHeight,
  mapMargin,
  recoveryZone,
) {
  const top = clamp((y - mapMargin) / (recoveryZone - mapMargin), 0, 1);
  const bottom = clamp(
    (worldHeight - mapMargin - y) / (recoveryZone - mapMargin),
    0,
    1,
  );
  if (windY < 0) windY *= top;
  if (windY > 0) windY *= bottom;
  return { x: windX, y: windY };
}

/**
 * Find the heading nearest to `preferAngle` whose lookahead point is open
 * water. Used to recover a ship that has nosed into the shallows: rather than
 * freezing it against the coast (where wind drift keeps biasing the next step
 * back onto land), the caller rotates the bow toward this heading and nudges
 * the hull along it so the ship can actually get back to open water.
 *
 * Headings are sampled in order of increasing angular distance from the
 * preferred angle, so a player pointing at a clear gap keeps it. If nothing is
 * open at the first lookahead, shorter lookaheads are tried so a ship wedged
 * tight against a concave coast can still find the way out. Returns
 * `preferAngle` unchanged only when every sample is blocked (a fully boxed-in
 * position, which the coastline data does not produce).
 */
export function nearestOpenHeading({
  x,
  y,
  preferAngle = 0,
  isOpen,
  lookaheads = [40, 22, 10],
  steps = 24,
}) {
  const step = (Math.PI * 2) / steps;
  const offsets = [0];
  for (let i = 1; i <= steps / 2; i++) offsets.push(i, -i);
  for (const lookahead of lookaheads) {
    let best = null;
    let bestDelta = Infinity;
    for (const off of offsets) {
      const angle = preferAngle + off * step;
      if (
        isOpen(x + Math.cos(angle) * lookahead, y + Math.sin(angle) * lookahead)
      ) {
        const delta = Math.abs(normalizeAngle(angle - preferAngle));
        if (delta < bestDelta) {
          bestDelta = delta;
          best = angle;
        }
      }
    }
    if (best !== null) return best;
  }
  return preferAngle;
}

/**
 * Recover a ship that has nosed into the shallows. Given the hull's current
 * (open-water) position and the blocked step it was about to take, return an
 * open-water heading to point the bow at and a position with clear water ahead.
 *
 * The heading is the nearest open heading off the seaward normal — the
 * direction back from the blocked point toward the hull — so it pushes the ship
 * off a straight coast and threads it out of a bay instead of grinding along
 * the shore. The hull is then marched along that heading until it has
 * `standoff` pixels of open water ahead, which is what keeps wind drift on the
 * next open-water frame from immediately pushing it back onto the coast.
 */
export function recoverFromShallows({
  x,
  y,
  blockedX,
  blockedY,
  isOpen,
  standoff = 24,
  step = 8,
  maxSteps = 14,
}) {
  const seaward = Math.atan2(y - blockedY, x - blockedX);
  const heading = nearestOpenHeading({ x, y, preferAngle: seaward, isOpen });
  const hx = Math.cos(heading);
  const hy = Math.sin(heading);
  let recoveredX = x;
  let recoveredY = y;
  for (let i = 0; i < maxSteps; i++) {
    // Require clear water both ahead and astern along the sailing axis. "Astern"
    // is the landward side, so this is what pushes the hull off a straight coast
    // with real standoff — without it, wind drift re-blocks the waterline every
    // frame and the ship can never build the speed to pull away.
    const aheadOpen = isOpen(
      recoveredX + hx * standoff,
      recoveredY + hy * standoff,
    );
    const asternOpen = isOpen(
      recoveredX - hx * standoff,
      recoveredY - hy * standoff,
    );
    if (aheadOpen && asternOpen) break;
    recoveredX += hx * step;
    recoveredY += hy * step;
  }
  return { x: recoveredX, y: recoveredY, heading };
}
