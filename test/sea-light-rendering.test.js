import assert from "node:assert/strict";
import test from "node:test";
import { MAP_TILT_COS } from "../src/core/projection.js";
import { createSeaLightRendering } from "../src/sea-light-rendering.js";
import { createSeaSurfaceRendering } from "../src/sea-surface-rendering.js";

function setup(t, createRenderer = createSeaLightRendering) {
  const originalDocument = globalThis.document;
  const clears = [],
    transforms = [],
    paints = [],
    blits = [],
    gradients = [],
    fills = [];
  const context = {
    globalAlpha: 1,
    clearRect: (...args) => clears.push(args),
    setTransform: (...args) => transforms.push(args),
    createLinearGradient(...args) {
      const gradient = {
        args,
        stops: [],
        addColorStop(...stop) {
          this.stops.push(stop);
        },
      };
      gradients.push(gradient);
      return gradient;
    },
    fillRect(...args) {
      fills.push({
        args,
        blend: this.globalCompositeOperation,
        alpha: this.globalAlpha,
      });
    },
  };
  const layer = { width: 0, height: 0, getContext: () => context };
  let allocations = 0;
  globalThis.document = {
    createElement() {
      allocations++;
      return layer;
    },
  };
  t.after(() => {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  });
  const states = [];
  const target = {
    globalAlpha: 0.5,
    globalCompositeOperation: "source-over",
    save() {
      states.push([this.globalAlpha, this.globalCompositeOperation]);
    },
    restore() {
      [this.globalAlpha, this.globalCompositeOperation] = states.pop();
    },
    drawImage(...args) {
      blits.push({
        alpha: this.globalAlpha,
        blend: this.globalCompositeOperation,
        args,
      });
    },
  };
  const renderer = createRenderer((...args) => paints.push(args));
  return {
    renderer,
    target,
    layer,
    context,
    clears,
    transforms,
    paints,
    blits,
    gradients,
    fills,
    get allocations() {
      return allocations;
    },
  };
}

const options = {
  camera: { x: 10, y: 400, zoom: 0.7 },
  vw: 801,
  vh: 601,
  time: 1000,
  lighting: { daylight: 1 },
  windAngle: 0.2,
};

test("sun bands blend once from a smaller padded layer and preserve target state", (t) => {
  const env = setup(t);
  env.renderer.draw(env.target, options);
  assert.equal(env.allocations, 1);
  assert.equal(env.layer.width, 465);
  assert.equal(env.layer.height, 365);
  assert.deepEqual(env.clears, [[0, 0, 465, 365]]);
  assert.equal(env.paints.length, 1);
  const [context, camera, seconds, lighting, wind, halfW, halfH] =
    env.paints[0];
  assert.equal(context, env.context);
  assert.equal(context.globalAlpha, 0.5);
  assert.equal(camera, options.camera);
  assert.equal(seconds, 1);
  assert.equal(lighting, options.lighting);
  assert.equal(wind, options.windAngle);
  assert.equal(halfW, 465 / 0.7);
  assert.equal(halfH, 365 / (0.7 * MAP_TILT_COS));
  assert.deepEqual(env.transforms.at(-1), [
    0.35,
    0,
    0,
    0.35 * MAP_TILT_COS,
    465 / 2 - 10 * 0.35,
    365 / 2 - 400 * 0.35 * MAP_TILT_COS,
  ]);
  assert.deepEqual(env.blits[0], {
    alpha: 1,
    blend: "screen",
    args: [env.layer, 10 - halfW, 400 - halfH, halfW * 2, halfH * 2],
  });
  assert.equal(env.target.globalAlpha, 0.5);
  assert.equal(env.target.globalCompositeOperation, "source-over");
});

test("steady glitter reuses its layer between updates and freezes at time zero", (t) => {
  const env = setup(t);
  env.renderer.draw(env.target, options);
  const moved = {
    ...options,
    time: 1016,
    windAngle: 0.201,
    camera: { ...options.camera, x: 10.1, y: 400.1 },
    lighting: { daylight: 1 },
  };
  env.renderer.draw(env.target, moved);
  assert.equal(env.paints.length, 1);
  assert.deepEqual(env.blits[0], env.blits[1]);
  env.renderer.draw(env.target, { ...moved, time: 1034 });
  assert.equal(env.paints.length, 2);
  assert.notDeepEqual(env.blits[1], env.blits[2]);
  env.renderer.draw(env.target, { ...moved, time: 0 });
  assert.equal(env.paints.length, 3);
  for (let i = 0; i < 120; i++)
    env.renderer.draw(env.target, { ...moved, time: 0 });
  assert.equal(env.paints.length, 3);
  assert.equal(env.allocations, 1);
});

test("sun cache refreshes for viewport, projection, weather, alpha, and buffer edges", (t) => {
  const env = setup(t);
  const overrides = [
    {},
    { vw: 900 },
    { vh: 900 },
    { camera: { ...options.camera, zoom: 1 } },
    { camera: { ...options.camera, x: 200 } },
    { camera: { ...options.camera, y: 600 } },
    { camera: { ...options.camera, x: -4800 } },
    { camera: { ...options.camera, x: 4800 } },
    { windAngle: 0.5 },
    { lighting: { daylight: 0.5 } },
    { lighting: { daylight: 1, storm: 1 } },
    { lighting: { daylight: 0, sunset: 1 } },
  ];
  for (const overridesForDraw of overrides) {
    const count = env.paints.length;
    env.renderer.draw(env.target, { ...options, ...overridesForDraw });
    assert.equal(env.paints.length, count + 1);
  }
  env.renderer.draw(env.target, options);
  const count = env.paints.length;
  env.target.globalAlpha = 0.75;
  env.renderer.draw(env.target, options);
  assert.equal(env.paints.length, count + 1);
  assert.equal(env.context.globalAlpha, 0.75);
  assert.equal(env.target.globalAlpha, 0.75);
  assert.ok(env.transforms.flat().every(Number.isFinite));
});

test("night and heavy cloud suppression avoid allocating or compositing a sun layer", (t) => {
  const env = setup(t);
  for (const lighting of [
    { daylight: 0 },
    { daylight: 0, sunrise: 0.01 },
    { daylight: 0.02, storm: 1 },
  ])
    env.renderer.draw(env.target, { ...options, lighting });
  assert.equal(env.allocations, 0);
  assert.equal(env.paints.length, 0);
  assert.equal(env.blits.length, 0);
  env.renderer.draw(env.target, { ...options, lighting: undefined });
  assert.equal(env.allocations, 1);
  assert.equal(env.blits.length, 1);
});

test("moon phase, source position, sea state, and quality invalidate cached glitter", (t) => {
  const env = setup(t);
  const changes = [
    { lighting: { daylight: 0, night: 1, moon: 1 } },
    { lighting: { daylight: 0, night: 1, moon: 0.32 } },
    { lighting: { daylight: 0, sunrise: 1 } },
    { lighting: { daylight: 0, sunset: 1 } },
    { roughness: 0.7 },
    { detail: 0.5 },
    { camera: { ...options.camera, x: 12 } },
  ];
  for (const change of changes) {
    const count = env.paints.length;
    env.renderer.draw(env.target, { ...options, ...change });
    assert.equal(env.paints.length, count + 1);
  }
});

test("buffered ripples reuse a padded world anchor and refresh at edges and projection changes", (t) => {
  const env = setup(t, createSeaSurfaceRendering);
  const frame = { ...options, roughness: 0.5, detail: 1 };
  env.renderer.draw(env.target, frame);
  assert.equal(env.layer.width, 929);
  assert.equal(env.layer.height, 729);
  assert.deepEqual(env.clears[0], [0, 0, 929, 729]);
  assert.equal(env.paints[0][1].vw, 929);
  assert.equal(env.paints[0][1].vh, 729);
  assert.equal(env.context.globalAlpha, 0.5);
  assert.equal(env.context.globalCompositeOperation, "source-over");
  assert.deepEqual(env.transforms.at(-1), [
    0.7,
    0,
    0,
    0.7 * MAP_TILT_COS,
    929 / 2 - 10 * 0.7,
    729 / 2 - 400 * 0.7 * MAP_TILT_COS,
  ]);
  assert.equal(env.blits[0].alpha, 1);
  assert.equal(env.target.globalAlpha, 0.5);
  env.renderer.draw(env.target, {
    ...frame,
    time: 1016,
    camera: { ...frame.camera, x: 40, y: 410 },
  });
  assert.equal(env.paints.length, 1);
  assert.deepEqual(env.blits[0], env.blits[1]);
  env.renderer.draw(env.target, { ...frame, time: 1034 });
  assert.equal(env.paints.length, 2);
  for (const change of [
    { camera: { ...frame.camera, x: 200 } },
    { camera: { ...frame.camera, y: 600 } },
    { camera: { ...frame.camera, x: -1000 } },
    { camera: { ...frame.camera, x: 1000 } },
    { camera: { ...frame.camera, zoom: 1 } },
    { vw: 1000 },
    { vh: 900 },
    { roughness: 1 },
    { windAngle: 1 },
    { lighting: { daylight: 0 } },
    { lighting: { daylight: 1, storm: 1 } },
    { detail: 0.5 },
  ]) {
    env.renderer.draw(env.target, { ...frame, time: 0 });
    const count = env.paints.length;
    env.renderer.draw(env.target, { ...frame, ...change, time: 0 });
    assert.equal(env.paints.length, count + 1);
  }
  assert.equal(env.allocations, 1);
  assert.ok(
    env.blits.every(({ args }) => args.slice(1).every(Number.isFinite)),
  );
});

test("buffered ripples freeze with reduced motion while updating weather and inherited opacity", (t) => {
  const env = setup(t, createSeaSurfaceRendering);
  const frame = { ...options, reducedMotion: true, roughness: 0 };
  env.renderer.draw(env.target, frame);
  env.renderer.draw(env.target, { ...frame, time: 99000 });
  assert.equal(env.paints.length, 1);
  env.renderer.draw(env.target, { ...frame, roughness: 0.2 });
  assert.equal(env.paints.length, 2);
  env.target.globalAlpha = 0.75;
  env.renderer.draw(env.target, { ...frame, roughness: 0.2 });
  assert.equal(env.paints.length, 3);
  assert.equal(env.context.globalAlpha, 0.75);
  assert.equal(env.target.globalAlpha, 0.75);
});

test("zoomed-out ocean work stays bounded, fades distant edges, and follows wrapped focus", (t) => {
  const env = setup(t, (draw) => createSeaSurfaceRendering(draw, 1000));
  const frame = {
    ...options,
    vw: 3840,
    vh: 2160,
    roughness: 0,
    camera: { x: 990, y: 400, zoom: 0.7 },
    focus: { x: -10, y: 450, radius: 480 },
  };
  env.renderer.draw(env.target, frame);
  assert.equal(env.layer.width, 1528);
  assert.equal(env.layer.height, Math.ceil(2000 * 0.7 * MAP_TILT_COS + 128));
  assert.equal(env.paints[0][1].camera.x, 990);
  assert.equal(env.paints[0][1].camera.y, 450);
  assert.equal(env.gradients.length, 2);
  for (const gradient of env.gradients) {
    assert.equal(gradient.stops[0][1], "rgba(0,0,0,0)");
    assert.equal(gradient.stops[1][1], "#000");
    assert.equal(gradient.stops[2][1], "#000");
    assert.equal(gradient.stops[3][1], "rgba(0,0,0,0)");
  }
  assert.ok(
    env.fills.every(
      ({ blend, alpha, args }) =>
        blend === "destination-in" &&
        alpha === 1 &&
        args[2] === env.layer.width,
    ),
  );
  assert.equal(env.context.globalAlpha, 0.5);
  assert.equal(env.context.globalCompositeOperation, "source-over");
  const dimensions = [env.layer.width, env.layer.height];
  env.renderer.draw(env.target, { ...frame, vw: 7680, vh: 4320, time: 1100 });
  assert.deepEqual([env.layer.width, env.layer.height], dimensions);
  assert.equal(env.allocations, 1);
  env.renderer.draw(env.target, {
    ...frame,
    time: 1200,
    focus: { ...frame.focus, x: -950 },
  });
  assert.equal(env.paints.at(-1)[1].camera.x, 1050);
});

test("buffered focus also works without a wrapping world width", (t) => {
  const env = setup(t, createSeaSurfaceRendering);
  env.renderer.draw(env.target, {
    ...options,
    roughness: 0,
    focus: { x: -10, y: 450, radius: 200 },
  });
  assert.equal(env.paints[0][1].camera.x, -10);
  assert.equal(env.paints[0][1].camera.y, 450);
  assert.equal(env.gradients.length, 0);
});
