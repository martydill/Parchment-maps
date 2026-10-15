import assert from "node:assert/strict";
import test from "node:test";
import { pointInPolygon } from "../src/core/geometry.js";
import { planLandTerrain } from "../src/core/terrain.js";
import {
  planRiverDetails,
  riverWidthAt,
  sampleRiverPath,
} from "../src/core/rivers.js";

const land = [
  [0, 0],
  [620, 0],
  [620, 500],
  [0, 500],
];
const river = [
  { x: 310, y: 250 },
  { x: 310, y: 180 },
  { x: 310, y: 80 },
  { x: 310, y: 0 },
];

test("river samples follow the chart curve and preserve exact junctions and endpoints", () => {
  assert.deepEqual(sampleRiverPath([]), []);
  assert.deepEqual(sampleRiverPath([river[0]]), [river[0]]);
  assert.deepEqual(sampleRiverPath(river.slice(0, 2)), river.slice(0, 2));
  const samples = sampleRiverPath(river);
  assert.deepEqual(samples[0], river[0]);
  assert.deepEqual(samples.at(-1), river.at(-1));
  assert.deepEqual(samples[8], { x: 310, y: 130 });
  assert.ok(samples.every((point) => point.x === 310));
  assert.ok(samples.every((point, i) => i === 0 || point.y < samples[i - 1].y));
});

test("waterways widen downstream and flare at the estuary", () => {
  for (const tributary of [false, true]) {
    assert.equal(riverWidthAt(-1, tributary), riverWidthAt(0, tributary));
    assert.equal(riverWidthAt(2, tributary), riverWidthAt(1, tributary));
    let previous = 0;
    for (let step = 0; step <= 100; step++) {
      const width = riverWidthAt(step / 100, tributary);
      assert.ok(width > previous);
      previous = width;
    }
  }
  assert.ok(riverWidthAt(1) > riverWidthAt(0.8) * 2);
  assert.ok(riverWidthAt(0.5, true) < riverWidthAt(0.5));
});

test("mouths flow out to sea while bridges and hamlets occupy inland banks", () => {
  const original = structuredClone(river);
  const details = planRiverDetails(land, [river], [river.slice(0, 2)]);
  assert.deepEqual(
    details,
    planRiverDetails(land, [river], [river.slice(0, 2)]),
  );
  assert.deepEqual(river, original);
  assert.equal(details.channels.length, 2);
  assert.equal(details.channels[1].tributary, true);
  assert.equal(details.mouths.length, 1);
  const mouth = details.mouths[0];
  assert.deepEqual(mouth.direction, { x: 0, y: -1 });
  assert.equal(pointInPolygon(mouth.x, mouth.y - 1, land), false);
  assert.equal(mouth.plumeLength, 85);
  assert.equal(details.bridges.length, 1);
  const bridge = details.bridges[0];
  assert.equal(bridge.x, 310);
  assert.equal(bridge.angle, 0);
  assert.ok(bridge.span > riverWidthAt(0.62));
  assert.equal(details.settlements.length, 8);
  for (const house of details.settlements) {
    assert.ok(Math.abs(house.x - 310) > house.size + riverWidthAt(1) / 2);
    assert.ok(house.y > 0 && house.y < 50);
    for (const side of [-1, 1])
      assert.ok(pointInPolygon(house.x + side * house.size, house.y, land));
  }
});

test("empty, tiny, and repeated-point rivers omit unsupported mouth details", () => {
  const empty = { channels: [], mouths: [], bridges: [], settlements: [] };
  assert.deepEqual(planRiverDetails([], [], []), empty);
  assert.deepEqual(planRiverDetails(land, [[], [river[0]]], []), empty);
  const details = planRiverDetails(
    land,
    [
      [river[0], river[0]],
      [
        { x: 10, y: 20 },
        { x: 10, y: 0 },
      ],
    ],
    [],
  );
  assert.equal(details.channels.length, 2);
  assert.deepEqual(details.mouths, []);
  const short = planRiverDetails(
    land,
    [
      [
        { x: 20, y: 40 },
        { x: 20, y: 0 },
      ],
    ],
    [],
  );
  assert.equal(short.mouths[0].plumeLength, 38);
  assert.ok(
    short.settlements.length < 8,
    "footprints that reach the coast are omitted",
  );
  const repeated = { x: 250, y: 31 };
  const tinyHeadwater = planRiverDetails(
    land,
    [[repeated, repeated, repeated, { x: 250, y: 0 }]],
    [],
  );
  assert.equal(tinyHeadwater.mouths.length, 1);
  assert.ok(
    tinyHeadwater.settlements.every(
      (house) => Number.isFinite(house.x) && Number.isFinite(house.y),
    ),
  );
});

test("harbor and label clearings suppress bridges and settlements, preserving waterways", () => {
  const details = planRiverDetails(
    land,
    [river],
    [],
    [{ x: 310, y: 100, rx: 1000, ry: 1000 }],
  );
  assert.equal(details.channels.length, 1);
  assert.equal(details.mouths.length, 1);
  assert.deepEqual(details.bridges, []);
  assert.deepEqual(details.settlements, []);
  const narrow = [
    [0, 0],
    [12, 0],
    [12, 500],
    [0, 500],
  ];
  const cramped = planRiverDetails(
    narrow,
    [river.map((p) => ({ ...p, x: 6 }))],
    [],
  );
  assert.deepEqual(cramped.bridges, []);
  assert.deepEqual(cramped.settlements, []);
});

test("both winding tributaries meet exact points on their receiving river", () => {
  const concave = [
    [0, 0],
    [500, 0],
    [500, 500],
    [300, 500],
    [300, 150],
    [200, 150],
    [200, 500],
    [0, 500],
  ];
  for (const poly of [land, concave]) {
    for (let seed = 0; seed < 30; seed++) {
      const terrain = planLandTerrain(poly, seed, true);
      const rivers = terrain.rivers.map(sampleRiverPath);
      assert.equal(terrain.tributaries.length, terrain.rivers.length * 2);
      terrain.tributaries.forEach((tributary, index) => {
        const junction = tributary.at(-1);
        assert.ok(
          rivers[Math.floor(index / 2)].some(
            (p) => p.x === junction.x && p.y === junction.y,
          ),
        );
        assert.ok(
          sampleRiverPath(tributary).every((p) =>
            pointInPolygon(p.x, p.y, poly),
          ),
        );
      });
      for (const river of rivers)
        assert.ok(
          river.slice(0, -1).every((p) => pointInPolygon(p.x, p.y, poly)),
        );
    }
  }
});

test("mouths, bridges, channels and hamlets follow islands across the world seam", () => {
  const offset = 4800;
  const base = planRiverDetails(land, [river], []);
  const shifted = planRiverDetails(
    land.map(([x, y]) => [x + offset, y]),
    [river.map((p) => ({ ...p, x: p.x + offset }))],
    [],
  );
  const positions = (details) => [
    ...details.channels.flatMap((c) => c.points),
    ...details.mouths,
    ...details.bridges,
    ...details.settlements,
  ];
  const a = positions(base),
    b = positions(shifted);
  assert.equal(a.length, b.length);
  a.forEach((point, index) => {
    assert.ok(Math.abs(b[index].x - point.x - offset) < 1e-8);
    assert.ok(Math.abs(b[index].y - point.y) < 1e-8);
  });
  assert.deepEqual(base.mouths[0].direction, shifted.mouths[0].direction);
});
