import assert from "node:assert/strict";
import test from "node:test";
import { createWakeCrossingRendering } from "../src/wake-crossing-rendering.js";
import { createSeaRendering } from "../src/sea-rendering.js";
import { CROSSING_LIFETIME } from "../src/core/wake-crossings.js";

const event = {
  x: 500,
  y: 400,
  time: 100,
  seed: 2,
  strength: 0.85,
  energy: 1,
  angle: 0.4,
};
const camera = { x: 500, y: 400, zoom: 1 };
function recording() {
  const marks = [],
    clips = [],
    states = [];
  let path = [];
  const c = new Proxy(
    {
      globalAlpha: 0.7,
      globalCompositeOperation: "source-over",
      save() {
        states.push({
          globalAlpha: this.globalAlpha,
          globalCompositeOperation: this.globalCompositeOperation,
        });
      },
      restore() {
        Object.assign(this, states.pop());
      },
      beginPath() {
        path = [];
      },
      ellipse(...args) {
        path.push(["ellipse", ...args]);
      },
      moveTo(...args) {
        path.push(["moveTo", ...args]);
      },
      lineTo(...args) {
        path.push(["lineTo", ...args]);
      },
      quadraticCurveTo(...args) {
        path.push(["quadraticCurveTo", ...args]);
      },
      stroke() {
        marks.push({
          kind: "stroke",
          path: [...path],
          style: this.strokeStyle,
          alpha: this.globalAlpha,
          blend: this.globalCompositeOperation,
          width: this.lineWidth,
        });
      },
      fill() {
        marks.push({
          kind: "fill",
          path: [...path],
          style: this.fillStyle,
          alpha: this.globalAlpha,
          blend: this.globalCompositeOperation,
        });
      },
    },
    { get: (target, key) => target[key] ?? (() => {}) },
  );
  const draw = createWakeCrossingRendering({
    WORLD: { w: 1000 },
    visibleCoasts: () => ["coast"],
    clipWater: (_c, coasts, region) => clips.push({ coasts, region }),
  });
  return { c, marks, clips, states, draw };
}

test("crossings paint fragmented crests and foam inside a bounded water clip", () => {
  const r = recording();
  r.draw(r.c, [event], 800, camera, 400, 300);
  assert.equal(r.clips.length, 1);
  assert.deepEqual(r.clips[0], {
    coasts: ["coast"],
    region: { left: 418, right: 582, top: 318, bottom: 482 },
  });
  const crests = r.marks.filter(({ kind }) => kind === "stroke");
  assert.ok(crests.length > 20);
  assert.ok(
    crests.every(
      ({ path }) =>
        path[0][0] === "ellipse" && path[0].at(-1) - path[0].at(-2) < 0.7,
    ),
    "open arcs never draw perfect full circles",
  );
  assert.ok(r.marks.filter(({ kind }) => kind === "fill").length > 5);
  assert.ok(
    r.marks.every(({ path }) =>
      path
        .flat()
        .filter((n) => typeof n === "number")
        .every(Number.isFinite),
    ),
  );
  assert.equal(r.c.globalAlpha, 0.7);
  assert.equal(r.c.globalCompositeOperation, "source-over");
  assert.equal(r.states.length, 0);
});

test("offscreen, newborn and fully dissolved crossings do no drawing", () => {
  for (const [events, time, view] of [
    [[], 800, camera],
    [[event], event.time, camera],
    [[event], event.time + CROSSING_LIFETIME, camera],
    [[event], 800, { ...camera, y: 2000 }],
    [[event], 800, { ...camera, x: 0 }],
  ]) {
    const r = recording();
    r.draw(r.c, events, time, view, 400, 300);
    assert.equal(r.marks.length, 0);
    assert.equal(r.clips.length, 0);
  }
});

test("reduced motion freezes fragment geometry while opacity dissolves", () => {
  const early = recording(),
    late = recording();
  early.draw(early.c, [event], 800, camera, 400, 300, { reducedMotion: true });
  late.draw(late.c, [event], 2500, camera, 400, 300, { reducedMotion: true });
  assert.deepEqual(
    early.marks.map(({ path }) => path),
    late.marks.map(({ path }) => path),
  );
  assert.notDeepEqual(
    early.marks.map(({ style }) => style),
    late.marks.map(({ style }) => style),
  );
});

test("world copies retain identical marks and low detail draws fewer fragments", () => {
  const original = recording(),
    wrapped = recording(),
    low = recording();
  original.draw(original.c, [event], 800, camera, 400, 300);
  wrapped.draw(
    wrapped.c,
    [{ ...event, x: event.x + 1000 }],
    800,
    camera,
    400,
    300,
  );
  assert.deepEqual(original.marks, wrapped.marks);
  assert.deepEqual(original.clips, wrapped.clips);
  low.draw(low.c, [event], 800, camera, 400, 300, {
    detail: 0.5,
    roughness: 1,
  });
  assert.ok(low.marks.length < original.marks.length);
  assert.ok(low.marks.length > 10);
});

test("night crossings pick up silver and glow only in a luminous sea", () => {
  const seas = [{ name: "Luminous", x: 500, y: 400, rx: 200, ry: 200 }];
  for (const [lighting, bioluminescentSeas, luminous] of [
    [{ night: 1, daylight: 0 }, seas, true],
    [{ night: 1, daylight: 0 }, [], false],
    [{ night: 0, daylight: 1 }, seas, false],
  ]) {
    const r = recording();
    r.draw(r.c, [event], 800, camera, 400, 300, {
      lighting,
      bioluminescentSeas,
    });
    assert.equal(
      r.marks.some(({ blend }) => blend === "screen"),
      luminous,
    );
    if (lighting.night)
      assert.ok(
        r.marks.some(({ style }) => style.startsWith("rgba(186,222,222,")),
      );
    assert.equal(r.c.globalCompositeOperation, "source-over");
  }
});

test("ribbons break at discontinuities, fade at intersections and cull distant trails", () => {
  const renderer = createSeaRendering({
    WORLD: { w: 1000, h: 800 },
    lands: [],
  });
  const trail = [
    { x: 510, y: 400, time: 700, strength: 1 },
    { x: 500, y: 400, time: 600, strength: 1 },
    { x: 490, y: 400, time: 500, strength: 1 },
  ];
  const before = recording(),
    disturbed = recording(),
    broken = recording(),
    offscreen = recording();
  renderer.drawWake(before.c, trail, 800, camera, 400, 300);
  renderer.drawWake(disturbed.c, trail, 800, camera, 400, 300, {
    crossings: [event],
  });
  assert.ok(disturbed.marks.some(({ alpha }) => alpha < 0.7));
  assert.ok(before.marks.every(({ alpha }) => alpha === 0.7));
  renderer.drawWake(
    broken.c,
    trail.map((p) => ({ ...p, breakBefore: true })),
    800,
    camera,
    400,
    300,
    {
      lighting: { night: 1, daylight: 0 },
      bioluminescentSeas: [{ x: 500, y: 400, rx: 100, ry: 100 }],
    },
  );
  assert.equal(broken.marks.length, 0);
  renderer.drawWake(offscreen.c, trail, 800, { ...camera, y: 2000 }, 400, 300);
  assert.equal(offscreen.marks.length, 0);
  assert.equal(disturbed.c.globalAlpha, 0.7);
});
