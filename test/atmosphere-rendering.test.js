import assert from "node:assert/strict";
import test from "node:test";

function canvasContext() {
  const calls = [];
  return new Proxy(
    {
      calls,
      createRadialGradient(...args) {
        calls.push(["createRadialGradient", ...args]);
        return { addColorStop() {} };
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
  state.lighthouses[0].x = -66.25;
  drawNightAtmosphere(context, state);
  assert.equal(
    context.calls.filter(([name]) => name === "createRadialGradient").length,
    2,
  );
  assert.ok(context.calls.some(([name, x]) => name === "lineTo" && x > 0));
  context.calls.length = 0;
  state.lighthouses[0].x = -65.5;
  drawNightAtmosphere(context, state);
  assert.equal(
    context.calls.filter(([name]) => name === "createRadialGradient").length,
    3,
  );
});
