import test from "node:test";
import assert from "node:assert/strict";
import {
  updateSailResponse,
  sampleSailPoint,
  sailBacklight,
  sailShadowSegment,
} from "../src/core/sail-cloth.js";
import { sceneLighting, LIGHT_DIRECTION } from "../src/core/lighting.js";

const close = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} ≈ ${expected}`);

test("cloth pressure stays bounded and responds to wind in ship space", () => {
  assert.deepEqual(updateSailResponse(), {
    x: 0,
    y: -0.25,
    vx: 0,
    vy: 0,
    time: 0,
  });
  for (const strength of [-1, 0, 0.11, 0.22, 9]) {
    const pose = updateSailResponse(null, {
      windStrength: strength,
      windAngle: Math.PI / 2,
    });
    assert.ok(pose.x >= 0.25 && pose.x <= 2);
    close(pose.y, 0);
    const wrapped = updateSailResponse(null, {
      windStrength: strength,
      windAngle: Math.PI / 2 + Math.PI * 2,
    });
    close(pose.x, wrapped.x);
    close(pose.y, wrapped.y);
  }
});

test("a turn leaves the cloth behind briefly, then settles without overshooting", () => {
  const options = { windStrength: 0.22 };
  const initial = updateSailResponse(null, options);
  const target = updateSailResponse(null, { ...options, angle: Math.PI / 2 });
  let state = updateSailResponse(initial, {
    ...options,
    angle: Math.PI / 2,
    time: 1 / 60,
  });
  assert.ok(state.x > target.x && state.x < initial.x);
  assert.ok(state.y < target.y && state.y > initial.y);
  assert.ok(state.vx < 0 && state.vy > 0);
  for (let index = 2; index <= 240; index++) {
    state = updateSailResponse(state, {
      ...options,
      angle: Math.PI / 2,
      time: index / 60,
    });
    assert.ok(state.x >= target.x && state.y <= target.y);
  }
  assert.ok(Math.abs(state.x - target.x) < 1e-6);
  assert.ok(Math.abs(state.y - target.y) < 1e-6);
  assert.deepEqual(
    initial,
    updateSailResponse(null, options),
    "input state is immutable",
  );
});

test("cloth response is independent of frame rate and repeated wrap-copy draws", () => {
  const initial = updateSailResponse(null, { windStrength: 0.22 });
  const options = {
    windStrength: 0.11,
    angle: -Math.PI + 0.02,
    windAngle: Math.PI - 0.02,
  };
  const sample = (rate) => {
    let state = initial;
    for (let index = 1; index <= rate; index++)
      state = updateSailResponse(state, { ...options, time: index / rate });
    return state;
  };
  for (const rate of [30, 60, 144]) {
    const result = sample(rate);
    for (const field of ["x", "y", "vx", "vy"])
      close(result[field], sample(1)[field]);
    assert.deepEqual(
      updateSailResponse(result, { ...options, time: 1 }),
      result,
    );
  }
});

test("reduced motion, a clock reset, and a long absence reset cloth to equilibrium", () => {
  const initial = updateSailResponse(null, { time: 4 });
  for (const options of [
    { time: 2 },
    { time: 8 },
    { time: 4.1, reducedMotion: true },
  ]) {
    const environment = { ...options, angle: 0.9, windStrength: 0.22 };
    assert.deepEqual(
      updateSailResponse(initial, environment),
      updateSailResponse(null, environment),
    );
  }
});

const a = [-6, 0, 20],
  b = [6, 0, 20],
  center = [0, 1, 12];

test("curved cloth holds attachments steady and moves its belly and loose foot", () => {
  const options = { x: 0.8, y: -1.7, time: 1.2, freeEdge: true };
  assert.deepEqual(sampleSailPoint(a, b, center, 0, 0, options), a);
  sampleSailPoint(a, b, center, 1, 0, options).forEach((value, axis) =>
    close(value, b[axis]),
  );
  const belly = sampleSailPoint(a, b, center, 0, 1, options);
  close(belly[0], center[0] + options.x * 1.35);
  close(belly[1], center[1] + options.y * 1.35);
  close(belly[2], center[2]);
  const head = sampleSailPoint(a, b, center, 0.5, 0, {
    ...options,
    freeEdge: false,
  });
  assert.deepEqual(head, [0, 0, 20]);
  const foot = sampleSailPoint(a, b, center, 0.5, 0, options);
  assert.ok(foot[2] < head[2]);
  assert.notDeepEqual(
    foot,
    sampleSailPoint(a, b, center, 0.5, 0, { ...options, time: 2.1 }),
  );
  assert.notDeepEqual(
    sampleSailPoint(a, b, center, 0.3, 0.4, options),
    sampleSailPoint(a, b, center, 0.3, 0.4, { ...options, seed: 3, panel: 2 }),
  );
});

test("neighboring cloth fans share every moving boundary point", () => {
  const next = [6, 1.4, 5];
  for (const time of [0, 1, 4]) {
    const options = { x: -0.5, y: 2, time, freeEdge: true };
    for (const v of [0, 0.25, 0.5, 0.75, 1]) {
      const left = sampleSailPoint(a, b, center, 1 - v, v, options);
      const right = sampleSailPoint(b, next, center, 0, v, options);
      left.forEach((value, axis) => close(value, right[axis]));
    }
  }
});

test("reduced motion freezes folds while keeping a rounded sail under pressure", () => {
  const options = { x: 1, y: -1, reducedMotion: true, freeEdge: true };
  for (const [u, v] of [
    [0.3, 0.3],
    [0.5, 0],
    [0, 1],
  ]) {
    assert.deepEqual(
      sampleSailPoint(a, b, center, u, v, { ...options, time: 1 }),
      sampleSailPoint(a, b, center, u, v, { ...options, time: 99 }),
    );
  }
  sampleSailPoint(a, b, center, 0.3, 0.3, { x: 0, y: 0 }).forEach(
    (value, axis) => close(value, [-0.6, 0.3, 17.6][axis]),
  );
});

test("backlighting depends on the visible side, daylight, and cloud cover", () => {
  const day = sceneLighting(0.5);
  const back = sailBacklight([0, 1, 0], 1, day);
  const front = sailBacklight([0, -1, 0], 1, day);
  assert.ok(back.transmission > front.transmission);
  assert.ok(back.opacity < front.opacity);
  assert.deepEqual(sailBacklight([0, -1, 0], -1, day), back);
  assert.equal(sailBacklight([0, 1, 0], 1, sceneLighting(0)).transmission, 0);
  assert.ok(
    sailBacklight([0, 1, 0], 1, sceneLighting(0.5, 1)).transmission <
      back.transmission,
  );
  assert.equal(sailBacklight([0, 0, 0], 0, day).transmission, 0);
});

test("mast shadows follow light rays onto receiving cloth and reject parallel planes", () => {
  const plane = [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
    ],
    normal = [0, 0, 1];
  const segment = sailShadowSegment(plane, normal, [0, 0, 1], [0, 0, 10]);
  assert.ok(segment);
  for (const [index, height] of [1, 10].entries()) {
    close(segment[index][0], (-LIGHT_DIRECTION.x * height) / LIGHT_DIRECTION.z);
    close(segment[index][1], (-LIGHT_DIRECTION.y * height) / LIGHT_DIRECTION.z);
    close(segment[index][2], 0);
  }
  assert.equal(
    sailShadowSegment(
      plane,
      [LIGHT_DIRECTION.y, -LIGHT_DIRECTION.x, 0],
      [0, 0, 1],
      [0, 0, 10],
    ),
    null,
  );
  assert.equal(sailShadowSegment(plane, normal, [0, 0, -1], [0, 0, -10]), null);
  assert.deepEqual(
    sailShadowSegment(plane, normal, [0, 0, -1], [0, 0, 1])[0],
    [0, 0, 0],
  );
  assert.deepEqual(
    sailShadowSegment(plane, normal, [0, 0, 1], [0, 0, -1])[1],
    [0, 0, 0],
  );
});
