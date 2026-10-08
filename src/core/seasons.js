import { wrap, wrappedDistance } from "./math.js";

// A short sailing year makes return visits change within a campaign. Derive
// everything from the saved day, so older voyages need no calendar migration.
export const SEASON_LENGTH = 24;
export const YEAR_LENGTH = SEASON_LENGTH * 4;
const SEASONS = ["spring", "summer", "autumn", "winter"];

export function seasonAtDay(day = 1) {
  const value = Number(day);
  const elapsed = Math.max(
    0,
    Math.floor(Number.isFinite(value) ? value : 1) - 1,
  );
  const index = Math.floor((elapsed % YEAR_LENGTH) / SEASON_LENGTH);
  const dayOfSeason = (elapsed % SEASON_LENGTH) + 1;
  // Ease toward the next season over eight days. Four pigment steps keep
  // expensive terrain and architecture plates cached between changes.
  const t = Math.max(0, (dayOfSeason - 16) / 8);
  const blend = Math.round(t * t * (3 - 2 * t) * 4) / 4;
  const weights = [0, 0, 0, 0];
  weights[index] = 1 - blend;
  weights[(index + 1) % 4] = blend;
  const id = SEASONS[index];
  return {
    id,
    label: id[0].toUpperCase() + id.slice(1),
    year: Math.floor(elapsed / YEAR_LENGTH) + 1,
    dayOfSeason,
    weights,
    key: weights.join(":"),
  };
}

export function mixSeasonColor(base, tint, amount) {
  const channel = (color, offset) =>
    parseInt(color.slice(offset, offset + 2), 16);
  return (
    "#" +
    [1, 3, 5]
      .map((offset) =>
        Math.round(
          channel(base, offset) * (1 - amount) + channel(tint, offset) * amount,
        )
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

export function seasonalAppearance(day = 1, biome = "temperate") {
  const calendar = seasonAtDay(day);
  const [spring, summer, autumn, winter] = calendar.weights;
  const mild = biome === "tropical" || biome === "arid" || biome === "volcanic";
  const deciduous = !mild && biome !== "alpine";
  const snow = mild ? 0 : winter * (biome === "marsh" ? 0.65 : 1);
  return {
    key: `${biome}:${calendar.key}`,
    snow,
    growth: spring * (mild ? 0.65 : 1),
    dryness: summer * (mild ? 0.75 : 0.15) + autumn * (mild ? 0.5 : 0.8),
    blossoms: deciduous ? spring : 0,
    autumn: deciduous ? autumn : 0,
    leaf: mild
      ? "#60804c"
      : mixSeasonColor(
          mixSeasonColor("#65834b", "#b76632", deciduous ? autumn : 0),
          "#687d79",
          winter,
        ),
    leafLight: mixSeasonColor(
      mixSeasonColor("#b4c580", "#edb45c", deciduous ? autumn : 0),
      "#e3edf0",
      snow,
    ),
    ground: mixSeasonColor(
      mixSeasonColor("#b2ac78", "#c3a06c", deciduous ? autumn : 0),
      "#dde5de",
      snow * 0.85,
    ),
    // The autumn silverfin run draws more boats out; cold harbors shelter
    // most of their fleet. Warm waters retain year-round fishing activity.
    fishing: mild
      ? 1 + autumn * 0.5
      : spring * 1.3 + summer + autumn * 1.8 + winter * 0.35,
    sail: mixSeasonColor("#eee0b8", "#b87845", autumn * 0.65),
  };
}

// The entire ocean changes pigment, including distant water on the atlas.
export function seasonalSeaPalette(day = 1) {
  const { weights } = seasonAtDay(day);
  const colors = [
    ["#91b6a4", "#659e97", "#416f7e"],
    ["#a7c6ac", "#63a8a1", "#426f82"],
    ["#abb2a0", "#788f8e", "#4b6a78"],
    ["#bbcbd0", "#7e9aa7", "#405c76"],
  ];
  return [0, 1, 2].map(
    (stop) =>
      "#" +
      [1, 3, 5]
        .map((offset) =>
          Math.round(
            colors.reduce(
              (value, palette, index) =>
                value +
                parseInt(palette[stop].slice(offset, offset + 2), 16) *
                  weights[index],
              0,
            ),
          )
            .toString(16)
            .padStart(2, "0"),
        )
        .join(""),
  );
}

// World-space emitters keep seasonal weather fixed to the chart while panning.
// Periodic longitude makes the same snowfall continue across the map seam.
export function seasonalDrift(x, y, time, worldWidth, seed = 0) {
  const seconds = Number.isFinite(time) ? time / 1000 : 0;
  const phase = (((seconds * 0.045 + seed * 0.618) % 1) + 1) % 1;
  const longitude =
    wrap(x, worldWidth) + Math.sin(seconds * 0.45 + seed) * 12 + phase * 28;
  return {
    x: ((longitude % worldWidth) + worldWidth) % worldWidth,
    y: y + phase * 120 - 60,
    alpha: 0.3 + Math.sin(phase * Math.PI) * 0.55,
    angle: seconds * 0.4 + seed,
  };
}

export function seasonalFishingBoats(
  site,
  day,
  worldWidth,
  biome = "temperate",
) {
  const count = Math.max(
    1,
    Math.round(seasonalAppearance(day, biome).fishing * 3),
  );
  return Array.from({ length: count }, (_, index) => {
    const angle = index * 2.4 + 0.7;
    const radius = site.radius * (0.3 + (index % 3) * 0.18);
    return {
      x:
        (((wrap(site.x, worldWidth) + Math.cos(angle) * radius) % worldWidth) +
          worldWidth) %
        worldWidth,
      y: site.y + Math.sin(angle) * radius,
      heading: angle * 0.12,
    };
  });
}

export function seasonalRegionAt(x, y, regions, worldWidth) {
  let nearest;
  let distance = Infinity;
  for (const region of regions) {
    const candidate = wrappedDistance(x, y, region.x, region.y, worldWidth);
    if (candidate < distance) {
      nearest = region;
      distance = candidate;
    }
  }
  return nearest?.biome ?? "temperate";
}
