import test from "node:test";
import assert from "node:assert/strict";
import { LIGHT_DIRECTION, sceneLighting } from "../src/core/lighting.js";
import { drawMerchantShip } from "../src/ship-rendering.js";

test("voyage lighting eases into dusk and back to daylight", () => {
  assert.deepEqual(sceneLighting(), { dusk: 0, storm: 0, strength: 1 });
  assert.equal(sceneLighting(-1, -1).dusk, 0);
  assert.equal(sceneLighting(0.7).dusk > 0, true);
  assert.equal(sceneLighting(0.85).dusk, 1);
  assert.equal(sceneLighting(0.94).dusk < 1, true);
  assert.equal(sceneLighting(1).dusk, 0);
  assert.equal(sceneLighting(3).dusk, 0);
});

test("storms soften the same northwest light used by terrain and ports", () => {
  assert.ok(LIGHT_DIRECTION.x < 0 && LIGHT_DIRECTION.y < 0);
  assert.equal(sceneLighting(0, 0.2).storm, 0);
  assert.equal(sceneLighting(0, 0.48).storm, 1);
  assert.equal(sceneLighting(0, 5).storm, 1);
  assert.ok(sceneLighting(0.85, 0.5).strength < sceneLighting().strength);
  assert.deepEqual(sceneLighting(NaN, NaN), sceneLighting());
});

function shipFaceFills(lighting) {
  const fills = [];
  const context = new Proxy(
    {
      fill() {
        fills.push(this.fillStyle);
      },
    },
    {
      get(target, property) {
        return target[property] ?? (() => {});
      },
    },
  );
  drawMerchantShip(
    context,
    { x: 30, y: 40, angle: 0.4, vesselClass: "brig", idNum: 3 },
    1,
    30,
    { lighting, reducedMotion: true },
  );
  return fills.filter((fill) => String(fill).startsWith("rgb("));
}

test("ship faces change with dusk and storm lighting", () => {
  const day = shipFaceFills(sceneLighting());
  const dusk = shipFaceFills(sceneLighting(0.85));
  const storm = shipFaceFills(sceneLighting(0, 0.5));
  assert.ok(day.length > 0);
  assert.notDeepEqual(dusk, day);
  assert.notDeepEqual(storm, day);
});
