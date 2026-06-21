import { PORT_NAMES } from "../src/names.js";
import assert from "node:assert/strict";
import test from "node:test";

import {
  beginAtHomePort,
  bindBeginButton,
  recoverNavigablePosition,
} from "../src/core/startup.js";

test("the Begin button starts the supplied home-port transition", () => {
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

test("beginning at the home port resets the ship and camera", () => {
  const camera = { x: 12, y: 34 };
  const ship = {
    x: 1,
    y: 2,
    angle: 3,
    speed: 40,
    anchored: false,
    trail: [{ x: 1, y: 2 }],
  };
  const goldhaven = { name: PORT_NAMES.orvessaQuay, home: true };

  const home = beginAtHomePort({
    camera,
    homePort: { spawnX: 705, spawnY: 485, departureAngle: 0 },
    ports: [{ name: PORT_NAMES.narthkel }, goldhaven],
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

test("beginning repairs a legacy ship without a usable trail", () => {
  const ship = {
    x: 1,
    y: 2,
    angle: 3,
    speed: 40,
    anchored: false,
    trail: null,
  };

  beginAtHomePort({
    camera: {},
    homePort: { spawnX: 705, spawnY: 485, departureAngle: 0 },
    ports: [{ name: PORT_NAMES.orvessaQuay, home: true }],
    ship,
  });

  assert.deepEqual(ship.trail, []);
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

test("valid restored positions remain unchanged", () => {
  const position = { x: 40, y: 50 };

  assert.equal(
    recoverNavigablePosition({
      position,
      fallback: { x: 10, y: 20 },
      isBlocked: () => false,
    }),
    position,
  );
});

test("blocked restored positions move to nearby wrapped open water", () => {
  const checked = [];
  const recovered = recoverNavigablePosition({
    position: { x: 95, y: 50 },
    fallback: { x: 10, y: 20 },
    isBlocked(x, y) {
      checked.push([x, y]);
      return x !== 11 || y !== 50;
    },
    searchRadius: 16,
    step: 16,
    samples: 4,
    wrapX: (x) => ((x % 100) + 100) % 100,
  });

  assert.deepEqual(recovered, { x: 11, y: 50 });
  assert.deepEqual(checked, [
    [95, 50],
    [11, 50],
  ]);
});

test("blocked restored positions fall back when no nearby water is open", () => {
  assert.deepEqual(
    recoverNavigablePosition({
      position: { x: 40, y: 50 },
      fallback: { x: 10, y: 20 },
      isBlocked: () => true,
      searchRadius: 16,
      step: 16,
      samples: 2,
    }),
    { x: 10, y: 20 },
  );
});
