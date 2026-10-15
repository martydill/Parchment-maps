import assert from "node:assert/strict";
import test from "node:test";
import { planRiverDetails } from "../src/core/rivers.js";
import {
  drawRiverChannels,
  drawRiverMouths,
  drawRiverSediment,
  drawRiverSettlements,
} from "../src/river-rendering.js";

function recorder() {
  const calls = [];
  const c = new Proxy(
    {},
    {
      get:
        (_target, name) =>
        (...args) => {
          calls.push([name, ...args]);
          if (name === "createRadialGradient")
            return {
              addColorStop: (...values) => calls.push(["stop", ...values]),
            };
        },
      set: (target, name, value) => {
        calls.push([name, value]);
        target[name] = value;
        return true;
      },
    },
  );
  return { c, calls };
}

const land = [
  [0, 0],
  [500, 0],
  [500, 500],
  [0, 500],
];
const river = [
  { x: 250, y: 250 },
  { x: 270, y: 180 },
  { x: 230, y: 80 },
  { x: 250, y: 0 },
];

test("river artwork handles empty and degenerate channels without invalid canvas coordinates", () => {
  const details = planRiverDetails(land, [[river[0], river[0]]], [river]);
  const original = structuredClone(details);
  for (const snow of [0, 1]) {
    const { c, calls } = recorder();
    drawRiverChannels(c, details, { snow });
    drawRiverSettlements(c, details, { snow });
    drawRiverMouths(c, details, 12);
    drawRiverSediment(c, details, 12);
    for (const args of calls)
      assert.ok(
        args
          .filter((value) => typeof value === "number")
          .every(Number.isFinite),
      );
    assert.equal(
      calls.filter(([name]) => name === "save").length,
      calls.filter(([name]) => name === "restore").length,
    );
  }
  assert.deepEqual(details, original);
  const { c, calls } = recorder();
  const empty = planRiverDetails([], [], []);
  for (const draw of [
    drawRiverChannels,
    drawRiverSettlements,
    drawRiverMouths,
    drawRiverSediment,
  ])
    draw(c, empty);
  assert.equal(calls.filter(([name]) => name === "fill").length, 0);
});

test("tidal plumes have transparent ochre edges and project from the correct side of raised land", () => {
  for (const direction of [-1, 1]) {
    const mouth = {
      x: 100,
      y: 200,
      direction: { x: 0, y: direction },
      width: 10,
      plumeLength: 60,
    };
    const details = { mouths: [mouth] };
    const { c, calls } = recorder();
    drawRiverSediment(c, details, 20);
    const centers = calls.filter(([name]) => name === "translate");
    assert.ok(centers.length > 1, "overlapping washes soften the sediment fan");
    assert.ok(centers.every(([, , y]) => (direction > 0 ? y > 220 : y < 200)));
    const stops = calls.filter(([name]) => name === "stop");
    assert.ok(
      stops.some(
        ([, position, color]) => position === 1 && color.endsWith(",0)"),
      ),
    );
    assert.ok(
      stops.some(
        ([, position, color]) =>
          position === 0 && color.startsWith("rgba(188,151,81,"),
      ),
    );
    drawRiverMouths(c, details, 20);
    assert.ok(calls.some(([name]) => name === "quadraticCurveTo"));
  }
});

test("bridges and inhabited river mouths keep their geometry through winter pigment changes", () => {
  const details = planRiverDetails(land, [river], []);
  assert.ok(details.bridges.length > 0 && details.settlements.length > 0);
  const original = structuredClone(details);
  const summer = recorder(),
    winter = recorder();
  drawRiverChannels(summer.c, details);
  drawRiverSettlements(summer.c, details);
  drawRiverChannels(winter.c, details, { snow: 1 });
  drawRiverSettlements(winter.c, details, { snow: 1 });
  assert.ok(winter.calls.some(([, value]) => value === "#e8eee3"));
  assert.ok(winter.calls.some(([, value]) => value === "#e1f0f2"));
  const geometry = (calls) =>
    calls.filter(([name]) =>
      ["moveTo", "lineTo", "fillRect", "translate", "rotate"].includes(name),
    );
  assert.deepEqual(geometry(summer.calls), geometry(winter.calls));
  assert.deepEqual(details, original);
});
