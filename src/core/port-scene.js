import { sceneLighting } from "./lighting.js";
import { mixSeasonColor } from "./seasons.js";

export const PORT_ARRIVAL_DURATION = 3200;

const clamp = (value, min = 0, max = 1) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));

function blend(first, second, amount) {
  const t = clamp(amount);
  const channels = [1, 3, 5].map((offset) =>
    Math.round(
      parseInt(first.slice(offset, offset + 2), 16) * (1 - t) +
        parseInt(second.slice(offset, offset + 2), 16) * t,
    ),
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

// Keep cached masonry in small lighting steps rather than repainting its paths
// on every frame of the day/night cycle.
export function portPlateLighting(lighting = sceneLighting()) {
  return Object.fromEntries(
    ["strength", "dusk", "storm", "night"].map((key) => [
      key,
      Math.round(clamp(lighting[key]) * 16) / 16,
    ]),
  );
}

export function portScenePalette(lighting = sceneLighting(), season) {
  const seasonal = (day) =>
    season
      ? mixSeasonColor(
          mixSeasonColor(
            mixSeasonColor(day, "#b1c991", season.growth * 0.12),
            "#c4a16e",
            season.dryness * 0.16,
          ),
          "#dbe6e6",
          season.snow * 0.4,
        )
      : day;
  const tint = (day, dusk, night) =>
    blend(
      blend(
        blend(seasonal(day), night, lighting.night),
        dusk,
        lighting.dusk * 0.72,
      ),
      "#52616d",
      lighting.storm * 0.55,
    );
  return {
    paperSky: tint("#f3e7c9", "#9c7a91", "#233243"),
    paperHorizon: tint("#eaddbb", "#efa66c", "#536075"),
    paperSea: tint("#e5d5b0", "#b78b83", "#344959"),
    sky: tint("#d6decb", "#745d87", "#152536"),
    horizon: tint("#f0e3c0", "#efa66c", "#536075"),
    sea: tint("#6f9285", "#796881", "#243b4b"),
    ridge: tint("#929d87", "#867180", "#283b4c"),
    reflection: tint("#f5ebc7", "#ffd29a", "#a1bcd0"),
  };
}

export function portLayerOffset(
  pointer = {},
  depth = 1,
  reducedMotion = false,
) {
  const amount = reducedMotion ? 0 : Math.max(0, depth);
  return {
    x: clamp(pointer.x, -1, 1) * 12 * amount,
    y: clamp(pointer.y, -1, 1) * 7 * amount,
  };
}

// A curved approach slows to a berth; the final pose is also the docked pose.
export function portArrivalFrame(elapsed = 0, reducedMotion = false) {
  const progress = reducedMotion ? 1 : clamp(elapsed / PORT_ARRIVAL_DURATION);
  const sail = clamp(progress / 0.8);
  const t = 1 - (1 - sail) ** 3;
  const merge = clamp((progress - 0.78) / 0.22);
  return {
    progress,
    complete: progress === 1,
    reveal: merge * merge * (3 - 2 * merge),
    opacity: clamp(progress / 0.16),
    ship: {
      x: -0.12 + 0.81 * t,
      y: 0.96 - 0.12 * t + Math.sin(t * Math.PI) * 0.035,
      angle: Math.atan2(-0.12 + Math.cos(t * Math.PI) * Math.PI * 0.035, 0.81),
      scale: 1.3 - 0.3 * t,
      speed: (1 - sail) * 65,
    },
  };
}
