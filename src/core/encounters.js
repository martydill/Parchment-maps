import { clamp, nearestWrapped } from "./math.js";

export const ENCOUNTER_DURATION = 2.6;
export const ENCOUNTER_COOLDOWN = 45;

const smooth = (value) => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

// Presentation state is deliberately transient: a save never resumes midway
// through a camera move, and the pursuit remains owned by the raider system.
export function createEncounterState() {
  return { active: null, seen: new Set(), cooldown: 0 };
}

export function beginEncounter(state, encounter, camera) {
  const preview = encounter.preview === true;
  if (
    !["raider", "whale", "monster"].includes(encounter.kind) ||
    !encounter.id ||
    !encounter.name ||
    ![encounter.x, encounter.y].every(Number.isFinite) ||
    (!preview && state.seen.has(encounter.id))
  )
    return false;
  const danger = encounter.kind === "raider";
  if (
    (state.active && (!danger || state.active.kind === "raider")) ||
    (!preview && !danger && state.cooldown > 0)
  )
    return false;
  state.active = { ...encounter, elapsed: 0, origin: { ...camera } };
  if (!preview) {
    state.seen.add(encounter.id);
    state.cooldown = ENCOUNTER_COOLDOWN;
  }
  return true;
}

export function encounterFrame(elapsed, reducedMotion = false) {
  const t = Math.max(0, elapsed);
  const duration = reducedMotion ? 0.9 : ENCOUNTER_DURATION;
  const complete = t >= duration;
  const entrance = reducedMotion ? 1 : smooth(t / 0.25);
  const exit = smooth((t - (duration - 0.55)) / 0.55);
  const focus = reducedMotion ? 0 : smooth(t / 0.65) * (1 - exit);
  return {
    complete,
    bars: complete ? 0 : reducedMotion ? 1 : entrance * (1 - exit),
    banner: complete
      ? 0
      : reducedMotion
        ? 1
        : smooth((t - 0.12) / 0.3) * (1 - exit),
    focus,
    zoom: 1 + focus * 0.9,
    timeScale: reducedMotion || complete ? 1 : 1 - entrance * (1 - exit) * 0.88,
  };
}

export function advanceEncounter(state, dt, reducedMotion = false) {
  const step = Number.isFinite(dt) ? Math.max(0, dt) : 0;
  state.cooldown = Math.max(0, state.cooldown - step);
  if (!state.active) return encounterFrame(ENCOUNTER_DURATION);
  state.active.elapsed += step;
  const frame = encounterFrame(state.active.elapsed, reducedMotion);
  if (frame.complete) state.active = null;
  return frame;
}

export function encounterCamera(active, frame, home, worldWidth) {
  const returning = active.elapsed > ENCOUNTER_DURATION - 0.55;
  const origin = returning ? home : active.origin;
  const targetX = nearestWrapped(active.x, origin.x, worldWidth);
  return {
    x: origin.x + (targetX - origin.x) * frame.focus,
    y: origin.y + (active.y - origin.y) * frame.focus,
    zoom: home.zoom * frame.zoom,
  };
}

export function creatureEncounter(index, [x, y], appearance) {
  // Dolphins are ambient; whales and the ominous dorsal fins get an entrance.
  if (index % 3 === 1 || appearance.rise < 0.65) return null;
  const whale = index % 3 === 0;
  return {
    id: `creature:${index}`,
    kind: whale ? "whale" : "monster",
    name: whale ? "The great whale" : "The deepwater leviathan",
    caption: whale
      ? "A wonder of the open sea"
      : "Something stirs beneath the waves",
    x,
    y,
    index,
  };
}
