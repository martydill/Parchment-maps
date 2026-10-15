import assert from "node:assert/strict";
import test from "node:test";
import { createCartographicRendering } from "../src/cartographic-rendering.js";
import { pointInWrappedPolygon } from "../src/core/geometry.js";

function recording() {
  const draws = [];
  const transforms = [];
  let measures = 0;
  let depth = 0;
  const states = [];
  const c = {
    globalAlpha: 1,
    save() {
      depth++;
      states.push({ globalAlpha: this.globalAlpha, font: this.font });
    },
    restore() {
      assert.ok(--depth >= 0);
      Object.assign(this, states.pop());
    },
    translate(x, y) {
      transforms.push([x, y]);
    },
    rotate(angle) {
      assert.ok(Number.isFinite(angle));
    },
    measureText() {
      measures++;
      return { width: 12 };
    },
    strokeText() {},
    fillText(text) {
      draws.push({ text, alpha: this.globalAlpha });
    },
  };
  return { c, draws, transforms, measures: () => measures, depth: () => depth };
}

const options = {
  worldWidth: 1000,
  lands: [
    {
      name: "Isle",
      poly: [
        [800, 100],
        [1000, 100],
        [1000, 300],
        [800, 300],
      ],
    },
  ],
  seas: [["BLUE SEA", 0, 400, 30]],
};

test("geographic lettering caches glyph metrics and resets after font loading", () => {
  const renderer = createCartographicRendering(options);
  const r = recording();
  renderer.draw(r.c, { zoom: 1.5 });
  assert.equal(r.draws.map((draw) => draw.text).join(""), "ISLEBLUE SEA");
  assert.ok(r.transforms.flat().every(Number.isFinite));
  assert.equal(r.depth(), 0);
  const measured = r.measures();
  renderer.draw(r.c, { zoom: 1.5 });
  assert.equal(r.measures(), measured);
  renderer.invalidate();
  renderer.draw(r.c);
  assert.equal(r.measures(), measured * 2);
});

test("wrapped ribbons repeat consistently and offscreen copies skip drawing", () => {
  const renderer = createCartographicRendering({ ...options, lands: [] });
  const r = recording();
  renderer.draw(r.c, { copies: [0, 1000] });
  const count = r.transforms.length / 2;
  for (let index = 0; index < count; index++) {
    assert.ok(
      Math.abs(r.transforms[index + count][0] - r.transforms[index][0] - 1000) <
        1e-8,
    );
    assert.equal(r.transforms[index + count][1], r.transforms[index][1]);
  }
  const offscreen = recording();
  renderer.draw(offscreen.c, {
    bounds: { left: 4000, right: 5000, top: 0, bottom: 800 },
  });
  assert.deepEqual(offscreen.draws, []);
  renderer.draw(offscreen.c, {
    bounds: { left: -300, right: 300, top: 200, bottom: 600 },
  });
  assert.equal(offscreen.draws.length, count);
});

test("overview lettering ignores zoom reveal while sailing fades each tier", () => {
  const renderer = createCartographicRendering(options);
  const hidden = recording();
  renderer.draw(hidden.c, { zoom: 0 });
  assert.deepEqual(hidden.draws, []);
  renderer.draw(hidden.c, { zoom: 0, overview: true });
  assert.equal(hidden.draws.length, 12);
  const seaOnly = recording();
  renderer.draw(seaOnly.c, { zoom: 0.7 });
  assert.equal(seaOnly.draws.map((draw) => draw.text).join(""), "BLUE SEA");
});

test("basin lettering shifts away from an island across the first meridian", () => {
  const poly = [
    [950, 340],
    [1050, 340],
    [1050, 460],
    [950, 460],
  ];
  const renderer = createCartographicRendering({
    ...options,
    lands: [{ poly }],
  });
  const r = recording();
  renderer.draw(r.c);
  assert.equal(r.transforms.length, 8);
  for (const [x, y] of r.transforms)
    assert.equal(pointInWrappedPolygon(x, y, poly, 1000), false);
});

test("lettering inherits opacity and restores canvas state for the next layer", () => {
  const renderer = createCartographicRendering(options);
  const r = recording();
  r.c.globalAlpha = 0.5;
  r.c.font = "12px serif";
  renderer.draw(r.c, { overview: true });
  assert.ok(r.draws.every((draw) => draw.alpha > 0 && draw.alpha < 0.5));
  assert.equal(r.c.globalAlpha, 0.5);
  assert.equal(r.c.font, "12px serif");
});
