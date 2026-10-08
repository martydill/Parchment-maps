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
