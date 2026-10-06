import assert from "node:assert/strict";
import test from "node:test";
import {
  createRenderCadence,
  createRenderQuality,
  renderPixelRatio,
} from "../src/core/render-quality.js?v=1";

function feed(controller, frameMs, count) {
  let changes = 0;
  for (let frame = 0; frame < count; frame++)
    changes += Number(controller.sample(frameMs));
  return changes;
}

test("render resolution respects device density, the pixel budget, and CSS readability", () => {
  assert.equal(renderPixelRatio(390, 844, 2), 2);
  assert.equal(renderPixelRatio(390, 844, 3), 2);
  assert.equal(renderPixelRatio(1920, 1080, 1), 1);
  assert.equal(renderPixelRatio(390, 844), 1);
  const retina = renderPixelRatio(2560, 1440, 2);
  assert.ok(retina > 1 && retina < 2);
  assert.ok(Math.abs(2560 * 1440 * retina ** 2 - 5_000_000) < 1e-7);
  assert.equal(renderPixelRatio(3840, 2160, 2), 1);
  assert.equal(renderPixelRatio(390, 844, 2, 0.5), 1);
  assert.equal(renderPixelRatio(390, 844, 2, 0.75), 1.5);
  assert.equal(renderPixelRatio(390, 844, 0.5), 1);
  assert.equal(renderPixelRatio(390, 844, 2, 0), 1);
  assert.equal(renderPixelRatio(390, 844, 2, 2), 2);
  assert.equal(renderPixelRatio(390, 844, NaN), 1);
  assert.equal(renderPixelRatio(390, 844, 2, NaN), 2);
  for (const [width, height] of [
    [0, 600],
    [-1, 600],
    [800, 0],
    [800, -1],
    [NaN, 600],
    [800, Infinity],
  ])
    assert.equal(renderPixelRatio(width, height, 2), 1);
});

test("sustained slow frames lower quality while one isolated stall does not", () => {
  const controller = createRenderQuality();
  assert.equal(controller.quality, 1);
  feed(controller, 16, 40);
  controller.sample(180);
  feed(controller, 16, 12);
  assert.equal(controller.quality, 1);
  controller.reset();
  assert.equal(feed(controller, 40, 24), 0);
  assert.equal(controller.sample(40), true);
  assert.equal(controller.quality, 0.85);
  assert.ok(feed(controller, 100, 50) > 0);
  assert.equal(controller.quality, 0.5);
  assert.equal(feed(controller, 100, 10), 0);
  assert.equal(controller.quality, 0.5);
});

test("quality recovers slowly after stable frame times and stays capped", () => {
  const controller = createRenderQuality();
  feed(controller, 40, 25);
  assert.equal(feed(controller, 16, 629), 0);
  assert.equal(controller.quality, 0.85);
  assert.equal(controller.sample(16), true);
  assert.equal(controller.quality, 1);
  assert.equal(feed(controller, 16, 630), 0);
});

test("moderate frame times and suspension interrupt recovery without changing quality", () => {
  const controller = createRenderQuality();
  feed(controller, 40, 25);
  feed(controller, 16, 315);
  feed(controller, 18, 56);
  feed(controller, 16, 315);
  assert.equal(controller.quality, 0.85);
  for (const interval of [251, 10000, 0, -1, NaN, Infinity, undefined]) {
    assert.equal(controller.sample(interval), false);
    assert.equal(controller.quality, 0.85);
  }
  assert.equal(feed(controller, 16, 629), 0);
  assert.equal(controller.sample(16), true);
});

test("a reset clears unfinished samples without losing the selected quality", () => {
  const controller = createRenderQuality();
  feed(controller, 40, 25);
  feed(controller, 40, 20);
  controller.reset();
  assert.equal(feed(controller, 40, 5), 0);
  assert.equal(controller.quality, 0.85);
  controller.reset();
  assert.equal(feed(controller, 18.5, 55), 0);
});

test("frame pacing below the 60 Hz budget triggers adjustment even around 50 FPS", () => {
  const controller = createRenderQuality();
  assert.equal(feed(controller, 20, 49), 0);
  assert.equal(controller.sample(20), true);
  assert.equal(controller.quality, 0.85);
});

test("soft-layer cadence reuses nearby frames and refreshes on time or state changes", () => {
  const cadence = createRenderCadence();
  const frame = { x: 10, y: 20, width: 800, height: 600, key: "view" };
  assert.equal(cadence.shouldRender(1000, frame), true);
  assert.equal(cadence.shouldRender(1016, { ...frame, x: 12, y: 18 }), false);
  assert.equal(cadence.shouldRender(1033, frame), false);
  assert.equal(cadence.shouldRender(1034, frame), true);
  assert.equal(cadence.shouldRender(0, frame), true);
  assert.equal(cadence.shouldRender(0, frame), false);
  for (const change of [
    { x: 13 },
    { y: 23 },
    { width: 900 },
    { height: 900 },
    { key: "zoom" },
  ]) {
    cadence.reset();
    assert.equal(cadence.shouldRender(0, frame), true);
    assert.equal(cadence.shouldRender(1, { ...frame, ...change }), true);
  }
  cadence.reset();
  assert.equal(cadence.shouldRender(1, frame), true);
  const custom = createRenderCadence(100, 0);
  assert.equal(custom.shouldRender(0, frame), true);
  assert.equal(custom.shouldRender(99, frame), false);
  assert.equal(custom.shouldRender(100, frame), true);
  assert.equal(custom.shouldRender(101, { ...frame, x: 10.1 }), true);
});
