import assert from "node:assert/strict";
import test from "node:test";
import { drawHarborPlate } from "../src/harbor-plate.js";
import { PORT_NAMES } from "../src/names.js";

function recordingSurface(width, height) {
  const geometry = [];
  let depth = 0;
  const context = new Proxy(
    {
      globalAlpha: 1,
      createLinearGradient() {
        return { addColorStop() {} };
      },
      createRadialGradient() {
        return { addColorStop() {} };
      },
      save() {
        depth++;
      },
      restore() {
        depth--;
        assert.ok(depth >= 0);
      },
    },
    {
      get(target, property) {
        return (
          target[property] ??
          ((...args) => {
            geometry.push(...args.filter((value) => typeof value === "number"));
          })
        );
      },
    },
  );
  return {
    width,
    height,
    getContext: () => context,
    geometry,
    depth: () => depth,
  };
}

test("harbor plates fit wide and narrow canvases and restore drawing state for every port", () => {
  for (const name of Object.values(PORT_NAMES)) {
    for (const [width, height] of [
      [1440, 760],
      [390, 420],
    ]) {
      const surface = recordingSurface(width, height);
      const evolution = { level: 3, crisis: true };
      let drawCount = 0;
      const art = {
        draw(context, drawnName, drawnEvolution) {
          assert.equal(context, surface.getContext());
          assert.equal(drawnName, name);
          assert.equal(drawnEvolution, evolution);
          drawCount++;
        },
      };
      drawHarborPlate(
        surface,
        { name },
        { art, evolution, time: 14000, windAngle: 0.4 },
      );
      assert.equal(drawCount, 1);
      assert.equal(surface.depth(), 0);
      assert.ok(surface.geometry.every(Number.isFinite), name);
    }
  }
});

test("atlas plates accept older saves without evolution and unknown harbor names", () => {
  const surface = recordingSurface(720, 380);
  let received;
  drawHarborPlate(
    surface,
    { name: "Uncharted Haven" },
    {
      art: {
        draw: (_context, name, evolution) => {
          received = { name, evolution };
        },
      },
    },
  );
  assert.deepEqual(received, { name: "Uncharted Haven", evolution: {} });
  assert.equal(surface.depth(), 0);
  assert.ok(surface.geometry.every(Number.isFinite));
});

test("merged atlas plates inherit scene light and parallax while preserving arrival and reduced motion", async () => {
  const { sceneLighting } = await import("../src/core/lighting.js");
  const { portArrivalFrame } = await import("../src/core/port-scene.js");
  const light = sceneLighting(0.73);
  const surface = recordingSurface(1440, 760);
  const context = surface.getContext();
  const shifts = [];
  context.translate = (...values) => shifts.push(values);
  const plates = [];
  const ships = [];
  const options = {
    art: { draw: (...args) => plates.push(args) },
    lighting: light,
    pointer: { x: 1, y: -1 },
    ship: portArrivalFrame(1600).ship,
    drawPlayerShip: (...args) => ships.push(args),
    time: 1600,
  };
  drawHarborPlate(surface, { name: PORT_NAMES.orvessaQuay }, options);
  assert.equal(plates[0][4], light);
  assert.equal(ships[0][2], light);
  assert.equal(ships[0][3], 1600);
  assert.ok(shifts.some(([x, y]) => x === 24 && y === -14));
  assert.ok(surface.geometry.every(Number.isFinite));
  assert.equal(surface.depth(), 0);
  shifts.length = 0;
  drawHarborPlate(
    surface,
    { name: PORT_NAMES.orvessaQuay },
    { ...options, reducedMotion: true },
  );
  assert.equal(ships[1][3], 0);
  assert.ok(shifts[0].every((value) => value === 0));
  assert.equal(surface.depth(), 0);
});
