import assert from "node:assert/strict";
import test from "node:test";
import { createSeaRendering } from "../src/sea-rendering.js";

function recordingContext() {
  const calls = [];
  const context = new Proxy(
    {
      createRadialGradient() {
        return {
          addColorStop: (...args) => calls.push(["addColorStop", ...args]),
        };
      },
    },
    {
      get(target, property) {
        if (property in target) return target[property];
        return (...args) => calls.push([property, ...args]);
      },
      set(target, property, value) {
        calls.push([property, typeof value === "object" ? "gradient" : value]);
        target[property] = value;
        return true;
      },
    },
  );
  return { context, calls };
}

const options = {
  camera: { x: 500, y: 400, zoom: 1 },
  vw: 300,
  vh: 200,
  time: 0,
  roughness: 0.5,
  windAngle: 0.2,
  reducedMotion: false,
  lighting: { daylight: 1, storm: 0 },
};

test("surface marks reuse bounded palettes across time, weather, and zoom", () => {
  const renderer = createSeaRendering({
    WORLD: { w: 1000, h: 800 },
    lands: [],
  });
  const shadows = new Set();
  const glints = new Set();
  for (let frame = 0; frame < 100; frame++) {
    const { context, calls } = recordingContext();
    renderer.drawSurface(context, {
      ...options,
      camera: { ...options.camera, zoom: [0.7, 1, 2][frame % 3] },
      time: frame * 123,
      roughness: (frame % 11) / 10,
      lighting: { daylight: (frame % 7) / 6, storm: (frame % 5) / 4 },
    });
    for (const [property, style] of calls) {
      if (property !== "strokeStyle") continue;
      if (style.startsWith("rgba(37,81,78,")) shadows.add(style);
      if (style.startsWith("rgba(247,237,197,")) glints.add(style);
    }
  }
  assert.equal(shadows.size, 20);
  assert.ok(glints.size > 20 && glints.size <= 128);
});

test("reduced motion keeps water geometry and colors identical across frames", () => {
  const renderer = createSeaRendering({
    WORLD: { w: 1000, h: 800 },
    lands: [],
  });
  const first = recordingContext();
  const second = recordingContext();
  renderer.drawSurface(first.context, {
    ...options,
    reducedMotion: true,
    time: 1000,
  });
  renderer.drawSurface(second.context, {
    ...options,
    reducedMotion: true,
    time: 99000,
  });
  assert.deepEqual(first.calls, second.calls);
});

test("surface palettes and phases are continuous across the world seam", () => {
  const renderer = createSeaRendering({
    WORLD: { w: 1000, h: 800 },
    lands: [],
  });
  const first = recordingContext();
  const wrapped = recordingContext();
  renderer.drawSurface(first.context, options);
  renderer.drawSurface(wrapped.context, {
    ...options,
    camera: { ...options.camera, x: options.camera.x + 1000 },
  });
  const strokes = ({ calls }) =>
    calls.filter(([property]) => property === "strokeStyle");
  assert.deepEqual(strokes(first), strokes(wrapped));
});

test("current lanes reuse their exact fixed opacities at every phase", () => {
  const renderer = createSeaRendering({
    WORLD: { w: 1000, h: 800 },
    lands: [],
    currents: [[500, 400, 0.2]],
  });
  for (const time of [0, 1000, 99000]) {
    const { context, calls } = recordingContext();
    renderer.drawSurface(context, { ...options, time });
    const styles = calls.filter(
      ([property, style]) =>
        property === "strokeStyle" &&
        (style.startsWith("rgba(38,104,107,") ||
          style.startsWith("rgba(238,236,193,")),
    );
    assert.equal(styles.length, 14);
    for (let lane = -3; lane <= 3; lane++) {
      const index = (lane + 3) * 2;
      assert.equal(
        styles[index][1],
        `rgba(38,104,107,${0.055 + (3 - Math.abs(lane)) * 0.009})`,
      );
      assert.equal(
        styles[index + 1][1],
        `rgba(238,236,193,${0.2 + (3 - Math.abs(lane)) * 0.035})`,
      );
    }
  }
});
