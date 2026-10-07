// Discrete graphics quality tiers, the render scalars each tier implies, and
// the rolling-frame-time detector that picks a tier in "auto" mode. Pure data
// and transitions: DOM, canvas, and storage stay in the callers.

export const GRAPHICS_SETTINGS = ["auto", "low", "medium", "high"];
export const QUALITY_TIERS = ["low", "medium", "high"];

// One profile per tier. Callers treat them as read-only; every field is a
// plain number or a plain options object so profiles can be shared freely.
// "high" reproduces the historical fixed-effect rendering exactly.
export const GRAPHICS_PROFILES = {
  low: {
    tier: "low",
    resolutionScale: 0.75,
    detail: 0.6,
    particleScale: 0.45,
    maskScale: 0.3,
    grainAlpha: 0,
    lightning: { intervalScale: 2.6, segments: 4, glow: false },
  },
  medium: {
    tier: "medium",
    resolutionScale: 0.85,
    detail: 0.75,
    particleScale: 0.7,
    maskScale: 0.4,
    grainAlpha: 0.17,
    lightning: { intervalScale: 1.7, segments: 6, glow: false },
  },
  high: {
    tier: "high",
    resolutionScale: 1,
    detail: 1,
    particleScale: 1,
    maskScale: 0.5,
    grainAlpha: 0.28,
    lightning: { intervalScale: 1, segments: 9, glow: true },
  },
};

// Stored preferences may be absent, user-edited, or from an older build.
export function normalizeGraphicsSetting(value) {
  const key = typeof value === "string" ? value.trim().toLowerCase() : "";
  return GRAPHICS_SETTINGS.includes(key) ? key : "auto";
}

// A fixed setting names its tier directly; "auto" defers to the detector.
export function resolveQualityTier(setting, detectedTier = "high") {
  if (setting === "low" || setting === "medium" || setting === "high")
    return setting;
  return QUALITY_TIERS.includes(detectedTier) ? detectedTier : "high";
}

export function graphicsQualityProfile(setting, detectedTier) {
  return GRAPHICS_PROFILES[resolveQualityTier(setting, detectedTier)];
}

// Watches averaged frame intervals and steps the tier along low → medium →
// high. Windows mirror createRenderQuality: ~1s of samples with the single
// longest frame discarded, so one hitch or a suspended tab never moves the
// tier. Changes are rare by design — a cooldown separates them and raising
// requires a sustained healthy soak. `headroom` (0..1) reports how much
// resolution the continuous controller still allows: a device that only holds
// its frame budget by dropping most pixels is heavier than its frame times
// alone suggest, so sustained heavy compensation also steps the tier down.
export function createAutoQualityTier({
  slowMs = 18.5,
  fastMs = 15,
  compensateWindows = 6,
  raiseSoakWindows = 8,
  cooldownWindows = 4,
} = {}) {
  let tier = "high";
  let elapsed = 0;
  let frames = 0;
  let longestFrame = 0;
  let slowRun = 0;
  let compensatedRun = 0;
  let healthyRun = 0;
  let quietWindows = cooldownWindows;

  function closeWindow(average, headroom) {
    quietWindows++;
    if (average > slowMs) {
      slowRun++;
      compensatedRun = 0;
      healthyRun = 0;
    } else if (average <= fastMs && headroom >= 0.97) {
      healthyRun++;
      slowRun = 0;
      compensatedRun = 0;
    } else if (headroom < 0.7) {
      compensatedRun++;
      slowRun = 0;
      healthyRun = 0;
    } else {
      slowRun = 0;
      compensatedRun = 0;
      healthyRun = 0;
    }
    if (quietWindows < cooldownWindows) return false;
    const previous = tier;
    if ((slowRun >= 1 || compensatedRun >= compensateWindows) && tier !== "low")
      tier = QUALITY_TIERS[Math.max(0, QUALITY_TIERS.indexOf(tier) - 1)];
    else if (healthyRun >= raiseSoakWindows && tier !== "high")
      tier =
        QUALITY_TIERS[
          Math.min(QUALITY_TIERS.length - 1, QUALITY_TIERS.indexOf(tier) + 1)
        ];
    if (tier === previous) return false;
    quietWindows = 0;
    slowRun = 0;
    compensatedRun = 0;
    healthyRun = 0;
    return true;
  }

  return {
    get tier() {
      return tier;
    },
    // Clears unfinished samples without losing the selected tier.
    reset() {
      elapsed = 0;
      frames = 0;
      longestFrame = 0;
      slowRun = 0;
      compensatedRun = 0;
      healthyRun = 0;
    },
    sample(frameMs, headroom = 1) {
      if (!Number.isFinite(frameMs) || frameMs <= 0 || frameMs > 250) {
        this.reset();
        return false;
      }
      elapsed += frameMs;
      frames++;
      longestFrame = Math.max(longestFrame, frameMs);
      if (elapsed < 1000) return false;
      const average = (elapsed - longestFrame) / (frames - 1);
      elapsed = 0;
      frames = 0;
      longestFrame = 0;
      const allowed = Number.isFinite(headroom)
        ? Math.max(0, Math.min(1, headroom))
        : 1;
      return closeWindow(average, allowed);
    },
  };
}
