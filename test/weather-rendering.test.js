import test, { after } from "node:test";
import assert from "node:assert/strict";
import { drawWeatherEffects } from "../src/rendering.js";

function recordingContext() {
  const draws = [];
  const gradients = [];
  const states = [];
  const context = new Proxy(
    {
      globalAlpha: 1,
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
  return { context, draws, gradients };
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
    draws.map(({ stamp, alpha }) => [stamp.gradients.at(-1).stops, alpha]);
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
