import assert from "node:assert/strict";
import test from "node:test";
import {
  SEASON_LENGTH,
  YEAR_LENGTH,
  mixSeasonColor,
  seasonAtDay,
  seasonalAppearance,
  seasonalSeaPalette,
  seasonalDrift,
  seasonalFishingBoats,
  seasonalRegionAt,
} from "../src/core/seasons.js";

test("the sailing calendar starts in spring and repeats without persisted fields", () => {
  assert.equal(SEASON_LENGTH, 24);
  assert.equal(YEAR_LENGTH, 96);
  for (const [day, id, year, dayOfSeason] of [
    [1, "spring", 1, 1],
    [24, "spring", 1, 24],
    [25, "summer", 1, 1],
    [49, "autumn", 1, 1],
    [73, "winter", 1, 1],
    [96, "winter", 1, 24],
    [97, "spring", 2, 1],
    [100000, "autumn", 1042, 16],
  ]) {
    const season = seasonAtDay(day);
    assert.equal(season.id, id);
    assert.equal(season.year, year);
    assert.equal(season.dayOfSeason, dayOfSeason);
  }
  assert.deepEqual(seasonAtDay(1), seasonAtDay());
  assert.deepEqual(seasonalAppearance(), seasonalAppearance(1, "temperate"));
});

test("missing and invalid legacy days normalize safely; fractional days are whole voyage days", () => {
  for (const day of [
    undefined,
    null,
    NaN,
    Infinity,
    -Infinity,
    -5,
    0,
    "invalid",
  ])
    assert.deepEqual(seasonAtDay(day), seasonAtDay(1));
  assert.deepEqual(seasonAtDay(25.9), seasonAtDay(25));
  assert.deepEqual(seasonAtDay("49"), seasonAtDay(49));
});

test("pigments ease between seasons without a jump at year or season boundaries", () => {
  for (let index = 0; index < 4; index++) {
    let previous = 0;
    const keys = new Set();
    for (let day = 1; day <= 24; day++) {
      const calendar = seasonAtDay(index * 24 + day);
      assert.equal(
        calendar.weights.reduce((sum, weight) => sum + weight),
        1,
      );
      assert.ok(calendar.weights.every((weight) => weight >= 0 && weight <= 1));
      const next = calendar.weights[(index + 1) % 4];
      assert.ok(next >= previous);
      if (day <= 16) assert.equal(next, 0);
      previous = next;
      keys.add(calendar.key);
    }
    assert.equal(
      keys.size,
      5,
      "bounded pigment steps preserve rendering caches",
    );
    assert.deepEqual(
      seasonAtDay(index * 24 + 24).weights,
      seasonAtDay(index * 24 + 25).weights,
    );
    assert.equal(
      seasonAtDay(index * 24 + 24).key,
      seasonAtDay(index * 24 + 25).key,
    );
  }
});

test("temperate scenery blooms, turns copper, and accumulates snow with seasonal fleets", () => {
  const spring = seasonalAppearance(1);
  const summer = seasonalAppearance(25);
  const autumn = seasonalAppearance(49);
  const winter = seasonalAppearance(73);
  assert.equal(spring.blossoms, 1);
  assert.equal(summer.blossoms, 0);
  assert.equal(autumn.autumn, 1);
  assert.equal(winter.snow, 1);
  assert.notEqual(autumn.leaf, summer.leaf);
  assert.notEqual(winter.ground, summer.ground);
  assert.notEqual(autumn.sail, summer.sail);
  assert.ok(
    winter.fishing < summer.fishing &&
      summer.fishing < spring.fishing &&
      spring.fishing < autumn.fishing,
  );
  assert.deepEqual(seasonalAppearance(49), seasonalAppearance(145));
});

test("regional climates retain their identity and every transition has finite bounded effects", () => {
  for (const biome of [
    "temperate",
    "marsh",
    "alpine",
    "tropical",
    "arid",
    "volcanic",
    "unknown",
  ]) {
    for (let day = 1; day <= 96; day++) {
      const appearance = seasonalAppearance(day, biome);
      for (const field of ["snow", "blossoms", "autumn"])
        assert.ok(
          Number.isFinite(appearance[field]) &&
            appearance[field] >= 0 &&
            appearance[field] <= 1,
        );
      assert.ok(appearance.fishing >= 0.35 && appearance.fishing <= 1.8);
      for (const field of ["leaf", "leafLight", "ground", "sail"])
        assert.match(appearance[field], /^#[0-9a-f]{6}$/);
      if (["tropical", "arid", "volcanic"].includes(biome)) {
        assert.equal(appearance.snow, 0);
        assert.equal(appearance.blossoms, 0);
        assert.equal(appearance.autumn, 0);
        assert.ok(appearance.fishing >= 1);
      }
    }
  }
  assert.equal(seasonalAppearance(73, "marsh").snow, 0.65);
  assert.equal(seasonalAppearance(1, "alpine").blossoms, 0);
  assert.equal(seasonalAppearance(49, "alpine").autumn, 0);
  assert.notEqual(
    seasonalAppearance(73).key,
    seasonalAppearance(73, "tropical").key,
  );
});

test("seasonal pigment mixing preserves endpoints and rounds valid RGB channels", () => {
  assert.equal(mixSeasonColor("#123456", "#abcdef", 0), "#123456");
  assert.equal(mixSeasonColor("#123456", "#abcdef", 1), "#abcdef");
  assert.equal(mixSeasonColor("#000000", "#ffffff", 0.5), "#808080");
});

test("ocean pigments and vegetation respond in every region throughout the year", () => {
  const sea = [1, 25, 49, 73].map((day) => seasonalSeaPalette(day));
  assert.equal(new Set(sea.map((value) => value.join(":"))).size, 4);
  assert.deepEqual(seasonalSeaPalette(), sea[0]);
  assert.deepEqual(seasonalSeaPalette(73), seasonalSeaPalette(169));
  for (let day = 1; day <= 96; day++) {
    for (const color of seasonalSeaPalette(day))
      assert.match(color, /^#[0-9a-f]{6}$/);
    for (const biome of [
      "temperate",
      "alpine",
      "tropical",
      "arid",
      "volcanic",
    ]) {
      const appearance = seasonalAppearance(day, biome);
      assert.ok(appearance.growth >= 0 && appearance.growth <= 1);
      assert.ok(appearance.dryness >= 0 && appearance.dryness <= 1);
    }
  }
});

test("regional seasons use wrapped longitude, including open water far from any port", () => {
  const regions = [
    { x: 970, y: 100, biome: "alpine" },
    { x: 400, y: 100, biome: "tropical" },
  ];
  for (const x of [-990, 10, 1010])
    assert.equal(seasonalRegionAt(x, 100, regions, 1000), "alpine");
  assert.equal(seasonalRegionAt(390, 100, regions, 1000), "tropical");
  assert.equal(seasonalRegionAt(390, 100, [], 1000), "temperate");
  assert.equal(seasonalRegionAt(0, 0, [{ x: 0, y: 0 }], 1000), "temperate");
});

test("world particles animate deterministically and remain continuous across the meridian", () => {
  const first = seasonalDrift(990, 200, 1000, 1000);
  assert.deepEqual(first, seasonalDrift(1990, 200, 1000, 1000));
  assert.deepEqual(first, seasonalDrift(-10, 200, 1000, 1000));
  assert.notDeepEqual(first, seasonalDrift(990, 200, 2000, 1000));
  assert.deepEqual(
    seasonalDrift(990, 200, NaN, 1000),
    seasonalDrift(990, 200, 0, 1000),
  );
  for (const time of [-3000, 0, 120000]) {
    const value = seasonalDrift(990, 200, time, 1000, 17);
    assert.ok(Object.values(value).every(Number.isFinite));
    assert.ok(value.x >= 0 && value.x < 1000);
    assert.ok(value.y >= 140 && value.y <= 260);
    assert.ok(value.alpha >= 0.3 && value.alpha <= 0.85);
  }
});

test("offshore fishing boats stay within their grounds, wrap at the seam, and respond to climate", () => {
  const site = { x: 995, y: 300, radius: 52 };
  const winter = seasonalFishingBoats(site, 73, 1000);
  const autumn = seasonalFishingBoats(site, 49, 1000);
  assert.ok(winter.length < autumn.length);
  assert.ok(
    seasonalFishingBoats(site, 73, 1000, "tropical").length > winter.length,
  );
  assert.deepEqual(autumn, seasonalFishingBoats({ ...site, x: -5 }, 49, 1000));
  assert.ok(autumn.some((boat) => boat.x < 30));
  for (const boat of autumn) {
    assert.ok(Object.values(boat).every(Number.isFinite));
    assert.ok(boat.x >= 0 && boat.x < 1000);
    assert.ok(Math.abs(boat.y - site.y) <= site.radius);
  }
});
