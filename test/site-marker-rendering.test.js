import assert from "node:assert/strict";
import test from "node:test";
import { MAP_TILT_COS } from "../src/core/projection.js";
import { createSiteMarkerRendering } from "../src/site-marker-rendering.js";

function setup(t) {
  const originalDocument = globalThis.document;
  const canvases = [],
    blits = [];
  globalThis.document = {
    createElement() {
      const calls = [],
        properties = [];
      const context = new Proxy(
        {},
        {
          get(target, key) {
            if (key in target) return target[key];
            return (...args) => calls.push([key, ...args]);
          },
          set(target, key, value) {
            properties.push([key, value]);
            target[key] = value;
            return true;
          },
        },
      );
      const canvas = {
        width: 0,
        height: 0,
        calls,
        properties,
        getContext: () => context,
      };
      canvases.push(canvas);
      return canvas;
    },
  };
  t.after(() => {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  });
  const states = [];
  return {
    renderer: createSiteMarkerRendering(),
    canvases,
    blits,
    target: {
      globalAlpha: 0.4,
      save() {
        states.push(this.globalAlpha);
      },
      restore() {
        this.globalAlpha = states.pop();
      },
      drawImage(...args) {
        assert.equal(this.globalAlpha, 1);
        blits.push(args);
      },
    },
  };
}

test("static survey glyphs and shadows are painted once at the actual display transform", (t) => {
  const env = setup(t);
  const site = { id: "survey", name: "Old stone cairn" };
  env.renderer.draw(env.target, site, { pixelRatio: 1.5 });
  const canvas = env.canvases[0];
  assert.equal(canvas.width, 240);
  assert.equal(canvas.height, Math.ceil(240 * MAP_TILT_COS));
  assert.deepEqual(canvas.calls[0], [
    "setTransform",
    1.5,
    0,
    0,
    1.5 * MAP_TILT_COS,
    canvas.width / 2,
    canvas.height / 2,
  ]);
  assert.ok(
    canvas.properties.some(
      ([key, value]) => key === "shadowBlur" && value === 3,
    ),
  );
  assert.ok(
    canvas.properties.some(
      ([key, value]) => key === "globalAlpha" && value === 0.4,
    ),
  );
  const count = canvas.calls.length;
  for (let i = 0; i < 120; i++)
    env.renderer.draw(env.target, site, { pixelRatio: 1.5 });
  assert.equal(canvas.calls.length, count);
  assert.equal(env.canvases.length, 1);
  assert.ok(env.blits.every(([image]) => image === canvas));
  assert.deepEqual(env.blits[0], [
    canvas,
    -canvas.width / 3,
    -canvas.height / (3 * MAP_TILT_COS),
    canvas.width / 1.5,
    canvas.height / (1.5 * MAP_TILT_COS),
  ]);
  assert.equal(env.target.globalAlpha, 0.4);
});

test("survey completion, selection, size, density, and changed artwork refresh the same plate", (t) => {
  const env = setup(t),
    site = { id: "survey", name: "Sea cliffs" };
  env.renderer.draw(env.target, site);
  const canvas = env.canvases[0];
  for (const options of [
    { surveyed: true },
    { active: true, size: 54 },
    { size: 43 },
    { pixelRatio: 2 },
  ]) {
    const count = canvas.calls.length;
    env.renderer.draw(env.target, site, options);
    assert.ok(canvas.calls.length > count);
  }
  assert.ok(
    canvas.properties.some(
      ([key, value]) => key === "fillStyle" && value === "#78bd92",
    ),
  );
  assert.ok(
    canvas.properties.some(
      ([key, value]) => key === "shadowBlur" && value === 13,
    ),
  );
  env.renderer.draw(env.target, site);
  const count = canvas.calls.length;
  site.name = "Ancient observatory";
  env.renderer.draw(env.target, site);
  assert.ok(canvas.calls.length > count);
  const next = canvas.calls.length;
  env.renderer.draw(env.target, { ...site });
  assert.ok(canvas.calls.length > next);
  const beforeAlpha = canvas.calls.length;
  env.target.globalAlpha = 0.75;
  env.renderer.draw(env.target, site);
  assert.ok(canvas.calls.length > beforeAlpha);
  assert.equal(env.target.globalAlpha, 0.75);
  assert.equal(env.canvases.length, 1);
});

test("discovery secrecy refreshes art and marker kinds keep separate cached plates", (t) => {
  const env = setup(t),
    site = {
      id: "shared",
      name: "Hidden anchorage",
      type: "Uncharted anchorage",
    };
  env.renderer.draw(env.target, site);
  env.renderer.draw(env.target, site, {
    kind: "discovery",
    size: 43,
    secret: true,
  });
  assert.equal(env.canvases.length, 2);
  const discovery = env.canvases[1];
  assert.ok(
    discovery.properties.some(
      ([key, value]) => key === "fillStyle" && value === "#765845",
    ),
  );
  const count = discovery.calls.length;
  env.renderer.draw(env.target, site, {
    kind: "discovery",
    size: 43,
    secret: true,
  });
  assert.equal(discovery.calls.length, count);
  env.renderer.draw(env.target, site, {
    kind: "discovery",
    size: 43,
    secret: false,
  });
  assert.ok(
    discovery.properties.some(
      ([key, value]) => key === "fillStyle" && value === "#bb7449",
    ),
  );
  site.type = "Ruins";
  const before = discovery.calls.length;
  env.renderer.draw(env.target, site, {
    kind: "discovery",
    size: 43,
    secret: false,
  });
  assert.ok(discovery.calls.length > before);
});
