import assert from "node:assert/strict";
import test from "node:test";
import {
  MAP_OPENING_DURATION,
  mapOpeningFrame,
} from "../src/core/map-opening.js";

test("the chart starts tightly rolled with the camera above the table", () => {
  const frame = mapOpeningFrame(0);
  assert.equal(frame.complete, false);
  assert.equal(frame.unroll, 0);
  assert.equal(frame.approach, 0);
  assert.equal(frame.handoff, 0);
  assert.ok(frame.curl > 0);
  assert.ok(frame.tilt > 0);
  assert.ok(frame.scale < 1);
  assert.deepEqual(mapOpeningFrame(-100), frame);
});

test("the camera starts zooming while the chart is still unrolling", () => {
  const start = mapOpeningFrame(440);
  assert.equal(start.approach, 0);
  assert.ok(start.unroll > 0 && start.unroll < 1);
  const middle = mapOpeningFrame(860);
  assert.equal(middle.unroll, 0.5);
  assert.ok(middle.approach > 0 && middle.approach < 1);
  assert.ok(middle.scale > start.scale);
  assert.equal(middle.handoff, 0);
  assert.ok(middle.lift > 0);
  const approach = mapOpeningFrame(1420);
  assert.ok(approach.unroll > middle.unroll && approach.unroll < 1);
  assert.equal(approach.approach, 0.5);
});

test("paper wear and curls remain until the final handoff", () => {
  const open = mapOpeningFrame(1680);
  assert.equal(open.unroll, 1);
  assert.ok(open.approach > 0.5 && open.approach < 1);
  assert.equal(open.handoff, 0);
  assert.ok(open.curl > 0);
  const handoff = mapOpeningFrame(2040);
  assert.equal(handoff.handoff, 0.5);
  assert.ok(handoff.curl < open.curl);
});

test("opening is monotonic and finishes exactly on the playable view", () => {
  assert.equal(mapOpeningFrame(MAP_OPENING_DURATION - 1).complete, false);
  let previous = mapOpeningFrame(0);
  for (let elapsed = 16; elapsed < MAP_OPENING_DURATION; elapsed += 16) {
    const frame = mapOpeningFrame(elapsed);
    assert.ok(frame.unroll >= previous.unroll);
    assert.ok(frame.approach >= previous.approach);
    assert.ok(frame.handoff >= previous.handoff);
    assert.ok(frame.scale >= previous.scale);
    assert.ok(frame.curl <= previous.curl);
    assert.ok(
      Object.entries(frame).every(
        ([key, value]) => key === "complete" || Number.isFinite(value),
      ),
    );
    previous = frame;
  }
  assert.deepEqual(mapOpeningFrame(MAP_OPENING_DURATION), {
    complete: true,
    unroll: 1,
    approach: 1,
    handoff: 1,
    scale: 1,
    tilt: 0,
    rotation: 0,
    lift: 0,
    curl: 0,
  });
  assert.deepEqual(
    mapOpeningFrame(MAP_OPENING_DURATION + 10000),
    mapOpeningFrame(MAP_OPENING_DURATION),
  );
});

test("reduced motion bypasses the rolls and camera travel immediately", () => {
  assert.deepEqual(
    mapOpeningFrame(0, true),
    mapOpeningFrame(MAP_OPENING_DURATION),
  );
});
