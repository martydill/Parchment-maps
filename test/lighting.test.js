import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceTimeOfDay,
  LIGHT_DIRECTION,
  litPigment,
  lightingHierarchy,
  nightSightLimit,
  normalizeTimeOfDay,
  sceneLighting,
  solarGeometry,
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

test("sun direction and shadow length move continuously through a shared solar path", () => {
  const dawn = sceneLighting(0.25);
  const noon = sceneLighting(0.5);
  const dusk = sceneLighting(0.75);
  assert.ok(dawn.sunDirection.x > 0 && dusk.sunDirection.x < 0);
  assert.ok(dawn.shadow.x < 0 && dusk.shadow.x > 0);
  assert.ok(dawn.shadow.length > noon.shadow.length);
  assert.ok(dusk.shadow.length > noon.shadow.length);
  assert.equal(sceneLighting(0).shadow.strength, 0);
  assert.ok(sceneLighting(0.5, 0.5).shadow.strength < noon.shadow.strength);
  assert.deepEqual(solarGeometry(), solarGeometry(NaN));
  assert.deepEqual(solarGeometry(0), solarGeometry(1));
  for (let step = 0; step <= 100; step++) {
    const time = step / 100;
    const { sunDirection: sun, shadow } = solarGeometry(time);
    assert.ok(Math.abs(Math.hypot(sun.x, sun.y, sun.z) - 1) < 1e-9);
    assert.ok(Math.abs(Math.hypot(shadow.x, shadow.y) - 1) < 1e-9);
    assert.ok(shadow.length > 0 && shadow.length <= 4.5);
    const next = solarGeometry(time + 1e-6);
    assert.ok(Math.abs(next.shadow.x - shadow.x) < 0.0001);
    assert.ok(Math.abs(next.shadow.length - shadow.length) < 0.0001);
  }
});

test("sunset warms exposed stone while sheltered faces take cool sky light", () => {
  const dusk = sceneLighting(0.73);
  const lit = pigmentChannels(litPigment("#aaaaaa", [-1, 0, 0], dusk));
  const shaded = pigmentChannels(litPigment("#aaaaaa", [1, 0, 0], dusk));
  assert.ok(lit[0] > lit[2]);
  assert.ok(shaded[2] > shaded[0]);
  assert.ok(lit[0] > shaded[0]);
  const legacy = { strength: 1, dusk: 0, storm: 0, night: 0 };
  assert.match(litPigment("#aaaaaa", [0, 0, 1], legacy), /^rgb\(/);
});

test("lighting hierarchy preserves a sharp approach and fades the middle distance", () => {
  const day = lightingHierarchy();
  const zoomedOut = lightingHierarchy(0.1);
  const zoomedIn = lightingHierarchy(2);
  assert.equal(day.amber, 0);
  assert.equal(zoomedOut.sharpRadius, 110);
  assert.equal(zoomedOut.washRadius, 300);
  assert.ok(zoomedIn.sharpRadius > day.sharpRadius);
  assert.ok(zoomedIn.washRadius > day.washRadius);
  for (const invalid of [0, -1, NaN, Infinity])
    assert.deepEqual(lightingHierarchy(invalid), day);
  const night = lightingHierarchy(1, sceneLighting(0));
  const storm = lightingHierarchy(1, sceneLighting(0, 0.5));
  assert.equal(night.amber, 1);
  assert.ok(storm.amber > 0 && storm.amber < night.amber);
  assert.equal(storm.sharpRadius, night.sharpRadius);
  assert.ok(storm.washRadius < night.washRadius);
  assert.ok(storm.washOpacity > day.washOpacity);
  assert.ok(storm.pigmentOpacity > day.pigmentOpacity);
  // The falloff stays ordered even at extreme close-up zoom in a storm.
  const close = lightingHierarchy(100, sceneLighting(0, 0.5));
  assert.ok(close.washRadius >= close.sharpRadius + 100);
});

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

test("vessel shadows switch sides with the sun, lengthen near sunset, and soften in storms", () => {
  const shadowAt = (lighting) => {
    const shadows = [];
    const context = new Proxy(
      {
        globalAlpha: 1,
        ellipse(...geometry) {
          if (this.fillStyle === "rgba(18,39,35,0.22)")
            shadows.push({ geometry, alpha: this.globalAlpha });
        },
      },
      { get: (target, key) => target[key] ?? (() => {}) },
    );
    drawMerchantShip(
      context,
      { x: 30, y: 40, angle: 0.4, vesselClass: "brig", idNum: 3 },
      1,
      0,
      { lighting, reducedMotion: true },
    );
    assert.equal(shadows.length, 1);
    return shadows[0];
  };
  const morning = shadowAt(sceneLighting(0.25));
  const noon = shadowAt(sceneLighting(0.5));
  const sunset = shadowAt(sceneLighting(0.73));
  assert.ok(morning.geometry[0] < 0 && sunset.geometry[0] > 0);
  assert.ok(morning.geometry[3] > noon.geometry[3]);
  assert.ok(sunset.geometry[3] > noon.geometry[3]);
  assert.ok(shadowAt(sceneLighting(0.5, 0.5)).alpha < noon.alpha);
  assert.ok(shadowAt(sceneLighting(0)).alpha < noon.alpha);
});
