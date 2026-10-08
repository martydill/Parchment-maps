import assert from "node:assert/strict";
import test from "node:test";

import {
  DAMAGE_MAX_HEEL,
  DAMAGE_MAX_SETTLE,
  DAMAGE_SMOKE_THRESHOLD,
  REPAIR_PATCH_DAYS,
  SAIL_TEAR_GRID,
  SMOKE_MAX_PUFFS,
  SMOKE_PUFF_LIFE,
  SMOKE_SPAWN_INTERVAL,
  createSmokeTrail,
  damageHeel,
  damageNoise,
  repairPatchFreshness,
  sailClothCells,
  sailTearLayout,
  sailTornCells,
  shipDamageVisuals,
  smokePuffRender,
  splinterFlecks,
  updateSmokeTrail,
} from "../src/core/ship-damage.js";
import { createOperationsState } from "../src/core/operations.js";

function operationsWith(components, extra = {}) {
  return { ...createOperationsState(), components, ...extra };
}

test("damage noise is deterministic and bounded", () => {
  assert.equal(damageNoise(7, 3), damageNoise(7, 3));
  assert.notEqual(damageNoise(7, 3), damageNoise(8, 3));
  assert.notEqual(damageNoise(7, 3), damageNoise(7, 4));
  for (let seed = -20; seed <= 20; seed++) {
    const value = damageNoise(seed, seed * 5);
    assert.ok(value >= 0 && value < 1, `${value} for seed ${seed}`);
  }
  assert.equal(damageNoise(0), damageNoise(0, 0));
});

test("a healthy vessel produces no damage visuals", () => {
  assert.equal(shipDamageVisuals(null), null);
  assert.equal(shipDamageVisuals(createOperationsState()), null);
  assert.equal(shipDamageVisuals({ components: {} }), null);
  assert.equal(shipDamageVisuals({ components: { hull: "pudding" } }), null);
});

test("hull damage lists the ship to a stable side and settles it", () => {
  const light = shipDamageVisuals(operationsWith({ hull: 85, rigging: 100 }));
  assert.ok(light.heel !== 0);
  assert.ok(Math.abs(light.heel) < DAMAGE_MAX_HEEL * 0.5);
  assert.ok(light.settle > 0 && light.settle < DAMAGE_MAX_SETTLE);
  assert.equal(light.tear, 0);
  assert.equal(light.splinters, 0);
  assert.equal(light.smoke, 0);

  const heavy = shipDamageVisuals(operationsWith({ hull: 4, rigging: 100 }));
  assert.ok(Math.abs(heavy.heel) > DAMAGE_MAX_HEEL * 0.9);
  assert.ok(heavy.settle > DAMAGE_MAX_SETTLE * 0.9);
  assert.equal(
    Math.sign(heavy.heel),
    Math.sign(light.heel),
    "the same vessel keeps listing to the same side",
  );

  const otherSide = [];
  for (let seed = 0; otherSide.length < 2 && seed < 200; seed++) {
    const heel = damageHeel(1, seed);
    if (Math.sign(heel) !== Math.sign(light.heel)) otherSide.push(heel);
  }
  assert.equal(otherSide.length, 2, "different vessels list to either side");
  assert.equal(damageHeel(0, 3), 0);
  assert.equal(damageHeel(-0.5, 3), 0);
});

test("rigging damage tears sails once it passes the wear threshold", () => {
  const sound = shipDamageVisuals(operationsWith({ hull: 90, rigging: 75 }));
  assert.equal(sound.tear, 0);
  const frayed = shipDamageVisuals(operationsWith({ hull: 90, rigging: 55 }));
  assert.ok(frayed.tear > 0 && frayed.tear < 1);
  const shredded = shipDamageVisuals(operationsWith({ hull: 90, rigging: 10 }));
  assert.equal(shredded.tear, 1);
});

test("splinters and critical smoke ramp with hull damage", () => {
  const bruised = shipDamageVisuals(operationsWith({ hull: 76, rigging: 100 }));
  assert.ok(bruised.splinters > 0 && bruised.splinters < 1);
  assert.equal(bruised.smoke, 0);
  const smoking = shipDamageVisuals(
    operationsWith({
      hull: Math.round((1 - DAMAGE_SMOKE_THRESHOLD) * 50),
      rigging: 100,
    }),
  );
  assert.ok(smoking.smoke > 0, "smoke begins on a critically holed hull");
  const burning = shipDamageVisuals(operationsWith({ hull: 2, rigging: 2 }));
  assert.equal(burning.smoke, 1);
  assert.equal(burning.splinters, 1);
});

test("fresh repair patches decay day by day and older saves show none", () => {
  const visuals = shipDamageVisuals(
    operationsWith({ hull: 100, rigging: 100 }, { patchedDay: 40 }),
    { day: 40 },
  );
  assert.equal(visuals.patch, 1);
  assert.equal(visuals.patchedDay, 40);
  assert.equal(
    shipDamageVisuals(
      operationsWith({ hull: 100, rigging: 100 }, { patchedDay: 40 }),
      { day: 40 + Math.floor(REPAIR_PATCH_DAYS / 2) },
    ).patch,
    0.5,
  );
  assert.equal(
    shipDamageVisuals(
      operationsWith({ hull: 100, rigging: 100 }, { patchedDay: 40 }),
      { day: 40 + REPAIR_PATCH_DAYS * 2 },
    ),
    null,
    "weathered patches stop rendering entirely",
  );
  assert.equal(repairPatchFreshness(0, 40), 0);
  assert.equal(repairPatchFreshness(undefined, 40), 0);
  assert.equal(repairPatchFreshness(40, 40.9), 1);
  assert.equal(
    shipDamageVisuals(
      operationsWith({ hull: 100, rigging: 100 }, { patchedDay: 40 }),
      { day: 12 },
    ).patch,
    1,
    "a day earlier than the repair still reads as fresh",
  );
  assert.equal(
    shipDamageVisuals(operationsWith({ hull: 100 }), { day: 9 }),
    null,
  );
  assert.equal(
    shipDamageVisuals(operationsWith({ hull: 100 }, { patchedDay: "soon" }), {
      day: 9,
    }),
    null,
  );
});

test("sail cloth cells tile a triangle exactly once", () => {
  const cells = sailClothCells();
  assert.equal(cells.length, SAIL_TEAR_GRID * SAIL_TEAR_GRID);
  for (const cell of cells) {
    assert.equal(cell.points.length, 3);
    for (const [u, v] of cell.points) {
      assert.ok(u >= 0 && u <= SAIL_TEAR_GRID);
      assert.ok(v >= 0 && v <= SAIL_TEAR_GRID);
    }
  }
  assert.equal(sailClothCells(1).length, 1);
  assert.equal(sailClothCells(0).length, 1);
  assert.equal(sailClothCells(2.9).length, 4);
});

test("tears remove clustered cells and never more than the whole sail", () => {
  assert.equal(sailTornCells(5, 0).size, 0);
  assert.equal(sailTornCells(5, -1).size, 0);
  const total = SAIL_TEAR_GRID * SAIL_TEAR_GRID;
  let grew = false;
  for (let seed = 0; seed < 30; seed++) {
    const light = sailTornCells(seed, 0.35);
    const heavy = sailTornCells(seed, 1);
    assert.ok(light.size > 0, `seed ${seed} tears something`);
    assert.ok(heavy.size >= light.size);
    assert.ok(heavy.size <= total);
    if (heavy.size > light.size) grew = true;
    assert.deepEqual([...sailTornCells(seed, 0.35)], [...light]);
  }
  assert.ok(grew, "heavier tearing removes more cloth");
});

test("tear layout fringes every edge between kept and torn cloth", () => {
  const quiet = sailTearLayout(3, 0);
  assert.equal(quiet.torn.size, 0);
  assert.equal(quiet.fringes.length, 0);
  assert.equal(quiet.cells.length, SAIL_TEAR_GRID * SAIL_TEAR_GRID);

  let checked = 0;
  for (let seed = 0; seed < 40 && checked < 5; seed++) {
    const layout = sailTearLayout(seed, 0.8);
    if (!layout.torn.size || layout.torn.size === layout.cells.length) continue;
    checked++;
    const cellEdges = new Map();
    const keyFor = (a, b) =>
      a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]) ? `${a}|${b}` : `${b}|${a}`;
    layout.cells.forEach((cell, index) => {
      for (let edge = 0; edge < 3; edge++) {
        const a = cell.points[edge];
        const b = cell.points[(edge + 1) % 3];
        const key = keyFor(a.join(","), b.join(","));
        if (!cellEdges.has(key)) cellEdges.set(key, []);
        cellEdges.get(key).push(index);
      }
    });
    const expected = [...cellEdges.entries()].filter(
      ([, owners]) =>
        owners.length === 2 &&
        layout.torn.has(owners[0]) !== layout.torn.has(owners[1]),
    );
    assert.equal(layout.fringes.length, expected.length, `seed ${seed}`);
    for (const [start, end] of layout.fringes) {
      assert.equal(start.length, 2);
      assert.ok(
        cellEdges.has(keyFor(start, end)),
        "each fringe follows a real cell edge",
      );
    }
  }
  assert.ok(checked >= 3, "partial tears leave bordered holes");
});

test("splinter flecks scale with hull damage and stay deterministic", () => {
  assert.deepEqual(splinterFlecks(9, 0), []);
  assert.deepEqual(splinterFlecks(9, 2), splinterFlecks(9, 2));
  const few = splinterFlecks(9, 0.2);
  const many = splinterFlecks(9, 1);
  assert.ok(few.length > 0 && few.length < many.length);
  assert.ok(many.length <= 14);
  for (const fleck of many) {
    assert.ok([-1, 1].includes(fleck.side));
    assert.ok(fleck.along >= -0.5 && fleck.along <= 0.5);
    assert.ok(fleck.athwart >= 0.55 && fleck.athwart <= 1.3);
    assert.ok(fleck.size >= 0.35 && fleck.size <= 1.1);
    assert.ok(fleck.phase >= 0 && fleck.phase < 1);
    assert.equal(typeof fleck.fresh, "boolean");
  }
});

test("smoke trails spawn puffs over time and prune expired ones", () => {
  assert.deepEqual(updateSmokeTrail(null, { smoke: 1, time: 1 }), []);
  const trail = createSmokeTrail();
  const first = updateSmokeTrail(trail, { x: 10, y: 20, smoke: 1, time: 5 });
  assert.equal(first.length, 1, "a fresh trail smokes immediately");
  assert.equal(first[0].x, 10);
  assert.equal(first[0].y, 20);
  assert.deepEqual(
    updateSmokeTrail(trail, { x: 10, y: 20, smoke: 1, time: 5.1 }),
    first,
    "no new puff before the spawn interval elapses",
  );
  const later = updateSmokeTrail(trail, { x: 12, y: 21, smoke: 1, time: 5.3 });
  assert.equal(later.length, 2);
  assert.equal(later[0].born, 5);
  assert.equal(later[1].born, 5.2);
  assert.ok(later[1].strength > 0.55 && later[1].strength <= 1);
});

test("smoke stops when the hull recovers and never exceeds the puff cap", () => {
  const trail = createSmokeTrail();
  let time = 0;
  let maxAlive = 0;
  for (let step = 0; step < 400; step++) {
    time += 0.05;
    const puffs = updateSmokeTrail(trail, { x: time, y: 0, smoke: 1, time });
    maxAlive = Math.max(maxAlive, puffs.length);
  }
  assert.equal(maxAlive, SMOKE_MAX_PUFFS);
  for (let step = 0; step < 3; step++) {
    time += SMOKE_SPAWN_INTERVAL;
    updateSmokeTrail(trail, { x: time, y: 0, smoke: 1, time });
  }
  const pinned = trail.sinceSpawn;
  updateSmokeTrail(trail, { smoke: 1, time: time + SMOKE_SPAWN_INTERVAL });
  assert.ok(
    Math.abs(trail.sinceSpawn - pinned) < 1e-9,
    "the cap holds the spawn timer",
  );
  updateSmokeTrail(trail, { smoke: 0, time: time + SMOKE_SPAWN_INTERVAL * 2 });
  const count = trail.puffs.length;
  updateSmokeTrail(trail, { smoke: 0, time: time + 1 });
  assert.ok(
    trail.puffs.length <= count,
    "puffs keep fading out while the hull holds",
  );
  const expired = updateSmokeTrail(trail, {
    smoke: 0,
    time: time + SMOKE_PUFF_LIFE + 1,
  });
  assert.deepEqual(expired, []);
});

test("smoke trails survive a paused or rewound clock", () => {
  const trail = createSmokeTrail();
  updateSmokeTrail(trail, { x: 0, y: 0, smoke: 1, time: 10 });
  const rewound = updateSmokeTrail(trail, { x: 1, y: 0, smoke: 1, time: 2 });
  assert.equal(rewound.length, 2);
  updateSmokeTrail(trail, { x: 2, y: 0, smoke: 1, time: 1e6 });
  assert.ok(trail.puffs.length <= SMOKE_MAX_PUFFS);
});

test("smoke puffs drift downwind, climb, and fade", () => {
  const puff = { x: 100, y: 50, born: 4, strength: 1, seed: 7 };
  const born = smokePuffRender(puff, { time: 4 });
  assert.equal(born.x, 100);
  assert.equal(born.y, 50);
  assert.equal(born.z, 0);
  assert.equal(born.alpha, 0, "a puff blooms in from nothing");
  const blooming = smokePuffRender(puff, { time: 4.25 });
  assert.ok(blooming.alpha > 0, "brightening while it rises");
  const fresh = smokePuffRender(puff, { time: 4.5 });
  assert.ok(fresh.alpha > blooming.alpha, "fully bloomed at half a second");
  assert.ok(fresh.z > blooming.z, "smoke climbs as it ages");
  assert.ok(fresh.radius > blooming.radius, "smoke spreads as it ages");
  const mid = smokePuffRender(puff, {
    time: 4.5,
    windAngle: 0,
    windStrength: 1,
  });
  assert.ok(mid.x > puff.x, "wind carries the puff downwind");
  assert.ok(mid.y === puff.y, "a purely easterly wind adds no northward drift");
  assert.ok(mid.z === fresh.z);
  assert.ok(mid.radius === fresh.radius);

  const late = smokePuffRender(puff, { time: 4 + SMOKE_PUFF_LIFE });
  assert.equal(late.alpha, 0);
  const clamped = smokePuffRender(puff, { time: 0, windStrength: 9 });
  assert.ok(clamped.alpha >= 0);
  assert.deepEqual(
    smokePuffRender(puff, { time: 4.5, windStrength: 2 }),
    smokePuffRender(puff, { time: 4.5, windStrength: 1 }),
    "wind strength clamps to a gale",
  );
});
