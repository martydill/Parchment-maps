import {
  mountainShadowBlend,
  mountainShadowSun,
  SHADOW_PHASES,
} from "./core/mountain-shadows.js";
import { nearestWrapped } from "./core/math.js";
import { MAP_TILT_COS } from "./core/projection.js";
import { sceneLighting } from "./core/lighting.js";
import { coastalExposure } from "./core/sunlight.js";

// Shared sun buckets hold penumbras and coastal/mountain glazes together.
// Local half-resolution plates avoid terrain paths and gradients per frame.
export function createMountainShadowRendering({
  world,
  lands,
  terrainPlans,
  ports,
  shorePlans = [],
  coastDepths = [],
}) {
  const plates = lands.map((land, index) => {
    const depth = coastDepths[index] ?? 7;
    const margin = Math.max(64 + depth * 1.5, depth * 4.5 + 4);
    const left = Math.min(...land.poly.map((p) => p[0])) - margin;
    const top = Math.min(...land.poly.map((p) => p[1])) - margin;
    const width = Math.max(...land.poly.map((p) => p[0])) - left + margin;
    const height = Math.max(...land.poly.map((p) => p[1])) - top + margin;
    const buckets = SHADOW_PHASES.map((phase) => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(width * 0.5);
      canvas.height = Math.ceil(height * 0.5);
      const c = canvas.getContext("2d");
      c.scale(0.5, 0.5);
      c.translate(-left, -top);
      const sun = mountainShadowSun(phase);
      const light = sceneLighting(phase);
      const coast = (shorePlans[index] ?? []).map((segment) => ({
        segment,
        exposure: coastalExposure(land.poly, segment, depth, light),
      }));
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
          sun.x * sun.length * depth * spread,
          sun.y * sun.length * depth * spread,
        );
        c.fill();
      }
      // Headlands shelter nearby water from low sun. These blue penumbras
      // are cut against the actual coastline along with its projected skirt.
      for (const { exposure } of coast) {
        if (exposure.shelter < 0.08) continue;
        const radius = Math.min(52, 12 + exposure.reach * 0.5);
        const x = exposure.x;
        const y = exposure.y + depth;
        const wash = c.createRadialGradient(x, y, 0, x, y, radius);
        wash.addColorStop(
          0,
          `rgba(29,48,83,${exposure.shelter * (0.09 + light.dusk * 0.08)})`,
        );
        wash.addColorStop(1, "rgba(29,48,83,0)");
        c.fillStyle = wash;
        c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
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
      // Glazes follow the same sun as the cast shadows, lifting exposed
      // mountain planes and cooling their receding sides over the chart ink.
      for (const peak of peaks) {
        for (const side of [-1, 1]) {
          const direct = Math.max(
            0,
            side * light.sunDirection.x * 0.8 + light.sunDirection.z * 0.35,
          );
          c.beginPath();
          c.moveTo(peak.x - peak.size * 0.08, peak.y - peak.size);
          c.lineTo(peak.x + side * peak.size, peak.y + peak.size * 0.58);
          c.lineTo(peak.x, peak.y + peak.size * 0.4);
          c.closePath();
          c.fillStyle =
            direct > 0.3
              ? `rgba(255,190,105,${direct * (0.08 + light.dusk * 0.2)})`
              : `rgba(33,49,79,${(1 - direct) * (0.09 + light.dusk * 0.12)})`;
          c.fill();
        }
      }
      c.restore();
      // Vertical coastal faces remain outside the raised crown. Only exposed
      // stone catches amber light; shadowed walls receive a cool blue glaze.
      for (const { segment: s, exposure } of coast) {
        if (s.ny <= 0 || (s.kind !== "rock" && s.kind !== "basalt")) continue;
        c.beginPath();
        c.moveTo(s.a.x, s.a.y);
        c.lineTo(s.b.x, s.b.y);
        c.lineTo(s.b.x, s.b.y + depth);
        c.lineTo(s.a.x, s.a.y + depth);
        c.closePath();
        const wash = c.createLinearGradient(
          0,
          Math.min(s.a.y, s.b.y),
          0,
          Math.max(s.a.y, s.b.y) + depth,
        );
        if (exposure.direct > 0.15) {
          wash.addColorStop(
            0,
            `rgba(255,184,100,${exposure.direct * (0.22 + light.dusk * 0.55)})`,
          );
          wash.addColorStop(
            1,
            `rgba(178,91,62,${exposure.direct * light.dusk * 0.25})`,
          );
        } else {
          wash.addColorStop(0, `rgba(41,57,88,${0.08 + light.dusk * 0.22})`);
          wash.addColorStop(1, `rgba(26,42,72,${0.14 + light.dusk * 0.24})`);
        }
        c.fillStyle = wash;
        c.fill();
      }
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
        if (
          plate.top + plate.height < camera.y - halfH ||
          plate.top > camera.y + halfH
        )
          continue;
        const first = Math.ceil(
          (camera.x - halfW - plate.left - plate.width) / world.w,
        );
        const last = Math.floor((camera.x + halfW - plate.left) / world.w);
        for (let copy = first; copy <= last; copy++)
          for (const sample of blend) {
            if (sample.alpha <= 0.001) continue;
            c.globalAlpha = alpha * sample.alpha;
            c.drawImage(
              plate.buckets[sample.bucket],
              plate.left + copy * world.w,
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
