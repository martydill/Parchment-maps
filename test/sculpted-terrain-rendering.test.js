import assert from "node:assert/strict";
import test from "node:test";
import { planTerrainIllustration } from "../src/core/terrain.js";
import { seasonalAppearance } from "../src/core/seasons.js";
import { terrainPalette } from "../src/terrain-rendering.js";
import {
  createTerrainDetailRendering,
  drawCliffDetails,
  drawTerrainDetails,
} from "../src/sculpted-terrain-rendering.js";
import { cliffFacePlans } from "../src/core/terrain-detail.js";

function recorder() {
  const calls = [];
  const stack = [];
  const c = new Proxy(
    {
      globalAlpha: 1,
      globalCompositeOperation: "source-over",
      save() {
        stack.push({
          alpha: this.globalAlpha,
          operation: this.globalCompositeOperation,
        });
      },
      restore() {
        const state = stack.pop();
        this.globalAlpha = state.alpha;
        this.globalCompositeOperation = state.operation;
      },
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
    },
    {
      get(target, key) {
        return (
          target[key] ??
          ((...args) =>
            calls.push({
              method: key,
              args,
              alpha: target.globalAlpha,
              operation: target.globalCompositeOperation,
            }))
        );
      },
    },
  );
  return { c, calls };
}

const poly = [
  [0, 0],
  [620, 0],
  [620, 500],
  [0, 500],
];

test("sculpted detail covers every biome and season without changing geography or canvas state", () => {
  for (const biome of [
    "temperate",
    "alpine",
    "tropical",
    "arid",
    "volcanic",
    "marsh",
  ]) {
    const terrain = planTerrainIllustration(poly, 42, {
      mountainous: true,
      biome,
    });
    const original = structuredClone(terrain);
    for (const day of [1, 25, 49, 73])
      for (const fine of [false, true]) {
        const { c, calls } = recorder();
        c.globalAlpha = 0.7;
        const palette = terrainPalette(biome, seasonalAppearance(day, biome));
        drawCliffDetails(c, cliffFacePlans(poly, 20), fine);
        drawTerrainDetails(c, terrain, palette, fine);
        assert.equal(c.globalAlpha, 0.7);
        assert.equal(c.globalCompositeOperation, "source-over");
        assert.ok(calls.some((call) => call.method === "stroke"));
        const coordinates = calls
          .filter((call) =>
            [
              "moveTo",
              "lineTo",
              "ellipse",
              "quadraticCurveTo",
              "bezierCurveTo",
            ].includes(call.method),
          )
          .flatMap((call) => call.args);
        assert.ok(
          coordinates.every(Number.isFinite),
          `${biome}, day ${day}, fine ${fine}`,
        );
      }
    assert.deepEqual(terrain, original);
  }
});

test("detail plates cull distant islands, reuse art through zoom and world seams, and refresh seasonal colors in place", () => {
  const previous = globalThis.document;
  const canvases = [];
  globalThis.document = {
    createElement() {
      const { c, calls } = recorder();
      const canvas = { getContext: () => c, calls };
      canvases.push(canvas);
      return canvas;
    },
  };
  try {
    const terrain = planTerrainIllustration(poly, 42, { mountainous: true });
    let day = 25;
    const renderer = createTerrainDetailRendering({
      world: { w: 4800, h: 3200 },
      islands: [{ poly, terrain, depth: 20 }],
      paletteFor: (biome) =>
        terrainPalette(biome, seasonalAppearance(day, biome)),
    });
    const { c, calls } = recorder();
    const options = {
      camera: { x: 310, y: 250, zoom: 0.7 },
      vw: 800,
      vh: 600,
      reducedMotion: true,
    };
    renderer.draw(c, options);
    assert.equal(
      canvases.length,
      0,
      "overview does not allocate fine-detail plates",
    );
    options.camera.zoom = 1.5;
    options.camera.y = 2000;
    renderer.draw(c, options);
    options.camera.y = 250;
    options.camera.x = 2000;
    renderer.draw(c, options);
    assert.equal(canvases.length, 0, "off-screen land is never baked");
    options.camera.x = 310;
    c.globalAlpha = 0.8;
    renderer.draw(c, options);
    assert.equal(canvases.length, 2);
    assert.equal(c.globalAlpha, 0.8);
    const firstDraw = calls.filter((call) => call.method === "drawImage");
    assert.equal(firstDraw.length, 2);
    assert.ok(firstDraw.every((call) => call.alpha === 0.8));
    const bakes = canvases[0].calls.length;
    options.camera.zoom = 1.1;
    renderer.draw(c, options);
    assert.equal(
      canvases[0].calls.length,
      bakes,
      "zoom only blends existing art",
    );
    options.camera.x += 4800;
    renderer.draw(c, options);
    const seamDraw = calls.filter((call) => call.method === "drawImage").at(-2);
    assert.equal(seamDraw.args[1], firstDraw[0].args[1] + 4800);
    assert.equal(
      canvases.length,
      2,
      "world copies share their original detail plate",
    );
    day = 73;
    renderer.invalidate();
    renderer.draw(c, options);
    assert.equal(
      canvases.length,
      2,
      "season changes repaint existing canvases",
    );
    assert.ok(canvases[0].calls.length > bakes);
    assert.ok(canvases[0].calls.some((call) => call.method === "clearRect"));
    options.detail = 0;
    const count = calls.length;
    renderer.draw(c, options);
    assert.equal(calls.length, count);
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});

test("detail cache releases the oldest distant plate when its pixel budget is exceeded", () => {
  const previous = globalThis.document;
  const canvases = [];
  globalThis.document = {
    createElement() {
      const { c } = recorder();
      const canvas = { getContext: () => c };
      canvases.push(canvas);
      return canvas;
    },
  };
  try {
    const terrain = { biome: "temperate", ridges: [], ranges: [], groves: [] };
    const islands = [0, 1800, 3600].map((offset) => ({
      poly: [
        [offset, 0],
        [offset + 1000, 0],
        [offset + 1000, 1000],
        [offset, 1000],
      ],
      terrain,
      depth: 20,
    }));
    const renderer = createTerrainDetailRendering({
      world: { w: 6000, h: 3200 },
      islands,
      paletteFor: terrainPalette,
    });
    const { c } = recorder();
    for (const x of [500, 2300, 4100])
      renderer.draw(c, { camera: { x, y: 500, zoom: 1.5 }, vw: 600, vh: 600 });
    assert.equal(canvases.length, 6);
    assert.equal(canvases[0].width, 0);
    assert.equal(canvases[2].width, 0);
    assert.ok(canvases[4].width > 0);
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});
