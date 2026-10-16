import test from "node:test";
import assert from "node:assert/strict";
import { createUnderwaterRendering } from "../src/underwater-rendering.js";
import { MAP_TILT_COS } from "../src/core/projection.js";

function recorder() {
  const calls = [];
  const states = [];
  const c = new Proxy(
    { globalAlpha: 0.7, globalCompositeOperation: "source-over" },
    {
      get(target, key) {
        if (key in target) return target[key];
        if (key === "save")
          return () =>
            states.push({
              globalAlpha: c.globalAlpha,
              globalCompositeOperation: c.globalCompositeOperation,
            });
        if (key === "restore") return () => Object.assign(target, states.pop());
        return (...args) =>
          calls.push({ method: key, args, alpha: c.globalAlpha });
      },
    },
  );
  return { c, calls };
}

function setup(
  t,
  lands = [
    {
      poly: [
        [300, 300],
        [1000, 300],
        [1000, 800],
        [300, 800],
      ],
    },
  ],
) {
  const previous = globalThis.document;
  const canvases = [];
  globalThis.document = {
    createElement() {
      const r = recorder();
      const canvas = { ...r, getContext: () => r.c };
      canvases.push(canvas);
      return canvas;
    },
  };
  t.after(() => {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  });
  const clips = [];
  const renderer = createUnderwaterRendering({
    WORLD: { w: 1800, h: 1200 },
    lands,
    visibleCoasts: (...args) => args,
    clipWater: (...args) => clips.push(args),
  });
  const draw = (changes = {}) => {
    const r = recorder();
    renderer.draw(r.c, {
      camera: { x: 700, y: 600, zoom: 1 },
      vw: 1500,
      vh: 1000,
      time: 1000,
      ...changes,
    });
    return r;
  };
  return { draw, canvases, clips };
}

test("submerged plates paint all four forms once, clip to water, and restore canvas state", (t) => {
  const env = setup(t);
  const first = env.draw();
  assert.ok(env.canvases.length > 7);
  assert.ok(env.canvases.every((c) => c.width === 192 && c.height === 192));
  const art = env.canvases.flatMap(({ calls }) => calls);
  assert.ok(
    art.some(({ method }) => method === "clearRect"),
    "broken masonry is baked",
  );
  assert.ok(
    art.some(({ method }) => method === "bezierCurveTo"),
    "kelp and hull curves are baked",
  );
  assert.ok(
    art.some(({ method }) => method === "quadraticCurveTo"),
    "coral branches and ribs are baked",
  );
  assert.equal(env.clips.length, 1);
  assert.equal(first.c.globalAlpha, 0.7);
  assert.equal(first.c.globalCompositeOperation, "source-over");
  const count = env.canvases.length;
  const commands = env.canvases.map(({ calls }) => calls.length);
  const next = env.draw({ time: 9000 });
  assert.equal(env.canvases.length, count);
  assert.deepEqual(
    env.canvases.map(({ calls }) => calls.length),
    commands,
  );
  assert.notDeepEqual(
    first.calls,
    next.calls,
    "only the moving reveal changes",
  );
  for (const { args, alpha } of first.calls) {
    assert.ok(args.slice(1).every(Number.isFinite));
    assert.ok(alpha >= 0 && alpha < 0.2);
    assert.equal(args[3], 192);
    assert.equal(args[4], 6);
  }
});

test("underwater refraction wraps with the chart and freezes with reduced motion", (t) => {
  const env = setup(t);
  const a = env.draw({ reducedMotion: true, time: 1000 });
  const b = env.draw({ reducedMotion: true, time: 99000 });
  assert.deepEqual(a.calls, b.calls);
  const shifted = env.draw({
    reducedMotion: true,
    camera: { x: 2500, y: 600, zoom: 1 },
  });
  assert.equal(a.calls.length, shifted.calls.length);
  shifted.calls.forEach((call, i) => {
    assert.ok(Math.abs(call.args[5] - a.calls[i].args[5] - 1800) < 1e-9);
    assert.equal(call.args[6], a.calls[i].args[6]);
    assert.equal(call.alpha, a.calls[i].alpha);
  });
});

test("quality reduces reveal sampling while distant, deep, and dark water allocate no plates", (t) => {
  const env = setup(t);
  assert.equal(
    env.draw({ camera: { x: 700, y: 3000, zoom: 1 } }).calls.length,
    0,
  );
  assert.equal(env.canvases.length, 0);
  assert.equal(env.draw({ lighting: { daylight: 0 } }).calls.length, 0);
  assert.equal(env.canvases.length, 0);
  assert.equal(
    env.clips.length,
    0,
    "invisible plates never set up coastline masks",
  );
  const high = env.draw().calls.length;
  assert.equal(env.draw({ detail: 0.75 }).calls.length, (high * 20) / 32);
  assert.equal(env.draw({ detail: 0.6 }).calls.length, (high * 12) / 32);
  const deep = setup(t, []);
  assert.equal(deep.draw().calls.length, 0);
  assert.equal(deep.canvases.length, 0);
});

test("water scissoring contains every refracted strip across wrapped views", (t) => {
  const env = setup(t);
  for (const x of [700, -1100, 2500]) {
    const { calls } = env.draw({
      camera: { x, y: 280, zoom: 1.5 },
      vw: 300,
      vh: 240,
    });
    assert.ok(calls.length > 0);
    const region = env.clips.at(-1)[2];
    for (const { args } of calls) {
      assert.ok(args[5] >= region.left);
      assert.ok(args[5] + args[7] <= region.right);
      assert.ok(args[6] >= region.top);
      assert.ok(args[6] + args[8] <= region.bottom);
    }
    assert.ok(
      region.right - region.left < 1800,
      "the scissor is local to the artwork",
    );
  }
});

test("partly offscreen plates only sample strips that can reach the viewport", (t) => {
  const env = setup(t);
  const camera = { x: 700, y: 280, zoom: 1 };
  const full = env.draw({ camera, vw: 1500, vh: 1000 });
  const narrow = env.draw({ camera, vw: 1500, vh: 10 });
  assert.ok(narrow.calls.length > 0);
  assert.ok(narrow.calls.length < full.calls.length);
  const edge = 1 / MAP_TILT_COS;
  const top = camera.y - 10 / (2 * MAP_TILT_COS) - edge;
  const bottom = camera.y + 10 / (2 * MAP_TILT_COS) + edge;
  for (const { args } of narrow.calls) {
    assert.ok(args[6] + args[8] >= top);
    assert.ok(args[6] <= bottom);
  }
});
