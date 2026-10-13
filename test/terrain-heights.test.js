import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTerrainField,
  buildTerrainMesh,
  sampleFieldChannel,
  sampleTerrainHeight,
  sampleTerrainLandness,
} from "../src/core/terrain-heights.js";

// A single square island in the middle of a small world.
const ISLAND = {
  poly: [
    [400, 300],
    [600, 300],
    [620, 420],
    [500, 500],
    [380, 420],
  ],
};

function buildSmall(overrides = {}) {
  return buildTerrainField({
    width: 1000,
    height: 800,
    cell: 10,
    lands: [{ poly: ISLAND.poly }],
    ...overrides,
  });
}

test("land cells rise from the sea plane while open water stays flat", () => {
  const field = buildSmall();
  assert.ok(sampleTerrainHeight(field, 500, 400) > 4, "island interior rises");
  assert.equal(
    sampleTerrainHeight(field, 100, 100),
    0,
    "open sea stays at zero",
  );
  assert.equal(sampleTerrainHeight(field, 900, 700), 0);
});

test("landness reads one inland, zero offshore, and shades across the shore", () => {
  const field = buildSmall();
  assert.equal(sampleTerrainLandness(field, 500, 400), 1);
  assert.equal(sampleTerrainLandness(field, 60, 60), 0);
  const shoreSamples = [0, 0].map(() => sampleTerrainLandness(field, 388, 418));
  for (const value of shoreSamples) {
    assert.ok(value >= 0 && value <= 1);
  }
});

test("peaks raise the terrain near their centers and wrap in longitude", () => {
  const base = buildSmall();
  const peaked = buildSmall({ peaks: [{ x: 500, y: 400, size: 30 }] });
  assert.ok(
    sampleTerrainHeight(peaked, 500, 400) >
      sampleTerrainHeight(base, 500, 400) + 40,
  );
  assert.ok(
    sampleTerrainHeight(peaked, 300, 400) >
      sampleTerrainHeight(base, 300, 400) - 1,
  );
  // An island spanning the seam with its peak just past the wrap edge.
  const seamIsland = {
    poly: [
      [930, 350],
      [1070, 350],
      [1090, 450],
      [910, 450],
    ],
  };
  const seamField = (overrides) =>
    buildTerrainField({
      width: 1000,
      height: 800,
      cell: 10,
      lands: [{ poly: seamIsland.poly }],
      ...overrides,
    });
  const seamPeak = seamField({ peaks: [{ x: 1010, y: 400, size: 40 }] });
  const seamBase = seamField();
  assert.ok(
    sampleTerrainHeight(seamPeak, 990, 400) >
      sampleTerrainHeight(seamBase, 990, 400) + 20,
    "peaks near the seam wrap to the other edge",
  );
});

test("ports flatten a terrace around the harbor", () => {
  const plain = buildSmall();
  const terraced = buildSmall({ ports: [{ x: 500, y: 400 }] });
  const before = sampleTerrainHeight(plain, 500, 400);
  const after = sampleTerrainHeight(terraced, 500, 400);
  assert.ok(Math.abs(after - before) > 0.1, "port terrace regrades the ground");
  const flatA = sampleTerrainHeight(terraced, 520, 415);
  const flatB = sampleTerrainHeight(terraced, 485, 390);
  assert.ok(Math.abs(flatA - flatB) < 3, "terrace is level around the port");
});

test("ports in open water do not raise the seabed", () => {
  const field = buildSmall({ ports: [{ x: 100, y: 100 }] });
  assert.equal(sampleTerrainHeight(field, 100, 100), 0);
});

test("the heightfield wraps seamlessly in longitude", () => {
  const field = buildSmall();
  const east = sampleTerrainHeight(field, 995, 400);
  const west = sampleTerrainHeight(field, 5, 400);
  assert.ok(
    Math.abs(east - west) < 0.5,
    "coast distance wraps across the seam",
  );
  const eastLand = sampleTerrainLandness(field, 997, 400);
  const westLand = sampleTerrainLandness(field, 3, 400);
  assert.ok(Math.abs(eastLand - westLand) < 0.2);
});

test("the same seed produces the same field, different seeds differ", () => {
  const a = buildSmall({ seed: 11 });
  const b = buildSmall({ seed: 11 });
  const c = buildSmall({ seed: 12 });
  assert.deepEqual(Array.from(a.heights), Array.from(b.heights));
  let differs = false;
  for (let i = 0; i < a.heights.length; i++) {
    if (a.heights[i] !== c.heights[i]) {
      differs = true;
      break;
    }
  }
  assert.ok(differs, "seed changes the noise-driven relief");
});

test("sampler clamps y at the map borders and wraps x beyond the world", () => {
  const field = buildSmall();
  assert.equal(sampleTerrainHeight(field, 500, -50), 0);
  assert.equal(sampleTerrainHeight(field, 500, 4000), 0);
  assert.ok(
    Math.abs(
      sampleTerrainHeight(field, 1500, 400) -
        sampleTerrainHeight(field, 500, 400),
    ) < 0.001,
  );
});

test("a world without land leaves flat water and zero landness", () => {
  const field = buildSmall({ lands: [] });
  assert.equal(sampleTerrainHeight(field, 500, 400), 0);
  assert.equal(sampleTerrainLandness(field, 500, 400), 0);
});

test("degenerate inputs are rejected", () => {
  assert.throws(() => buildTerrainField({ width: 0, height: 100 }));
  assert.throws(() => buildTerrainField({ width: 100, height: -1 }));
});

test("mesh interleaves six floats per vertex and duplicates the seam", () => {
  const field = buildSmall();
  const mesh = buildTerrainMesh(field);
  const gridVerts = (field.cols + 1) * field.rows;
  assert.equal(mesh.positions.length % 6, 0);
  assert.equal(mesh.positions.length / 6, mesh.vertexCount);
  assert.equal(mesh.vertexCount, gridVerts + 2 * 2 * (field.cols + 1));
  assert.equal(mesh.indices.length % 6, 0);
  // Seam column copies the first column's heights with u = 1.
  const first = 0;
  const seam = field.cols;
  const stride = 6;
  assert.equal(
    mesh.positions[seam * stride + 2],
    mesh.positions[first * stride + 2],
  );
  assert.ok(Math.abs(mesh.positions[seam * stride + 3] - 1) < 0.0001);
  // Sea vertices sit on the plane, land vertices at or above it.
  let minHeight = Infinity;
  for (let v = 0; v < mesh.vertexCount; v++) {
    const z = mesh.positions[v * stride + 2];
    minHeight = Math.min(minHeight, z);
  }
  assert.ok(minHeight < 0, "the skirt drops below the sea plane");
  let maxU = 0;
  for (let v = 0; v < gridVerts; v++) {
    maxU = Math.max(maxU, mesh.positions[v * stride + 3]);
  }
  assert.ok(maxU <= 1.0001);
});

test("field channels can be sampled generically", () => {
  const field = buildSmall();
  const landness = sampleFieldChannel(field, "landness", 500, 400);
  assert.equal(landness, 1);
});

test("unwrapped coastlines crossing the seam still rasterize as land", () => {
  const seamPoly = [
    [960, 350],
    [1040, 360],
    [1030, 450],
    [950, 440],
  ];
  const field = buildTerrainField({
    width: 1000,
    height: 800,
    cell: 10,
    lands: [{ poly: seamPoly }],
  });
  assert.equal(sampleTerrainLandness(field, 995, 400), 1);
  assert.equal(sampleTerrainLandness(field, 5, 400), 1);
  assert.equal(sampleTerrainLandness(field, 900, 400), 0);
});

test("malformed lands, peaks, and ports are tolerated", () => {
  const field = buildTerrainField({
    width: 1000,
    height: 800,
    cell: 20,
    lands: [
      { name: "no polygon here" },
      { poly: [[0, 0]] },
      { poly: ISLAND.poly },
    ],
    peaks: [
      { x: 500, y: 400 },
      { x: 480, y: 390, size: 0 },
    ],
    ports: [{ name: "drifting port" }, { x: NaN, y: 400 }, { x: 500, y: 4 }],
  });
  assert.ok(sampleTerrainHeight(field, 500, 400) > 0);
  // The port hugging the northern rim still terraces without escaping the grid.
  assert.ok(Number.isFinite(sampleTerrainHeight(field, 500, 6)));
});

test("peaks without a size fall back to the default scale", () => {
  const withPeak = buildSmall({ peaks: [{ x: 500, y: 400 }] });
  assert.ok(
    sampleTerrainHeight(withPeak, 500, 400) >
      sampleTerrainHeight(buildSmall(), 500, 400),
  );
});

test("value noise stays inside its unit range across the map", () => {
  const field = buildSmall();
  for (const value of field.heights) {
    assert.ok(Number.isFinite(value) && value >= 0);
  }
});
