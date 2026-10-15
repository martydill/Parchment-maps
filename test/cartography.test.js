import assert from "node:assert/strict";
import test from "node:test";
import {
  labelZoomOpacity,
  layoutPathGlyphs,
  letteringPoint,
  regionalLettering,
} from "../src/core/cartography.js";

const path = { x: 100, y: 80, span: 200, bend: -30, angle: 0 };

test("label tiers reveal progressively with smooth bounded zoom bands", () => {
  for (const tier of ["sea", "region", "port", "detail"]) {
    assert.equal(labelZoomOpacity(0, tier), 0);
    assert.equal(labelZoomOpacity(2, tier), 1);
    let previous = 0;
    for (let zoom = 0; zoom < 2; zoom += 0.01) {
      const opacity = labelZoomOpacity(zoom, tier);
      assert.ok(opacity >= previous && opacity <= 1);
      assert.ok(opacity - previous < 0.075);
      previous = opacity;
    }
  }
  assert.equal(labelZoomOpacity(0.65, "region"), 0);
  assert.ok(labelZoomOpacity(0.65, "sea") > 0);
  assert.equal(labelZoomOpacity(1, "detail"), 0);
  assert.ok(labelZoomOpacity(1, "port") > 0);
  assert.equal(labelZoomOpacity((1.15 + 1.46) / 2, "detail"), 0.5);
});

test("curved lettering follows tangent angles and keeps a stable midpoint", () => {
  assert.deepEqual(letteringPoint(path, 0.5), { x: 100, y: 80, angle: 0 });
  const first = letteringPoint(path, 0);
  const last = letteringPoint(path, 1);
  assert.equal(first.x, 0);
  assert.equal(last.x, 200);
  assert.equal(first.y, 50);
  assert.equal(last.y, 50);
  assert.equal(first.angle, -last.angle);
  const rotated = letteringPoint({ ...path, angle: Math.PI / 2 }, 0);
  assert.ok(Math.abs(rotated.x - 130) < 1e-10);
  assert.ok(Math.abs(rotated.y + 20) < 1e-10);
});

test("glyph spacing respects measured widths, single letters, and overflowing text", () => {
  const flat = { ...path, bend: 0 };
  assert.deepEqual(layoutPathGlyphs([], path), []);
  assert.deepEqual(layoutPathGlyphs([2], { ...path, span: 0 }), []);
  assert.deepEqual(layoutPathGlyphs([201], flat), []);
  assert.deepEqual(layoutPathGlyphs([10], flat), [{ x: 100, y: 80, angle: 0 }]);
  const glyphs = layoutPathGlyphs([10, 30, 10], flat);
  assert.deepEqual(
    glyphs.map((glyph) => glyph.x),
    [5, 100, 195],
  );
  const curved = layoutPathGlyphs([10, 30, 10], path);
  assert.ok(curved[0].angle > 0 && curved[2].angle < 0);
  assert.ok(Math.abs(curved[1].x - path.x) < 1e-8);
  assert.ok(
    curved.every((glyph) => Object.values(glyph).every(Number.isFinite)),
  );
});

test("regional lettering tracks landform direction and limits extreme angles and sizes", () => {
  const poly = [
    [-200, -50],
    [200, -50],
    [200, 50],
    [-200, 50],
  ];
  assert.deepEqual(regionalLettering(poly, { x: 0, y: 0 }), {
    x: 0,
    y: 0,
    angle: 0,
    span: 400 * 0.58,
    bend: -8,
  });
  const diagonal = poly.map(([x, y]) => [
    x * Math.cos(0.3) - y * Math.sin(0.3),
    x * Math.sin(0.3) + y * Math.cos(0.3),
  ]);
  assert.ok(
    Math.abs(regionalLettering(diagonal, { x: 0, y: 0 }).angle - 0.3) < 1e-10,
  );
  assert.equal(
    regionalLettering(
      [
        [0, -500],
        [0, 500],
      ],
      { x: 0, y: 0 },
    ).angle,
    0.5,
  );
  assert.equal(
    regionalLettering(
      [
        [0, 0],
        [1, 0],
      ],
      { x: 0, y: 0 },
    ).span,
    100,
  );
  assert.equal(
    regionalLettering(
      [
        [-1000, 0],
        [1000, 0],
      ],
      { x: 0, y: 0 },
    ).span,
    620,
  );
});
