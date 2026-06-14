import assert from "node:assert/strict";
import test from "node:test";

import { beginAtHomePort, bindBeginButton } from "../src/core/startup.js";

test("the Begin button starts the supplied Goldhaven transition", () => {
  let listener;
  let starts = 0;
  const button = {
    addEventListener(type, callback) {
      assert.equal(type, "click");
      listener = callback;
    },
  };

  bindBeginButton(button, () => {
    starts += 1;
  });
  listener();

  assert.equal(starts, 1);
});

test("beginning at Goldhaven resets the ship and camera at the home port", () => {
  const camera = { x: 12, y: 34 };
  const ship = {
    x: 1,
    y: 2,
    angle: 3,
    speed: 40,
    anchored: false,
    trail: [{ x: 1, y: 2 }],
  };
  const goldhaven = { name: "Goldhaven", home: true };

  const home = beginAtHomePort({
    camera,
    homePort: { spawnX: 705, spawnY: 485, departureAngle: 0 },
    ports: [{ name: "Rimegate" }, goldhaven],
    ship,
  });

  assert.equal(home, goldhaven);
  assert.deepEqual(ship, {
    x: 705,
    y: 485,
    angle: 0,
    speed: 0,
    anchored: true,
    trail: [],
  });
  assert.deepEqual(camera, { x: 705, y: 485 });
});

test("startup fails clearly when the Begin button or home port is missing", () => {
  assert.throws(() => bindBeginButton(null, () => {}), /missing Begin button/);
  assert.throws(
    () =>
      beginAtHomePort({
        camera: {},
        homePort: {},
        ports: [],
        ship: {},
      }),
    /without a home port/,
  );
});
