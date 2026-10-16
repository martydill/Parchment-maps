import {
  planUnderwaterSites,
  sampleUnderwaterVeil,
  underwaterNoise,
} from "./core/underwater.js";
import { nearestWrapped } from "./core/math.js";
import { MAP_TILT_COS } from "./core/projection.js";

const PLATE_SIZE = 192;
const TAU = Math.PI * 2;

function ellipse(c, x, y, rx, ry, angle = 0) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, angle, 0, TAU);
  c.fill();
}

function reef(c, noise) {
  // Unequal coral heads, eroded ledges, and branching fans; no repeated stamp.
  for (let i = 0; i < 23; i++) {
    const x = (noise(i, 1) - 0.5) * 112;
    const y = (noise(i, 2) - 0.5) * 83;
    const size = 5 + noise(i, 3) * 15;
    c.fillStyle = i % 3 ? "#244f4e" : "#466657";
    c.beginPath();
    for (let j = 0; j < 11; j++) {
      const a = (j / 10) * TAU;
      const r = size * (0.67 + noise(i * 11 + j, 4) * 0.4);
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r * 0.7;
      if (j === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
    c.strokeStyle = "#90a286";
    c.lineWidth = 1.2;
    c.beginPath();
    c.ellipse(x - 1, y - 2, size * 0.67, size * 0.38, 0, 3.3, 5.8);
    c.stroke();
  }
  c.strokeStyle = "#254c48";
  c.lineCap = "round";
  for (let i = 0; i < 7; i++) {
    const x = (noise(i, 10) - 0.5) * 105;
    const y = (noise(i, 11) - 0.5) * 85;
    c.lineWidth = 2.1;
    c.beginPath();
    c.moveTo(x, y + 13);
    c.bezierCurveTo(x - 4, y + 2, x + 2, y - 7, x, y - 18);
    for (const side of [-1, 1]) {
      c.moveTo(x, y + 3);
      c.quadraticCurveTo(x + side * 13, y, x + side * 15, y - 12);
      c.moveTo(x, y - 7);
      c.lineTo(x + side * 9, y - 17);
    }
    c.stroke();
  }
}

function kelp(c, noise) {
  for (let i = 0; i < 25; i++) {
    const x = (noise(i, 1) - 0.5) * 112;
    const y = (noise(i, 2) - 0.5) * 61 + 24;
    const height = 19 + noise(i, 3) * 43;
    const bend = (noise(i, 4) - 0.5) * 20;
    c.strokeStyle = "#254f45";
    c.lineWidth = 1.3;
    c.beginPath();
    c.moveTo(x, y);
    c.bezierCurveTo(
      x - bend,
      y - height * 0.35,
      x + bend * 2,
      y - height * 0.7,
      x + bend,
      y - height,
    );
    c.stroke();
    c.fillStyle = i % 3 ? "#31594a" : "#54715a";
    for (let leaf = 1; leaf < 6; leaf++) {
      const t = leaf / 6;
      const px = x + Math.sin(t * Math.PI * 2) * bend * 0.65;
      const py = y - height * t;
      const side = leaf % 2 ? 1 : -1;
      c.beginPath();
      c.moveTo(px, py);
      c.quadraticCurveTo(px + side * 15, py - 1, px + side * 9, py - 12);
      c.quadraticCurveTo(px + side * 2, py - 12, px, py);
      c.fill();
    }
  }
}

function ruins(c, noise) {
  c.lineJoin = "miter";
  c.fillStyle = "#3d6059";
  c.fillRect(-49, -34, 96, 65);
  c.clearRect(-40, -25, 78, 47);
  // Missing wall sections and fallen columns break the architectural outline.
  c.clearRect(20, -38, 19, 20);
  c.clearRect(-54, 5, 20, 13);
  c.fillStyle = "#234d4b";
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 6; col++) {
      if ((row + col) % 5 === 2) continue;
      const x = -36 + col * 14;
      const y = -20 + row * 36;
      c.fillRect(x + 2, y + 3, 7, 9);
      c.fillStyle = "#778b75";
      c.fillRect(x - 1, y - 2, 10, 5);
      c.fillStyle = "#234d4b";
      ellipse(c, x + 3, y + 2, 3.4, 3);
    }
  }
  c.fillRect(-22, -9, 5, 24);
  c.fillRect(-22, 10, 39, 5);
  c.strokeStyle = "#83947c";
  c.lineWidth = 1.3;
  c.beginPath();
  c.moveTo(-48, -33);
  c.lineTo(16, -33);
  c.moveTo(-48, -33);
  c.lineTo(-48, -2);
  c.stroke();
  c.save();
  c.translate(27, 1);
  c.rotate(0.48);
  c.fillStyle = "#32574f";
  c.fillRect(-4, -17, 8, 30);
  c.fillStyle = "#89957d";
  c.fillRect(-4, -17, 2, 28);
  c.restore();
  for (let i = 0; i < 22; i++) {
    c.fillStyle = i % 2 ? "#46695b" : "#2d5350";
    const x = (noise(i, 3) - 0.5) * 123;
    const y = (noise(i, 4) - 0.5) * 90;
    c.fillRect(x, y, 3 + noise(i, 5) * 6, 2 + noise(i, 6) * 4);
  }
}

function wreck(c, noise) {
  // A split, tapered hull with exposed ribs, broken keel, and a fallen mast.
  c.fillStyle = "#244d49";
  c.beginPath();
  c.moveTo(-62, 0);
  c.bezierCurveTo(-40, -25, 32, -29, 58, -7);
  c.lineTo(52, 13);
  c.bezierCurveTo(14, 27, -37, 22, -62, 0);
  c.fill();
  c.globalCompositeOperation = "destination-out";
  c.beginPath();
  c.moveTo(-49, 0);
  c.bezierCurveTo(-21, -16, 24, -19, 46, -5);
  c.bezierCurveTo(27, 13, -22, 17, -49, 0);
  c.fill();
  c.fillRect(9, -29, 13, 25);
  c.fillRect(-26, 7, 14, 20);
  c.globalCompositeOperation = "source-over";
  c.strokeStyle = "#2a514b";
  c.lineWidth = 3;
  for (let i = 0; i < 10; i++) {
    const x = -43 + i * 9;
    const width = 8 + Math.sin(((i + 1) / 12) * Math.PI) * 9;
    c.beginPath();
    c.moveTo(x - 3, -width);
    c.quadraticCurveTo(x + 6, -2, x - 2, width * (i === 4 ? 0.3 : 0.9));
    c.stroke();
  }
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-50, 1);
  c.lineTo(40, -1);
  c.moveTo(-8, -5);
  c.lineTo(37, 42);
  c.moveTo(7, 24);
  c.lineTo(33, 7);
  c.stroke();
  c.strokeStyle = "#8c997d";
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(-49, -8);
  c.bezierCurveTo(-22, -23, 10, -23, 35, -16);
  c.stroke();
  for (let i = 0; i < 13; i++) {
    c.fillStyle = "#37594e";
    ellipse(
      c,
      (noise(i, 4) - 0.5) * 110,
      23 + noise(i, 5) * 20,
      2 + noise(i, 6) * 3,
      1.5,
    );
  }
}

function bakeSite(site) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = PLATE_SIZE;
  const c = canvas.getContext("2d");
  const noise = (i, salt) => underwaterNoise(site.seed * 37 + i, salt);
  c.translate(PLATE_SIZE / 2, PLATE_SIZE / 2);
  c.rotate(site.angle);
  ({ reef, kelp, ruins, wreck })[site.kind](c, noise);
  // Sediment softens the silhouette edges and settles into the broken forms.
  c.globalCompositeOperation = "source-atop";
  for (let i = 0; i < 100; i++) {
    c.fillStyle = i % 3 ? "rgba(156,177,139,0.22)" : "rgba(13,57,57,0.2)";
    ellipse(
      c,
      (noise(i, 20) - 0.5) * 155,
      (noise(i, 21) - 0.5) * 155,
      0.5 + noise(i, 22) * 2,
      0.7,
    );
  }
  return canvas;
}

export function createUnderwaterRendering({
  WORLD,
  lands,
  shoals = [],
  visibleCoasts,
  clipWater,
}) {
  const sites = planUnderwaterSites(WORLD, lands, shoals);
  const plates = new Map();
  return {
    draw(c, options) {
      const { camera, vw, vh, detail = 1 } = options;
      const halfW = vw / (2 * camera.zoom);
      const halfH = vh / (2 * camera.zoom * MAP_TILT_COS);
      const visible = [];
      const region = {
        left: Infinity,
        right: -Infinity,
        top: Infinity,
        bottom: -Infinity,
      };
      for (const site of sites) {
        if (Math.abs(site.y - camera.y) > halfH + site.radius) continue;
        const base = nearestWrapped(site.x, camera.x, WORLD.w);
        const left = camera.x - halfW - site.radius;
        const right = camera.x + halfW + site.radius;
        const first = base + Math.ceil((left - base) / WORLD.w) * WORLD.w;
        if (first > right) continue;
        // Dark water needs neither a plate nor a coastline clip. This sample
        // was previously repeated after collecting every visible world copy.
        if (
          sampleUnderwaterVeil(site, 0, options.time, WORLD.w, options).alpha <
          0.001
        )
          continue;
        for (let x = first; x <= right; x += WORLD.w) {
          visible.push({ site, x });
          // Refraction moves a strip by at most 2.925 world units. Include
          // that shift and a screen pixel for filtering at the plate edge.
          const margin = site.radius + 3 + 1 / camera.zoom;
          region.left = Math.min(region.left, x - margin);
          region.right = Math.max(region.right, x + margin);
          const verticalMargin = site.radius + 1 / (camera.zoom * MAP_TILT_COS);
          region.top = Math.min(region.top, site.y - verticalMargin);
          region.bottom = Math.max(region.bottom, site.y + verticalMargin);
        }
      }
      if (!visible.length) return;
      c.save();
      // Scissor the inverse coastline masks to the submerged artwork rather
      // than rasterizing them across the entire Retina canvas.
      clipWater(c, visibleCoasts(camera, vw, vh), region);
      const inheritedAlpha = c.globalAlpha;
      const strips = detail < 0.7 ? 12 : detail < 0.9 ? 20 : 32;
      const pixels = PLATE_SIZE / strips;
      const edge = 1 / (camera.zoom * MAP_TILT_COS);
      const top = camera.y - halfH - edge;
      const bottom = camera.y + halfH + edge;
      for (const { site, x } of visible) {
        if (!plates.has(site)) {
          if (plates.size >= 96) plates.delete(plates.keys().next().value);
          plates.set(site, bakeSite(site));
        }
        const plate = plates.get(site);
        const span = site.radius * 2;
        const stripHeight = span / strips;
        const first = Math.max(
          0,
          Math.floor((top - site.y + site.radius) / stripHeight),
        );
        const last = Math.min(
          strips,
          Math.ceil((bottom - site.y + site.radius) / stripHeight),
        );
        for (let strip = first; strip < last; strip++) {
          const y = (strip / strips - 0.5) * span;
          const veil = sampleUnderwaterVeil(
            site,
            y,
            options.time,
            WORLD.w,
            options,
          );
          c.globalAlpha = inheritedAlpha * veil.alpha;
          c.drawImage(
            plate,
            0,
            strip * pixels,
            PLATE_SIZE,
            pixels,
            x - site.radius + veil.shift,
            site.y + y,
            span,
            span / strips,
          );
        }
      }
      c.restore();
    },
  };
}
