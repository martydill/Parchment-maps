import { clamp } from "./math.js";

// Damage states translate persisted component condition into presentation
// numbers. Everything here is deterministic: the same vessel, damage, and day
// always produce the same pose, tears, flecks, and patches.

// Component damage below these fractions leaves no visible trace; above them
// each effect ramps toward full strength across the matching range.
export const DAMAGE_TEAR_THRESHOLD = 0.3;
export const DAMAGE_TEAR_RANGE = 0.45;
export const DAMAGE_SPLINTER_THRESHOLD = 0.18;
export const DAMAGE_SPLINTER_RANGE = 0.5;
export const DAMAGE_SMOKE_THRESHOLD = 0.72;
export const DAMAGE_SMOKE_RANGE = 0.23;
export const DAMAGE_MAX_HEEL = 0.15;
export const DAMAGE_MAX_SETTLE = 1.8;

// Fresh canvas patches fade out over this many days after a repair.
export const REPAIR_PATCH_DAYS = 8;

// Thin critical smoke. Times are seconds of rendered animation time.
export const SMOKE_PUFF_LIFE = 3.4;
export const SMOKE_SPAWN_INTERVAL = 0.2;
export const SMOKE_MAX_PUFFS = 16;
export const SMOKE_RISE = 6.5;
export const SMOKE_DRIFT = 26;

// One deterministic 0..1 noise value per seed pair.
export function damageNoise(seed, salt = 0) {
  const value =
    Math.sin(
      (Number(seed || 0) * 127 + Number(salt || 0) * 311 + 7) * 12.9898,
    ) * 43758.5453;
  return value - Math.floor(value);
}

function damageFraction(operations, key) {
  const condition = Number(operations?.components?.[key]);
  if (!Number.isFinite(condition)) return 0;
  return clamp((100 - clamp(condition, 0, 100)) / 100, 0, 1);
}

// A crippled hull lists to one deterministic side and settles into the water.
export function damageHeel(hullDamage, seed = 0) {
  if (!(hullDamage > 0)) return 0;
  const side = damageNoise(seed, 11) < 0.5 ? -1 : 1;
  return side * DAMAGE_MAX_HEEL * Math.pow(clamp(hullDamage, 0, 1), 0.9);
}

export function repairPatchFreshness(patchedDay, day) {
  const patched = Math.floor(Number(patchedDay) || 0);
  if (patched <= 0) return 0;
  const now = Math.floor(Number(day) || 0);
  return clamp(1 - (now - patched) / REPAIR_PATCH_DAYS, 0, 1);
}

// The full presentation descriptor for one vessel, or null while undamaged.
export function shipDamageVisuals(operations, { seed = 0, day = 0 } = {}) {
  const hull = damageFraction(operations, "hull");
  const rigging = damageFraction(operations, "rigging");
  const tear = clamp(
    (rigging - DAMAGE_TEAR_THRESHOLD) / DAMAGE_TEAR_RANGE,
    0,
    1,
  );
  const splinters = clamp(
    (hull - DAMAGE_SPLINTER_THRESHOLD) / DAMAGE_SPLINTER_RANGE,
    0,
    1,
  );
  const smoke = clamp(
    (hull - DAMAGE_SMOKE_THRESHOLD) / DAMAGE_SMOKE_RANGE,
    0,
    1,
  );
  const heel = damageHeel(hull, seed);
  const settle = hull > 0 ? DAMAGE_MAX_SETTLE * hull : 0;
  const patchedDay = Math.floor(Number(operations?.patchedDay) || 0);
  const patch = repairPatchFreshness(patchedDay, day);
  if (!tear && !splinters && !smoke && !heel && !settle && !patch) return null;
  return {
    hull,
    rigging,
    tear,
    splinters,
    smoke,
    heel,
    settle,
    patch,
    patchedDay,
  };
}

// --- Torn sails -----------------------------------------------------------------

// Cloth triangles subdivide into this many cells per side, so a tear removes
// whole small triangles and the sky shows through the gaps.
export const SAIL_TEAR_GRID = 4;

// Lattice cells of one cloth triangle in (u, v) barycentric space, u right
// along the first edge and v along the second. Up cells tile with down cells.
export function sailClothCells(grid = SAIL_TEAR_GRID) {
  const cells = [];
  const size = Math.max(1, Math.floor(grid));
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      if (i + j >= size) continue;
      cells.push({
        points: [
          [i, j],
          [i + 1, j],
          [i, j + 1],
        ],
      });
      if (i + j < size - 1)
        cells.push({
          points: [
            [i + 1, j],
            [i, j + 1],
            [i + 1, j + 1],
          ],
        });
    }
  }
  return cells;
}

// Which cloth cells a sail is missing. Tears cluster around one or two
// deterministic rip centers so holes read as rips rather than dithering.
export function sailTornCells(seed, tear, grid = SAIL_TEAR_GRID) {
  const torn = new Set();
  if (!(tear > 0)) return torn;
  const ripCount = tear >= 0.55 ? 2 : 1;
  const rips = [];
  for (let index = 0; index < ripCount; index++) {
    // Barycentric (u, v) covers a triangle, so pull sampled centers back
    // inside the u + v < 1 edge before measuring cell distances.
    let u = 0.2 + damageNoise(seed, 40 + index) * 0.6;
    let v = 0.2 + damageNoise(seed, 60 + index) * 0.6;
    const reach = u + v;
    if (reach > 0.92) {
      u = (u / reach) * 0.92;
      v = (v / reach) * 0.92;
    }
    rips.push({
      u,
      v,
      // Even a fully shredded sail keeps ragged cloth: cap the rip well short
      // of the whole panel so the holes read as tears, not bare yards.
      radius: Math.min(
        0.3,
        (0.12 + 0.2 * tear) * (0.8 + damageNoise(seed, 80 + index) * 0.4),
      ),
    });
  }
  const cells = sailClothCells(grid);
  cells.forEach((cell, index) => {
    const center = cell.points
      .reduce((sum, [u, v]) => [sum[0] + u, sum[1] + v], [0, 0])
      .map((value) => value / 3 / grid);
    for (const rip of rips) {
      if (Math.hypot(center[0] - rip.u, center[1] - rip.v) <= rip.radius) {
        torn.add(index);
        break;
      }
    }
  });
  return torn;
}

// Ragged thread edges: lattice segments where kept cloth meets a torn cell.
export function sailTearLayout(seed, tear, grid = SAIL_TEAR_GRID) {
  const cells = sailClothCells(grid);
  const torn = sailTornCells(seed, tear, grid);
  if (!torn.size) return { cells, torn, fringes: [] };
  const owners = new Map();
  cells.forEach((cell, index) => {
    for (let edge = 0; edge < 3; edge++) {
      const a = cell.points[edge];
      const b = cell.points[(edge + 1) % 3];
      const key =
        a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])
          ? `${a[0]},${a[1]}|${b[0]},${b[1]}`
          : `${b[0]},${b[1]}|${a[0]},${a[1]}`;
      if (!owners.has(key)) owners.set(key, []);
      owners.get(key).push(index);
    }
  });
  const fringes = [];
  for (const [key, indices] of owners) {
    if (indices.length !== 2) continue;
    const [first, second] = indices;
    if (torn.has(first) === torn.has(second)) continue;
    fringes.push(
      key
        .split("|")
        .map((point) => point.split(",").map((value) => Number(value))),
    );
  }
  return { cells, torn, fringes };
}

// --- Splinter flecks ------------------------------------------------------------

// Wood chips floating in the water around a holed hull. Positions are
// deterministic; the renderer streams them slowly aft with animation time.
export function splinterFlecks(seed, splinters, count = 14) {
  const total = Math.round(count * clamp(splinters, 0, 1));
  const flecks = [];
  for (let index = 0; index < total; index++) {
    flecks.push({
      side: damageNoise(seed, 100 + index) < 0.5 ? -1 : 1,
      along: damageNoise(seed, 120 + index) - 0.5,
      athwart: 0.55 + damageNoise(seed, 140 + index) * 0.75,
      phase: damageNoise(seed, 160 + index),
      spin: damageNoise(seed, 180 + index) * Math.PI * 2,
      size: 0.35 + damageNoise(seed, 200 + index) * 0.75,
      fresh: damageNoise(seed, 220 + index) < 0.4,
    });
  }
  return flecks;
}

// --- Critical smoke trail -------------------------------------------------------

export function createSmokeTrail() {
  return { puffs: [], sinceSpawn: SMOKE_SPAWN_INTERVAL, lastTime: null };
}

// Advance one vessel's trail and return the live puffs. Puff positions are
// absolute world coordinates; callers resolve them against the ship when
// drawing so a wrapping world never stretches the trail.
export function updateSmokeTrail(trail, { x = 0, y = 0, smoke = 0, time = 0 }) {
  if (!trail) return [];
  const now = Number(time) || 0;
  if (trail.lastTime === null || now < trail.lastTime)
    trail.sinceSpawn = SMOKE_SPAWN_INTERVAL;
  const dt = trail.lastTime === null ? 0 : clamp(now - trail.lastTime, 0, 0.25);
  trail.lastTime = now;
  if (smoke > 0) {
    trail.sinceSpawn += dt;
    while (
      trail.sinceSpawn >= SMOKE_SPAWN_INTERVAL &&
      trail.puffs.length < SMOKE_MAX_PUFFS
    ) {
      trail.sinceSpawn -= SMOKE_SPAWN_INTERVAL;
      trail.puffs.push({
        x: Number(x) || 0,
        y: Number(y) || 0,
        born: now - trail.sinceSpawn,
        strength: clamp(0.55 + smoke * 0.45, 0, 1),
        seed: Math.floor(now * 61) % 997,
      });
    }
    // Stay pinned at one interval while the cap holds, so expiring puffs
    // release exactly one fresh puff rather than a stored-up burst.
    trail.sinceSpawn = Math.min(trail.sinceSpawn, SMOKE_SPAWN_INTERVAL);
  } else {
    trail.sinceSpawn = Math.min(trail.sinceSpawn + dt, SMOKE_SPAWN_INTERVAL);
  }
  while (trail.puffs.length && now - trail.puffs[0].born > SMOKE_PUFF_LIFE)
    trail.puffs.shift();
  return trail.puffs;
}

// Presentation numbers for one puff: where it has drifted, how high it has
// climbed, and how much of it is still visible.
export function smokePuffRender(
  puff,
  { time = 0, windAngle = 0, windStrength = 0 } = {},
) {
  const age = clamp((Number(time) || 0) - puff.born, 0, SMOKE_PUFF_LIFE);
  // Ramp in quickly, then hold most of the puff's life before thinning out,
  // so the trailing plume stays visible away from the hull.
  const fade = Math.min(1, age / 0.35) * (1 - age / SMOKE_PUFF_LIFE);
  const drift = (5 + SMOKE_DRIFT * clamp(windStrength, 0, 1)) * age;
  return {
    x: puff.x + Math.cos(windAngle) * drift,
    y: puff.y + Math.sin(windAngle) * drift,
    z: age * SMOKE_RISE,
    radius: 1.5 + age * 3.7,
    alpha: 0.46 * clamp(fade, 0, 1) * puff.strength,
  };
}
