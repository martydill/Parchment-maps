import assert from "node:assert/strict";
import test from "node:test";
import {
  celestialPosition,
  seaLightSources,
  glitterCorridor,
  shallowLightStrength,
  causticPoint,
} from "../src/core/sea-optics.js";
import { sceneLighting } from "../src/core/lighting.js";

test("reflections share celestial positions and switch from warm sun to cool moon", () => {
  assert.deepEqual(celestialPosition("sun"), { x: 0.38, y: 0.28 });
  assert.deepEqual(celestialPosition("sun", { sunrise: 1 }), {
    x: 0.64,
    y: 0.28,
  });
  assert.deepEqual(celestialPosition("sun", { sunset: 1 }), {
    x: 0.38,
    y: 0.28,
  });
  assert.equal(celestialPosition("sun", { sunrise: 0.5, sunset: 0.5 }).x, 0.51);
  assert.deepEqual(celestialPosition("moon"), { x: 0.76, y: 0.19 });
  const noon = seaLightSources();
  assert.equal(noon[0].strength, 0.1);
  assert.equal(noon[1].strength, 0);
  assert.equal(seaLightSources({ daylight: 0, sunrise: 1 })[0].warm, true);
  const full = seaLightSources(sceneLighting(0, 0, 1));
  const crescent = seaLightSources(sceneLighting(0, 0, 5));
  assert.equal(full[0].strength, 0);
  assert.ok(full[1].strength > crescent[1].strength);
  assert.ok(seaLightSources({ daylight: 0, night: 1 })[1].strength > 0);
  assert.ok(
    seaLightSources(sceneLighting(0.5, 1))[0].strength < noon[0].strength,
  );
});

test("glitter opens from the light toward the viewer and scatters in rough seas", () => {
  const source = celestialPosition("moon");
  const far = glitterCorridor(source, 0);
  const near = glitterCorridor(source, 1);
  assert.equal(far.x, source.x);
  assert.equal(far.y, source.y);
  assert.equal(far.intensity, 0);
  assert.equal(near.x, 0.5);
  assert.equal(near.y, 1.12);
  assert.ok(near.width > far.width * 10);
  const calm = glitterCorridor(source, 0.5);
  const rough = glitterCorridor(source, 0.5, 1);
  assert.ok(rough.width > calm.width);
  assert.ok(rough.intensity < calm.intensity);
  assert.deepEqual(glitterCorridor(source, -10, -1), far);
  assert.deepEqual(
    glitterCorridor(source, 10, 10),
    glitterCorridor(source, 1, 1),
  );
});

test("shallow illumination responds to cloud and moon phase without going dark at night", () => {
  assert.equal(shallowLightStrength(), 0.46);
  assert.equal(shallowLightStrength({ daylight: 0 }), 0);
  assert.ok(shallowLightStrength({ daylight: 0, night: 1 }) > 0);
  const full = shallowLightStrength(sceneLighting(0, 0, 1));
  assert.ok(full > shallowLightStrength(sceneLighting(0, 0, 5)));
  assert.ok(full < shallowLightStrength(sceneLighting(0.5)));
  assert.ok(shallowLightStrength(sceneLighting(0.5, 1)) < 0.1);
});

test("caustic junctions animate deterministically and match across wrapped copies", () => {
  const first = causticPoint(140, 290, 0, 1000);
  assert.deepEqual(causticPoint(140, 290, 0, 1000), first);
  assert.notDeepEqual(causticPoint(140, 290, 1, 1000), first);
  for (const x of [-1000, -140, 0, 140, 1000]) {
    const a = causticPoint(x, 290, 4, 1000);
    const b = causticPoint(x + 1000, 290, 4, 1000);
    assert.ok(Math.abs(b.x - a.x - 1000) < 1e-10);
    assert.equal(a.y, b.y);
    assert.ok(Math.abs(a.x - x) <= 6);
    assert.ok(Math.abs(a.y - 290) <= 6);
  }
});
