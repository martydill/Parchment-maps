import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceTimeOfDay,
  LIGHT_DIRECTION,
  litPigment,
  nightSightLimit,
  normalizeTimeOfDay,
  sceneLighting,
  timeOfDayLabel,
} from "../src/core/lighting.js";
import { drawMerchantShip } from "../src/ship-rendering.js";

test("time of day wraps and moves through dawn, noon, dusk, and night", () => {
  assert.equal(normalizeTimeOfDay(undefined), 0.5);
  assert.ok(Math.abs(normalizeTimeOfDay(-0.1) - 0.9) < 1e-9);
  assert.equal(advanceTimeOfDay(0.75, 18), 0);
  assert.equal(advanceTimeOfDay(0.5, -12), 0.5);
  assert.equal(advanceTimeOfDay(NaN, NaN), 0.5);
  assert.equal(timeOfDayLabel(sceneLighting(0)), "Night");
  assert.equal(timeOfDayLabel(sceneLighting(0.25)), "Sunrise");
  assert.equal(timeOfDayLabel(sceneLighting(0.5)), "Daylight");
  assert.equal(timeOfDayLabel(sceneLighting(0.75)), "Sunset");
  assert.equal(sceneLighting(1).night, sceneLighting(0).night);
  assert.equal(sceneLighting(NaN).night, 0);
});

test("moon and storms change night brightness and sight distance", () => {
  assert.ok(LIGHT_DIRECTION.x < 0 && LIGHT_DIRECTION.y < 0);
  const day = sceneLighting(0.5);
  const fullMoon = sceneLighting(0, 0, 1);
  const darkMoon = sceneLighting(0, 0, 5);
  assert.equal(sceneLighting(0.5, 0.2).storm, 0);
  assert.equal(sceneLighting(0.5, 0.48).storm, 1);
  assert.ok(sceneLighting(0, 0.5).strength < fullMoon.strength);
  assert.ok(fullMoon.moon > darkMoon.moon);
  assert.ok(day.strength > fullMoon.strength);
  assert.equal(nightSightLimit(day, 12), 12);
  assert.ok(nightSightLimit(fullMoon, 12) > nightSightLimit(darkMoon, 12));
  assert.ok(nightSightLimit(fullMoon, 12) < 4);
  assert.equal(nightSightLimit(fullMoon, 1), 1);
  assert.equal(nightSightLimit(fullMoon, NaN), 0);
});

const pigmentChannels = (color) => color.match(/\d+/g).map(Number);

test("relief lighting separates lit faces, shaded faces, and weather", () => {
  const normal = [LIGHT_DIRECTION.x, LIGHT_DIRECTION.y, LIGHT_DIRECTION.z];
  const opposite = normal.map((value) => -value);
  const day = pigmentChannels(litPigment("#aabbcc", normal));
  const shade = pigmentChannels(litPigment("#aabbcc", opposite));
  const night = pigmentChannels(
    litPigment("#aabbcc", normal, sceneLighting(0)),
  );
  assert.ok(day.every((value, i) => value > shade[i] && value > night[i]));
  assert.equal(
    litPigment("#aabbcc", normal),
    litPigment(
      "#aabbcc",
      normal.map((value) => value * 12),
    ),
  );
  assert.notEqual(
    litPigment("#aabbcc", normal),
    litPigment("#aabbcc", normal, sceneLighting(0.5, 0.5)),
  );
  const sunset = pigmentChannels(
    litPigment("#aaaaaa", normal, sceneLighting(0.75)),
  );
  assert.ok(sunset[0] > sunset[2]);
});

test("relief lighting preserves transparent ink and bounds bright or degenerate faces", () => {
  for (const color of ["rgba(40,30,20,.2)", "#abc", "gold"])
    assert.equal(litPigment(color, [0, 0, 1]), color);
  const ambient = litPigment("#aabbcc", [0, 0, 0]);
  assert.equal(litPigment("#aabbcc", [NaN, 0, 1]), ambient);
  assert.equal(litPigment("#aabbcc", [Infinity, 0, 1]), ambient);
  const white = pigmentChannels(litPigment("#ffffff", [-0.55, -0.45, 0.7]));
  assert.ok(white.every((value) => value >= 0 && value <= 255));
  assert.equal(white[0], 255);
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

test("ship faces change with sunset, night, and storm lighting", () => {
  const day = shipFaceFills(sceneLighting());
  const sunrise = shipFaceFills(sceneLighting(0.25));
  const dusk = shipFaceFills(sceneLighting(0.75));
  const night = shipFaceFills(sceneLighting(0));
  const storm = shipFaceFills(sceneLighting(0.5, 0.5));
  assert.ok(day.length > 0);
  assert.notDeepEqual(sunrise, day);
  assert.notDeepEqual(dusk, day);
  assert.notDeepEqual(night, day);
  assert.notDeepEqual(storm, day);
});
