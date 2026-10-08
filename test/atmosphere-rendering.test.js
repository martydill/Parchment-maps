import assert from "node:assert/strict";
import test from "node:test";
import { sampleLighthouse } from "../src/core/seascape.js";

function canvasContext() {
  const calls = [];
  return new Proxy(
    {
      calls,
      createRadialGradient(...args) {
        calls.push(["createRadialGradient", ...args]);
        return {
          addColorStop: (...stop) => calls.push(["colorStop", ...stop]),
        };
      },
      createLinearGradient(...args) {
        calls.push(["createLinearGradient", ...args]);
        return { addColorStop() {} };
      },
    },
    {
      get(target, property) {
        return (
          target[property] ?? ((...args) => calls.push([property, ...args]))
        );
      },
      set(target, property, value) {
        if (typeof value === "string" || typeof value === "number")
          calls.push([property, value]);
        target[property] = value;
        return true;
      },
    },
  );
}

const canvases = [];
const previousDocument = globalThis.document;
globalThis.document = {
  createElement() {
    const context = canvasContext();
    const canvas = { width: 300, height: 150, getContext: () => context };
    canvases.push({ canvas, context });
    return canvas;
  },
};
let drawNightAtmosphere;
try {
  ({ drawNightAtmosphere } = await import("../src/atmosphere-rendering.js"));
} finally {
  if (previousDocument === undefined) delete globalThis.document;
  else globalThis.document = previousDocument;
}
const mask = canvases[0];
const paints = () =>
  mask.context.calls.filter(([name]) => name === "clearRect").length;

function options() {
  return {
    lighting: {
      night: 1,
      moon: 0.5,
      storm: 0,
      stars: 0,
      sunrise: 0,
      sunset: 0,
    },
    width: 641,
    height: 481,
    ship: { x: 320, y: 240, angle: 0 },
    lighthouses: [
      { x: 180, y: 200, index: 1 },
      { x: 500, y: 300, index: 2 },
    ],
    time: 1000,
    reducedMotion: false,
  };
}

test("a steady night view reuses mask pixels while beams keep rotating", () => {
  const context = canvasContext();
  const state = options();
  drawNightAtmosphere(context, state);
  const initialPaints = paints();
  const initialBeams = context.calls.filter(([name]) => name === "lineTo");
  context.calls.length = 0;
  drawNightAtmosphere(context, {
    ...state,
    time: 2000,
    ship: { ...state.ship, angle: 1 },
    lighthouses: state.lighthouses.map((light) => ({ ...light })),
  });
  assert.equal(paints(), initialPaints);
  assert.ok(context.calls.some(([name]) => name === "drawImage"));
  assert.notDeepEqual(
    context.calls.filter(([name]) => name === "lineTo"),
    initialBeams,
  );
});

test("night stars reuse a fine palette without losing their twinkle", () => {
  const colors = new Set();
  let previousStyles;
  let changed = false;
  for (let frame = 0; frame < 80; frame++) {
    const context = canvasContext();
    const state = options();
    state.lighting.stars = 1;
    state.time = frame * 123;
    drawNightAtmosphere(context, state);
    const styles = context.calls
      .filter(
        ([property, style]) =>
          property === "fillStyle" && style.startsWith("rgba(223,235,255,"),
      )
      .map(([, style]) => style);
    assert.equal(styles.length, 95);
    styles.forEach((style, index) => {
      colors.add(style);
      const alpha = Number(style.slice(style.lastIndexOf(",") + 1, -1));
      const expected =
        (0.7 + Math.sin(state.time * 0.0015 + index * 4.7) * 0.3) *
        (0.2 + (index % 7) * 0.075);
      assert.ok(Math.abs(alpha - expected) <= 0.65 / 254 + 1e-15);
    });
    if (
      previousStyles &&
      styles.some((style, i) => style !== previousStyles[i])
    )
      changed = true;
    previousStyles = styles;
  }
  assert.ok(changed);
  assert.ok(colors.size > 20 && colors.size <= 128);
});

test("mask changes invalidate immediately, including in-place state edits", () => {
  const context = canvasContext();
  const state = options();
  drawNightAtmosphere(context, state);
  const changes = [
    () => (state.ship.x += 0.0001),
    () => (state.ship.y += 0.0001),
    () => (state.lighting.night = 0.9),
    () => (state.lighting.moon = 0.6),
    () => (state.lighting.storm = 0.2),
    () => (state.width = 642),
    () => (state.height = 482),
    () => (state.lighthouses[0].x += 0.0001),
    () => (state.lighthouses[0].y += 0.0001),
    () => state.lighthouses[0].index++,
    () => state.lighthouses.reverse(),
    () => state.lighthouses.push({ x: 30, y: 100, index: 4 }),
    () => state.lighthouses.pop(),
  ];
  for (const change of changes) {
    const previous = paints();
    change();
    drawNightAtmosphere(context, state);
    assert.equal(paints(), previous + 1);
    drawNightAtmosphere(context, state);
    assert.equal(paints(), previous + 1);
  }
  assert.equal(mask.canvas.width, 321);
  assert.equal(mask.canvas.height, 241);
});

test("daylight skips darkness and reduced motion retains a stable beam", () => {
  const context = canvasContext();
  const state = options();
  drawNightAtmosphere(context, state);
  const initialPaints = paints();
  context.calls.length = 0;
  drawNightAtmosphere(context, {
    ...state,
    lighting: { ...state.lighting, night: 0 },
  });
  assert.equal(paints(), initialPaints);
  assert.ok(!context.calls.some(([name]) => name === "drawImage"));
  context.calls.length = 0;
  drawNightAtmosphere(context, { ...state, reducedMotion: true });
  const first = context.calls.filter(([name]) => name === "lineTo");
  context.calls.length = 0;
  drawNightAtmosphere(context, { ...state, time: 9000, reducedMotion: true });
  assert.deepEqual(
    context.calls.filter(([name]) => name === "lineTo"),
    first,
  );
  assert.equal(paints(), initialPaints);
});

test("offscreen lighthouse effects are culled without dropping an incoming beam", () => {
  const context = canvasContext();
  const state = options();
  state.time = 0;
  state.lighthouses = [{ x: -500, y: 200, index: 0 }];
  drawNightAtmosphere(context, state);
  assert.equal(
    context.calls.filter(([name]) => name === "createRadialGradient").length,
    1,
  );
  assert.ok(!context.calls.some(([name]) => name === "lineTo"));
  context.calls.length = 0;
  const bloomRadius = sampleLighthouse(0, 0).glowRadius * 1.8;
  state.lighthouses[0].x = -bloomRadius - 1.25;
  drawNightAtmosphere(context, state);
  assert.equal(
    context.calls.filter(([name]) => name === "createRadialGradient").length,
    2,
  );
  assert.ok(context.calls.some(([name, x]) => name === "lineTo" && x > 0));
  context.calls.length = 0;
  state.lighthouses[0].x = -bloomRadius - 0.5;
  drawNightAtmosphere(context, state);
  assert.equal(
    context.calls.filter(([name]) => name === "createRadialGradient").length,
    5,
  );
});

test("flame beacons draw flickering fire without a rotating cone", () => {
  const context = canvasContext();
  const state = options();
  state.lighthouses = [{ x: 180, y: 200, index: 1 }];
  drawNightAtmosphere(context, state);
  assert.ok(!context.calls.some(([name]) => name === "lineTo"));
  const flames = context.calls.filter(([name]) => name === "bezierCurveTo");
  assert.equal(flames.length, 4);
  const initialPaints = paints();
  context.calls.length = 0;
  drawNightAtmosphere(context, { ...state, time: 2000 });
  assert.notDeepEqual(
    context.calls.filter(([name]) => name === "bezierCurveTo"),
    flames,
  );
  assert.equal(paints(), initialPaints);
});

test("reduced motion freezes fire, cinders, bloom and beams together", () => {
  const context = canvasContext();
  const state = options();
  state.reducedMotion = true;
  state.lighthouses = Array.from({ length: 8 }, (_, index) => ({
    x: 60 + index * 70,
    y: 200,
    index,
  }));
  drawNightAtmosphere(context, state);
  const still = [...context.calls];
  context.calls.length = 0;
  drawNightAtmosphere(context, { ...state, time: 59000 });
  assert.deepEqual(context.calls, still);
});

test("paired optics cast opposite feathered beams in their own color", () => {
  const context = canvasContext();
  const state = options();
  state.time = 0;
  state.lighthouses = [{ x: 320, y: 240, index: 4 }];
  drawNightAtmosphere(context, state);
  const ends = context.calls.filter(([name]) => name === "lineTo");
  assert.equal(ends.length, 10);
  assert.ok(Math.abs(ends[0][1] + ends[5][1] - 640) < 1e-10);
  assert.ok(Math.abs(ends[0][2] + ends[5][2] - 480) < 1e-10);
  assert.ok(
    context.calls.some(
      ([name, , color]) =>
        name === "colorStop" && color.startsWith("rgba(211,227,255,"),
    ),
  );
  const falloffs = context.calls.filter(([name]) => name === "colorStop");
  assert.ok(falloffs.some(([, position]) => position === 0.65));
  assert.ok(
    falloffs.some(
      ([, position, color]) =>
        position === 1 && color === "rgba(211,227,255,0)",
    ),
  );
});

test("local light reveals stay compact even for long-range optics", () => {
  const context = canvasContext();
  const state = options();
  state.lighthouses = [{ x: 250, y: 200, index: 4 }];
  mask.context.calls.length = 0;
  drawNightAtmosphere(context, state);
  const radii = mask.context.calls
    .filter(([name]) => name === "createRadialGradient")
    .map((call) => call[6]);
  assert.equal(radii.length, 2);
  assert.equal(radii[1], sampleLighthouse(0, 4).glowRadius * 1.8);
  assert.ok(radii[1] < 65);
  assert.ok(
    mask.context.calls.some(
      ([name, x, y]) => name === "scale" && x === 1 && y === 0.5,
    ),
  );
});

test("a fixed lantern keeps its cone still while the light gently breathes", () => {
  const context = canvasContext();
  const state = options();
  state.lighthouses = [{ x: 180, y: 200, index: 6 }];
  drawNightAtmosphere(context, state);
  const ends = context.calls.filter(([name]) => name === "lineTo");
  const colors = context.calls.filter(([name]) => name === "colorStop");
  assert.equal(ends.length, 5);
  context.calls.length = 0;
  drawNightAtmosphere(context, { ...state, time: 9000 });
  assert.deepEqual(
    context.calls.filter(([name]) => name === "lineTo"),
    ends,
  );
  assert.notDeepEqual(
    context.calls.filter(([name]) => name === "colorStop"),
    colors,
  );
});

test("graphics tiers thin the star field while keeping the layout stable", () => {
  const state = options();
  state.lighting.stars = 1;
  const full = canvasContext();
  drawNightAtmosphere(full, state);
  const scaled = canvasContext();
  drawNightAtmosphere(scaled, { ...state, particleScale: 0.45 });
  const styles = (context) =>
    context.calls.filter(
      ([property, style]) =>
        property === "fillStyle" && style.startsWith("rgba(223,235,255,"),
    ).length;
  assert.equal(styles(scaled), Math.round(95 * 0.45));
  const arcs = (context) =>
    context.calls.filter(([name]) => name === "arc").map(([, x]) => x);
  // The moon disc draws first, then stars in their fixed order: the scaled
  // sky's moon-and-stars window matches the full sky's, never a reshuffle.
  const window = 1 + Math.round(95 * 0.45);
  assert.deepEqual(arcs(scaled).slice(0, window), arcs(full).slice(0, window));
});

test("the darkness mask follows the tier's mask resolution", () => {
  const context = canvasContext();
  const state = options();
  drawNightAtmosphere(context, state);
  assert.equal(mask.canvas.width, Math.ceil(641 * 0.5));
  const basePaints = paints();
  drawNightAtmosphere(context, { ...state, maskScale: 0.3 });
  assert.equal(mask.canvas.width, Math.ceil(641 * 0.3));
  assert.equal(mask.canvas.height, Math.ceil(481 * 0.3));
  assert.equal(paints(), basePaints + 1, "the smaller mask is repainted once");
  drawNightAtmosphere(context, { ...state, maskScale: 0.3 });
  assert.equal(
    paints(),
    basePaints + 1,
    "the same tier reuses the painted mask",
  );
  drawNightAtmosphere(context, state);
  assert.equal(mask.canvas.width, Math.ceil(641 * 0.5));
  assert.equal(
    paints(),
    basePaints + 2,
    "returning to the default tier repaints once",
  );
});
