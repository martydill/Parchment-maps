import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTOMATION_DT,
  automationOptions,
  chooseAutomationVoyage,
  createAutomationPilot,
  createAutomationSession,
} from "../src/core/automation.js";
import { buildSeaField, segmentClear } from "../src/core/navfield.js";

function session(mode = "step", overrides = {}) {
  let position = 0;
  let draws = 0;
  const advances = [];
  const options = { mode, seed: "test", speed: 1 };
  const adapter = {
    observe: () => ({ position }),
    decide: () => null,
    act: (action) => ({ ok: action.type === "move" }),
    advance(dt, seconds) {
      advances.push([dt, seconds]);
      position += dt;
    },
    render() {
      draws++;
    },
    ...overrides,
  };
  return {
    api: createAutomationSession(options, adapter),
    advances,
    draws: () => draws,
  };
}

test("automation is opt-in and validates seed, mode, and speed", () => {
  assert.equal(automationOptions("?seed=test"), null);
  assert.deepEqual(automationOptions("?automation=step"), {
    mode: "step",
    seed: "parchment-automation",
    speed: 1,
  });
  assert.deepEqual(
    automationOptions("?automation=demo&seed=research%20A&speed=32"),
    { mode: "demo", seed: "research A", speed: 32 },
  );
  assert.equal(
    automationOptions("?automation=demo&speed=.25&seed=").speed,
    0.25,
  );
  for (const query of [
    "automation=on",
    "automation=step&speed=0",
    "automation=demo&speed=33",
    "automation=demo&speed=NaN",
    "automation=step&seed=" + "x".repeat(129),
  ])
    assert.throws(() => automationOptions(query), RangeError);
});

test("manual stepping uses exact fixed ticks, independent of render calls", () => {
  const { api, advances, draws } = session();
  api.frame(1);
  assert.equal(api.snapshot().ticks, 0);
  api.step();
  const snapshot = api.step(29);
  assert.equal(snapshot.ticks, 30);
  assert.equal(snapshot.seconds, 1);
  assert.equal(snapshot.running, false);
  advances.forEach(([dt, seconds], index) => {
    assert.equal(dt, AUTOMATION_DT);
    assert.equal(seconds, index * AUTOMATION_DT);
  });
  api.render();
  assert.equal(draws(), 1);
  assert.equal(api.snapshot().ticks, 30);
  for (const invalid of [0, -1, 0.5, NaN, Infinity, 1801])
    assert.throws(() => api.step(invalid), RangeError);
});

test("real-time playback accumulates fixed ticks and drops paused elapsed time", () => {
  const { api } = session("demo");
  api.frame(AUTOMATION_DT / 2);
  assert.equal(api.snapshot().ticks, 0);
  api.frame(AUTOMATION_DT / 2);
  assert.equal(api.snapshot().ticks, 1);
  api.pause();
  api.frame(10);
  api.resume();
  for (const invalid of [0, -1, NaN, Infinity]) api.frame(invalid);
  api.frame(10); // tab suspension is capped at 250ms
  assert.equal(api.snapshot().ticks, 8);
  const fast = createAutomationSession(
    { mode: "demo", speed: 4, seed: "fast" },
    {
      observe: () => ({}),
      decide: () => null,
      act: () => ({}),
      advance() {},
      render() {},
    },
  );
  fast.frame(0.25);
  assert.equal(fast.snapshot().ticks, 30);
});

test("policies, commands, snapshots, and bounded events support research agents", () => {
  const { api } = session("step", { decide: () => ({ type: "move" }) });
  api.step(2);
  assert.equal(api.snapshot().counts.move, 2);
  api.setAutoplay(false);
  api.step();
  assert.equal(api.snapshot().counts.move, 2);
  assert.throws(() => api.setAutoplay(1), TypeError);
  assert.deepEqual(api.command({ type: "bad" }), { ok: false });
  assert.equal(api.snapshot().counts.rejected, 1);
  api.setAutoplay(true);
  api.step(600);
  const state = api.snapshot();
  assert.equal(state.events.length, 500);
  assert.equal(state.counts.move, 602);
  assert.equal(state.events.at(-1).id, 603);
  state.events[0].detail.action.type = "corrupted";
  state.counts.move = 0;
  assert.equal(api.snapshot().counts.move, 602);
  assert.equal(api.snapshot().events[0].detail.action.type, "move");
});

test("simulation failures pause playback and preserve diagnostics", () => {
  for (const failure of [new Error("stalled"), "plain failure"]) {
    const { api } = session("demo", {
      advance() {
        throw failure;
      },
    });
    assert.throws(
      () => api.step(),
      (error) => error === failure,
    );
    const snapshot = api.snapshot();
    assert.equal(snapshot.running, false);
    assert.equal(snapshot.error, failure.message || failure);
    assert.equal(snapshot.counts.error, 1);
    assert.equal(snapshot.ticks, 0);
    assert.throws(() => api.step(), Error);
    assert.throws(() => api.resume(), Error);
  }
});

test("voyage selection considers wrapped distances, profit, contracts, and visits", () => {
  const origin = { name: "Home", x: 980, y: 200 };
  const near = {
    port: { name: "Near", x: 20, y: 200 },
    profit: 10,
    reward: 20,
  };
  const far = { port: { name: "Far", x: 500, y: 200 }, profit: 80, reward: 20 };
  const home = { port: origin, profit: 10000, reward: 10000 };
  assert.equal(
    chooseAutomationVoyage(origin, [near, far, home], 1000).port.name,
    "Near",
  );
  assert.equal(
    chooseAutomationVoyage(origin, [near, far], 1000, { Near: 10 }).port.name,
    "Far",
  );
  assert.equal(chooseAutomationVoyage(origin, [home], 1000), null);
  const tie = { ...near, port: { ...near.port, name: "A" } };
  assert.equal(
    chooseAutomationVoyage(origin, [near, tie], 1000).port.name,
    "A",
  );
});

test("pilot steers across the world seam and slows for a turn", () => {
  const field = buildSeaField([], { width: 1000, height: 400 });
  const original = field.grid.slice();
  const pilot = createAutomationPilot(field);
  const ship = { x: 980, y: 200, angle: 0 };
  assert.equal(pilot.steer(ship), null);
  assert.equal(pilot.plan(ship, { x: 180, y: 200 }), true);
  const forward = pilot.steer(ship);
  assert.ok(Math.abs(forward.angle) < 0.2);
  assert.equal(forward.power, 0.45);
  assert.equal(pilot.steer({ ...ship, angle: Math.PI }).power, 0.14);
  assert.deepEqual(field.grid, original);
});

test("pilot routes around islands with clearance and refuses unreachable water", () => {
  const field = buildSeaField(
    [
      {
        poly: [
          [400, 90],
          [600, 90],
          [600, 320],
          [400, 320],
        ],
      },
    ],
    { width: 1000, height: 600 },
  );
  const pilot = createAutomationPilot(field);
  const ship = { x: 300, y: 200, angle: 0 };
  assert.equal(pilot.plan(ship, { x: 700, y: 200 }), true);
  let arrived = false;
  for (let i = 0; i < 1500; i++) {
    const steering = pilot.steer(ship);
    const nx = (ship.x + Math.cos(steering.angle) * 2 + 1000) % 1000;
    const ny = ship.y + Math.sin(steering.angle) * 2;
    assert.ok(segmentClear(field, ship.x, ship.y, nx, ny));
    ship.x = nx;
    ship.y = ny;
    ship.angle = steering.angle;
    if (Math.hypot(ship.x - 700, ship.y - 200) < 15) {
      arrived = true;
      break;
    }
  }
  assert.ok(arrived);
  // An external/manual position outside the clearance corridor still gets a
  // heading toward the route, rather than mutating or teleporting the hull.
  assert.ok(pilot.steer({ x: 500, y: 200, angle: 0 }));
  const blocked = { ...field, grid: new Uint8Array(field.grid.length).fill(1) };
  const trapped = createAutomationPilot(blocked, { margin: 0, clearance: 0 });
  assert.equal(trapped.plan(ship, { x: 700, y: 200 }), false);
  assert.equal(trapped.steer(ship), null);
});

test("pilot finishes a coastal approach inside docking range without entering land", () => {
  const field = buildSeaField(
    [
      {
        poly: [
          [500, 200],
          [650, 200],
          [650, 400],
          [500, 400],
        ],
      },
    ],
    { width: 1000, height: 600 },
  );
  const pilot = createAutomationPilot(field);
  const ship = { x: 400, y: 300, angle: 0 };
  const port = { x: 560, y: 300 };
  assert.ok(pilot.plan(ship, port));
  for (let tick = 0; tick < 100; tick++) {
    const input = pilot.steer(ship);
    assert.equal(input.power, 0.22);
    const nx = ship.x + Math.cos(input.angle);
    const ny = ship.y + Math.sin(input.angle);
    assert.ok(segmentClear(field, ship.x, ship.y, nx, ny));
    ship.x = nx;
    ship.y = ny;
    if (Math.hypot(ship.x - port.x, ship.y - port.y) < 78) return;
  }
  assert.fail("pilot held outside docking range");
});
