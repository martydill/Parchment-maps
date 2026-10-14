import assert from "node:assert/strict";
import test from "node:test";
import { planShoreline, shorelineCliffFaces } from "../src/core/shoreline.js";
import { drawCliffDetails } from "../src/sculpted-terrain-rendering.js";
import {
  drawCoastalWater,
  drawCoastalFaces,
  drawCoastalLand,
  drawPigmentGranulation,
  drawShoreBreak,
} from "../src/shoreline-rendering.js";

function recordingContext() {
  const calls = [],
    states = [];
  const state = { globalAlpha: 0.4 };
  const context = new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === "save")
        return () => {
          states.push({ ...target });
          calls.push([key]);
        };
      if (key === "restore")
        return () => {
          const saved = states.pop();
          Object.keys(target).forEach((k) => delete target[k]);
          Object.assign(target, saved);
          calls.push([key]);
        };
      if (key === "createLinearGradient" || key === "createRadialGradient")
        return (...args) => {
          calls.push([key, ...args]);
          return {
            addColorStop: (...stops) => calls.push(["colorStop", ...stops]),
          };
        };
      return (...args) => calls.push([key, ...args]);
    },
    set(target, key, value) {
      target[key] = value;
      calls.push([key, typeof value === "object" ? "gradient" : value]);
      return true;
    },
  });
  return { context, calls, states };
}
const poly = [
  [10, 10],
  [180, 10],
  [180, 180],
  [10, 180],
];

test("baked pigment keeps water masked from land and cliff faces and restores canvas state", () => {
  for (const biome of ["tropical", "volcanic", "marsh", "alpine"]) {
    const { context, calls, states } = recordingContext();
    const shoreline = planShoreline(poly, 811, biome);
    drawCoastalWater(context, poly, shoreline, 12);
    assert.deepEqual(
      calls.filter(([key]) => key === "clip"),
      [
        ["clip", "evenodd"],
        ["clip", "evenodd"],
      ],
    );
    assert.ok(calls.some(([key]) => key === "fillRect"));
    drawCoastalFaces(context, shoreline, 12);
    drawCoastalLand(context, poly, shoreline);
    assert.ok(calls.some(([key]) => key === "fill"));
    assert.ok(calls.some(([key]) => key === "clip"));
    assert.ok(
      calls
        .flat()
        .filter((v) => typeof v === "number")
        .every(Number.isFinite),
    );
    assert.equal(context.globalAlpha, 0.4);
    assert.equal(states.length, 0);
    assert.equal(
      calls.filter(([key]) => key === "save").length,
      calls.filter(([key]) => key === "restore").length,
    );
  }
});

test("granulation is clipped to its silhouette and inherits opacity without leaking paint state", () => {
  const { context, calls, states } = recordingContext();
  context.fillStyle = "original";
  drawPigmentGranulation(context, poly, 11, "#20372a", "#d0d2a1", 40);
  assert.equal(calls.filter(([key]) => key === "clip").length, 1);
  assert.equal(calls.filter(([key]) => key === "fillRect").length, 40);
  const opacities = calls
    .filter(([key]) => key === "globalAlpha")
    .map(([, alpha]) => alpha);
  assert.ok(opacities.every((alpha) => alpha > 0 && alpha < 0.4));
  assert.equal(context.globalAlpha, 0.4);
  assert.equal(context.fillStyle, "original");
  assert.equal(states.length, 0);
});

test("beach foam stays thin, stone throws broken spray, and marshes draw no surf", () => {
  const segment = {
    ...planShoreline(poly, 1)[0],
    phase: Math.PI / 2,
    grain: 0.8,
  };
  const render = (kind) => {
    const recording = recordingContext();
    drawShoreBreak(recording.context, { ...segment, kind }, 12, 0, 1, 1.5);
    return recording;
  };
  const beach = render("sand"),
    rocks = render("rock"),
    basalt = render("basalt"),
    marsh = render("marsh");
  assert.ok(beach.calls.some(([key]) => key === "stroke"));
  assert.ok(!beach.calls.some(([key]) => key === "arc"));
  assert.ok(rocks.calls.some(([key]) => key === "arc"));
  assert.deepEqual(rocks.calls, basalt.calls);
  assert.deepEqual(marsh.calls, []);
  const thin = beach.calls.find(([key]) => key === "lineWidth")[1];
  const broken = rocks.calls.find(([key]) => key === "lineWidth")[1];
  assert.ok(thin < broken);
  const quiet = recordingContext();
  drawShoreBreak(
    quiet.context,
    { ...segment, kind: "rock", phase: -Math.PI / 2 },
    12,
    0,
    0,
    1,
  );
  assert.deepEqual(quiet.calls, []);
});

test("material coastlines and close-up relief use filled terrain without perimeter hatching", () => {
  for (const biome of ["tropical", "alpine", "volcanic", "marsh"]) {
    const shoreline = planShoreline(poly, 811, biome);
    const target = recordingContext();
    drawCoastalWater(target.context, poly, shoreline, 12);
    drawCoastalFaces(target.context, shoreline, 12);
    drawCoastalLand(target.context, poly, shoreline);
    const faces = shorelineCliffFaces(shoreline, 12);
    drawCliffDetails(target.context, faces, false);
    drawCliffDetails(target.context, faces, true);
    assert.equal(
      target.calls.filter(([method]) => method === "stroke").length,
      0,
    );
    assert.ok(target.calls.some(([method]) => method === "fill"));
    assert.ok(
      target.calls.some(([method]) => method === "createRadialGradient"),
    );
    assert.equal(target.context.globalAlpha, 0.4);
  }
});
