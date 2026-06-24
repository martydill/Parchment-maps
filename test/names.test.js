import assert from "node:assert/strict";
import test from "node:test";
import {
  generateFleetShipName,
  FLEET_NAME_PREFIXES,
  FLEET_NAME_NOUNS,
  RESERVED_SHIP_NAMES,
} from "../src/names.js";

test("generateFleetShipName returns an Adjective Noun pair drawn from the banks", () => {
  const name = generateFleetShipName(0, []);
  const [prefix, noun] = name.split(" ");
  assert.ok(
    FLEET_NAME_PREFIXES.includes(prefix),
    `${prefix} is a known prefix`,
  );
  assert.ok(FLEET_NAME_NOUNS.includes(noun), `${noun} is a known noun`);
});

test("generateFleetShipName is deterministic for a fixed seed", () => {
  assert.equal(generateFleetShipName(123, []), generateFleetShipName(123, []));
});

test("different seeds can yield different names", () => {
  const names = new Set(
    [0, 1, 2, 3, 4].map((seed) => generateFleetShipName(seed, [])),
  );
  assert.ok(names.size > 1);
});

test("generateFleetShipName skips any name passed in the avoid list", () => {
  const first = generateFleetShipName(7, []);
  const second = generateFleetShipName(7, [first]);
  assert.notEqual(first, second);
});

test("generateFleetShipName keeps names unique as a fleet grows", () => {
  const taken = [];
  for (let seed = 0; seed < 60; seed += 1) {
    taken.push(generateFleetShipName(seed, taken));
  }
  assert.equal(new Set(taken).size, taken.length);
});

test("the reserved roster is a non-empty list of already-taken ship names", () => {
  assert.ok(RESERVED_SHIP_NAMES.length > 0);
  for (const name of RESERVED_SHIP_NAMES) {
    assert.equal(typeof name, "string");
    assert.ok(name.length > 0);
  }
});
