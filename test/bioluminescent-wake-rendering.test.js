import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createSeaRendering } from "../src/sea-rendering.js";
import { drawMerchantShip, drawShip } from "../src/ship-rendering.js";

const BIOLUMINESCENT_TEAL = "rgba(104,236,205,";
const NIGHT = { daylight: 0, night: 1, storm: 0 };
const DAYLIGHT = { daylight: 1, night: 0, storm: 0 };
const SEAS = [
  { name: "The Sea of Whispers", x: 500, y: 400, rx: 260, ry: 200 },
];

function recordingContext() {
  const calls = [];
  let path = [];
  const states = [];
  const context = new Proxy(
    {
      globalAlpha: 1,
      beginPath() {
        path = [];
      },
      moveTo(...args) {
        path.push(["moveTo", ...args]);
      },
      lineTo(...args) {
        path.push(["lineTo", ...args]);
      },
      stroke() {
        calls.push({
          kind: "stroke",
          style: this.strokeStyle,
          width: this.lineWidth,
        });
      },
      fill() {
        calls.push({ kind: "fill", style: this.fillStyle, path: [...path] });
      },
      save() {
        states.push(this.globalAlpha);
      },
      restore() {
        this.globalAlpha = states.pop();
      },
    },
    {
      get(target, property) {
        if (property in target) return target[property];
        return (...args) => calls.push({ call: property, args });
      },
      set(target, property, value) {
        calls.push({ set: property, value });
        target[property] = value;
        return true;
      },
    },
  );
  return { context, calls };
}

const previousPath = globalThis.Path2D;
globalThis.Path2D = class {
  rect() {}
  moveTo() {}
  lineTo() {}
  closePath() {}
};
after(() => {
  if (previousPath === undefined) delete globalThis.Path2D;
  else globalThis.Path2D = previousPath;
});

const camera = { x: 500, y: 400, zoom: 1 };
const TRAIL = [
  { x: 520, y: 420, time: 10000, strength: 1 },
  { x: 480, y: 424, time: 9600, strength: 1 },
  { x: 440, y: 428, time: 9200, strength: 1 },
];

function drawWake({ lighting = NIGHT, seas = SEAS, time = 10000 } = {}) {
  const renderer = createSeaRendering({
    WORLD: { w: 1000, h: 800 },
    lands: [],
  });
  const recording = recordingContext();
  renderer.drawWake(recording.context, TRAIL, time, camera, 400, 300, {
    lighting,
    bioluminescentSeas: seas,
    reducedMotion: false,
  });
  return recording.calls;
}

const tealSpecks = (calls) =>
  calls.filter(
    ({ kind, style }) =>
      kind === "fill" && style?.startsWith(BIOLUMINESCENT_TEAL),
  );
const tealEnvelopes = (calls) =>
  calls.filter(
    ({ kind, style }) =>
      kind === "stroke" && style?.startsWith(BIOLUMINESCENT_TEAL),
  );
const screenBlends = (calls) =>
  calls.filter(
    ({ set, value }) =>
      set === "globalCompositeOperation" && value === "screen",
  );
const alphaOf = (style) => Number(style.slice(BIOLUMINESCENT_TEAL.length, -1));

test("a night wake in a luminous sea glows teal through screen composite", () => {
  const calls = drawWake();
  assert.ok(
    tealEnvelopes(calls).length > 0,
    "the ribbon carries a glow envelope",
  );
  assert.ok(tealSpecks(calls).length >= 2, "individual organisms flare");
  assert.ok(tealSpecks(calls).every(({ style }) => alphaOf(style) <= 0.85));
  assert.equal(screenBlends(calls).length, 1);
  // restore() reverts the blend, so the glow pass must stay balanced.
  const saves = calls.filter(({ call }) => call === "save").length;
  const restores = calls.filter(({ call }) => call === "restore").length;
  assert.equal(saves, restores);
});

test("the wake glow only exists at night and only inside the named seas", () => {
  assert.equal(tealSpecks(drawWake({ lighting: DAYLIGHT })).length, 0);
  assert.equal(screenBlends(drawWake({ lighting: DAYLIGHT })).length, 0);
  assert.equal(tealSpecks(drawWake({ seas: [] })).length, 0);
  // No environment at all keeps the legacy signature glow-free.
  const renderer = createSeaRendering({
    WORLD: { w: 1000, h: 800 },
    lands: [],
  });
  const legacy = recordingContext();
  renderer.drawWake(legacy.context, TRAIL, 10000, camera, 400, 300);
  assert.equal(tealSpecks(legacy.calls).length, 0);
  assert.equal(screenBlends(legacy.calls).length, 0);
});

test("glow exposure fades with distance and follows the wrapped world", () => {
  const far = drawWake({
    seas: [{ ...SEAS[0], x: 100, y: 100, rx: 60, ry: 40 }],
  });
  assert.equal(tealSpecks(far).length, 0);
  const wrappedRenderer = createSeaRendering({
    WORLD: { w: 1000, h: 800 },
    lands: [],
  });
  const wrapped = recordingContext();
  wrappedRenderer.drawWake(
    wrapped.context,
    TRAIL.map((point) => ({ ...point, x: point.x + 1000 })),
    10000,
    { ...camera, x: 1500 },
    400,
    300,
    { lighting: NIGHT, bioluminescentSeas: SEAS, reducedMotion: false },
  );
  assert.equal(tealSpecks(wrapped.calls).length, tealSpecks(drawWake()).length);
});

test("reduced motion freezes the speck shimmer while the glow remains", () => {
  const renderer = createSeaRendering({
    WORLD: { w: 1000, h: 800 },
    lands: [],
  });
  const draws = (time) => {
    const recording = recordingContext();
    renderer.drawWake(recording.context, TRAIL, time, camera, 400, 300, {
      lighting: NIGHT,
      bioluminescentSeas: SEAS,
      reducedMotion: true,
    });
    return recording.calls;
  };
  assert.deepEqual(draws(10000), draws(10000));
  // The wake still ages across frames, but which organisms are lit is the
  // frozen zero-time shimmer, so the same specks stay lit as the foam fades.
  const early = tealSpecks(draws(10000));
  const late = tealSpecks(draws(10060));
  assert.ok(early.length > 0);
  assert.equal(late.length, early.length);
});

function drawVessel(draw, environment) {
  const recording = recordingContext();
  draw(recording.context, environment);
  return recording.calls;
}

test("the hull eddy scatters glow at the bow shoulders and stern pool", () => {
  const drawPlayer = (c, environment) =>
    drawShip(c, 300, 300, 0.3, 0.5, 0.1, "cutter", 1, {
      time: 12,
      roughness: 0.2,
      speed: 120,
      reducedMotion: true,
      lighting: NIGHT,
      ...environment,
    });
  const calls = drawVessel(drawPlayer, { bioluminescence: 0.9 });
  assert.ok(screenBlends(calls).length === 1);
  const specks = tealSpecks(calls);
  assert.ok(specks.length >= 2, "bow and stern both carry specks");
  assert.ok(
    specks.some(({ style }) => alphaOf(style) > 0.4),
    "at least one organism burns bright",
  );
  assert.equal(tealSpecks(drawVessel(drawPlayer, {})).length, 0);
});

test("hull glow keys off strength and matches merchant rendering across frames", () => {
  const merchant = {
    x: 300,
    y: 300,
    angle: 0.2,
    vesselClass: "cutter",
    idNum: 4,
    speed: 90,
  };
  const environment = {
    time: 0,
    roughness: 0.2,
    windAngle: 0.4,
    reducedMotion: true,
    lighting: NIGHT,
    bioluminescence: 0.8,
  };
  const first = drawVessel((c) =>
    drawMerchantShip(c, merchant, 1, 300, environment),
  );
  const second = drawVessel((c) =>
    drawMerchantShip(c, merchant, 1, 300, environment),
  );
  assert.deepEqual(first, second);
  assert.ok(tealSpecks(first).length > 0);
  const dim = drawVessel((c) =>
    drawMerchantShip(c, merchant, 1, 300, {
      ...environment,
      bioluminescence: 0,
    }),
  );
  assert.equal(tealSpecks(dim).length, 0);
  assert.equal(screenBlends(dim).length, 0);
});
