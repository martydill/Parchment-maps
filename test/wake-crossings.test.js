import assert from "node:assert/strict";
import test from "node:test";
import {
  createWakeSystem,
  intersectWakes,
  sampleWakeCrossing,
  wakeDisruption,
  WAKE_LIFETIME,
  CROSSING_LIFETIME,
} from "../src/core/wake-crossings.js";
import { buildWakeRibbon } from "../src/core/seascape.js";

const point = (x, y) => ({ x, y });
const vessel = (id, x, y, extra = {}) => ({ id, x, y, stern: 0, ...extra });
function crossingSystem() {
  const system = createWakeSystem(1000);
  system.update([vessel("a", 490, 400), vessel("b", 500, 390)], 0);
  system.update([vessel("a", 510, 400), vessel("b", 500, 410)], 100);
  return system;
}

test("finite wake intersections resolve perpendicular, endpoint and oblique crossings", () => {
  const hit = intersectWakes(
    point(0, 0),
    point(20, 0),
    point(10, -10),
    point(10, 10),
    1000,
  );
  assert.deepEqual(hit, { x: 10, y: 0, angle: 0, energy: 1 });
  assert.equal(
    intersectWakes(point(0, 0), point(10, 0), point(10, 0), point(20, 10), 1000)
      .x,
    10,
  );
  const oblique = intersectWakes(
    point(0, 0),
    point(20, 0),
    point(0, -10),
    point(20, 10),
    1000,
  );
  assert.equal(oblique.x, 10);
  assert.ok(oblique.energy > 0.7 && oblique.energy < 0.71);
});

test("parallel, shallow, degenerate and disjoint finite wakes do not collide", () => {
  for (const [a, b, c, d] of [
    [point(0, 0), point(10, 0), point(0, 1), point(10, 1)],
    [point(0, 0), point(10, 0), point(0, -0.1), point(10, 0.1)],
    [point(0, 0), point(0, 0), point(0, -1), point(0, 1)],
    [point(0, 0), point(10, 0), point(20, -5), point(20, 5)],
    [point(0, 0), point(10, 0), point(5, 1), point(5, 5)],
  ])
    assert.equal(intersectWakes(a, b, c, d, 1000), null);
});

test("crossings wrap through either meridian and repeated world copies", () => {
  for (const offset of [-1000, 0, 2000]) {
    const hit = intersectWakes(
      point(995 + offset, 0),
      point(5 + offset, 0),
      point(0, -10),
      point(0, 10),
      1000,
    );
    assert.equal(hit.x, 1000 + offset);
    assert.equal(hit.y, 0);
  }
  const system = createWakeSystem(1000);
  system.update([vessel("a", 995, 400), vessel("b", 0, 390)], 0);
  system.update([vessel("a", 5, 400), vessel("b", 0, 410)], 100);
  assert.equal(system.crossings.length, 1);
  assert.ok(system.crossings[0].x === 0 || system.crossings[0].x === 1000);
});

test("actual movement lays stern samples and simultaneous crossings coalesce", () => {
  const system = crossingSystem();
  assert.equal(system.crossings.length, 1);
  assert.equal(system.crossings[0].x, 500);
  assert.equal(system.crossings[0].y, 400);
  assert.ok(system.crossings[0].strength > 0);
  const original = structuredClone(system.crossings);
  for (let time = 110; time < 300; time += 10)
    system.update([vessel("a", 510, 400), vessel("b", 500, 410)], time);
  assert.deepEqual(system.crossings, original);
  assert.equal(system.trails.get("a").points.length, 2);
  const stern = createWakeSystem(1000);
  stern.update([{ id: "ship", x: 30, y: 40, speed: 10 }], 0);
  assert.equal(stern.trails.get("ship").points[0].x, 15);
  assert.equal(stern.trails.get("ship").points[0].y, 40);
  assert.equal(stern.trails.get("ship").points[0].strength, 0.25);
});

test("stationary, anchored, paused, invalid and absent sources never join across a gap", () => {
  const system = createWakeSystem(1000);
  system.update(
    [
      vessel("bad", NaN, 0),
      vessel("anchor", 0, 0, { anchored: true }),
      vessel("pause", 0, 0, { active: false }),
      vessel("a", 100, 100),
    ],
    0,
  );
  assert.equal(system.trails.size, 1);
  system.update([vessel("a", 110, 100)], 40);
  assert.equal(
    system.trails.get("a").points.length,
    1,
    "sample rate is bounded",
  );
  system.update([vessel("a", 101, 100)], 100);
  assert.equal(
    system.trails.get("a").points.length,
    1,
    "tiny displacement is ignored",
  );
  system.update([], 200);
  system.update([vessel("a", 120, 100)], 300);
  assert.equal(system.trails.get("a").points[0].breakBefore, true);
  system.update([vessel("a", 120, 100, { active: false })], 400);
  system.update([vessel("a", 130, 100)], 500);
  assert.equal(system.trails.get("a").points[0].breakBefore, true);
});

test("teleports, tab suspensions and old wake segments cannot create phantom crossings", () => {
  const system = createWakeSystem(1000);
  system.update([vessel("a", 100, 100), vessel("b", 150, 90)], 0);
  system.update([vessel("b", 150, 110)], 100);
  system.update([vessel("a", 250, 100)], 200);
  assert.equal(system.crossings.length, 0);
  assert.equal(system.trails.get("a").points[0].breakBefore, true);
  system.update([vessel("a", 240, 100)], 1000);
  assert.equal(system.trails.get("a").points[0].breakBefore, true);
  const old = createWakeSystem(1000);
  old.update([vessel("a", 490, 400)], 0);
  old.update([vessel("a", 510, 400)], 100);
  old.update([vessel("b", 500, 390)], 10000);
  old.update([vessel("b", 500, 410)], 10100);
  assert.equal(old.crossings.length, 0);
});

test("a vessel cannot cross its own wake, and parallel traffic stays braided", () => {
  const system = createWakeSystem(1000);
  for (const [i, [x, y]] of [
    [100, 100],
    [120, 120],
    [100, 120],
    [120, 100],
  ].entries()) {
    system.update([vessel("a", x, y), vessel("b", x, y + 50)], i * 100);
  }
  assert.equal(system.crossings.length, 0);
});

test("a later vessel crosses a departed ship's still fading wake", () => {
  const system = createWakeSystem(1000);
  system.update([vessel("a", 490, 400)], 0);
  system.update([vessel("a", 510, 400)], 100);
  system.update([vessel("b", 500, 390)], 400);
  system.update([vessel("b", 500, 410)], 500);
  assert.equal(system.crossings.length, 1);
  assert.equal(system.crossings[0].x, 500);
  assert.equal(system.crossings[0].y, 400);
  const first = structuredClone(system.crossings[0]);
  system.update([vessel("b", 500, 390)], 600);
  assert.equal(system.crossings.length, 1, "nearby repeated hits coalesce");
  assert.deepEqual(
    system.crossings[0],
    first,
    "a repeated hit cannot renew its lifetime",
  );
});

test("sample counts, event counts and retention are bounded and reset cleanly", () => {
  const system = createWakeSystem(100000);
  for (let i = 0; i < 140; i++)
    system.update([vessel("a", i * 3, 0, { speed: 500 })], i * 90);
  assert.equal(system.trails.get("a").points.length, 128);
  assert.equal(system.trails.get("a").points[0].strength, 1);
  system.clear();
  const before = [],
    after = [];
  for (let i = 0; i < 70; i++) {
    const x = i * 200;
    before.push(vessel(`a${i}`, x - 10, 0), vessel(`b${i}`, x, -10));
    after.push(vessel(`a${i}`, x + 10, 0), vessel(`b${i}`, x, 10));
  }
  system.update(before, 0);
  system.update(after, 100);
  assert.equal(system.crossings.length, 64);
  system.update([], 100 + CROSSING_LIFETIME);
  assert.equal(system.crossings.length, 0);
  system.update([], 100 + WAKE_LIFETIME);
  assert.equal(system.trails.size, 0);
  system.update(after, 20000);
  system.clear();
  assert.equal(system.trails.size, 0);
  assert.equal(system.crossings.length, 0);
});

test("crossing ripples expand, fragment and fully dissolve with deterministic reduced motion", () => {
  const event = crossingSystem().crossings[0];
  const early = sampleWakeCrossing(event, 400);
  const later = sampleWakeCrossing(event, 3000);
  assert.ok(later.radius > early.radius);
  assert.ok(later.breakup > early.breakup);
  assert.ok(later.alpha < early.alpha);
  assert.ok(later.foam < early.foam);
  assert.deepEqual(sampleWakeCrossing(event, 400), early);
  assert.equal(sampleWakeCrossing(event, event.time).alpha, 0);
  assert.equal(sampleWakeCrossing(event, event.time - 100).alpha, 0);
  assert.equal(
    sampleWakeCrossing(event, event.time + CROSSING_LIFETIME).alpha,
    0,
  );
  assert.equal(
    sampleWakeCrossing(event, event.time + CROSSING_LIFETIME).foam,
    0,
  );
  const still = sampleWakeCrossing(event, 400, true);
  const stillLater = sampleWakeCrossing(event, 3000, true);
  assert.equal(still.radius, stillLater.radius);
  assert.equal(still.breakup, stillLater.breakup);
  assert.ok(still.alpha > stillLater.alpha);
});

test("ribbon breakup is local, wraps and fades without changing the stored path", () => {
  const system = crossingSystem();
  assert.equal(wakeDisruption(point(500, 400), [], 1000, 1000), 0);
  assert.ok(
    wakeDisruption(point(500, 400), system.crossings, 1000, 1000) > 0.1,
  );
  assert.equal(
    wakeDisruption(point(500, 400), system.crossings, 1000, 1000),
    wakeDisruption(point(1500, 400), system.crossings, 1000, 1000),
  );
  assert.equal(
    wakeDisruption(point(600, 400), system.crossings, 1000, 1000),
    0,
  );
  assert.equal(wakeDisruption(point(500, 400), system.crossings, 0, 1000), 0);
  assert.equal(
    wakeDisruption(point(500, 400), system.crossings, 7000, 1000),
    0,
  );
  const points = system.trails.get("a").points;
  const original = structuredClone(points);
  assert.ok(
    buildWakeRibbon(points, 6000, 1000).length > 0,
    "traffic history outlives the legacy five-second ribbon",
  );
  assert.equal(buildWakeRibbon(points, 13000, 1000).length, 0);
  assert.deepEqual(points, original);
  assert.equal(buildWakeRibbon(points, 200, 1000).at(-1).breakBefore, true);
});
