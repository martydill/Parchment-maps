import assert from "node:assert/strict";
import test from "node:test";
import { createCloudShadowRendering } from "../src/sunlight-rendering.js";
import { createMountainShadowRendering } from "../src/mountain-shadow-rendering.js";
import { planShoreline } from "../src/core/shoreline.js";
import { sceneLighting } from "../src/core/lighting.js";

function recorder() {
  const calls = [];
  const stack = [];
  const context = new Proxy(
    {
      globalAlpha: 0.8,
      globalCompositeOperation: "source-over",
      save() {
        stack.push([this.globalAlpha, this.globalCompositeOperation]);
      },
      restore() {
        [this.globalAlpha, this.globalCompositeOperation] = stack.pop();
      },
      createRadialGradient(...args) {
        calls.push({ method: "radial", args });
        return {
          addColorStop: (...args) => calls.push({ method: "stop", args }),
        };
      },
      createLinearGradient(...args) {
        calls.push({ method: "linear", args });
        return {
          addColorStop: (...args) => calls.push({ method: "stop", args }),
        };
      },
    },
    {
      get(target, key) {
        return (
          target[key] ??
          ((...args) =>
            calls.push({
              method: key,
              args,
              alpha: target.globalAlpha,
              operation: target.globalCompositeOperation,
            }))
        );
      },
    },
  );
  return { context, calls };
}

function withCanvases(run) {
  const previous = globalThis.document;
  const canvases = [];
  globalThis.document = {
    createElement() {
      const { context, calls } = recorder();
      const canvas = { getContext: () => context, calls };
      canvases.push(canvas);
      return canvas;
    },
  };
  try {
    run(canvases);
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
}

test("cloud stamps are baked once, cull distant patches, cover repeated worlds, and restore canvas state", () =>
  withCanvases((canvases) => {
    const renderer = createCloudShadowRendering({ w: 4800, h: 3200 });
    const { context: c, calls } = recorder();
    const options = {
      camera: { x: 2400, y: 1600, zoom: 1 },
      vw: 10000,
      vh: 6400,
      time: 1000,
      lighting: sceneLighting(),
    };
    renderer.draw(c, { ...options, reducedMotion: true });
    assert.equal(canvases.length, 0);
    renderer.draw(c, options);
    assert.equal(canvases.length, 1);
    assert.equal(
      canvases[0].calls.filter((call) => call.method === "radial").length,
      5,
    );
    const draws = calls.filter((call) => call.method === "drawImage");
    assert.ok(draws.length > 24);
    assert.ok(
      draws.every(
        (call) =>
          call.operation === "multiply" &&
          call.alpha > 0 &&
          call.alpha <= 0.8 * 0.09,
      ),
    );
    assert.ok(
      draws.flatMap((call) => call.args.slice(1)).every(Number.isFinite),
    );
    assert.equal(c.globalAlpha, 0.8);
    assert.equal(c.globalCompositeOperation, "source-over");
    const bakes = canvases[0].calls.length;
    renderer.draw(c, { ...options, time: 2000 });
    assert.equal(canvases[0].calls.length, bakes);
    const before = calls.length;
    renderer.draw(c, {
      ...options,
      vw: 10,
      vh: 10,
      camera: { x: 0, y: 0, zoom: 1 },
    });
    assert.equal(
      calls.length,
      before,
      "empty viewport incurs no image drawing",
    );
    renderer.draw(c, { ...options, lighting: sceneLighting(0) });
    assert.equal(calls.length, before);
  }));

test("coastal glazes and mountain penumbras share cached sun phases and wrap without rebuilding", () =>
  withCanvases((canvases) => {
    const poly = [
      [0, 0],
      [200, 0],
      [200, 200],
      [140, 200],
      [140, 60],
      [60, 60],
      [60, 200],
      [0, 120],
    ];
    const renderer = createMountainShadowRendering({
      world: { w: 1000, h: 1000 },
      lands: [{ poly }],
      terrainPlans: new Map([
        [
          0,
          {
            hills: [{ x: 30, y: 30, size: 10 }],
            ranges: [{ peaks: [{ x: 170, y: 45, size: 14 }] }],
          },
        ],
      ]),
      shorePlans: [planShoreline(poly, 17, "volcanic")],
      coastDepths: [20],
      ports: [{ x: 50, y: 40 }],
    });
    assert.equal(canvases.length, 4);
    assert.ok(
      canvases.some((canvas) =>
        canvas.calls.some((call) => call.method === "radial"),
      ),
    );
    assert.ok(
      canvases.some((canvas) =>
        canvas.calls.some(
          (call) =>
            call.method === "stop" &&
            String(call.args[1]).startsWith("rgba(255,184,100,"),
        ),
      ),
    );
    const bakes = canvases.map((canvas) => canvas.calls.length);
    const { context: c, calls } = recorder();
    const options = {
      camera: { x: 100, y: 100, zoom: 1 },
      vw: 600,
      vh: 500,
      lighting: sceneLighting(0.5),
    };
    renderer.draw(c, options);
    const first = calls.filter((call) => call.method === "drawImage");
    assert.equal(first.length, 2);
    renderer.draw(c, { ...options, camera: { ...options.camera, x: 1100 } });
    const seam = calls.filter((call) => call.method === "drawImage").slice(-2);
    assert.equal(seam[0].args[1], first[0].args[1] + 1000);
    renderer.draw(c, { ...options, vw: 2200, lighting: sceneLighting(0.73) });
    assert.ok(calls.filter((call) => call.method === "drawImage").length > 8);
    const before = calls.length;
    renderer.draw(c, { ...options, camera: { ...options.camera, y: 800 } });
    renderer.draw(c, { ...options, lighting: sceneLighting(0) });
    assert.equal(calls.length, before);
    assert.deepEqual(
      canvases.map((canvas) => canvas.calls.length),
      bakes,
    );
    assert.equal(c.globalAlpha, 0.8);
    assert.equal(c.globalCompositeOperation, "source-over");
  }));
