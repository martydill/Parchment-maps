import assert from "node:assert/strict";
import test from "node:test";
import { createMistRendering } from "../src/mist-rendering.js";
import { MAP_TILT_COS } from "../src/core/projection.js";

test("mist reuses banks during drift and camera motion, rebuilding at cache edges, zoom, and resize", () => {
  const originalDocument = globalThis.document;
  const paints = [];
  const transforms = [];
  const layer = {
    width: 0,
    height: 0,
    getContext() {
      return {
        setTransform: (...args) => transforms.push(args),
        drawImage: (...args) => paints.push(args),
      };
    },
  };
  globalThis.document = { createElement: () => layer };
  try {
    const stamp = {};
    const renderer = createMistRendering(1000, stamp);
    const blits = [];
    const c = { drawImage: (...args) => blits.push(args) };
    const options = {
      camera: { x: 0, y: 400, zoom: 0.7 },
      vw: 600,
      vh: 400,
      time: 0,
    };
    renderer.draw(c, options);
    const count = paints.length;
    assert.ok(count > 0);
    assert.deepEqual(blits[0], [layer, -128, -128]);
    assert.equal(layer.width, 856);
    assert.equal(layer.height, 656);
    renderer.draw(c, {
      ...options,
      time: 1000,
      camera: { ...options.camera, x: 40, y: 420 },
    });
    assert.equal(paints.length, count);
    assert.deepEqual(blits[1], [
      layer,
      -128 - 37 * 0.7,
      -128 - 20 * 0.7 * MAP_TILT_COS,
    ]);
    for (const overrides of [
      { camera: { x: 300, y: 400, zoom: 0.7 } },
      { camera: { x: 300, y: 800, zoom: 0.7 } },
      { camera: { x: 300, y: 800, zoom: 1.5 } },
      { vw: 900 },
      { vh: 600 },
      { time: 1000000 },
    ]) {
      const before = paints.length;
      renderer.draw(c, { ...options, ...overrides });
      assert.ok(paints.length > before);
      assert.deepEqual(blits.at(-1), [layer, -128, -128]);
    }
    assert.ok(paints.every(([image]) => image === stamp));
    assert.ok(transforms.flat().every(Number.isFinite));
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

test("mist keeps bank geometry and opacity continuous across negative and positive world copies", () => {
  const originalDocument = globalThis.document;
  const layers = [];
  globalThis.document = {
    createElement() {
      const draws = [];
      const context = {
        globalAlpha: 1,
        setTransform() {},
        drawImage: (...args) =>
          draws.push([context.globalAlpha, ...args.slice(1)]),
      };
      const layer = { width: 0, height: 0, getContext: () => context, draws };
      layers.push(layer);
      return layer;
    },
  };
  try {
    const options = {
      camera: { x: 10, y: 400, zoom: 0.7 },
      vw: 600,
      vh: 400,
      time: 12345,
    };
    const draw = (offset) => {
      createMistRendering(1000, {}).draw(
        { drawImage() {} },
        {
          ...options,
          camera: { ...options.camera, x: options.camera.x + offset },
        },
      );
      return layers
        .at(-1)
        .draws.map(([alpha, x, ...rest]) => [alpha, x - offset, ...rest]);
    };
    const canonical = draw(0);
    for (const offset of [-2000, -1000, 1000, 2000]) {
      const wrapped = draw(offset);
      assert.equal(wrapped.length, canonical.length);
      for (let bank = 0; bank < canonical.length; bank++) {
        for (
          let coordinate = 0;
          coordinate < canonical[bank].length;
          coordinate++
        ) {
          assert.ok(
            Math.abs(wrapped[bank][coordinate] - canonical[bank][coordinate]) <
              1e-9,
          );
        }
      }
    }
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});
