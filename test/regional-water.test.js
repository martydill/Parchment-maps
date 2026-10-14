import assert from "node:assert/strict";
import test from "node:test";
import {
  createRegionalWaterSampler,
  regionalWaveProfile,
  regionalWaterInk,
} from "../src/core/regional-water.js";

const world = { w: 2000, h: 2000 };
const rectangle = (left, top, right, bottom) => ({
  poly: [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom],
  ],
});
const bay = [
  rectangle(200, 700, 420, 1250),
  rectangle(580, 700, 800, 1250),
  rectangle(200, 1080, 800, 1250),
];
const channel = [
  rectangle(200, 100, 420, 1900),
  rectangle(580, 100, 800, 1900),
];
const sample = (lands, currents) =>
  createRegionalWaterSampler({ world, lands, currents });
const open = { shelter: 0, channel: 0, north: 0 };

test("closed bays shelter waves while two open ends identify a channel", () => {
  const quiet = sample(bay)(500, 1000);
  const exposed = sample(channel)(500, 1000);
  assert.ok(quiet.shelter > 0.8 && quiet.channel < 0.2);
  assert.ok(exposed.channel > 0.8 && exposed.shelter < 0.2);
  assert.equal(exposed.angle, Math.PI / 2);
  const still = regionalWaveProfile(quiet);
  const sharp = regionalWaveProfile(exposed);
  assert.ok(still.length > sharp.length);
  assert.ok(still.amplitude < sharp.amplitude);
  assert.ok(still.speed < sharp.speed);
  assert.ok(still.crestThreshold > sharp.crestThreshold);
});

test("coastline profiles repeat exactly across positive and negative world copies", () => {
  const sampler = sample(bay);
  for (const offset of [-4000, -2000, 2000, 4000]) {
    assert.deepEqual(sampler(500 + offset, 1000), sampler(500, 1000));
  }
  const seamBay = bay.map(({ poly }) => ({
    poly: poly.map(([x, y]) => [x - 500, y]),
  }));
  const seam = sample(seamBay);
  assert.deepEqual(seam(0, 1000), seam(2000, 1000));
  assert.ok(seam(0, 1000).shelter > 0.8);
});

test("distant shores and coastlines behind a ray do not influence open water", () => {
  assert.deepEqual(sample([])(1000, 1000), { ...open, angle: 0 });
  assert.deepEqual(sample(bay)(1500, 1000), { ...open, angle: 0 });
  assert.deepEqual(sample(bay)(500, 1600), { ...open, angle: 0 });
  const coast = sample([rectangle(580, 700, 800, 1250)])(500, 1000);
  assert.equal(coast.channel, 0);
  assert.ok(coast.shelter < 0.25, "one shore is not an enclosed harbor");
  const edge = sample([rectangle(820, 700, 900, 1250)])(500, 1000);
  assert.deepEqual(
    edge,
    { ...open, angle: 0 },
    "influence reaches zero at 320 units",
  );
});

test("currents give exposed water an axis but lose influence inside sheltered bays", () => {
  const current = [
    [500, 1000, -0.7],
    [1500, 1000, 1.2],
  ];
  const flow = sample([], current);
  assert.equal(flow(500, 1000).channel, 1);
  assert.equal(flow(500, 1000).angle, -0.7);
  assert.equal(flow(1500, 1000).angle, 1.2);
  assert.equal(flow(1000, 1000).channel, 0);
  assert.deepEqual(flow(2500, 1000), flow(500, 1000));
  assert.ok(sample(bay, current)(500, 1000).channel < 0.2);
  assert.equal(sample(channel, [[500, 1000, 0.4]])(500, 1000).angle, 0.4);
});

test("northern silver fades continuously into temperate water", () => {
  const sampler = sample([]);
  assert.equal(sampler(500, 0).north, 1);
  assert.equal(sampler(500, world.h * 0.08).north, 1);
  assert.ok(Math.abs(sampler(500, world.h * 0.15).north - 0.5) < 1e-10);
  assert.equal(sampler(500, world.h * 0.22).north, 0);
  assert.equal(sampler(500, world.h).north, 0);
  const north = regionalWaveProfile(sampler(500, 0));
  const south = regionalWaveProfile(open);
  assert.ok(north.density < south.density * 0.5);
  assert.ok(north.amplitude < south.amplitude);
  assert.ok(regionalWaveProfile(sampler(500, 0), 73).density < north.density);
});

test("seasonal rhythms preserve regional identities and repeat with the calendar", () => {
  assert.deepEqual(regionalWaveProfile(open), {
    length: 1,
    amplitude: 1,
    speed: 1,
    density: 1,
    contrast: 1,
    crestThreshold: 0.65,
  });
  assert.ok(regionalWaveProfile(open, 25).speed < 1);
  assert.ok(regionalWaveProfile(open, 49).length > 1);
  const quiet = sample(bay)(500, 1000);
  const exposed = sample(channel)(500, 1000);
  for (const day of [1, 21, 25, 49, 69, 73, 95]) {
    assert.ok(
      regionalWaveProfile(quiet, day).speed <
        regionalWaveProfile(exposed, day).speed,
    );
    assert.deepEqual(
      regionalWaveProfile(quiet, day),
      regionalWaveProfile(quiet, day + 96),
    );
    for (const region of [
      quiet,
      exposed,
      samplerNorth(),
      { shelter: 1, channel: 0, north: 1 },
    ]) {
      for (const value of Object.values(regionalWaveProfile(region, day))) {
        assert.ok(Number.isFinite(value) && value > 0);
      }
    }
  }
});

function samplerNorth() {
  return sample([])(500, 0);
}

test("seasonal ink retains warm spring pigments and gives the north its own silver", () => {
  assert.deepEqual(regionalWaterInk(), {
    shadow: "37,81,78",
    glint: "247,237,197",
    silver: "220,233,239",
  });
  assert.notDeepEqual(regionalWaterInk(49), regionalWaterInk(1));
  assert.notDeepEqual(regionalWaterInk(73), regionalWaterInk(1));
  for (const day of [1, 25, 49, 73, 21, 69, 95]) {
    assert.deepEqual(regionalWaterInk(day), regionalWaterInk(day + 96));
    for (const color of Object.values(regionalWaterInk(day))) {
      assert.match(color, /^\d+,\d+,\d+$/);
      assert.ok(
        color
          .split(",")
          .every((value) => Number(value) >= 0 && Number(value) <= 255),
      );
    }
  }
});
