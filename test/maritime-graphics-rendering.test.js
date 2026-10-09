import test from "node:test";
import assert from "node:assert/strict";
import { createChartSprayRendering } from "../src/chart-spray-rendering.js";
import { createSeaIceRendering } from "../src/sea-ice-rendering.js";
import { createMountainShadowRendering } from "../src/mountain-shadow-rendering.js";
import { sceneLighting } from "../src/core/lighting.js";
import { LAND_NAMES } from "../src/names.js";

function recorder() {
  const calls = [];
  const stack = [];
  const c = new Proxy(
    { globalAlpha: 0.8 },
    {
      get(target, key) {
        if (key in target) return target[key];
        if (key === "save") return () => stack.push({ alpha: c.globalAlpha });
        if (key === "restore")
          return () => {
            c.globalAlpha = stack.pop().alpha;
          };
        if (key === "createLinearGradient")
          return () => ({ addColorStop() {} });
        return (...args) => calls.push({ key, args, alpha: c.globalAlpha });
      },
    },
  );
  return { c, calls };
}

function withCanvases(callback) {
  const previous = globalThis.document;
  const canvases = [];
  globalThis.document = {
    createElement() {
      const canvas = {
        getContext: () => canvas.recorder.c,
        recorder: recorder(),
      };
      canvases.push(canvas);
      return canvas;
    },
  };
  try {
    callback(canvases);
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
}

const world = { w: 1000, h: 600 };
const lands = [
  {
    name: LAND_NAMES.rimevault,
    poly: [
      [300, 200],
      [500, 200],
      [500, 400],
      [300, 400],
    ],
  },
];
const options = {
  camera: { x: 400, y: 300, zoom: 1 },
  vw: 800,
  vh: 600,
  day: 83,
  time: 1000,
};

test("spray needs a grade IV tempest, remains on the paper while drying, and respects quality", () => {
  const renderer = createChartSprayRendering();
  const output = recorder();
  renderer.update(1, { stage: "brewing", grade: 4 });
  renderer.update(1, { stage: "tempest", grade: 3 });
  renderer.draw(output.c, options);
  assert.equal(output.calls.length, 0);
  renderer.update(1, { stage: "tempest", grade: 4 });
  renderer.draw(output.c, options);
  assert.ok(output.calls.some((call) => call.key === "fill"));
  assert.equal(output.c.globalAlpha, 0.8);
  const low = recorder();
  renderer.draw(low.c, { ...options, particleScale: 0.45 });
  assert.ok(low.calls.length < output.calls.length);
  renderer.update(20, { stage: "afterglow", grade: 1 });
  const marks = recorder();
  renderer.draw(marks.c, options);
  assert.ok(marks.calls.some((call) => call.key === "stroke"));
  assert.ok(!marks.calls.some((call) => call.key === "fill"));
  assert.ok(marks.calls.flatMap((call) => call.args).every(Number.isFinite));
});

test("winter rim and floe plates are cached, cull offscreen, and repeat across the meridian", () =>
  withCanvases((canvases) => {
    const renderer = createSeaIceRendering({
      world,
      lands,
      ports: [],
      biomeAt: () => "alpine",
    });
    const winter = recorder();
    renderer.draw(winter.c, options);
    const count = canvases.length;
    const images = winter.calls.filter((call) => call.key === "drawImage");
    assert.ok(images.length > 1);
    const again = recorder();
    renderer.draw(again.c, options);
    assert.equal(canvases.length, count);
    assert.deepEqual(again.calls, winter.calls);
    assert.equal(again.c.globalAlpha, 0.8);
    const seam = recorder();
    renderer.draw(seam.c, {
      ...options,
      camera: { ...options.camera, x: 1400 },
    });
    const wrapped = seam.calls.filter((call) => call.key === "drawImage");
    assert.equal(wrapped.length, images.length);
    assert.equal(wrapped[0].args[1], images[0].args[1] + world.w);
    const earlyWinter = recorder();
    renderer.draw(earlyWinter.c, { ...options, day: 73 });
    assert.equal(
      earlyWinter.calls.filter((call) => call.key === "drawImage").length,
      1,
      "frost precedes the pack ice",
    );
    const summer = recorder();
    renderer.draw(summer.c, { ...options, day: 25 });
    assert.equal(summer.calls.length, 0);
    assert.equal(renderer.at({ x: 100, y: 100 }, 25, 1000).exposure, 0);
    const floeDraw = winter.calls.find((call) => call.key === "translate");
    const position = { x: floeDraw.args[0], y: floeDraw.args[1] };
    assert.equal(renderer.at(position, 83, 1000).exposure, 1);
    assert.deepEqual(
      renderer.at({ ...position, x: position.x + world.w }, 83, 1000),
      renderer.at(position, 83, 1000),
    );
  }));

test("mountain shading bakes four plates and draws only adjacent sun buckets without rebaking", () =>
  withCanvases((canvases) => {
    const terrainPlans = new Map([
      [
        0,
        {
          hills: [{ x: 350, y: 350, size: 14 }],
          ranges: [{ peaks: [{ x: 400, y: 300, size: 30 }] }],
        },
      ],
    ]);
    const renderer = createMountainShadowRendering({
      world,
      lands,
      terrainPlans,
      ports: [{ x: 450, y: 300 }],
    });
    assert.equal(canvases.length, 4);
    const day = recorder();
    renderer.draw(day.c, { ...options, lighting: sceneLighting(0.5) });
    assert.equal(
      day.calls.filter((call) => call.key === "drawImage").length,
      2,
    );
    assert.equal(day.c.globalAlpha, 0.8);
    const dawn = recorder();
    renderer.draw(dawn.c, { ...options, lighting: sceneLighting(0.3) });
    assert.notDeepEqual(dawn.calls, day.calls);
    assert.equal(canvases.length, 4);
    const seam = recorder();
    renderer.draw(seam.c, {
      ...options,
      camera: { ...options.camera, x: 1400 },
      lighting: sceneLighting(0.5),
    });
    assert.equal(seam.calls[0].args[1], day.calls[0].args[1] + world.w);
    const night = recorder();
    renderer.draw(night.c, { ...options, lighting: sceneLighting(0) });
    assert.equal(night.calls.length, 0);
    const distant = recorder();
    renderer.draw(distant.c, {
      ...options,
      camera: { x: 400, y: -1000, zoom: 1 },
      lighting: sceneLighting(0.5),
    });
    assert.equal(distant.calls.length, 0);
  }));
