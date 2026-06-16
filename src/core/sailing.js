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
 * The heading is searched off the seaward normal — the direction back from the
 * blocked point toward the hull — so it pushes the ship off a straight coast
 * and threads it out of a bay instead of grinding along the shore. For each
 * candidate heading (nearest to seaward first) the hull is marched along it,
 * moving only onto open-water cells, until it has `standoff` pixels of clear
 * water both ahead and astern. Astern is the landward side, so that standoff is
 * what keeps wind drift on the next open-water frame from immediately pushing
 * the hull back onto the coast.
 *
 * On a concave coast or a pinch between islands a heading may never clear
 * astern. There the march must not keep grinding past the open water onto land
 * (which traps the hull onshore for good): it takes the furthest-along open
 * cell that still has clear water ahead, so the ship can always build way on
 * the next frame. Headings are ranked by how much open water lies ahead, so
 * recovery threads out through the gap with the most sea room rather than the
 * first gap that merely looks open at one lookahead. The returned position is
 * always open water — the only way to reach the no-candidate fallback is a
 * position boxed in on every side, which the coastline data does not produce.
 */
export function recoverFromShallows({
  x,
  y,
  blockedX,
  blockedY,
  isOpen,
  standoff = 24,
  step = 6,
  maxSteps = 22,
  spread = 24,
}) {
  const seaward = Math.atan2(y - blockedY, x - blockedX);
  const angStep = (Math.PI * 2) / spread;
  const offsets = [0];
  for (let i = 1; i <= spread / 2; i++) offsets.push(i, -i);

  let best = null;
  for (const off of offsets) {
    const heading = seaward + off * angStep;
    const hx = Math.cos(heading);
    const hy = Math.sin(heading);
    let cx = x;
    let cy = y;
    let standoffMet = false;
    let lastAheadClear = null;
    for (let i = 0; i < maxSteps; i++) {
      const aheadOpen = isOpen(cx + hx * standoff, cy + hy * standoff);
      // The hull only ever sits on open cells (the start is open by contract,
      // and every advance below is gated on isOpen), so a clear-ahead sample
      // here means this cell is a valid place to leave the hull.
      if (aheadOpen) lastAheadClear = { x: cx, y: cy, i };
      const asternOpen = isOpen(cx - hx * standoff, cy - hy * standoff);
      if (aheadOpen && asternOpen) {
        standoffMet = true;
        break;
      }
      const nx = cx + hx * step;
      const ny = cy + hy * step;
      if (!isOpen(nx, ny)) break; // heading runs aground — stop before land
      cx = nx;
      cy = ny;
    }
    if (!lastAheadClear) continue; // no clear water ahead along this heading
    const candidate = { ...lastAheadClear, heading, standoffMet };
    // Prefer a heading with full standoff; break ties toward the one that
    // marched furthest through open water (the most sea room to escape into).
    if (
      !best ||
      (candidate.standoffMet && !best.standoffMet) ||
      (candidate.standoffMet === best.standoffMet && candidate.i > best.i)
    ) {
      best = candidate;
    }
  }

  if (best) return { x: best.x, y: best.y, heading: best.heading };
  // Fully boxed in: hold the current open cell and point the bow seaward so
  // thrust can try to work the hull free. Never return an on-land position.
  return { x, y, heading: seaward };
}
