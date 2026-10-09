import test from "node:test";
import assert from "node:assert/strict";
import {
  drawHullReflection,
  drawMerchantShip,
  drawShip,
} from "../src/ship-rendering.js";
import {
  getShipModelProfile,
  SHIP_MODEL_IDS,
} from "../src/core/ship-models.js";
import { MAP_TILT_TAN } from "../src/core/projection.js";
import { sampleWaterReflection } from "../src/core/seascape.js";
import { sceneLighting } from "../src/core/lighting.js";

function canvasContext() {
  const calls = [];
  const context = new Proxy(
    { calls },
    {
      get(target, property) {
        if (property in target) return target[property];
        return (...args) => calls.push([property, ...args]);
      },
      set(target, property, value) {
        calls.push([property, value]);
        target[property] = value;
        return true;
      },
    },
  );
  return context;
}

test("each merchant vessel class draws a detailed projected model", () => {
  for (const [index, vesselClass] of SHIP_MODEL_IDS.entries()) {
    const context = canvasContext();
    drawMerchantShip(context, {
      x: 120,
      y: 80,
      angle: index * 0.31,
      vesselClass,
      idNum: index + 1,
      color: "#a83f2f",
    });
    assert.ok(
      context.calls.some(([method]) => method === "fill"),
      vesselClass,
    );
    assert.ok(
      context.calls.some(([method]) => method === "stroke"),
      vesselClass,
    );
    assert.ok(
      context.calls.some(([method]) => method === "lineTo"),
      vesselClass,
    );
  }
});

test("ship foam uses bounded colors as speed changes and disappears at anchor", () => {
  const palettes = new Map([
    ["35,88,86", new Set()],
    ["255,247,213", new Set()],
    ["255,248,213", new Set()],
    ["255,249,218", new Set()],
  ]);
  for (let sample = 0; sample <= 150; sample++) {
    const context = canvasContext();
    drawMerchantShip(context, {
      x: 120,
      y: 80,
      speed: sample,
      vesselClass: "brig",
      idNum: 1,
    });
    const foam = context.calls.filter(
      ([property, style]) =>
        (property === "fillStyle" || property === "strokeStyle") &&
        [...palettes.keys()].some((rgb) => style.startsWith(`rgba(${rgb},`)),
    );
    if (sample < 3) assert.equal(foam.length, 0);
    else assert.equal(foam.length, 30);
    for (const [, style] of foam) {
      for (const [rgb, colors] of palettes) {
        if (style.startsWith(`rgba(${rgb},`)) colors.add(style);
      }
    }
  }
  for (const colors of palettes.values()) {
    assert.ok(colors.size > 20 && colors.size <= 128);
  }
});

test("the player vessel uses the same detailed renderer and wind-driven sails", () => {
  const context = canvasContext();
  drawShip(context, 50, 60, 0.4, 1.2, 0.8, "brig", 1);
  assert.ok(context.calls.some(([method]) => method === "fill"));
  assert.ok(context.calls.some(([method]) => method === "stroke"));
});

test("night accents follow each rig's sail edges and disappear in daylight", () => {
  for (const vesselClass of SHIP_MODEL_IDS) {
    const draw = (lighting) => {
      const context = canvasContext();
      drawShip(context, 50, 60, 0.4, 1.2, 0.8, vesselClass, 1, {
        lighting,
        reducedMotion: true,
        damage: { tear: 0.6, heel: 0.12, settle: 1 },
      });
      return context.calls;
    };
    const accentCount = (calls) =>
      calls.filter(
        ([property, style]) =>
          property === "strokeStyle" && style.startsWith("rgba(255,218,144,"),
      ).length;
    const night = draw(sceneLighting(0));
    assert.ok(accentCount(night) > 0, vesselClass);
    assert.equal(accentCount(draw(sceneLighting(0.5))), 0, vesselClass);
    assert.ok(
      night
        .flat()
        .filter((value) => typeof value === "number")
        .every(Number.isFinite),
    );
  }
});

test("swell moves projected geometry without moving the vessel's map origin", () => {
  const first = canvasContext();
  const second = canvasContext();
  const options = { roughness: 1, speed: 100 };
  drawShip(first, 50, 60, 0.4, 1.2, 0.22, "brig", 1, { ...options, time: 1 });
  drawShip(second, 50, 60, 0.4, 1.2, 0.22, "brig", 1, { ...options, time: 2 });
  assert.notDeepEqual(
    first.calls.filter(([method]) => method === "lineTo"),
    second.calls.filter(([method]) => method === "lineTo"),
  );
  assert.deepEqual(
    first.calls.filter(([method]) => method === "translate"),
    second.calls.filter(([method]) => method === "translate"),
  );
  for (const context of [first, second]) {
    assert.equal(
      context.calls.filter(([method]) => method === "save").length,
      context.calls.filter(([method]) => method === "restore").length,
    );
    assert.ok(
      context.calls
        .flat()
        .filter((value) => typeof value === "number")
        .every(Number.isFinite),
    );
  }
});

test("reduced motion keeps projected ships identical across frames", () => {
  const first = canvasContext();
  const second = canvasContext();
  const merchant = {
    x: 10,
    y: 20,
    idNum: 4,
    speed: 40,
    vesselClass: "carrack",
  };
  drawMerchantShip(first, merchant, 1, 1010, {
    time: 1,
    roughness: 1,
    reducedMotion: true,
  });
  drawMerchantShip(second, merchant, 1, 1010, {
    time: 99,
    roughness: 1,
    reducedMotion: true,
  });
  assert.deepEqual(first.calls, second.calls);
});

test("hull reflections mirror model height across the water for every heading", () => {
  for (const vesselClass of SHIP_MODEL_IDS) {
    const profile = getShipModelProfile(vesselClass);
    for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const context = canvasContext();
      drawHullReflection(context, profile, heading, { reducedMotion: true });
      const x = profile.beam * 0.05;
      const y = -profile.length / 2;
      const height = profile.deckHeight + profile.bowRise;
      const expectedX = x * Math.cos(heading) - y * Math.sin(heading);
      const expectedY =
        x * Math.sin(heading) + y * Math.cos(heading) + height * MAP_TILT_TAN;
      assert.ok(
        context.calls.some(
          ([method, px, py]) =>
            (method === "moveTo" || method === "lineTo") &&
            Math.abs(px - expectedX) < 1e-10 &&
            Math.abs(py - expectedY) < 1e-10,
        ),
        `${vesselClass} at ${heading}`,
      );
      assert.ok(
        context.calls
          .flat()
          .filter((value) => typeof value === "number")
          .every(Number.isFinite),
      );
    }
  }
});

test("eight separate reflection slices shift the ink after clipping and fade out", () => {
  const context = canvasContext();
  drawHullReflection(context, getShipModelProfile("brig"), Math.PI / 2, {
    time: 2,
    roughness: 0.5,
    anchored: true,
  });
  const slices = context.calls.filter(([method]) => method === "rect");
  const offsets = context.calls.filter(([method]) => method === "translate");
  assert.equal(slices.length, 8);
  assert.equal(offsets.length, 8);
  assert.equal(context.calls.filter(([method]) => method === "fill").length, 8);
  for (let row = 0; row < 8; row++) {
    assert.deepEqual(offsets[row], [
      "translate",
      sampleWaterReflection(2, row, 0.5).offset,
      0,
    ]);
    assert.ok(slices[row][3] > 0 && slices[row][4] > 0);
    if (row > 0)
      assert.ok(slices[row - 1][2] + slices[row - 1][4] < slices[row][2]);
  }
  const firstClip = context.calls.findIndex(([method]) => method === "clip");
  assert.equal(context.calls[firstClip + 1][0], "translate");
  const opacities = context.calls
    .filter(([property]) => property === "fillStyle")
    .map(([, style]) => Number(style.slice(style.lastIndexOf(",") + 1, -1)));
  assert.ok(opacities.every((alpha) => alpha > 0 && alpha <= 0.34));
  assert.ok(opacities.at(-1) < opacities[0]);
  assert.equal(
    context.calls.filter(([method]) => method === "save").length,
    context.calls.filter(([method]) => method === "restore").length,
  );
});

test("reflected hull motion freezes with reduced motion and responds to rough seas", () => {
  const render = (environment) => {
    const context = canvasContext();
    drawHullReflection(
      context,
      getShipModelProfile("carrack"),
      0.4,
      environment,
    );
    return context.calls;
  };
  assert.notDeepEqual(render({ time: 1 }), render({ time: 2 }));
  assert.notDeepEqual(render({ roughness: 0 }), render({ roughness: 1 }));
  assert.deepEqual(
    render({ time: 1, roughness: 1, reducedMotion: true }),
    render({ time: 99, roughness: 1, reducedMotion: true }),
  );
});

function stampDocument() {
  const previous = globalThis.document;
  return {
    set() {
      globalThis.document = {
        createElement: () => {
          const calls = [];
          const context = new Proxy(
            {
              calls,
              createRadialGradient: (...args) => {
                calls.push(["createRadialGradient", ...args]);
                return {
                  addColorStop: (...stop) =>
                    calls.push(["addColorStop", ...stop]),
                };
              },
            },
            {
              get(target, property) {
                if (property in target) return target[property];
                return (...args) => calls.push([property, ...args]);
              },
              set(target, property, value) {
                calls.push([property, value]);
                target[property] = value;
                return true;
              },
            },
          );
          return {
            width: 0,
            height: 0,
            getContext: () => context,
            calls,
          };
        },
      };
    },
    restore() {
      globalThis.document = previous;
    },
  };
}

function callCount(context, method) {
  return context.calls.filter(([name]) => name === method).length;
}

test("damaged vessels list in place while torn sails and splinters appear", () => {
  const merchant = {
    x: 10,
    y: 20,
    idNum: 3,
    vesselClass: "brig",
    speed: 30,
  };
  const healthy = canvasContext();
  drawMerchantShip(healthy, merchant, 1, 1010, {
    time: 2,
    reducedMotion: true,
  });
  const damage = {
    hull: 0.8,
    rigging: 0.8,
    tear: 0.9,
    splinters: 0.8,
    smoke: 0,
    patch: 0,
    patchedDay: 0,
    heel: 0.12,
    settle: 1.2,
  };
  const wounded = canvasContext();
  drawMerchantShip(wounded, { ...merchant, damage }, 1, 1010, {
    time: 2,
    reducedMotion: true,
  });
  // The hull stays at its map position, but the pose leans and the deck
  // geometry, sail lattice, and floating debris all differ.
  assert.deepEqual(
    healthy.calls.filter(([method]) => method === "translate"),
    wounded.calls.filter(([method]) => method === "translate"),
  );
  assert.notDeepEqual(
    healthy.calls.filter(([method]) => method === "lineTo"),
    wounded.calls.filter(([method]) => method === "lineTo"),
  );
  const healthyFills = callCount(healthy, "fill");
  assert.ok(callCount(wounded, "fill") > healthyFills);
  assert.ok(callCount(wounded, "ellipse") > callCount(healthy, "ellipse"));
  for (const context of [healthy, wounded]) {
    assert.equal(callCount(context, "save"), callCount(context, "restore"));
    assert.ok(
      context.calls
        .flat()
        .filter((value) => typeof value === "number")
        .every(Number.isFinite),
    );
  }
});

test("torn sails carve real gaps instead of painting over the hole", () => {
  const merchant = { x: 5, y: 5, idNum: 2, vesselClass: "carrack" };
  const healthy = canvasContext();
  drawMerchantShip(healthy, merchant, 1, 1005, { reducedMotion: true });
  const shredded = canvasContext();
  drawMerchantShip(
    shredded,
    {
      ...merchant,
      damage: {
        hull: 0.1,
        rigging: 0.95,
        tear: 1,
        splinters: 0,
        smoke: 0,
        patch: 0,
        patchedDay: 0,
        heel: 0,
        settle: 0,
      },
    },
    1,
    1005,
    { reducedMotion: true },
  );
  // Fan-triangle outlines keep the surviving panels reading as canvas.
  const canvasStrokes = shredded.calls.filter(
    ([property, style]) =>
      property === "strokeStyle" && String(style).startsWith("rgba(70,49,29"),
  );
  assert.ok(canvasStrokes.length > 0);
  // The lit sail pigment still dominates; the lattice just lost cells.
  assert.ok(
    shredded.calls.filter(
      ([property, style]) =>
        property === "fillStyle" && String(style).startsWith("rgb(2"),
    ).length > 20,
  );
  assert.notDeepEqual(
    healthy.calls.filter(([property]) => property === "fillStyle"),
    shredded.calls.filter(([property]) => property === "fillStyle"),
  );
});

test("critical hulls trail thin smoke that reduced motion suppresses", () => {
  const stamp = stampDocument();
  stamp.set();
  try {
    const merchant = {
      x: 10,
      y: 20,
      idNum: 1,
      vesselClass: "cutter",
      damageKey: {},
      damage: {
        hull: 0.95,
        rigging: 0,
        tear: 0,
        splinters: 0.9,
        smoke: 1,
        patch: 0,
        patchedDay: 0,
        heel: 0.1,
        settle: 1.5,
      },
    };
    const first = canvasContext();
    drawMerchantShip(first, merchant, 1, 1010, {
      time: 1,
      worldWidth: 2400,
    });
    const firstPuffs = callCount(first, "drawImage");
    assert.ok(firstPuffs > 0, "a burning hull smokes immediately");
    const later = canvasContext();
    drawMerchantShip(later, merchant, 1, 1010, {
      time: 3,
      worldWidth: 2400,
    });
    const laterPuffs = callCount(later, "drawImage");
    assert.ok(laterPuffs > firstPuffs, "the trail builds as it sails on");
    const still = canvasContext();
    drawMerchantShip(still, merchant, 1, 1010, {
      time: 9,
      reducedMotion: true,
    });
    assert.equal(callCount(still, "drawImage"), 0);
    assert.equal(callCount(still, "translate"), callCount(first, "translate"));
  } finally {
    stamp.restore();
  }
});

test("fresh canvas patches pop on after a repair and weather out", () => {
  const merchant = { x: 8, y: 9, idNum: 5, vesselClass: "cutter" };
  const bare = canvasContext();
  drawMerchantShip(bare, merchant, 1, 1008, { reducedMotion: true });
  assert.equal(
    bare.calls.filter(
      ([property, style]) =>
        property === "fillStyle" && style.startsWith("rgba(234,"),
    ).length,
    0,
  );
  const patched = canvasContext();
  drawMerchantShip(
    patched,
    {
      ...merchant,
      damageKey: {},
      damage: {
        hull: 0,
        rigging: 0,
        tear: 0,
        splinters: 0,
        smoke: 0,
        patch: 1,
        patchedDay: 12,
        heel: 0,
        settle: 0,
      },
    },
    1,
    1008,
    { reducedMotion: true },
  );
  const freshPatches = patched.calls.filter(
    ([property, style]) =>
      property === "fillStyle" && style.startsWith("rgba(234,"),
  );
  assert.ok(freshPatches.length === 3, "three planking patches");
  const weathered = canvasContext();
  drawMerchantShip(
    weathered,
    {
      ...merchant,
      damageKey: {},
      damage: {
        hull: 0,
        rigging: 0,
        tear: 0,
        splinters: 0,
        smoke: 0,
        patch: 0.2,
        patchedDay: 19,
        heel: 0,
        settle: 0,
      },
    },
    1,
    1008,
    { reducedMotion: true },
  );
  const oldPatches = weathered.calls.filter(
    ([property, style]) =>
      property === "fillStyle" && style.startsWith("rgba(204,"),
  );
  assert.ok(oldPatches.length === 3, "aged patches lose their fresh tone");
});

test("hull reflections lean with a damaged hull", () => {
  const level = canvasContext();
  drawHullReflection(level, getShipModelProfile("brig"), 0.5, {
    reducedMotion: true,
  });
  const heeled = canvasContext();
  drawHullReflection(heeled, getShipModelProfile("brig"), 0.5, {
    reducedMotion: true,
    heel: 0.12,
    settle: 1.4,
  });
  assert.notDeepEqual(
    level.calls.filter(([method]) => method === "lineTo"),
    heeled.calls.filter(([method]) => method === "lineTo"),
  );
  assert.equal(
    callCount(level, "rect"),
    callCount(heeled, "rect"),
    "the ink stays sliced into the same eight bands",
  );
  assert.equal(callCount(level, "save"), callCount(level, "restore"));
  assert.equal(callCount(heeled, "save"), callCount(heeled, "restore"));
});

test("scrambling deck crew man the player vessel as the storm arc builds", () => {
  const idle = canvasContext();
  drawShip(idle, 50, 60, 0.4, 1.2, 0.8, "brig", 1, { time: 5, crew: 0 });
  assert.ok(
    !idle.calls.some(
      ([method, arg]) => method === "strokeStyle" && arg === "#2a1a0e",
    ),
  );
  const scrambling = canvasContext();
  drawShip(scrambling, 50, 60, 0.4, 1.2, 0.8, "brig", 1, {
    time: 5,
    crew: 1,
  });
  const crewStrokes = scrambling.calls.filter(
    ([method, arg]) => method === "strokeStyle" && arg === "#2a1a0e",
  );
  assert.ok(crewStrokes.length >= 5, `crew strokes: ${crewStrokes.length}`);
  assert.ok(
    scrambling.calls.some(
      ([method, arg]) =>
        method === "fillStyle" && String(arg).startsWith("rgba(42,26,14,"),
    ),
  );
  // Crew freeze with reduced motion just like the hull they stand on.
  const frozen = canvasContext();
  drawShip(frozen, 50, 60, 0.4, 1.2, 0.8, "brig", 1, {
    time: 5,
    crew: 1,
    reducedMotion: true,
  });
  const again = canvasContext();
  drawShip(again, 50, 60, 0.4, 1.2, 0.8, "brig", 1, {
    time: 95,
    crew: 1,
    reducedMotion: true,
  });
  assert.deepEqual(frozen.calls, again.calls);
});
