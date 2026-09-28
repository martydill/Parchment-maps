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
