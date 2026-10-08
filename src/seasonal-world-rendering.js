import {
  createWrappedPolygonLookup,
  polygonCentroid,
} from "./core/geometry.js";
import { MAP_TILT_COS } from "./core/projection.js";
import { nearestWrapped } from "./core/math.js";
import { terrainBiome } from "./core/terrain.js";
import {
  seasonalAppearance,
  seasonalDrift,
  seasonalRegionAt,
  seasonAtDay,
} from "./core/seasons.js";

// Regional emitters cover wilderness and open water, independent of harbors.
// Keep a bounded set of visible cells; the world never needs a particle canvas.
export function createSeasonalWorldRendering({ world, lands }) {
  const onLand = createWrappedPolygonLookup(
    lands.map((land) => land.poly),
    world.w,
  );
  const regions = lands.map((land) => ({
    ...polygonCentroid(land.poly),
    biome: terrainBiome(land.name),
  }));
  const columns = Math.ceil(world.w / 140);
  const spacing = world.w / columns;
  const cells = new Map();
  const styles = new Map();
  let styleKey;
  return {
    biomeAt(x, y) {
      return seasonalRegionAt(x, y, regions, world.w);
    },
    draw(c, { camera, vw, vh, day, time, reducedMotion, windAngle = 0 }) {
      const key = seasonAtDay(day).key;
      if (styleKey !== key) {
        styles.clear();
        styleKey = key;
      }
      const halfWidth = vw / (2 * camera.zoom) + spacing;
      const halfHeight = vh / (2 * camera.zoom * MAP_TILT_COS) + 120;
      const visible = new Set();
      c.save();
      const baseAlpha = c.globalAlpha;
      for (
        let row = Math.max(0, Math.floor((camera.y - halfHeight) / 140));
        row <=
        Math.min(
          Math.floor(world.h / 140),
          Math.ceil((camera.y + halfHeight) / 140),
        );
        row++
      ) {
        for (
          let column = Math.floor((camera.x - halfWidth) / spacing);
          column <= Math.ceil((camera.x + halfWidth) / spacing);
          column++
        ) {
          const canonical = ((column % columns) + columns) % columns;
          const id = `${canonical}:${row}`;
          visible.add(id);
          let cell = cells.get(id);
          if (!cell) {
            const x = (canonical + 0.5) * spacing;
            const y = row * 140 + 70;
            cell = {
              x,
              y,
              land: onLand(x, y),
              biome: seasonalRegionAt(x, y, regions, world.w),
              seed: canonical * 17 + row * 31,
            };
            cells.set(id, cell);
          }
          if (!styles.has(cell.biome))
            styles.set(cell.biome, seasonalAppearance(day, cell.biome));
          const season = styles.get(cell.biome);
          const density = Math.max(
            season.snow,
            cell.land ? Math.max(season.blossoms, season.autumn) : 0,
          );
          if (density <= 0) continue;
          for (let particle = 0; particle < 3; particle++) {
            const drift = seasonalDrift(
              cell.x + particle * 23,
              cell.y,
              reducedMotion ? 0 : time,
              world.w,
              cell.seed + particle,
            );
            if (drift.y < 0 || drift.y > world.h) continue;
            c.globalAlpha = baseAlpha * density * drift.alpha * 0.75;
            c.fillStyle =
              season.snow > 0.5
                ? "#f4f8fa"
                : season.autumn > 0.5
                  ? "#cf8541"
                  : "#f4c4cf";
            c.beginPath();
            c.ellipse(
              nearestWrapped(drift.x, (column + 0.5) * spacing, world.w) +
                Math.cos(windAngle) * 5,
              drift.y,
              season.snow > 0.5 ? 1.7 : 2.2,
              season.snow > 0.5 ? 1.7 : 0.9,
              drift.angle,
              0,
              Math.PI * 2,
            );
            c.fill();
          }
        }
      }
      c.restore();
      for (const id of cells.keys()) if (!visible.has(id)) cells.delete(id);
    },
  };
}
