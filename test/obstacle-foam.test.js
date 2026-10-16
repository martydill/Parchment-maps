import assert from "node:assert/strict";
import test from "node:test";
import {
  createObstacleFlow,
  createObstacleFoam,
  harborFoamObstacles,
} from "../src/core/obstacle-foam.js";

const square = [
  [200, 200],
  [280, 200],
  [280, 280],
  [200, 280],
];
const view = { left: 100, right: 400, top: 100, bottom: 400 };
const environment = { view, windAngle: 0, roughness: 0.5, detail: 1 };
const make = (obstacles = [{ poly: square }], width = 1000) =>
  createObstacleFlow(obstacles, width);
const snapshot = (particles) => structuredClone(particles);

test("harbor waterlines match nested dock rotation, placement, and scale", () => {
  assert.deepEqual(harborFoamObstacles(null, {}), []);
  assert.deepEqual(harborFoamObstacles({}, null), []);
  const layout = {
    angle: Math.PI / 2,
    scale: 2,
    grounds: [
      {
        outline: [
          [0, 0],
          [2, 0],
          [0, 2],
        ],
      },
    ],
    docks: [[2, 0, 2, 4, Math.PI / 2]],
    walls: [[0, 0, 4, 2, 0]],
  };
  const obstacles = harborFoamObstacles(layout, {
    x: 100,
    y: 200,
    heading: 0,
    scale: 0.5,
  });
  assert.equal(obstacles.length, 3);
  assert.deepEqual(obstacles[0].poly, [
    [100, 200],
    [100, 202],
    [98, 200],
  ]);
  assert.deepEqual(
    obstacles[1].poly.map((p) => p.map(Math.round)),
    [
      [101, 204],
      [99, 204],
      [99, 200],
      [101, 200],
    ],
  );
  assert.equal(
    harborFoamObstacles(
      { ...layout, walls: undefined },
      { x: 0, y: 0, heading: 0, scale: 1 },
    ).length,
    2,
  );
});

test("waterlines handle winding, depth, invalid polygons, overlaps, and marsh shelter", () => {
  const flow = make([
    { poly: [] },
    {
      poly: [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
    },
    { poly: [...square, square[0]], depth: 12 },
    { poly: square, kind: "solid" },
  ]);
  assert.ok(flow.emitters.length > 0);
  assert.ok(flow.contains(240, 290));
  assert.ok(!flow.contains(240, 300));
  assert.ok(!flow.contains(100, 240));
  for (const s of flow.emitters)
    assert.ok(!flow.contains(s.x + s.nx * 3, s.y + s.ny * 3));
  const reversed = make([{ poly: [...square].reverse() }]);
  assert.equal(make().emitters.length, reversed.emitters.length);
  for (const s of reversed.emitters)
    assert.ok(!reversed.contains(s.x + s.nx * 3, s.y + s.ny * 3));
  assert.equal(make([{ poly: square, kind: "marsh" }]).emitters.length, 0);
  assert.equal(make([{ poly: square, kind: "solid" }]).emitters.length, 0);
});

test("incoming water splits toward both ends of a rock and slips along the face", () => {
  const flow = make();
  const upper = flow.sample(198, 220, 0, 0.5);
  const lower = flow.sample(198, 260, 0, 0.5);
  assert.ok(upper.vy < 0);
  assert.ok(lower.vy > 0);
  assert.ok(upper.vx < 1 && lower.vx < 1);
  assert.equal(flow.sample(500, 500, 0, 0.5).nearest, null);
  assert.ok(flow.sample(240, 197, Math.PI / 4, 0.5).vx > 0);
});

test("cached obstacle neighborhoods retain live positions, wind, and roughness", () => {
  const flow = make();
  for (const [x, y, wind, roughness] of [
    [198, 220, 0, 0.5],
    [196, 225, Math.PI / 2, 0.1],
    [197, 240, Math.PI, 0.9],
    [198, 260, -Math.PI / 2, 0],
  ]) {
    assert.deepEqual(
      flow.sample(x, y, wind, roughness),
      make().sample(x, y, wind, roughness),
    );
  }
});

test("neighborhood eviction and negative latitude preserve the same flow", () => {
  const flow = make();
  const initial = flow.sample(198, 220, 0, 0.5);
  // A long voyage must not retain every empty cell or alter later samples.
  for (let row = -300; row < 300; row++)
    assert.ok(Number.isFinite(flow.sample(500, row * 64, 0.2, 0.7).vx));
  assert.deepEqual(flow.sample(198, 220, 0, 0.5), initial);
  const narrow = createObstacleFlow([{ poly: square }], 100);
  const sample = narrow.sample(185, 220, 0.3, 0.6);
  for (const offset of [-300, -100, 100, 400]) {
    const wrapped = narrow.sample(185 + offset, 220, 0.3, 0.6);
    assert.equal(wrapped.vx, sample.vx);
    assert.equal(wrapped.vy, sample.vy);
  }
});

test("convex headlands shed opposite circulating lee eddies and currents steer water", () => {
  const flow = make();
  const above = flow.sample(300, 190, 0, 0.5);
  const below = flow.sample(300, 290, 0, 0.5);
  assert.ok(above.vy > 0, "upper lee vortex bends toward the wake");
  assert.ok(below.vy < 0, "lower lee vortex counter-rotates");
  assert.ok(
    flow.sample(305, 155, 0, 0.5).vx < 0,
    "lee vortex has a returning limb",
  );
  const current = createObstacleFlow([], 1000, [
    [500, 500, Math.PI / 2],
  ]).sample(500, 500, 0, 0);
  assert.ok(Math.abs(current.vx - 4) < 1e-12);
  assert.equal(current.vy, 11);
  const cancel = createObstacleFlow([], 1000, [[500, 500, Math.PI]]).sample(
    500,
    500,
    0,
    1.75,
  );
  assert.ok(Number.isFinite(cancel.vx));
});

test("flow and obstacle queries are continuous across any horizontal world copy", () => {
  const flow = make([
    {
      poly: [
        [980, 200],
        [1020, 200],
        [1020, 240],
        [980, 240],
      ],
    },
  ]);
  for (const shift of [-3000, -1000, 1000, 4000]) {
    const a = flow.sample(1025, 220, 0, 0.5);
    const b = flow.sample(1025 + shift, 220, 0, 0.5);
    assert.equal(a.vx, b.vx);
    assert.equal(a.vy, b.vy);
    assert.equal(a.nearest.distance, b.nearest.distance);
    assert.equal(flow.contains(1005 + shift, 220), true);
  }
  // A one-cell world must not apply an obstacle's vortex nine times.
  const tiny = createObstacleFlow(
    [
      {
        poly: [
          [10, 10],
          [20, 10],
          [20, 20],
          [10, 20],
        ],
      },
    ],
    60,
  );
  const first = tiny.sample(24, 24, 0, 0),
    wrapped = tiny.sample(84, 24, 0, 0);
  assert.equal(first.vx, wrapped.vx);
  assert.equal(first.vy, wrapped.vy);
  assert.equal(first.nearest.distance, wrapped.nearest.distance);
});

test("foam retains its history through gusts, expires, and never crosses the rock", () => {
  const flow = make();
  const foam = createObstacleFoam(flow, 1000);
  const first = foam.update(0, environment);
  assert.ok(first.length > 20);
  const parcel = first[0];
  const trail = snapshot(parcel.trail);
  const vx = parcel.vx;
  foam.update(0.05, { ...environment, windAngle: Math.PI });
  assert.ok(parcel.age > 0);
  assert.ok(Math.abs(parcel.vx - vx) < 4, "gusts retain parcel momentum");
  assert.deepEqual(parcel.trail.slice(0, trail.length - 1), trail.slice(1));
  for (let frame = 2; frame <= 600; frame++) {
    const particles = foam.update(frame * 0.05, environment);
    assert.ok(particles.length <= 720);
    for (const p of particles) {
      assert.ok(p.trail.length <= 12);
      assert.ok(
        !flow.contains(p.x, p.y),
        `foam crossed the rock at ${p.x}, ${p.y}`,
      );
      assert.ok(p.age < p.life);
    }
  }
  assert.ok(!foam.update(30.1, environment).includes(parcel));
});

test("fixed steps agree across frame cadences, freeze, and reset on time reversal", () => {
  const slow = createObstacleFoam(make(), 1000),
    fast = createObstacleFoam(make(), 1000);
  const initial = snapshot(fast.update(0, environment));
  slow.update(0, environment);
  assert.deepEqual(fast.update(0, environment), initial);
  for (let frame = 1; frame <= 60; frame++)
    fast.update(frame / 60, environment);
  for (let frame = 1; frame <= 20; frame++)
    slow.update(frame / 20, environment);
  assert.deepEqual(fast.update(1, environment), slow.update(1, environment));
  assert.deepEqual(fast.update(0, environment), initial);
  const before = fast.update(0, environment)[0].age;
  assert.ok(fast.update(1000, environment)[0].age - before <= 0.251);
});

test("detail, offscreen culling, empty water, and hidden sources bound simulation work", () => {
  assert.deepEqual(
    createObstacleFoam(make([]), 1000).update(0, environment),
    [],
  );
  const low = createObstacleFoam(make(), 1000),
    high = createObstacleFoam(make(), 1000);
  assert.ok(
    low.update(0, { ...environment, detail: 0 }).length <
      high.update(0, environment).length,
  );
  assert.deepEqual(
    high.update(0.1, {
      ...environment,
      view: { left: 500, right: 600, top: 500, bottom: 600 },
    }),
    [],
  );
  const wrapped = createObstacleFoam(make(), 1000).update(0, {
    ...environment,
    view: { ...view, left: 1100, right: 1400 },
  });
  assert.ok(wrapped.length > 0);
  const defaults = createObstacleFoam(make(), 1000).update(0, {
    view,
    windAngle: 0,
    roughness: 0,
  });
  assert.ok(defaults.length > 0);
  const blocked = {
    emitters: [
      { x: 200, y: 200, nx: 1, ny: 0, tx: 0, ty: 1, length: 10, seed: 1 },
    ],
    contains: () => true,
  };
  assert.deepEqual(
    createObstacleFoam(blocked, 1000).update(0, environment),
    [],
  );
});

test("frozen water seeds newly visible coasts when the camera pans", () => {
  const flow = createObstacleFlow(
    [{ poly: square }, { poly: square.map(([x, y]) => [x + 600, y]) }],
    2000,
  );
  const foam = createObstacleFoam(flow, 2000);
  const first = snapshot(foam.update(0, environment));
  const farView = { ...environment, view: { ...view, left: 700, right: 1000 } };
  const next = snapshot(foam.update(0, farView));
  assert.ok(next.length > 0);
  assert.ok(next.every((p) => p.x > 600));
  assert.deepEqual(foam.update(0, farView), next);
  assert.deepEqual(foam.update(0, environment), first);
});
