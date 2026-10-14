import assert from "node:assert/strict";
import test from "node:test";
import { pointInPolygon } from "../src/core/geometry.js";
import {
  planShoreline,
  planPigmentGrains,
  sampleShoreBreak,
  shorelineCliffFaces,
} from "../src/core/shoreline.js";

const square = [
  [0, 0],
  [280, 0],
  [280, 190],
  [0, 190],
];
const cove = [
  [0, 0],
  [300, 0],
  [300, 300],
  [200, 300],
  [200, 120],
  [100, 120],
  [100, 300],
  [0, 300],
];

test("shoreline plans preserve geometry, subdivide continuously, and are deterministic", () => {
  const original = structuredClone(cove);
  const plan = planShoreline(cove, 811);
  assert.deepEqual(plan, planShoreline(cove, 811));
  assert.notDeepEqual(plan, planShoreline(cove, 812));
  assert.deepEqual(cove, original);
  assert.ok(
    Math.abs(plan.reduce((total, s) => total + s.length, 0) - 1560) < 1e-9,
  );
  plan.forEach((s, i) => {
    assert.deepEqual(s.b, plan[(i + 1) % plan.length].a);
    assert.ok(s.length <= 18 && s.length > 0);
    assert.ok(Math.abs(Math.hypot(s.nx, s.ny) - 1) < 1e-12);
    assert.ok(Math.abs(s.nx * s.tx + s.ny * s.ty) < 1e-12);
    assert.ok(
      Object.values(s)
        .filter((v) => typeof v === "number")
        .every(Number.isFinite),
    );
  });
  assert.deepEqual(planShoreline([], 1), []);
  assert.deepEqual(
    planShoreline(
      [
        [0, 0],
        [1, 1],
      ],
      1,
    ),
    [],
  );
  assert.deepEqual(
    planShoreline(
      [
        [0, 0],
        [0, 0],
        [0, 0],
      ],
      1,
    ),
    [],
  );
  assert.deepEqual(
    planShoreline([...square, square[0]], 1),
    planShoreline(square, 1),
  );
  assert.ok(
    planShoreline(
      [
        [0, 0],
        [1, 1],
        [2, 2],
      ],
      1,
    ).every((s) => Number.isFinite(s.nx)),
  );
});

test("coast normals point into water for either polygon winding", () => {
  for (const poly of [square, [...square].reverse()]) {
    for (const s of planShoreline(poly, 12)) {
      const x = (s.a.x + s.b.x) / 2,
        y = (s.a.y + s.b.y) / 2;
      assert.equal(pointInPolygon(x + s.nx, y + s.ny, poly), false);
      assert.equal(pointInPolygon(x - s.nx, y - s.ny, poly), true);
    }
  }
});

test("biomes and coves produce coherent, geographically distinct materials", () => {
  for (const biome of [
    "temperate",
    "alpine",
    "volcanic",
    "marsh",
    "tropical",
    "arid",
  ]) {
    const kinds = new Set(
      Array.from({ length: 16 }, (_, seed) => planShoreline(cove, seed, biome))
        .flat()
        .map((s) => s.kind),
    );
    const expected =
      biome === "marsh"
        ? ["marsh"]
        : biome === "volcanic"
          ? ["basalt", "rock"]
          : ["sand", "rock"];
    assert.deepEqual([...kinds].sort(), expected.sort());
    for (const s of planShoreline(square, 7, biome)) {
      assert.ok(s.shelf >= 14 && s.shelf <= 54);
      if (s.kind === "sand") assert.ok(s.shelf >= 42);
      if (s.kind === "marsh") assert.ok(s.shelf <= 29);
    }
  }
  assert.deepEqual(planShoreline(cove, 0, "unknown"), planShoreline(cove, 0));
});

test("shorelines and grains translate unchanged across the horizontal world seam", () => {
  const translate = (poly) => poly.map(([x, y]) => [x + 4800, y]);
  const plan = planShoreline(cove, 811);
  const wrapped = planShoreline(translate(cove), 811);
  wrapped.forEach((s, i) => {
    assert.ok(Math.abs(s.a.x - plan[i].a.x - 4800) < 1e-10);
    assert.ok(Math.abs(s.b.x - plan[i].b.x - 4800) < 1e-10);
    assert.deepEqual({ ...s, a: plan[i].a, b: plan[i].b }, plan[i]);
  });
  const grains = planPigmentGrains(cove, 5);
  const wrappedGrains = planPigmentGrains(translate(cove), 5);
  wrappedGrains.forEach((grain, i) => {
    assert.ok(Math.abs(grain.x - grains[i].x - 4800) < 1e-10);
    assert.deepEqual({ ...grain, x: grains[i].x }, grains[i]);
  });
});

test("granulation stays inside crowns and mountain faces, with bounded degenerate sampling", () => {
  const grains = planPigmentGrains(cove, 17);
  assert.equal(grains.length, 100);
  assert.deepEqual(grains, planPigmentGrains(cove, 17));
  assert.notDeepEqual(grains, planPigmentGrains(cove, 18));
  assert.ok(grains.every((g) => pointInPolygon(g.x, g.y, cove)));
  assert.ok(
    grains.every(
      (g) =>
        g.radius >= 0.22 && g.radius <= 0.87 && g.alpha > 0 && g.alpha < 0.3,
    ),
  );
  assert.ok(grains.some((g) => g.light) && grains.some((g) => !g.light));
  for (const poly of [
    [],
    [[0, 0]],
    [
      [0, 0],
      [0, 1],
      [0, 2],
    ],
    [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
    [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
  ]) {
    assert.deepEqual(planPigmentGrains(poly, 1), []);
  }
  assert.deepEqual(planPigmentGrains(square, 1, 0), []);
  assert.deepEqual(planPigmentGrains(square, 1, -1), []);
  assert.equal(planPigmentGrains(square, 1, 3).length, 3);
});

test("sand leaves thin retreating foam, rocks pulse spray, and marshes stay still", () => {
  const sand = { kind: "sand", phase: 0 };
  const incoming = sampleShoreBreak(sand, 0.1 / 0.14);
  const lowTide = sampleShoreBreak(sand, 0.24 / 0.14);
  const retreat = sampleShoreBreak(sand, 0.7 / 0.14);
  assert.ok(incoming.reach > lowTide.reach);
  assert.ok(retreat.reach > lowTide.reach);
  assert.equal(retreat.spray, 0);
  assert.ok(retreat.alpha > 0 && retreat.alpha <= 0.52);
  assert.deepEqual(sampleShoreBreak(sand, 1, -5), sampleShoreBreak(sand, 1, 0));
  assert.deepEqual(sampleShoreBreak(sand, 1, 5), sampleShoreBreak(sand, 1, 1));
  assert.ok(
    Math.abs(
      sampleShoreBreak(sand, -1).reach -
        sampleShoreBreak(sand, 1 / 0.14 - 1).reach,
    ) < 1e-10,
  );
  for (const kind of ["rock", "basalt"]) {
    const rock = { kind, phase: Math.PI / 2 };
    assert.equal(sampleShoreBreak(rock, 0).spray, 1);
    assert.equal(
      sampleShoreBreak({ ...rock, phase: -Math.PI / 2 }, 0).spray,
      0,
    );
    assert.ok(
      sampleShoreBreak(rock, 0, 1).reach > sampleShoreBreak(rock, 0).reach,
    );
  }
  assert.equal(sampleShoreBreak({ kind: "marsh" }, 100), null);
});

test("detail cliffs only project forward-facing rock and basalt, preserving soft shores", () => {
  const segments = [
    ...planShoreline(cove, 3),
    ...planShoreline(cove, 3, "volcanic"),
    ...planShoreline(cove, 3, "marsh"),
  ];
  const faces = shorelineCliffFaces(segments, 14);
  assert.ok(faces.length > 0);
  assert.ok(
    faces.some((f) => f.kind === "rock") &&
      faces.some((f) => f.kind === "basalt"),
  );
  faces.forEach((f) => {
    assert.ok(f.normal[1] > 0);
    assert.equal(f.depth, 14);
    assert.ok(
      f.fissures.every(
        (p) => Number.isFinite(p.x) && p.variant >= 0 && p.variant < 1,
      ),
    );
  });
  assert.deepEqual(shorelineCliffFaces(segments, 0), []);
  assert.deepEqual(shorelineCliffFaces(segments, -1), []);
  assert.deepEqual(shorelineCliffFaces([], 14), []);
});

test("material areas join across vertices and the world seam without filling island interiors", async () => {
  const { shorelineMaterialRibbons } = await import("../src/core/shoreline.js");
  assert.deepEqual(shorelineMaterialRibbons([]), []);
  for (const biome of ["marsh", "temperate", "volcanic", "alpine"]) {
    for (const seed of [0, 3, 7, 811]) {
      const segments = planShoreline(square, seed, biome);
      const original = structuredClone(segments);
      const ribbons = shorelineMaterialRibbons(segments);
      assert.deepEqual(segments, original);
      assert.ok(ribbons.length > 0);
      assert.ok(ribbons.length < segments.length / 3);
      for (const ribbon of ribbons) {
        assert.ok(ribbon.points.length >= 4);
        assert.ok(
          ribbon.points.every(
            (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
          ),
        );
        assert.equal(
          pointInPolygon(
            140,
            95,
            ribbon.points.map((point) => [point.x, point.y]),
          ),
          false,
        );
      }
      const shifted = shorelineMaterialRibbons(
        planShoreline(
          square.map(([x, y]) => [x + 4800, y]),
          seed,
          biome,
        ),
      );
      assert.equal(shifted.length, ribbons.length);
      shifted.forEach((ribbon, i) => {
        assert.equal(ribbon.kind, ribbons[i].kind);
        ribbon.points.forEach((point, j) => {
          assert.ok(Math.abs(point.x - ribbons[i].points[j].x - 4800) < 1e-9);
          assert.ok(Math.abs(point.y - ribbons[i].points[j].y) < 1e-9);
        });
      });
    }
  }
  const spike = [
    [0, 0],
    [40, 0],
    [20, 0],
    [20, 30],
    [0, 30],
  ];
  const folded = shorelineMaterialRibbons(planShoreline(spike, 1, "marsh"));
  assert.ok(
    folded
      .flatMap((ribbon) => ribbon.points)
      .every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
  );
});
