import {
  mountainShadowBlend,
  mountainShadowSun,
  SHADOW_PHASES,
} from "./core/mountain-shadows.js";
import { nearestWrapped } from "./core/math.js";
import { MAP_TILT_COS } from "./core/projection.js";

// Four sun buckets, each containing three baked penumbra passes. Local plates
// at half resolution bound memory; no terrain paths or gradients run per frame.
export function createMountainShadowRendering({
  world,
  lands,
  terrainPlans,
  ports,
}) {
  const plates = lands.map((land, index) => {
    const left = Math.min(...land.poly.map((p) => p[0])) - 60;
    const top = Math.min(...land.poly.map((p) => p[1])) - 60;
    const width = Math.max(...land.poly.map((p) => p[0])) - left + 60;
    const height = Math.max(...land.poly.map((p) => p[1])) - top + 60;
    const buckets = SHADOW_PHASES.map((phase) => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(width * 0.5);
      canvas.height = Math.ceil(height * 0.5);
      const c = canvas.getContext("2d");
      c.scale(0.5, 0.5);
      c.translate(-left, -top);
      const sun = mountainShadowSun(phase);
      const polygon = (dx = 0, dy = 0) => {
        c.beginPath();
        land.poly.forEach(([x, y], i) =>
          i ? c.lineTo(x + dx, y + dy) : c.moveTo(x + dx, y + dy),
        );
        c.closePath();
      };
      // Raised coast shadow projects beyond the island, then the top surface
      // is cut out so only its seaward skirt remains.
      c.fillStyle = "rgba(32,43,48,.075)";
      for (const spread of [1, 0.75, 0.5]) {
        polygon(
          sun.x * sun.length * 7 * spread,
          sun.y * sun.length * 7 * spread,
        );
        c.fill();
      }
      c.globalCompositeOperation = "destination-out";
      polygon();
      c.fillStyle = "#000000";
      c.fill();
      c.globalCompositeOperation = "source-over";
      c.save();
      polygon();
      c.clip();
      const terrain = terrainPlans.get(index);
      const peaks = terrain.ranges.flatMap((range) => range.peaks);
      for (const peak of [...terrain.hills, ...peaks]) {
        for (const spread of [1.18, 1, 0.82]) {
          const length = peak.size * sun.length * spread;
          c.beginPath();
          c.moveTo(peak.x - peak.size * spread, peak.y + 3);
          c.lineTo(peak.x + sun.x * length, peak.y + sun.y * length);
          c.lineTo(peak.x + peak.size * spread, peak.y + 3);
          c.closePath();
          const wash = c.createLinearGradient(
            peak.x,
            peak.y,
            peak.x + sun.x * length,
            peak.y + sun.y * length,
          );
          wash.addColorStop(0, "rgba(35,39,48,.17)");
          wash.addColorStop(1, "rgba(35,39,48,0)");
          c.fillStyle = wash;
          c.fill();
        }
      }
      c.restore();
      // Keep port lettering and harbor art legible beneath the cached shade.
      c.globalCompositeOperation = "destination-out";
      c.fillStyle = "#000000";
      for (const port of ports) {
        c.beginPath();
        c.ellipse(
          nearestWrapped(port.x, left + width / 2, world.w),
          port.y,
          60,
          45,
          0,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
      return canvas;
    });
    return { left, top, width, height, buckets };
  });
  return {
    draw(c, { camera, vw, vh, lighting }) {
      const blend = mountainShadowBlend(
        lighting.time,
        lighting.daylight,
        lighting.storm,
      );
      const halfW = vw / (2 * camera.zoom),
        halfH = vh / (2 * camera.zoom * MAP_TILT_COS);
      c.save();
      const alpha = c.globalAlpha;
      for (const plate of plates) {
        const x =
          nearestWrapped(plate.left + plate.width / 2, camera.x, world.w) -
          plate.width / 2;
        if (
          x + plate.width < camera.x - halfW ||
          x > camera.x + halfW ||
          plate.top + plate.height < camera.y - halfH ||
          plate.top > camera.y + halfH
        )
          continue;
        for (const sample of blend) {
          if (sample.alpha <= 0.001) continue;
          c.globalAlpha = alpha * sample.alpha;
          c.drawImage(
            plate.buckets[sample.bucket],
            x,
            plate.top,
            plate.width,
            plate.height,
          );
        }
      }
      c.restore();
    },
  };
}
