import test, { after } from "node:test";
import assert from "node:assert/strict";
import { drawWeatherEffects } from "../src/rendering.js";
import { sampleWeatherFront } from "../src/core/weather.js";

function recordingContext() {
  const draws = [];
  const gradients = [];
  const states = [];
  const strokes = [];
  const fills = [];
  const rects = [];
  const transforms = [];
  const clears = [];
  const context = new Proxy(
    {
      globalAlpha: 1,
      setTransform(...args) {
        transforms.push(args);
      },
      clearRect(...args) {
        clears.push(args);
      },
      fillRect(...geometry) {
        rects.push({
          geometry,
          color: this.fillStyle,
          operation: this.globalCompositeOperation,
        });
      },
      stroke() {
        strokes.push(this.strokeStyle);
      },
      fill() {
        fills.push(this.globalCompositeOperation);
      },
      save() {
        states.push(this.globalAlpha);
      },
      restore() {
        this.globalAlpha = states.pop();
      },
      drawImage(stamp, ...geometry) {
        draws.push({ stamp, geometry, alpha: this.globalAlpha });
      },
      createRadialGradient(...geometry) {
        const stops = [];
        gradients.push({ geometry, stops });
        return { addColorStop: (...stop) => stops.push(stop) };
      },
      createLinearGradient() {
        return { addColorStop() {} };
      },
    },
    { get: (target, property) => target[property] ?? (() => {}) },
  );
  return {
    context,
    draws,
    gradients,
    strokes,
    fills,
    rects,
    transforms,
    clears,
  };
}

const stampCanvases = [];
const previousDocument = globalThis.document;
globalThis.document = {
  createElement() {
    const recording = recordingContext();
    const canvas = { getContext: () => recording.context, ...recording };
    stampCanvases.push(canvas);
    return canvas;
  },
};
after(() => {
  if (previousDocument === undefined) delete globalThis.document;
  else globalThis.document = previousDocument;
});

function render(overrides = {}) {
  const recording = recordingContext();
  drawWeatherEffects(recording.context, {
    name: "Overcast",
    roughness: 0.5,
    visibilityKm: 12,
    vw: 800,
    vh: 600,
    time: 0,
    reducedMotion: true,
    ...overrides,
  });
  return recording;
}

const puffs = ({ draws }) =>
  draws.filter(({ stamp }) =>
    stamp.gradients.at(-1).stops.some(([position]) => position === 0.7),
  );

test("reduced motion retains storm atmosphere without a frozen lightning flash", () => {
  const fills = [];
  const c = new Proxy(
    {
      globalAlpha: 1,
      fillRect() {
        fills.push(this.fillStyle);
      },
      createRadialGradient() {
        return { addColorStop() {} };
      },
      createLinearGradient() {
        return { addColorStop() {} };
      },
    },
    {
      get(target, property) {
        return target[property] ?? (() => {});
      },
    },
  );
  const weather = {
    name: "Rain squalls",
    roughness: 0.5,
    visibilityKm: 6,
    vw: 800,
    vh: 600,
    time: 1000000,
  };
  drawWeatherEffects(c, weather);
  assert.ok(fills.some((fill) => String(fill).startsWith("rgba(222,230,255,")));
  fills.length = 0;
  drawWeatherEffects(c, { ...weather, time: 0, reducedMotion: true });
  assert.ok(fills.some((fill) => String(fill).startsWith("rgba(49,72,98,")));
  assert.ok(
    !fills.some((fill) => String(fill).startsWith("rgba(222,230,255,")),
  );
});

test("cloud stamps reuse colors and opacity during motion and refresh when weather changes", () => {
  const first = puffs(render());
  const colors = (draws) =>
    draws.map(({ stamp, alpha }) => [stamp.context.fillStyle, alpha]);
  const originalColors = colors(first);
  const count = stampCanvases.length;
  const moving = puffs(
    render({ time: 1000, vw: 1000, vh: 800, windAngle: 0.8 }),
  );
  assert.equal(first.length, 93);
  assert.equal(stampCanvases.length, count);
  assert.deepEqual(
    moving.map(({ stamp, alpha }) => [stamp, alpha]),
    first.map(({ stamp, alpha }) => [stamp, alpha]),
  );
  const fair = puffs(render({ roughness: 0.25 }));
  assert.notDeepEqual(colors(fair), originalColors);
  assert.deepEqual(colors(puffs(render())), originalColors);
  assert.equal(
    stampCanvases.length,
    count,
    "weather changes reuse the canvases",
  );
  for (const { stamp } of first) {
    const alphas = stamp.gradients
      .at(-1)
      .stops.map(([, color]) =>
        Number(color.slice(color.lastIndexOf(",") + 1, -1)),
      );
    assert.deepEqual(alphas, [1, 0.4, 0]);
  }
});

test("cloud, shadow, and fog bank motion creates no new radial gradients after warming", () => {
  const options = { name: "Fog and overcast", roughness: 0.3, visibilityKm: 2 };
  const first = render(options);
  const count = stampCanvases.length;
  assert.ok(first.draws.length > 20);
  const originalStamps = first.draws.map(({ stamp }) => stamp);
  for (let frame = 1; frame <= 60; frame++) {
    const next = render({
      ...options,
      time: frame * 16,
      windAngle: frame / 60,
    });
    assert.equal(stampCanvases.length, count);
    // The one viewport edge-fog gradient is outside the particle loops.
    assert.equal(next.gradients.length, 1);
    assert.deepEqual(
      next.draws.map(({ stamp }) => stamp),
      originalStamps,
    );
    assert.equal(next.context.globalAlpha, 1);
    assert.ok(next.draws.every(({ alpha }) => alpha > 0 && alpha < 1));
  }
});

const fronts = [
  { name: "Clear", roughness: 0.08, visibilityKm: 24 },
  { name: "Rain squalls", roughness: 0.5, visibilityKm: 6 },
  { name: "Clear", roughness: 0.08, visibilityKm: 24 },
];
const sunlight = ({ draws }) =>
  draws.filter(({ stamp }) =>
    stamp.gradients
      .at(-1)
      .stops.some(([, color]) => /^rgba\(255,(234|241),/.test(color)),
  );

test("structured fronts suppress early rain and produce clearing sunlight only in daylight", () => {
  const approaching = render({ front: sampleWeatherFront(fronts, 0.35) });
  assert.ok(approaching.draws.length > 10);
  assert.equal(approaching.strokes.length, 0);
  assert.ok(
    render({ front: sampleWeatherFront(fronts, 1) }).strokes.length > 0,
  );
  const front = sampleWeatherFront(fronts, 1.65);
  assert.equal(sunlight(render({ front, daylight: 1 })).length, 4);
  assert.equal(sunlight(render({ front, daylight: 0 })).length, 0);
  const squall = render({
    name: "Squall waters",
    front: sampleWeatherFront(fronts, 2.5),
  });
  assert.ok(squall.strokes.length > 0);
  assert.equal(sunlight(squall).length, 0);
});

test("reduced motion freezes front clouds and clearing beams while retaining atmosphere", () => {
  const front = sampleWeatherFront(fronts, 1.65);
  const first = render({ front, time: 1000 });
  const count = stampCanvases.length;
  const later = render({ front, time: 99000 });
  assert.deepEqual(later.draws, first.draws);
  assert.equal(stampCanvases.length, count);
  const moving = render({ front, time: 99000, reducedMotion: false });
  assert.notDeepEqual(
    moving.draws.map(({ geometry }) => geometry),
    first.draws.map(({ geometry }) => geometry),
  );
  assert.equal(stampCanvases.length, count);
});

test("soft weather uses a reusable smaller layer while rain stays on the target", () => {
  const direct = render();
  const first = render({ softLayerScale: 0.5 });
  assert.equal(first.draws.length, 1);
  const layer = first.draws[0].stamp;
  assert.equal(layer.width, 400);
  assert.equal(layer.height, 300);
  assert.deepEqual(first.draws[0].geometry, [0, 0, 800, 600]);
  assert.deepEqual(layer.transforms.at(-1), [0.5, 0, 0, 0.5, 0, 0]);
  assert.ok(layer.draws.length > 0);
  assert.deepEqual(first.strokes, direct.strokes);
  assert.equal(first.context.globalAlpha, 1);
  const before = layer.clears.length;
  const later = render({ softLayerScale: 0.5, time: 5000, vw: 1001, vh: 601 });
  assert.equal(later.draws[0].stamp, layer);
  assert.equal(layer.width, 501);
  assert.equal(layer.height, 301);
  assert.deepEqual(layer.clears.at(-1), [0, 0, 501, 301]);
  assert.equal(layer.clears.length, before + 1);
  assert.deepEqual(layer.transforms.at(-1), [
    501 / 1001,
    0,
    0,
    301 / 601,
    0,
    0,
  ]);
});

test("soft weather culls only cloud puffs whose conservative bounds miss the screen", () => {
  const direct = puffs(render({ windAngle: 0 }));
  const low = render({ windAngle: 0, softLayerScale: 0.5 });
  const layer = low.draws[0].stamp;
  layer.draws.length = 0;
  render({ windAngle: 0, softLayerScale: 0.5 });
  const visible = puffs(layer);
  const expected = direct.filter(
    ({ geometry: [x, y, w, h] }) =>
      x + w >= -1 && x <= 801 && y + h >= -1 && y <= 601,
  );
  assert.ok(visible.length < direct.length);
  assert.deepEqual(visible, expected);
});

test("changing storm colours retints cloud masks without new gradients or textures", () => {
  const first = puffs(
    render({ front: { storm: 1, cloud: 1, rain: 0, fog: 0, lightning: 0 } }),
  );
  const textures = stampCanvases.length;
  const gradients = first.map(({ stamp }) => stamp.gradients.length);
  const paints = first.map(({ stamp }) => stamp.rects.length);
  render({ front: { storm: 0.7, cloud: 1, rain: 0, fog: 0, lightning: 0 } });
  assert.equal(stampCanvases.length, textures);
  first.forEach(({ stamp }, index) => {
    assert.equal(stamp.gradients.length, gradients[index]);
    assert.ok(stamp.rects.length >= paints[index]);
    assert.equal(stamp.rects.at(-1).operation, "source-in");
  });
  assert.ok(
    first.some(({ stamp }, index) => stamp.rects.length > paints[index]),
  );
});
