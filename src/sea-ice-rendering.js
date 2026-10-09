import { createWrappedPolygonLookup } from "./core/geometry.js";
import { nearestWrapped } from "./core/math.js";
import { terrainBiome } from "./core/terrain.js";
import {
  planSeaIce,
  seaIceAtPosition,
  seaIceFloe,
  seaIceStrength,
} from "./core/sea-ice.js";
import { MAP_TILT_COS } from "./core/projection.js";
import { seasonalAppearance } from "./core/seasons.js";

function floeStamp(variant) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const c = canvas.getContext("2d");
  const path = (dx, dy) => {
    c.beginPath();
    for (let i = 0; i < 9; i++) {
      const angle = (i * Math.PI * 2) / 8;
      const radius = 44 + Math.sin(i * 2.7 + variant) * 7;
      const x = 64 + Math.cos(angle) * radius + dx;
      const y = 60 + Math.sin(angle) * radius * 0.76 + dy;
      if (i) c.lineTo(x, y);
      else c.moveTo(x, y);
    }
    c.closePath();
  };
  path(3, 7);
  c.fillStyle = "rgba(27,57,72,.3)";
  c.fill();
  path(0, 4);
  c.fillStyle = "#658a9e";
  c.fill();
  path(0, 0);
  const wash = c.createLinearGradient(25, 25, 100, 100);
  wash.addColorStop(0, "#f3f8f6");
  wash.addColorStop(1, "#b3d1da");
  c.fillStyle = wash;
  c.fill();
  c.strokeStyle = "rgba(248,255,254,.85)";
  c.lineWidth = 2;
  c.stroke();
  c.strokeStyle = "rgba(66,108,128,.35)";
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(34, 50);
  c.lineTo(63, 60);
  c.lineTo(81, 43);
  c.moveTo(63, 60);
  c.lineTo(71, 77);
  c.stroke();
  return canvas;
}

export function createSeaIceRendering({ world, lands, ports, biomeAt }) {
  const isOnLand = createWrappedPolygonLookup(
    lands.map((land) => land.poly),
    world.w,
  );
  const floes = planSeaIce({
    world,
    isOnLand,
    biomeAt,
    ports,
    coastlines: lands.map((land) => land.poly),
  });
  const columns = Math.ceil(world.w / 150);
  const spacing = world.w / columns;
  const cells = new Map();
  for (const floe of floes) {
    const key = `${Math.floor(floe.x / spacing)}:${Math.floor(floe.y / 150)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(floe);
  }
  const stamps = [];
  // Coast geometry is static; frost strokes are painted once into local plates.
  const rims = lands
    .filter((land) => seaIceStrength(83, terrainBiome(land.name)) > 0)
    .map((land) => {
      const left = Math.min(...land.poly.map((p) => p[0])) - 12;
      const top = Math.min(...land.poly.map((p) => p[1])) - 12;
      const width = Math.max(...land.poly.map((p) => p[0])) - left + 12;
      const height = Math.max(...land.poly.map((p) => p[1])) - top + 12;
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(width * 0.5);
      canvas.height = Math.ceil(height * 0.5);
      const c = canvas.getContext("2d");
      c.scale(0.5, 0.5);
      c.translate(-left, -top);
      c.beginPath();
      land.poly.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
      c.strokeStyle = "rgba(116,168,188,.3)";
      c.lineWidth = 17;
      c.stroke();
      c.strokeStyle = "rgba(232,249,248,.8)";
      c.lineWidth = 6;
      c.stroke();
      c.setLineDash([3, 6, 9, 4]);
      c.strokeStyle = "rgba(255,255,250,.85)";
      c.lineWidth = 9;
      c.stroke();
      return {
        canvas,
        left,
        top,
        width,
        height,
        biome: terrainBiome(land.name),
      };
    });
  return {
    at(position, day, time) {
      if (!seaIceStrength(day, "alpine"))
        return { exposure: 0, speedMultiplier: 1 };
      const column = Math.floor(
        (((position.x % world.w) + world.w) % world.w) / spacing,
      );
      const row = Math.floor(position.y / 150);
      let exposure = 0;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const key = `${(column + dx + columns) % columns}:${row + dy}`;
          const sample = seaIceAtPosition(
            position,
            cells.get(key) || [],
            day,
            time,
            world.w,
          );
          exposure = Math.max(exposure, sample.exposure);
        }
      }
      return { exposure, speedMultiplier: 1 - exposure * 0.72 };
    },
    draw(c, { camera, vw, vh, day, time }) {
      if (!seasonalAppearance(day, "alpine").snow) return;
      const halfW = vw / (2 * camera.zoom),
        halfH = vh / (2 * camera.zoom * MAP_TILT_COS);
      c.save();
      const alpha = c.globalAlpha;
      for (const rim of rims) {
        const x =
          nearestWrapped(rim.left + rim.width / 2, camera.x, world.w) -
          rim.width / 2;
        if (
          x + rim.width < camera.x - halfW ||
          x > camera.x + halfW ||
          rim.top + rim.height < camera.y - halfH ||
          rim.top > camera.y + halfH
        )
          continue;
        c.globalAlpha =
          alpha *
          seasonalAppearance(day, rim.biome).snow *
          (0.3 + seaIceStrength(day, rim.biome) * 0.7);
        c.drawImage(rim.canvas, x, rim.top, rim.width, rim.height);
      }
      for (const source of floes) {
        const floe = seaIceFloe(source, day, time, world.w);
        const x = nearestWrapped(floe.x, camera.x, world.w);
        const r = floe.radius * 1.4;
        if (
          r === 0 ||
          Math.abs(x - camera.x) > halfW + r ||
          Math.abs(floe.y - camera.y) > halfH + r
        )
          continue;
        const variant = source.seed % 4;
        stamps[variant] ||= floeStamp(variant);
        c.save();
        c.globalAlpha = alpha * Math.min(1, floe.strength * 2);
        c.translate(x, floe.y);
        c.rotate(floe.angle + variant * 0.4);
        c.drawImage(stamps[variant], -r, -r, r * 2, r * 2);
        c.restore();
      }
      c.restore();
    },
  };
}
