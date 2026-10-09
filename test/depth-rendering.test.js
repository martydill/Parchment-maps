import assert from "node:assert/strict";
import test from "node:test";
import { createDepthRendering } from "../src/depth-rendering.js";
import { sceneLighting } from "../src/core/lighting.js";
import { MAP_TILT_COS } from "../src/core/projection.js";

test("the distance wash preserves a transparent, projected focus and reuses its surface", () => {
  const originalDocument = globalThis.document;
  const transforms = [];
  const stops = [];
  const gradients = [];
  const copies = [];
  const states = [];
  const wash = {
    globalCompositeOperation: "source-over",
    setTransform: (...args) => transforms.push(args),
    clearRect() {},
    fillRect() {},
    drawImage: (...args) => copies.push(args),
    createRadialGradient(...args) {
      gradients.push(args);
      return { addColorStop: (...stop) => stops.push(stop) };
    },
    save() {
      states.push(this.globalCompositeOperation);
    },
    restore() {
      this.globalCompositeOperation = states.pop();
    },
  };
  const layer = { getContext: () => wash };
  let allocations = 0;
  globalThis.document = {
    createElement: () => {
      allocations++;
      return layer;
    },
  };
  try {
    const renderer = createDepthRendering();
    const blits = [];
    let depth = 0;
    const c = {
      canvas: { width: 1282, height: 962 },
      save() {
        depth++;
      },
      restore() {
        depth--;
      },
      drawImage: (...args) => blits.push(args),
    };
    const options = {
      width: 641,
      height: 481,
      zoom: 1,
      ship: { x: -20, y: 150 },
      lighting: sceneLighting(),
    };
    renderer.draw(c, options);
    assert.equal(layer.width, Math.ceil(641 * 0.3));
    assert.equal(layer.height, Math.ceil(481 * 0.3));
    assert.deepEqual(copies[0], [c.canvas, 0, 0, layer.width, layer.height]);
    assert.deepEqual(blits[0], [layer, 0, 0, 641, 481]);
    assert.deepEqual(transforms[1], [0.3, 0, 0, 0.3 * MAP_TILT_COS, -6, 45]);
    assert.equal(
      gradients[0][2],
      230,
      "the immediate coast is excluded from the wash",
    );
    assert.deepEqual(stops[0], [0, "rgba(0,0,0,1)"]);
    assert.deepEqual(stops.at(-1), [1, "rgba(0,0,0,0)"]);
    assert.equal(wash.globalCompositeOperation, "source-over");
    renderer.draw(c, {
      ...options,
      width: 390,
      height: 844,
      maskScale: 0.2,
      zoom: 0.4,
      ship: { x: 195, y: 422 },
      lighting: sceneLighting(0),
    });
    assert.equal(layer.width, 78);
    assert.equal(layer.height, 169);
    assert.equal(wash.filter, "none");
    assert.equal(gradients[1][2], 110);
    assert.equal(allocations, 1);
    assert.equal(depth, 0);
    assert.equal(states.length, 0);
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});
