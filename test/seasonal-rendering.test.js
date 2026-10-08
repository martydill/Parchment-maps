import assert from "node:assert/strict";
import test from "node:test";
import { createMapRendering } from "../src/rendering.js";
import { seasonalAppearance } from "../src/core/seasons.js";
import { planTerrainIllustration } from "../src/core/terrain.js";
import {
  drawTerrainIllustration,
  terrainPalette,
  seasonalLandColor,
} from "../src/terrain-rendering.js";
import { createSeasonalWorldRendering } from "../src/seasonal-world-rendering.js";

function canvasRecorder() {
  const colors = [];
  const coordinates = [];
  const stops = [];
  let fills = 0;
  const context = new Proxy(
    {
      globalAlpha: 1,
      createRadialGradient: () => ({
        addColorStop: (_position, color) => stops.push(color),
      }),
      createLinearGradient: () => ({
        addColorStop: (_position, color) => stops.push(color),
      }),
      fill: () => fills++,
    },
    {
      get: (target, property) =>
        target[property] ??
        ((...args) => {
          if (
            [
              "moveTo",
              "lineTo",
              "arc",
              "ellipse",
              "bezierCurveTo",
              "quadraticCurveTo",
            ].includes(property)
          )
            coordinates.push(...args);
        }),
      set(target, property, value) {
        if (property === "fillStyle" || property === "strokeStyle")
          colors.push(value);
        target[property] = value;
        return true;
      },
    },
  );
  return { context, colors, coordinates, stops, fillCount: () => fills };
}

test("forests blossom and gather snow without altering their terrain plan", () => {
  const terrain = planTerrainIllustration(
    [
      [0, 0],
      [600, 0],
      [600, 500],
      [0, 500],
    ],
    42,
    {
      biome: "temperate",
      mountainous: true,
    },
  );
  const original = structuredClone(terrain);
  const plates = [];
  for (const day of [1, 25, 49, 73]) {
    const recorder = canvasRecorder();
    drawTerrainIllustration(recorder.context, terrain, seasonalAppearance(day));
    assert.ok(recorder.coordinates.every(Number.isFinite));
    plates.push(recorder.colors);
  }
  assert.ok(plates[0].includes("#f2d0ce"));
  assert.ok(!plates[1].includes("#f2d0ce"));
  assert.ok(!plates[1].includes("#edf3ef"));
  assert.ok(plates[3].includes("#edf3ef"));
  assert.notDeepEqual(plates[1], plates[2]);
  assert.deepEqual(terrain, original);
  const summer = terrainPalette("temperate", seasonalAppearance(25));
  assert.notEqual(
    summer.paper,
    terrainPalette("temperate", seasonalAppearance(73)).paper,
  );
  assert.equal(
    terrainPalette("tropical", seasonalAppearance(73, "tropical")).paper,
    terrainPalette("tropical").paper,
  );
});

test("seasonal ground cover changes entire islands, bare hills, plains, and river valleys", () => {
  for (const biome of [
    "temperate",
    "alpine",
    "tropical",
    "arid",
    "volcanic",
    "marsh",
  ]) {
    const spring = terrainPalette(biome, seasonalAppearance(1, biome));
    const summer = terrainPalette(biome, seasonalAppearance(25, biome));
    assert.notEqual(spring.paper, summer.paper, biome);
    assert.notEqual(spring.wash, summer.wash, biome);
  }
  assert.equal(seasonalLandColor("#443322", seasonalAppearance(73)), "#d6dbd4");
  const terrain = {
    biome: "temperate",
    ridges: [],
    ranges: [],
    groves: [],
    tributaries: [],
    plains: [{ x: 100, y: 100, angle: 0 }],
    hills: [{ x: 200, y: 200, size: 20 }],
    rivers: [
      [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
      ],
    ],
  };
  const spring = canvasRecorder();
  const winter = canvasRecorder();
  drawTerrainIllustration(spring.context, terrain, seasonalAppearance(1));
  drawTerrainIllustration(winter.context, terrain, seasonalAppearance(73));
  assert.ok(
    spring.colors.includes("#f2d0ce"),
    "meadows bloom without a forest or port",
  );
  assert.ok(
    winter.colors.includes("#f3f7f5"),
    "river ice follows the existing river",
  );
  assert.notDeepEqual(
    spring.stops,
    winter.stops,
    "hills and plains change their ground cover",
  );
});

test("seasonal weather renders over wilderness and open sea without any harbor data", () => {
  const world = { w: 1000, h: 700 };
  const lands = [
    {
      name: "Temperate wilderness",
      poly: [
        [200, 0],
        [600, 0],
        [600, 700],
        [200, 700],
      ],
    },
  ];
  const renderer = createSeasonalWorldRendering({ world, lands });
  const options = {
    camera: { x: 400, y: 350, zoom: 1 },
    vw: 500,
    vh: 400,
    time: 1000,
    day: 1,
    reducedMotion: false,
  };
  const spring = canvasRecorder();
  renderer.draw(spring.context, options);
  assert.ok(spring.fillCount() > 0);
  const summer = canvasRecorder();
  renderer.draw(summer.context, { ...options, day: 25 });
  assert.equal(summer.fillCount(), 0);
  const winter = canvasRecorder();
  renderer.draw(winter.context, {
    ...options,
    day: 73,
    camera: { ...options.camera, x: 900 },
  });
  assert.ok(
    winter.fillCount() > 0,
    "snow falls at sea away from land and ports",
  );
  assert.ok(winter.coordinates.every(Number.isFinite));
  assert.equal(renderer.biomeAt(900, 350), "temperate");
  const still = canvasRecorder();
  const later = canvasRecorder();
  renderer.draw(still.context, { ...options, day: 73, reducedMotion: true });
  renderer.draw(later.context, {
    ...options,
    day: 73,
    reducedMotion: true,
    time: 20000,
  });
  assert.deepEqual(still.coordinates, later.coordinates);
  const seam = canvasRecorder();
  renderer.draw(seam.context, {
    ...options,
    day: 73,
    reducedMotion: true,
    camera: { ...options.camera, x: 1400 },
  });
  assert.equal(seam.fillCount(), still.fillCount());
});

test("the map refreshes only for changed seasonal pigments and retains rivers and canvas allocations", () => {
  const previous = globalThis.document;
  const canvases = [];
  globalThis.document = {
    createElement() {
      const recorder = canvasRecorder();
      const canvas = { getContext: () => recorder.context, recorder };
      canvases.push(canvas);
      return canvas;
    },
  };
  try {
    const game = { day: 1, regionalEconomy: {} };
    const rendering = createMapRendering({
      WORLD: { w: 4800, h: 3200 },
      game,
      merchantRoutePaths: [],
    });
    const count = canvases.length;
    const riverPaths = structuredClone(rendering.riverPaths);
    const fills = canvases[0].recorder.fillCount();
    assert.equal(rendering.updateSeason(), false);
    game.day = 2;
    assert.equal(rendering.updateSeason(), false);
    assert.equal(canvases[0].recorder.fillCount(), fills);
    assert.equal(
      rendering.updateSeason(73),
      true,
      "preview a season without changing the saved day",
    );
    assert.equal(game.day, 2);
    assert.ok(canvases[0].recorder.fillCount() > fills);
    assert.equal(canvases.length, count);
    assert.deepEqual(rendering.riverPaths, riverPaths);
    assert.equal(rendering.updateSeason(), true, "restore the voyage calendar");
    assert.equal(rendering.updateSeason(24), true);
    assert.equal(
      rendering.updateSeason(25),
      false,
      "the boundary already has next season's pigments",
    );
    assert.equal(rendering.updateSeason(49), true);
    assert.equal(
      rendering.updateSeason(145),
      false,
      "the calendar repeats without rebuilding identical art",
    );
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});
