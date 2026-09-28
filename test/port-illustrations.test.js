import assert from "node:assert/strict";
import test from "node:test";

import { planPortIllustration } from "../src/core/port-illustrations.js";
import { pointInWrappedPolygon } from "../src/core/geometry.js";

const island = {
  name: "Island",
  poly: [
    [20, 20],
    [160, 20],
    [160, 160],
    [20, 160],
  ],
};

test("port city stays on its named land with room for the footprint", () => {
  const port = { name: "Harbor", land: "Island", x: 170, y: 90 };
  const placement = planPortIllustration(port, [island], 200);
  assert.equal(placement.scale, 0.44);
  assert.ok(placement.distance > 0);
  assert.ok(placement.x < port.x);
  for (let index = 0; index < 16; index++) {
    const angle = (index / 16) * Math.PI * 2;
    assert.equal(
      pointInWrappedPolygon(
        placement.x + 36 * Math.cos(angle),
        placement.y + 36 * Math.sin(angle),
        island.poly,
        200,
      ),
      true,
    );
  }
  assert.deepEqual(planPortIllustration(port, [island], 200), placement);
});

test("city frontage turns toward the nearest generated shoreline", () => {
  for (const [x, y, expectedHeading] of [
    [170, 90, -Math.PI / 2],
    [10, 90, Math.PI / 2],
    [90, 10, Math.PI],
    [90, 170, 0],
  ]) {
    const placement = planPortIllustration(
      { land: "Island", x, y },
      [island],
      200,
    );
    assert.ok(Math.cos(placement.heading - expectedHeading) > 0.999);
  }
});

test("city placement respects a land polygon crossing the world seam", () => {
  const seamLand = {
    name: "Keys",
    poly: [
      [-55, 20],
      [45, 20],
      [45, 130],
      [-55, 130],
    ],
  };
  const placement = planPortIllustration(
    { land: "Keys", x: 85, y: 75 },
    [seamLand],
    200,
  );
  assert.ok(placement.distance > 0);
  assert.equal(
    pointInWrappedPolygon(placement.x, placement.y, seamLand.poly, 200),
    true,
  );
  assert.ok(Math.cos(placement.heading + Math.PI / 2) > 0.999);
});

test("small islands use a smaller city and impossible placements are omitted", () => {
  const small = {
    name: "Small",
    poly: [
      [50, 50],
      [105, 50],
      [105, 105],
      [50, 105],
    ],
  };
  const placement = planPortIllustration(
    { land: "Small", x: 78, y: 78 },
    [small],
    200,
  );
  assert.ok(placement.scale < 0.44);
  assert.equal(
    planPortIllustration(
      { land: "Tiny", x: 20, y: 20 },
      [
        {
          name: "Tiny",
          poly: [
            [10, 10],
            [20, 10],
            [10, 20],
          ],
        },
      ],
      200,
    ),
    null,
  );
});

test("invalid ports and missing land have no placement", () => {
  assert.equal(planPortIllustration(null, [island], 200), null);
  assert.equal(planPortIllustration({ x: NaN, y: 0 }, [island], 200), null);
  assert.equal(planPortIllustration({ x: 0, y: 0 }, [island], 0), null);
  assert.equal(
    planPortIllustration({ x: 0, y: 0, land: "Missing" }, [island], 200),
    null,
  );
});
