import test from "node:test";
import assert from "node:assert/strict";
import { drawWeatherEffects } from "../src/rendering.js";

test("reduced motion retains storm atmosphere without a frozen lightning flash", () => {
  const fills = [];
  const c = new Proxy(
    {
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

test("cloud colors remain exact during motion and refresh when weather changes", () => {
  function render(overrides = {}) {
    const gradients = [];
    const context = new Proxy(
      {
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
    drawWeatherEffects(context, {
      name: "Overcast",
      roughness: 0.5,
      visibilityKm: 12,
      vw: 800,
      vh: 600,
      time: 0,
      reducedMotion: true,
      ...overrides,
    });
    return gradients.filter(({ stops }) =>
      stops.some(([position]) => position === 0.7),
    );
  }
  const first = render();
  const moving = render({ time: 1000, vw: 1000, vh: 800, windAngle: 0.8 });
  assert.equal(first.length, 93);
  assert.deepEqual(
    moving.map(({ stops }) => stops),
    first.map(({ stops }) => stops),
  );
  assert.notDeepEqual(
    moving.map(({ geometry }) => geometry),
    first.map(({ geometry }) => geometry),
  );
  const fair = render({ roughness: 0.25 });
  assert.notDeepEqual(
    fair.map(({ stops }) => stops),
    first.map(({ stops }) => stops),
  );
  assert.deepEqual(
    render().map(({ stops }) => stops),
    first.map(({ stops }) => stops),
  );
  for (const { stops } of first) {
    const alphas = stops.map(([, color]) =>
      Number(color.slice(color.lastIndexOf(",") + 1, -1)),
    );
    assert.equal(alphas[1], alphas[0] * 0.4);
    assert.equal(alphas[2], 0);
  }
});
