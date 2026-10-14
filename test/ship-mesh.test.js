import assert from "node:assert/strict";
import test from "node:test";
import { SHIP_MODEL_PROFILES } from "../src/core/ship-models.js";
import {
  buildCreatureHumpsMesh,
  buildLighthouseMesh,
  buildPortClusterMesh,
  buildRowboatMesh,
  buildVesselMesh,
} from "../src/core/ship-mesh.js";

const STRIDE = 10;

function bounds(mesh) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < mesh.vertexCount; v++) {
    for (let axis = 0; axis < 3; axis++) {
      const value = mesh.data[v * STRIDE + axis];
      min[axis] = Math.min(min[axis], value);
      max[axis] = Math.max(max[axis], value);
    }
  }
  return { min, max };
}

test("every ship class builds a sane, deterministic mesh", () => {
  for (const [name, profile] of Object.entries(SHIP_MODEL_PROFILES)) {
    const mesh = buildVesselMesh(profile);
    assert.ok(mesh.vertexCount > 100, `${name} has triangles`);
    assert.equal(mesh.data.length, mesh.vertexCount * STRIDE);
    const { min, max } = bounds(mesh);
    // Hull spans the profile length; rigging stays inside a sane envelope.
    assert.ok(min[0] >= -profile.length / 2 - 4, `${name} bow extent`);
    assert.ok(max[0] <= profile.length / 2 + 4, `${name} stern extent`);
    const beamExtent = profile.outrigger ? profile.beam * 2.4 : profile.beam;
    assert.ok(Math.abs(min[1]) <= beamExtent, `${name} beam extent`);
    assert.ok(max[2] > profile.deckHeight + 8, `${name} rigging rises`);
    assert.ok(min[2] < 0, `${name} hull draws some draft`);
    for (let v = 0; v < mesh.vertexCount; v++) {
      const sway = mesh.data[v * STRIDE + 9];
      assert.ok(sway >= 0 && sway <= 1.001, `${name} sway weight bounded`);
      for (let c = 0; c < 3; c++) {
        const color = mesh.data[v * STRIDE + 6 + c];
        assert.ok(color >= 0 && color <= 1.001);
      }
      const normalLength = Math.hypot(
        mesh.data[v * STRIDE + 3],
        mesh.data[v * STRIDE + 4],
        mesh.data[v * STRIDE + 5],
      );
      assert.ok(Math.abs(normalLength - 1) < 0.001, `${name} normals unit`);
    }
    const again = buildVesselMesh(profile);
    assert.deepEqual(Array.from(mesh.data), Array.from(again.data));
  }
});

test("bigger classes produce longer meshes", () => {
  const sloop = bounds(buildVesselMesh(SHIP_MODEL_PROFILES.sloop));
  const carrack = bounds(buildVesselMesh(SHIP_MODEL_PROFILES.carrack));
  assert.ok(
    carrack.max[0] - carrack.min[0] > sloop.max[0] - sloop.min[0],
    "carrack spans more than a sloop",
  );
  assert.ok(carrack.max[2] > sloop.max[2], "carrack rigs taller");
});

test("sails carry sway while hulls stay rigid", () => {
  const profile = SHIP_MODEL_PROFILES.carrack;
  const mesh = buildVesselMesh(profile);
  let swaying = false;
  let rigid = true;
  for (let v = 0; v < mesh.vertexCount; v++) {
    const sway = mesh.data[v * STRIDE + 9];
    const z = mesh.data[v * STRIDE + 2];
    if (sway > 0.3) swaying = true;
    // Hull vertices live at or below the deck line and must never sway.
    if (z <= profile.deckHeight && sway > 0) rigid = false;
  }
  assert.ok(swaying, "sail vertices sway");
  assert.ok(rigid, "hull vertices hold still");
});

test("the rowboat is a small open hull without rigging", () => {
  const mesh = buildRowboatMesh({});
  const { min, max } = bounds(mesh);
  assert.ok(max[2] < 6, "no masts");
  assert.ok(max[0] - min[0] < 20, "short boat");
});

test("the lighthouse is taller than it is wide", () => {
  const mesh = buildLighthouseMesh({ height: 50, baseRadius: 5 });
  const { min, max } = bounds(mesh);
  assert.ok(max[2] - min[2] > (max[0] - min[0]) * 2);
  assert.ok(max[2] > 40, "the cap tops the gallery");
});

test("port clusters differ by seed and stay near their origin", () => {
  const a = buildPortClusterMesh({ seed: 3, houses: 6 });
  const b = buildPortClusterMesh({ seed: 4, houses: 6 });
  assert.notDeepEqual(Array.from(a.data), Array.from(b.data));
  const { min, max } = bounds(a);
  assert.ok(Math.abs(min[0]) < 60 && Math.abs(max[0]) < 60);
  assert.equal(
    buildPortClusterMesh({ seed: 3, houses: 6 }).vertexCount,
    a.vertexCount,
  );
});

test("creature humps form a row of domes", () => {
  const mesh = buildCreatureHumpsMesh({ count: 4, radius: 8 });
  const { min, max } = bounds(mesh);
  assert.ok(max[2] > 6, "domes rise");
  assert.ok(max[0] - min[0] > 30, "humps spread along the body");
  assert.ok(Math.abs(min[2]) < 0.001, "domes start at the sea plane");
});
