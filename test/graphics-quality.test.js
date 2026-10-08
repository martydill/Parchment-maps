import assert from "node:assert/strict";
import test from "node:test";
import {
  createAutoQualityTier,
  graphicsQualityProfile,
  GRAPHICS_PROFILES,
  GRAPHICS_SETTINGS,
  normalizeGraphicsSetting,
  QUALITY_TIERS,
  resolveQualityTier,
} from "../src/core/graphics-quality.js";

function feed(detector, frameMs, count, headroom = 1) {
  let changes = 0;
  for (let frame = 0; frame < count; frame++)
    changes += Number(detector.sample(frameMs, headroom));
  return changes;
}

test("graphics settings normalize to a known value with auto as the fallback", () => {
  for (const setting of GRAPHICS_SETTINGS)
    assert.equal(normalizeGraphicsSetting(setting), setting);
  assert.equal(normalizeGraphicsSetting("HIGH"), "high");
  assert.equal(normalizeGraphicsSetting(" Medium "), "medium");
  assert.equal(normalizeGraphicsSetting("cinematic"), "auto");
  assert.equal(normalizeGraphicsSetting(""), "auto");
  assert.equal(normalizeGraphicsSetting(undefined), "auto");
  assert.equal(normalizeGraphicsSetting(null), "auto");
  assert.equal(normalizeGraphicsSetting(3), "auto");
});

test("a fixed setting names its tier and auto defers to the detected tier", () => {
  for (const tier of QUALITY_TIERS) {
    assert.equal(resolveQualityTier(tier, "low"), tier);
    assert.equal(graphicsQualityProfile(tier, "low"), GRAPHICS_PROFILES[tier]);
  }
  assert.equal(resolveQualityTier("auto", "medium"), "medium");
  assert.equal(resolveQualityTier("auto"), "high");
  assert.equal(resolveQualityTier("auto", "ultra"), "high");
  assert.equal(resolveQualityTier("auto", undefined), "high");
  assert.equal(
    graphicsQualityProfile("auto", "medium"),
    GRAPHICS_PROFILES.medium,
  );
});

test("tiers scale effect scalars monotonically with high reproducing the classic look", () => {
  // The high tier must match the pre-tier rendering exactly: full particles,
  // the historical half-resolution masks, the classic grain, and instant
  // glowing nine-segment lightning.
  assert.deepEqual(GRAPHICS_PROFILES.high, {
    tier: "high",
    resolutionScale: 1,
    detail: 1,
    particleScale: 1,
    maskScale: 0.5,
    grainAlpha: 0.28,
    lightning: { intervalScale: 1, segments: 9, glow: true },
  });
  for (const field of [
    "resolutionScale",
    "detail",
    "particleScale",
    "maskScale",
    "grainAlpha",
  ]) {
    assert.ok(GRAPHICS_PROFILES.low[field] < GRAPHICS_PROFILES.medium[field]);
    assert.ok(GRAPHICS_PROFILES.medium[field] < GRAPHICS_PROFILES.high[field]);
  }
  assert.ok(
    GRAPHICS_PROFILES.low.lightning.intervalScale >
      GRAPHICS_PROFILES.medium.lightning.intervalScale,
  );
  assert.ok(
    GRAPHICS_PROFILES.medium.lightning.intervalScale >
      GRAPHICS_PROFILES.high.lightning.intervalScale,
  );
  assert.ok(
    GRAPHICS_PROFILES.low.lightning.segments <
      GRAPHICS_PROFILES.medium.lightning.segments,
  );
  assert.ok(
    GRAPHICS_PROFILES.medium.lightning.segments <
      GRAPHICS_PROFILES.high.lightning.segments,
  );
  assert.equal(GRAPHICS_PROFILES.low.lightning.glow, false);
  assert.equal(GRAPHICS_PROFILES.medium.lightning.glow, false);
  assert.equal(GRAPHICS_PROFILES.high.lightning.glow, true);
});

test("sustained slow frames step the tier down while cooldown paces the drops", () => {
  const detector = createAutoQualityTier();
  assert.equal(detector.tier, "high");
  assert.equal(feed(detector, 40, 25), 1);
  assert.equal(detector.tier, "medium");
  // Cooldown holds the next drop for four quiet windows.
  assert.equal(feed(detector, 40, 75), 0);
  assert.equal(feed(detector, 40, 25), 1);
  assert.equal(detector.tier, "low");
  assert.equal(feed(detector, 40, 200), 0);
  assert.equal(detector.tier, "low", "low is the floor");
});

test("a single hitch or a suspended tab never moves the tier", () => {
  const detector = createAutoQualityTier();
  feed(detector, 16, 62);
  assert.equal(detector.sample(180), false);
  assert.equal(detector.tier, "high");
  for (const interval of [251, 10000, 0, -1, NaN, Infinity, undefined]) {
    assert.equal(detector.sample(interval), false);
    assert.equal(detector.tier, "high");
  }
  // The window was discarded, so the following samples start fresh.
  assert.equal(feed(detector, 16, 40), 0);
});

test("a sustained healthy soak climbs back toward high and stops there", () => {
  const detector = createAutoQualityTier();
  feed(detector, 40, 25);
  feed(detector, 40, 100);
  assert.equal(detector.tier, "low");
  // Each 14ms window averages below the fast budget; the soak and the
  // cooldown both have to elapse before the tier rises once.
  assert.equal(feed(detector, 14, 72 * 4), 0);
  assert.equal(feed(detector, 14, 72 * 3), 0);
  assert.equal(feed(detector, 14, 72), 1);
  assert.equal(detector.tier, "medium");
  assert.equal(feed(detector, 14, 72 * 7), 0);
  assert.equal(feed(detector, 14, 72), 1);
  assert.equal(detector.tier, "high");
  assert.equal(feed(detector, 14, 72 * 30), 0);
  assert.equal(detector.tier, "high", "high is the ceiling");
});

test("middling frame times interrupt the healthy soak without dropping the tier", () => {
  const detector = createAutoQualityTier();
  feed(detector, 40, 25);
  feed(detector, 40, 100);
  assert.equal(detector.tier, "low");
  assert.equal(feed(detector, 14, 72 * 7), 0);
  feed(detector, 16.5, 61);
  assert.equal(feed(detector, 14, 72 * 7), 0);
  assert.equal(detector.tier, "low");
});

test("heavy resolution compensation steps the tier down even at fast frame times", () => {
  const detector = createAutoQualityTier();
  // Fast frames, but the continuous controller is giving back most of the
  // resolution: the device is heavier than its frame times suggest.
  assert.equal(feed(detector, 14, 72 * 5, 0.5), 0);
  assert.equal(feed(detector, 14, 72, 0.5), 1);
  assert.equal(detector.tier, "medium");
  // Comfortable frames with full headroom no longer feed that run. A 17ms
  // window closes every 59 samples, and the feed ends exactly on the boundary
  // so no half-window spills into the feeds below.
  assert.equal(feed(detector, 17, 59 * 10, 1), 0);
  assert.equal(detector.tier, "medium");
  // headroom outside [0, 1] clamps, so a bloated value still counts as full
  // headroom and the healthy soak eventually raises the tier again.
  assert.equal(feed(detector, 14, 72 * 8, 4), 1);
  assert.equal(detector.tier, "high");
  // NaN headroom reads as full headroom; from the ceiling nothing changes.
  assert.equal(feed(detector, 14, 72 * 9, NaN), 0);
  assert.equal(detector.tier, "high");
});

test("a reset clears unfinished samples without losing the selected tier", () => {
  const detector = createAutoQualityTier();
  feed(detector, 40, 25);
  assert.equal(detector.tier, "medium");
  detector.sample(16);
  detector.reset();
  assert.equal(detector.tier, "medium");
  assert.equal(feed(detector, 14, 72 * 12), 1);
  assert.equal(detector.tier, "high");
});
