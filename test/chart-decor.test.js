import assert from "node:assert/strict";
import test from "node:test";

import {
  WIND_ROSE_NAMES,
  cartoucheInscription,
  coastAspect,
  createRhumbWeb,
  edgeDepthAt,
  foldCreases,
  foxingClusters,
  islandTint,
  portChartLabel,
  rhumbInk,
  rhumbRayAngles,
  roseTickPoints,
  scaleBarSpec,
  tatteredEdge,
  tidelineRingPoints,
  tidelines,
  waxDrops,
} from "../src/core/chart-decor.js";

const WORLD = { width: 4800, height: 3200 };

test("wind rose names run clockwise from north", () => {
  assert.equal(WIND_ROSE_NAMES.length, 8);
  assert.equal(WIND_ROSE_NAMES[0].label, "TRAMONTANA");
  assert.equal(WIND_ROSE_NAMES[0].angle, -Math.PI / 2);
  assert.equal(WIND_ROSE_NAMES[2].label, "LEVANTE");
  for (const wind of WIND_ROSE_NAMES) {
    assert.ok(Number.isFinite(wind.angle));
    assert.ok(wind.label.length > 0);
  }
});

test("rhumb inks alternate between vermillion and viridian", () => {
  assert.equal(rhumbInk(0).color, "146,44,34");
  assert.ok(rhumbInk(0).major);
  assert.equal(rhumbInk(1).color, "44,98,66");
  assert.ok(!rhumbInk(1).major);
  assert.equal(rhumbInk(2).color, rhumbInk(0).color);
});

test("rhumb ray angles start at north and wrap evenly", () => {
  const rays = rhumbRayAngles(16);
  assert.equal(rays.length, 16);
  assert.equal(rays[0], -Math.PI / 2);
  for (let index = 1; index < rays.length; index += 1)
    assert.ok(rays[index] > rays[index - 1]);
  assert.ok(Math.abs(rays[15] + Math.PI / 2 - (15 * Math.PI * 2) / 16) < 1e-9);
  assert.deepEqual(rhumbRayAngles(3), []);
  assert.deepEqual(rhumbRayAngles(65), []);
  assert.deepEqual(rhumbRayAngles(7.5), []);
});

test("rose tick points alternate reach by wind rank", () => {
  assert.deepEqual(roseTickPoints(0), []);
  assert.deepEqual(roseTickPoints(-4), []);
  const ticks = roseTickPoints(100);
  assert.equal(ticks.length, 32);
  assert.ok(Math.abs(ticks[0][0]) < 1e-9);
  assert.ok(Math.abs(ticks[0][1] + 100) < 1e-9);
  // Cardinal ticks reach the rim, quarter winds stop short of it.
  assert.equal(Math.hypot(...ticks[0]), 100);
  assert.ok(Math.hypot(...ticks[2]) < 100);
  assert.ok(Math.hypot(...ticks[1]) < Math.hypot(...ticks[2]));
});

test("rhumb web keeps anchors and adds hidden centers on open water", () => {
  const anchors = [
    [WORLD.width * 0.36, WORLD.height * 0.1],
    [WORLD.width * 0.72, WORLD.height * 0.13],
  ];
  const web = createRhumbWeb({ ...WORLD, anchors, count: 9 }, () => true, 4711);
  assert.equal(web.length, anchors.length + 9);
  assert.ok(web.slice(0, anchors.length).every((center) => center.major));
  assert.ok(web.slice(anchors.length).every((center) => !center.major));
  for (const center of web) {
    assert.ok(center.radius > 0);
    assert.ok(center.y > 120 && center.y < WORLD.height - 120);
  }
  const hidden = web.slice(anchors.length);
  for (let index = 0; index < hidden.length; index += 1)
    for (let other = index + 1; other < hidden.length; other += 1) {
      const dx = Math.abs(hidden[index].x - hidden[other].x);
      const apartX = Math.min(dx, WORLD.width - dx);
      assert.ok(
        apartX >= 560 * 0.6 ||
          Math.abs(hidden[index].y - hidden[other].y) >= 560 * 0.35,
      );
    }
});

test("rhumb web is deterministic and avoids land", () => {
  const isSea = (x, y) => !(x > 2000 && x < 2800 && y > 1200 && y < 2000);
  const first = createRhumbWeb({ ...WORLD, count: 6 }, isSea, 99);
  const second = createRhumbWeb({ ...WORLD, count: 6 }, isSea, 99);
  assert.deepEqual(first, second);
  for (const center of first.slice(0, 0).concat(first)) {
    if (center.major) continue;
    assert.ok(
      !(
        center.x > 2000 &&
        center.x < 2800 &&
        center.y > 1200 &&
        center.y < 2000
      ),
    );
  }
  // All-land worlds yield nothing beyond the anchors.
  const dry = createRhumbWeb({ ...WORLD, count: 4 }, () => false, 5);
  assert.equal(dry.filter((center) => !center.major).length, 0);
  assert.deepEqual(
    createRhumbWeb({ width: 0, height: 0 }, () => true, 5),
    [],
  );
  // Malformed sheet dimensions never produce NaN centers.
  assert.deepEqual(
    createRhumbWeb({ width: undefined, height: 3200 }, () => true, 5),
    [],
  );
});

test("coast aspect estimates shoreline direction and seaward side", () => {
  // Vertical shore with land to the west: the coast runs north-south.
  const vertical = coastAspect((x) => x < 500, 500, 800);
  assert.ok(vertical);
  assert.ok(Math.abs(Math.abs(vertical.angle) - Math.PI / 2) < 0.3);
  assert.ok(vertical.seaward.x > 0.7);

  // Horizontal shore with land to the north flips to keep text upright.
  const horizontal = coastAspect((x, y) => y < 300, 800, 300);
  assert.ok(horizontal);
  assert.ok(Math.abs(horizontal.angle) < 0.3);
  assert.ok(horizontal.flipped);
  assert.ok(horizontal.seaward.y > 0.7);

  // Open water and deep interior have no shoreline to label.
  assert.equal(
    coastAspect(() => false, 0, 0),
    null,
  );
  assert.equal(
    coastAspect(() => true, 0, 0),
    null,
  );
  assert.equal(
    coastAspect(() => false, 0, 0, 0),
    null,
  );
});

test("port chart labels reserve red boxes for the great ports", () => {
  assert.deepEqual(portChartLabel({ home: true }, false), {
    tone: "red",
    boxed: true,
  });
  assert.deepEqual(portChartLabel({}, true), { tone: "red", boxed: true });
  assert.deepEqual(portChartLabel({}, false), {
    tone: "black",
    boxed: false,
  });
  assert.deepEqual(portChartLabel(null, false), {
    tone: "black",
    boxed: false,
  });
});

test("tattered edges sweep the sheet with bounded, seeded bites", () => {
  const points = tatteredEdge(808, { maxDepth: 15, biteDepth: 24 });
  assert.equal(points[0].u, 0);
  assert.equal(points.at(-1).u, 1);
  let previousU = -1;
  for (const point of points) {
    assert.ok(point.u > previousU);
    previousU = point.u;
    assert.ok(point.depth > 0);
    assert.ok(point.depth <= 24);
  }
  assert.deepEqual(points, tatteredEdge(808, { maxDepth: 15, biteDepth: 24 }));
  assert.notDeepEqual(
    points,
    tatteredEdge(809, { maxDepth: 15, biteDepth: 24 }),
  );
});

test("edge depth interpolates between tatter points", () => {
  assert.equal(edgeDepthAt([], 0.5), 0);
  const points = [
    { u: 0, depth: 4 },
    { u: 0.5, depth: 10 },
    { u: 1, depth: 0 },
  ];
  assert.equal(edgeDepthAt(points, 0.25), 7);
  assert.equal(edgeDepthAt(points, -1), 4);
  assert.equal(edgeDepthAt(points, 2), 0);
  assert.equal(edgeDepthAt([{ u: 0, depth: 5 }], 0.7), 5);
  assert.equal(
    edgeDepthAt(
      [
        { u: 0.2, depth: 5 },
        { u: 0.2, depth: 8 },
      ],
      0.2,
    ),
    8,
  );
});

test("foxing clusters scatter bounded speckles deterministically", () => {
  const anchors = [
    { x: 100, y: 150, spread: 60 },
    { x: 4700, y: 110, spread: 50 },
  ];
  const clusters = foxingClusters(911, anchors);
  assert.equal(clusters.length, anchors.length);
  for (const cluster of clusters) {
    assert.ok(cluster.speckles.length >= 7);
    assert.ok(cluster.speckles.length <= 18);
    for (const speckle of cluster.speckles) {
      assert.ok(Math.abs(speckle.dx) <= 60);
      assert.ok(Math.abs(speckle.dy) <= 60 * 0.8 + 1e-9);
      assert.ok(speckle.r >= 0.6 && speckle.r <= 3.2);
      assert.ok(speckle.alpha >= 0.05 && speckle.alpha <= 0.21);
    }
  }
  assert.deepEqual(clusters, foxingClusters(911, anchors));
  assert.deepEqual(foxingClusters(911, []), []);
});

test("tideline stains sit inside the sheet with growing rings", () => {
  const stains = tidelines(WORLD, 3391, 3);
  assert.equal(stains.length, 3);
  for (const stain of stains) {
    assert.ok(stain.x >= 0 && stain.x <= WORLD.width);
    assert.ok(stain.y >= 0 && stain.y <= WORLD.height);
    assert.ok(stain.lobes >= 7 && stain.lobes <= 11);
    assert.ok(stain.wobble >= 0.06 && stain.wobble <= 0.15);
    assert.equal(stain.rings.length, 3);
    assert.ok(stain.rings[0] < stain.rings[1]);
    assert.ok(stain.rings[1] < stain.rings[2]);
  }
  assert.deepEqual(stains, tidelines(WORLD, 3391, 3));
  assert.deepEqual(tidelines({ width: 0, height: 0 }, 1, 3), []);
  assert.deepEqual(tidelines({ width: 4800, height: NaN }, 1, 3), []);
});

test("tideline ring points close their contour", () => {
  assert.deepEqual(tidelineRingPoints(0, 0, 0, 8, 0.1, 0), []);
  assert.deepEqual(tidelineRingPoints(0, 0, 50, 2, 0.1, 0), []);
  const points = tidelineRingPoints(100, 100, 50, 8, 0.1, 1.2);
  assert.equal(points.length, 64 + 1);
  assert.ok(Math.abs(points[0][0] - points.at(-1)[0]) < 1e-6);
  assert.ok(Math.abs(points[0][1] - points.at(-1)[1]) < 1e-6);
  for (const [x, y] of points) {
    const radius = Math.hypot(x - 100, y - 100);
    assert.ok(radius > 50 * 0.8 && radius < 50 * 1.2);
  }
});

test("wax drops land inside the sheet", () => {
  const drops = waxDrops(WORLD, 5153, 5);
  assert.equal(drops.length, 5);
  for (const drop of drops) {
    assert.ok(drop.x >= 0 && drop.x <= WORLD.width);
    assert.ok(drop.y >= 0 && drop.y <= WORLD.height);
    assert.ok(drop.r >= 5 && drop.r <= 16);
    assert.ok(drop.alpha >= 0.1 && drop.alpha <= 0.18);
  }
  assert.deepEqual(drops, waxDrops(WORLD, 5153, 5));
  assert.deepEqual(waxDrops({ width: 0, height: 0 }, 1, 5), []);
  assert.deepEqual(waxDrops({ width: 4800, height: NaN }, 1, 5), []);
});

test("fold creases run across the sheet from edge to edge", () => {
  const creases = foldCreases(WORLD.width, WORLD.height, 6067);
  assert.equal(creases.length, 2);
  // The storage fold runs edge to edge; the table crease starts mid-sheet.
  assert.equal(creases[0].y0, 0);
  assert.equal(creases[0].y1, WORLD.height);
  assert.ok(creases[1].y0 > 0 && creases[1].y0 < WORLD.height * 0.3);
  for (const crease of creases) {
    assert.equal(crease.y1, WORLD.height);
    assert.ok(crease.x0 >= 0 && crease.x0 <= WORLD.width);
    assert.ok(crease.x1 >= 0 && crease.x1 <= WORLD.width);
    assert.ok(crease.cy > 0 && crease.cy < WORLD.height);
  }
  assert.deepEqual(creases, foldCreases(WORLD.width, WORLD.height, 6067));
  assert.deepEqual(foldCreases(0, 0, 6067), []);
  assert.deepEqual(foldCreases(4800, NaN, 6067), []);
});

test("scale bar hugs the lower-left border of the sheet", () => {
  const spec = scaleBarSpec(WORLD);
  assert.ok(spec);
  assert.equal(spec.segments, 8);
  assert.equal(spec.width, spec.segment * spec.segments);
  assert.equal(spec.x, 216);
  assert.equal(spec.y, WORLD.height * 0.13);
  assert.ok(spec.values[0] < spec.values[1]);
  assert.equal(spec.values.at(-1), spec.total);
  assert.equal(scaleBarSpec({ width: 0, height: 1000 }), null);
  assert.equal(scaleBarSpec({ width: 4800, height: undefined }), null);
});

test("island tints wash only every third named island", () => {
  assert.equal(islandTint(undefined, 0), null);
  assert.equal(islandTint("Thrymm Spires", 1), null);
  assert.equal(islandTint("Thrymm Spires", 2), null);
  const tint = islandTint("Thrymm Spires", 3);
  assert.ok(typeof tint === "string" && tint.startsWith("rgba("));
  assert.equal(tint, islandTint("Thrymm Spires", 3));
  // Different islands pick their own pigment from the same small set.
  assert.ok(
    ["Thrymm Spires", "Drazhmark", "Veyr Ashreach", "Sivvyn Isle"].every(
      (name, index) =>
        islandTint(name, (index + 1) * 3) === null ||
        islandTint(name, (index + 1) * 3).startsWith("rgba("),
    ),
  );
});

test("cartouche inscription names the home port deterministically", () => {
  const line = cartoucheInscription("Orvessa Quay", 17);
  assert.ok(line.includes("Orvessa Quay"));
  assert.equal(line, cartoucheInscription("Orvessa Quay", 17));
  const variants = new Set(
    [1, 2, 3, 4, 5].map((seed) => cartoucheInscription("Orvessa Quay", seed)),
  );
  assert.ok(variants.size > 1);
});
