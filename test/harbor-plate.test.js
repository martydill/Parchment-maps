import assert from "node:assert/strict";
import test from "node:test";
import { drawHarborPlate } from "../src/harbor-plate.js";
import { PORT_NAMES } from "../src/names.js";
import { seasonalAppearance } from "../src/core/seasons.js";

function recordingSurface(width, height) {
  const geometry = [];
  const calls = [];
  const layers = [];
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
            calls.push([property, ...args]);
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
    ownerDocument: {
      createElement(tag) {
        assert.equal(tag, "canvas");
        const layer = recordingSurface(0, 0);
        layers.push(layer);
        return layer;
      },
    },
    geometry,
    calls,
    layers,
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

test("fixed harbor grain and ridges are reused while lighting, parallax, and vessels stay live", async () => {
  const { sceneLighting } = await import("../src/core/lighting.js");
  const surface = recordingSurface(720, 380);
  const port = { name: PORT_NAMES.orvessaQuay };
  const frames = [];
  const art = { draw: (...args) => frames.push(args) };
  drawHarborPlate(surface, port, { art });
  assert.equal(surface.layers.length, 2);
  const [grain, ridges] = surface.layers;
  assert.equal(
    grain.calls.filter(([call]) => call === "fillRect").length,
    1800,
  );
  assert.equal(ridges.calls.filter(([call]) => call === "fill").length, 3);
  const cachedCalls = surface.layers.map((layer) => layer.calls.length);
  for (let frame = 1; frame <= 120; frame++) {
    drawHarborPlate(surface, port, {
      art,
      time: frame * 16,
      lighting: sceneLighting(frame / 120),
      season: seasonalAppearance(frame),
      evolution: { level: frame % 4 },
      pointer: { x: 1, y: -1 },
      reducedMotion: frame === 120,
    });
  }
  assert.equal(surface.layers.length, 2);
  assert.deepEqual(
    surface.layers.map((layer) => layer.calls.length),
    cachedCalls,
  );
  const grainBlits = surface.calls.filter(
    ([call, image]) => call === "drawImage" && image === grain,
  );
  const ridgeBlits = surface.calls.filter(
    ([call, image]) => call === "drawImage" && image === ridges,
  );
  assert.equal(grainBlits.length, 121);
  assert.equal(ridgeBlits.length, 121);
  assert.ok(grainBlits.every(([, , x, y]) => x === 0 && y === 0));
  assert.ok(ridgeBlits.every(([, , x, y]) => x < 0 && y < 0));
  assert.ok(
    surface.calls.some(
      ([call, x, y]) =>
        call === "translate" &&
        Math.abs(x - 3.6) < 1e-9 &&
        Math.abs(y + 2.1) < 1e-9,
    ),
  );
  assert.equal(
    frames.length,
    121,
    "architecture still receives every live frame",
  );
  assert.equal(frames[119][6], 119 * 16);
  assert.equal(frames[120][6], 0, "reduced motion freezes the animation clock");
  assert.equal(surface.depth(), 0);
});

test("harbor artwork refreshes on port or dimension changes without accumulating canvases", () => {
  const surface = recordingSurface(720, 380);
  const options = { art: { draw() {} } };
  let port = { name: PORT_NAMES.orvessaQuay };
  drawHarborPlate(surface, port, options);
  const [grain, ridges] = surface.layers;
  const originalGrain = grain.calls.slice();
  const originalRidges = ridges.calls.slice();
  const changes = [
    () => {
      port = { name: PORT_NAMES.vesperport };
    },
    () => {
      surface.width = 390;
    },
    () => {
      surface.height = 420;
    },
  ];
  for (const change of changes) {
    const grainCount = grain.calls.length;
    const ridgeCount = ridges.calls.length;
    change();
    drawHarborPlate(surface, port, options);
    assert.equal(surface.layers.length, 2);
    assert.equal(grain.calls.length - grainCount, originalGrain.length);
    assert.ok(ridges.calls.length > ridgeCount);
    assert.equal(grain.width, surface.width);
    assert.equal(grain.height, surface.height);
    assert.ok(
      ridges.width > surface.width,
      "off-panel ridge strokes remain available for parallax",
    );
    assert.ok(ridges.height > surface.height);
  }
  assert.notDeepEqual(
    grain.calls.slice(originalGrain.length, originalGrain.length * 2),
    originalGrain,
  );
  assert.notDeepEqual(
    ridges.calls.slice(originalRidges.length, originalRidges.length * 2),
    originalRidges,
  );
  const otherSurface = recordingSurface(surface.width, surface.height);
  drawHarborPlate(otherSurface, port, options);
  assert.equal(otherSurface.layers.length, 2);
  assert.notEqual(
    otherSurface.layers[0],
    grain,
    "each panel owns its current artwork",
  );
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
    season: seasonalAppearance(73),
    pointer: { x: 1, y: -1 },
    ship: portArrivalFrame(1600).ship,
    drawPlayerShip: (...args) => ships.push(args),
    time: 1600,
  };
  drawHarborPlate(surface, { name: PORT_NAMES.orvessaQuay }, options);
  assert.equal(plates[0][4], light);
  assert.equal(plates[0][5], options.season);
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
