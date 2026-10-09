import assert from "node:assert/strict";
import test from "node:test";
import {
  cliffFacePlans,
  createTerrainDetailReveal,
  sculptedRidgeLayers,
  terrainDetailLevels,
} from "../src/core/terrain-detail.js";
import { planTerrainIllustration } from "../src/core/terrain.js";

test("discrete zoom steps fade without frame-rate dependence and honor reduced motion", () => {
  const reveal = createTerrainDetailReveal();
  assert.deepEqual(reveal.update(0.7, 1, 0), { sculpting: 0, engraving: 0 });
  const start = reveal.update(1.5, 1, 16);
  assert.ok(start.sculpting > 0 && start.sculpting < 0.2);
  const later = reveal.update(1.5, 1, 110);
  assert.ok(later.sculpting > start.sculpting && later.sculpting < 1);
  const slower = createTerrainDetailReveal();
  slower.update(0.7, 1, 0);
  assert.ok(
    Math.abs(slower.update(1.5, 1, 110).sculpting - later.sculpting) < 1e-12,
  );
  const out = reveal.update(0.7, 1, 220);
  assert.ok(out.sculpting < later.sculpting && out.sculpting > 0);
  assert.deepEqual(reveal.update(1.5, 1, 221, true), {
    sculpting: 1,
    engraving: 1,
  });
  assert.deepEqual(reveal.update(0.7, 1, 222, true), {
    sculpting: 0,
    engraving: 0,
  });
  assert.equal(
    reveal.update(1.5, 1, 200).sculpting,
    0,
    "a reversed clock cannot overshoot",
  );
});

test("sculpting and engraving reveal smoothly at different zoom levels", () => {
  assert.deepEqual(terrainDetailLevels(0.7), { sculpting: 0, engraving: 0 });
  assert.deepEqual(terrainDetailLevels(1.5), { sculpting: 1, engraving: 1 });
  assert.deepEqual(terrainDetailLevels(0.94), { sculpting: 0.5, engraving: 0 });
  assert.ok(Math.abs(terrainDetailLevels(1.25).engraving - 0.5) < 1e-12);
  for (const edge of [0.72, 1.02, 1.16, 1.48]) {
    const before = terrainDetailLevels(edge - 0.0001);
    const after = terrainDetailLevels(edge + 0.0001);
    assert.ok(Math.abs(after.sculpting - before.sculpting) < 0.001);
    assert.ok(Math.abs(after.engraving - before.engraving) < 0.001);
  }
  let previous = terrainDetailLevels(0);
  for (let zoom = 0; zoom <= 2; zoom += 0.01) {
    const levels = terrainDetailLevels(zoom);
    assert.ok(levels.sculpting >= previous.sculpting);
    assert.ok(levels.engraving >= previous.engraving);
    previous = levels;
  }
});

test("graphics quality scales fine engraving more strongly than large forms", () => {
  assert.deepEqual(terrainDetailLevels(1.5, 0.6), {
    sculpting: 0.6,
    engraving: 0.36,
  });
  assert.deepEqual(terrainDetailLevels(1.5, -1), {
    sculpting: 0,
    engraving: 0,
  });
  assert.deepEqual(terrainDetailLevels(1.5, 2), { sculpting: 1, engraving: 1 });
});

test("ridge layers are stable, finite, progressively raised, and translate across seams", () => {
  const ridge = { a: { x: 10, y: 20 }, b: { x: 70, y: 50 }, width: 12 };
  const original = structuredClone(ridge);
  const layers = sculptedRidgeLayers(ridge);
  assert.equal(layers.length, 3);
  assert.deepEqual(layers, sculptedRidgeLayers(ridge));
  assert.ok(layers[2].height > layers[0].height);
  const shifted = sculptedRidgeLayers({
    ...ridge,
    a: { x: 4810, y: 20 },
    b: { x: 4870, y: 50 },
  });
  layers.forEach((layer, index) => {
    assert.equal(layer.spine.length, 5);
    assert.equal(layer.foot.length, 5);
    for (const key of ["spine", "foot"])
      layer[key].forEach((point, step) => {
        assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
        assert.ok(
          Math.abs(shifted[index][key][step].x - point.x - 4800) < 1e-9,
        );
        assert.equal(shifted[index][key][step].y, point.y);
      });
  });
  assert.deepEqual(ridge, original);
  assert.ok(
    sculptedRidgeLayers({ a: ridge.a, b: ridge.a, width: 0 })
      .flatMap((layer) => layer.spine)
      .every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
  );
});

test("cliff plans use only front faces regardless of winding and tolerate repeated vertices", () => {
  const poly = [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
    [0, 100],
  ];
  const original = structuredClone(poly);
  const faces = cliffFacePlans(poly, 18);
  const reversed = cliffFacePlans([...poly].reverse(), 18);
  assert.equal(faces.length, 1);
  assert.equal(reversed.length, 1);
  assert.equal(faces[0].a.y, 100);
  assert.equal(faces[0].b.y, 100);
  faces[0].normal.forEach((value, index) =>
    assert.ok(Math.abs(value - reversed[0].normal[index]) < 1e-12),
  );
  assert.ok(faces[0].fissures.length > 10);
  assert.ok(
    faces[0].fissures.every(
      (point) => point.x > 0 && point.x < 100 && point.y === 100,
    ),
  );
  assert.deepEqual(cliffFacePlans([], 18), []);
  assert.deepEqual(cliffFacePlans(poly, 0), []);
  assert.deepEqual(
    cliffFacePlans(
      [
        [0, 0],
        [3, 0],
        [3, 3],
        [0, 3],
      ],
      8,
    )[0].fissures,
    [],
  );
  assert.deepEqual(
    cliffFacePlans(
      [
        [0, 0],
        [0, 0],
        [0, 0],
      ],
      18,
    ),
    [],
  );
  assert.deepEqual(poly, original);
  const shifted = cliffFacePlans(
    poly.map(([x, y]) => [x + 4800, y]),
    18,
  );
  assert.equal(shifted[0].a.x, faces[0].a.x + 4800);
  assert.equal(shifted[0].fissures.length, faces[0].fissures.length);
});

test("sculpted ridge faces respect cartographic clearings", () => {
  const poly = [
    [0, 0],
    [620, 0],
    [620, 500],
    [0, 500],
  ];
  const zone = { x: 310, y: 250, rx: 95, ry: 58 };
  const terrain = planTerrainIllustration(poly, 42, {
    mountainous: true,
    clearings: [zone],
  });
  assert.ok(terrain.ridges.some((ridge) => ridge.layers.length > 0));
  for (const ridge of terrain.ridges)
    for (const layer of ridge.layers) {
      for (const point of [...layer.spine, ...layer.foot]) {
        assert.ok(
          point.x >= 3 && point.x <= 617 && point.y >= 3 && point.y <= 497,
        );
        assert.ok(
          ((point.x - zone.x) / (zone.rx + 3)) ** 2 +
            ((point.y - zone.y) / (zone.ry + 3)) ** 2 >
            1,
        );
      }
    }
});
