import assert from "node:assert/strict";
import test from "node:test";
import { createExplorationSampler } from "../src/exploration-mask.js";

test("exploration samples cache both sides of the alpha threshold per pixel", () => {
  const reads = [];
  const sampler = createExplorationSampler(
    { width: 3, height: 2 },
    {
      getImageData(x, y, width, height) {
        reads.push([x, y, width, height]);
        return { data: [255, 255, 255, x + y === 0 ? 14 : 15] };
      },
    },
  );
  for (let frame = 0; frame < 60; frame++) {
    assert.equal(sampler.isExplored(0, 0), false);
    assert.equal(sampler.isExplored(1, 0), true);
    assert.equal(sampler.isExplored(0, 1), true);
  }
  assert.deepEqual(reads, [
    [0, 0, 1, 1],
    [1, 0, 1, 1],
    [0, 1, 1, 1],
  ]);
});

test("invalidating the painted mask refreshes explored and unexplored samples", () => {
  let alpha = 0;
  let reads = 0;
  const sampler = createExplorationSampler(
    { width: 1, height: 1 },
    {
      getImageData() {
        reads++;
        return { data: [0, 0, 0, alpha] };
      },
    },
  );
  assert.equal(sampler.isExplored(0, 0), false);
  alpha = 255;
  sampler.invalidate();
  assert.equal(sampler.isExplored(0, 0), true);
  // Restoring an older save can also remove exploration.
  alpha = 0;
  sampler.invalidate();
  assert.equal(sampler.isExplored(0, 0), false);
  assert.equal(reads, 3);
});

test("resizing a mask invalidates samples and updates pixel keys", () => {
  const mask = { width: 2, height: 2 };
  let alpha = 255;
  const sampler = createExplorationSampler(mask, {
    getImageData() {
      return { data: [0, 0, 0, alpha] };
    },
  });
  assert.equal(sampler.isExplored(0, 1), true);
  alpha = 0;
  mask.width = 3;
  assert.equal(sampler.isExplored(2, 0), false);
  assert.equal(sampler.isExplored(0, 1), false);
  alpha = 255;
  mask.height = 3;
  assert.equal(sampler.isExplored(0, 1), true);
});

test("a failed canvas read is retried rather than cached", () => {
  let failed = true;
  const sampler = createExplorationSampler(
    { width: 1, height: 1 },
    {
      getImageData() {
        if (failed) throw new Error("Canvas read failed");
        return { data: [0, 0, 0, 255] };
      },
    },
  );
  assert.throws(() => sampler.isExplored(0, 0), /Canvas read failed/);
  failed = false;
  assert.equal(sampler.isExplored(0, 0), true);
});

test("save snapshots encode once per mask change and retry failed encodes", () => {
  let encodes = 0;
  let fails = false;
  const mask = {
    width: 2,
    height: 2,
    toDataURL(type) {
      assert.equal(type, "image/png");
      encodes++;
      if (fails) throw new Error("Encoding failed");
      return `snapshot-${encodes}`;
    },
  };
  const sampler = createExplorationSampler(mask, {});
  assert.equal(sampler.snapshot(), "snapshot-1");
  assert.equal(sampler.snapshot(), "snapshot-1");
  sampler.invalidate();
  assert.equal(sampler.snapshot(), "snapshot-2");
  mask.width = 3;
  assert.equal(sampler.snapshot(), "snapshot-3");
  mask.height = 3;
  assert.equal(sampler.snapshot(), "snapshot-4");
  sampler.invalidate();
  fails = true;
  assert.throws(() => sampler.snapshot(), /Encoding failed/);
  fails = false;
  assert.equal(sampler.snapshot(), "snapshot-6");
});
