import { normalizeAngle, wrappedDelta } from "./math.js";
import { segmentClear } from "./navfield.js";
import { createPassagePlanner } from "./passages.js";
import { crewReadiness, previewShoreLeave } from "./crew-readiness.js";

export const AUTOMATION_DT = 1 / 30;
export const AUTOMATION_VERSION = 1;

export function automationOptions(search) {
  const params = new URLSearchParams(search);
  const mode = params.get("automation");
  if (!mode) return null;
  if (!["step", "demo"].includes(mode))
    throw new RangeError("automation must be step or demo");
  const speed = Number(params.get("speed") ?? 1);
  if (!Number.isFinite(speed) || speed < 0.25 || speed > 32)
    throw new RangeError("speed must be between 0.25 and 32");
  const seed = params.get("seed") || "parchment-automation";
  if (seed.length > 128)
    throw new RangeError("seed must be at most 128 characters");
  const knowledge = params.get("knowledge") || "known";
  if (!["known", "all"].includes(knowledge))
    throw new RangeError("knowledge must be known or all");
  const rest = params.get("rest") || "on";
  if (!["on", "off"].includes(rest))
    throw new RangeError("rest must be on or off");
  return { mode, seed, speed, knowledge, rest };
}

export function shouldAutomationRest(
  operations,
  coins,
  day,
  contracts,
  arrivalDays,
) {
  if (!crewReadiness(operations).needsRest) return false;
  const preview = previewShoreLeave(operations, coins, day, contracts);
  if (!preview.ok || coins - preview.cost < 40) return false;
  return contracts.every(
    (contract) =>
      day +
        1 +
        (contract.destination ? arrivalDays[contract.destination] : 0) <=
      contract.deadline,
  );
}

// The simulation advances only here in automation mode. Animation frames and
// browser scheduling never become inputs to game rules.
export function createAutomationSession(options, adapter) {
  let ticks = 0;
  let running = options.mode === "demo";
  let autoplay = true;
  let error = null;
  let accumulator = 0;
  let eventSerial = 0;
  const events = [];
  const counts = {};
  const record = (type, detail) => {
    counts[type] = (counts[type] || 0) + 1;
    events.push({
      id: ++eventSerial,
      tick: ticks,
      type,
      detail: structuredClone(detail),
    });
    if (events.length > 500) events.shift();
  };
  const snapshot = () =>
    structuredClone({
      version: AUTOMATION_VERSION,
      seed: options.seed,
      mode: options.mode,
      dt: AUTOMATION_DT,
      ticks,
      seconds: ticks * AUTOMATION_DT,
      running,
      autoplay,
      error,
      counts,
      events,
      ...adapter.observe(),
    });
  const command = (action) => {
    const result = adapter.act(action);
    record(result.ok ? action.type : "rejected", { action, result });
    return structuredClone(result);
  };
  const step = (frames = 1) => {
    if (!Number.isInteger(frames) || frames < 1 || frames > 1800)
      throw new RangeError("frames must be an integer from 1 to 1800");
    if (error) throw new Error(error);
    try {
      for (let i = 0; i < frames; i++) {
        if (autoplay) {
          const action = adapter.decide(ticks * AUTOMATION_DT);
          if (action) command(action);
        }
        adapter.advance(AUTOMATION_DT, ticks * AUTOMATION_DT);
        ticks++;
      }
    } catch (cause) {
      error = String(cause.message || cause);
      running = false;
      record("error", error);
      throw cause;
    }
    return snapshot();
  };
  return Object.freeze({
    version: AUTOMATION_VERSION,
    snapshot,
    step,
    command,
    render: () => adapter.render(),
    pause() {
      running = false;
      accumulator = 0;
    },
    resume() {
      if (error) throw new Error(error);
      running = true;
    },
    setAutoplay(value) {
      if (typeof value !== "boolean")
        throw new TypeError("autoplay must be boolean");
      autoplay = value;
    },
    frame(seconds) {
      if (!running || !Number.isFinite(seconds) || seconds <= 0) return;
      accumulator += Math.min(seconds, 0.25) * options.speed;
      const frames = Math.floor((accumulator + 1e-9) / AUTOMATION_DT);
      if (frames) {
        accumulator -= frames * AUTOMATION_DT;
        step(frames);
      }
    },
  });
}

// Income per sailing distance favors commissions and profitable short voyages;
// repeated calls become less attractive, allowing a penniless ship to explore.
export function chooseAutomationVoyage(origin, candidates, width, visits = {}) {
  return (
    candidates
      .filter((candidate) => candidate.port.name !== origin.name)
      .map((candidate) => {
        const distance = Math.hypot(
          wrappedDelta(candidate.port.x, origin.x, width),
          candidate.port.y - origin.y,
        );
        return {
          ...candidate,
          score:
            (20 + candidate.profit + candidate.reward) /
            Math.max(100, distance) /
            (1 + (visits[candidate.port.name] || 0) * 0.5),
        };
      })
      .sort(
        (a, b) => b.score - a.score || a.port.name.localeCompare(b.port.name),
      )[0] || null
  );
}

// Give the real sailing physics sea room for turns, drift, and hull recovery.
// Unlike NPC lane baking, a failed search never falls back to crossing land.
export function createAutomationPilot(field, options = {}) {
  const planner = createPassagePlanner(field, options);
  const safe = planner.field;
  let points = [];
  let approachFrom = null;
  let approaching = false;
  return {
    plan(ship, port) {
      const passage = planner.plan(ship, port);
      points = passage?.points || [];
      approachFrom = passage?.approachFrom || null;
      approaching = false;
      return points.length > 0;
    },
    steer(ship) {
      if (!points.length) return null;
      if (
        Math.hypot(
          wrappedDelta(approachFrom[0], ship.x, field.width),
          approachFrom[1] - ship.y,
        ) < 120
      )
        approaching = true;
      let target = points[0];
      for (let i = points.length - 1; i >= 0; i--) {
        const point = points[i];
        if (
          segmentClear(
            approaching ? field : safe,
            ship.x,
            ship.y,
            point[0],
            point[1],
          )
        ) {
          target = point;
          points.splice(0, i);
          break;
        }
      }
      const dx = wrappedDelta(target[0], ship.x, field.width);
      const dy = target[1] - ship.y;
      const angle = Math.atan2(dy, dx);
      const turn = Math.abs(normalizeAngle(angle - ship.angle));
      return { angle, power: turn > 0.5 ? 0.14 : approaching ? 0.22 : 0.45 };
    },
  };
}
