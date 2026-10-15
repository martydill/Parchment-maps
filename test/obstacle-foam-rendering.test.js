import assert from "node:assert/strict";
import test from "node:test";
import { createObstacleFoamRendering } from "../src/obstacle-foam-rendering.js";

function target() {
  const calls = [];
  const context = new Proxy(
    { globalAlpha: 0.6 },
    {
      get(object, name) {
        return name in object
          ? object[name]
          : (...args) => calls.push([name, ...args]);
      },
      set(object, name, value) {
        object[name] = value;
        calls.push([name, value]);
        return true;
      },
    },
  );
  return { context, calls };
}
const options = {
  camera: { x: 250, y: 250, zoom: 1 },
  time: 0,
  roughness: 0.7,
  windAngle: 0,
  detail: 1,
  view: { left: 100, right: 400, top: 100, bottom: 400 },
  reducedMotion: false,
};
const poly = [
  [200, 200],
  [280, 200],
  [280, 280],
  [200, 280],
];
const make = () =>
  createObstacleFoamRendering({
    WORLD: { w: 1000, h: 1000 },
    coasts: [{ poly, depth: 4, shoreline: [{ kind: "rock" }] }],
    currents: [],
  });

test("foam draws retained broken filaments over troughs and keeps inherited opacity", () => {
  const renderer = make(),
    recording = target();
  renderer.draw(recording.context, options);
  assert.ok(
    recording.calls.some(
      ([name, style]) =>
        name === "strokeStyle" && style.startsWith("rgba(250,247,221,"),
    ),
  );
  assert.ok(
    recording.calls.some(
      ([name, style]) =>
        name === "strokeStyle" && style.startsWith("rgba(30,90,91,"),
    ),
  );
  assert.ok(recording.calls.filter(([name]) => name === "lineTo").length > 20);
  assert.equal(recording.context.globalAlpha, 0.6);
  assert.equal(recording.calls.at(-1)[0], "restore");
});

test("foam freezes under reduced motion and follows horizontally wrapped cameras", () => {
  const renderer = make(),
    first = target(),
    frozen = target(),
    wrapped = target();
  renderer.draw(first.context, { ...options, reducedMotion: true });
  renderer.draw(frozen.context, { ...options, time: 100, reducedMotion: true });
  assert.deepEqual(first.calls, frozen.calls);
  renderer.draw(wrapped.context, {
    ...options,
    camera: { ...options.camera, x: 1250 },
    view: { ...options.view, left: 1100, right: 1400 },
    reducedMotion: true,
  });
  const positions = (calls) =>
    calls.filter(([name]) => name === "lineTo" || name === "moveTo");
  const a = positions(first.calls),
    b = positions(wrapped.calls);
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) {
    assert.equal(a[i][0], b[i][0]);
    assert.ok(Math.abs(b[i][1] - a[i][1] - 1000) < 1e-9);
    assert.equal(a[i][2], b[i][2]);
  }
});

test("harbor masks follow the same world copy and distant walls are culled", () => {
  const original = globalThis.Path2D;
  globalThis.Path2D = class {
    rect() {}
    moveTo() {}
    lineTo() {}
    closePath() {}
  };
  try {
    const renderer = make();
    renderer.setHarbors([
      {
        poly: [
          [300, 300],
          [340, 300],
          [340, 306],
          [300, 306],
        ],
        kind: "harbor",
      },
      {
        poly: [
          [700, 700],
          [710, 700],
          [710, 710],
        ],
        kind: "harbor",
      },
    ]);
    const recording = target();
    renderer.draw(recording.context, {
      ...options,
      camera: { ...options.camera, x: 1250 },
      view: { ...options.view, left: 1100, right: 1400 },
    });
    assert.equal(recording.calls.filter(([name]) => name === "clip").length, 1);
    assert.ok(
      recording.calls.some(([name, x]) => name === "translate" && x === 1000),
    );
    assert.ok(
      recording.calls.some(([name, x]) => name === "translate" && x === -1000),
    );
  } finally {
    if (original === undefined) delete globalThis.Path2D;
    else globalThis.Path2D = original;
  }
});
