import { nearestWrapped } from "./core/math.js";
import { MAP_TILT_COS, MAP_TILT_TAN } from "./core/projection.js";
import { buildWakeRibbon } from "./core/seascape.js";

// All expensive coastline work is done once. Per-frame work is limited to the
// visible part of the chart, with no extra world-sized animation canvases.
export function createSeaRendering({ WORLD, lands }) {
  const coasts = lands.map(({ poly }) => {
    const xs = poly.map(([x]) => x);
    const ys = poly.map(([, y]) => y);
    const bounds = {
      left: Math.min(...xs),
      right: Math.max(...xs),
      top: Math.min(...ys),
      bottom: Math.max(...ys) + 38 * MAP_TILT_TAN,
    };
    // Exclude both the land top and its raised cliff face from moving water.
    const masks = [0, 38 * MAP_TILT_TAN].map((depth) => {
      const path = new Path2D();
      path.rect(-WORLD.w, -WORLD.h, WORLD.w * 3, WORLD.h * 3);
      poly.forEach(([x, y], i) =>
        i ? path.lineTo(x, y + depth) : path.moveTo(x, y + depth),
      );
      path.closePath();
      return path;
    });
    const surf = new Path2D();
    poly.forEach(([x, y], i) =>
      i
        ? surf.lineTo(x, y + 38 * MAP_TILT_TAN)
        : surf.moveTo(x, y + 38 * MAP_TILT_TAN),
    );
    surf.closePath();
    return { bounds, masks, surf };
  });

  function visibleCoasts(camera, vw, vh) {
    const halfW = vw / (2 * camera.zoom) + 80;
    const halfH = vh / (2 * camera.zoom * MAP_TILT_COS) + 80;
    const visible = [];
    for (const coast of coasts) {
      const { bounds } = coast;
      const center = (bounds.left + bounds.right) / 2;
      const base = Math.round((camera.x - center) / WORLD.w) * WORLD.w;
      for (const offset of [base - WORLD.w, base, base + WORLD.w]) {
        if (
          bounds.right + offset < camera.x - halfW ||
          bounds.left + offset > camera.x + halfW ||
          bounds.bottom < camera.y - halfH ||
          bounds.top > camera.y + halfH
        )
          continue;
        visible.push({ ...coast, offset });
      }
    }
    return visible;
  }

  function clipWater(c, visible) {
    for (const { masks, offset } of visible) {
      c.translate(offset, 0);
      for (const mask of masks) c.clip(mask, "evenodd");
      c.translate(-offset, 0);
    }
  }

  function drawSurface(
    c,
    { camera, vw, vh, time, roughness, windAngle, reducedMotion },
  ) {
    const visible = visibleCoasts(camera, vw, vh);
    c.save();
    // Do not constrain longitude: the atlas wraps indefinitely.
    clipWater(c, visible);
    const t = reducedMotion ? 0 : time / 1000;
    const z = camera.zoom;
    const halfW = vw / (2 * z) + 100;
    const halfH = vh / (2 * z * MAP_TILT_COS) + 60;
    // Periodic longitude coordinates keep phase and spacing continuous at the
    // world seam. Broad swells carry finer broken ivory glints.
    const columns = Math.ceil(WORLD.w / 95);
    const spacing = WORLD.w / columns;
    const left = Math.floor((camera.x - halfW) / spacing);
    const right = Math.ceil((camera.x + halfW) / spacing);
    const top = Math.max(1, Math.floor((camera.y - halfH) / 48));
    const bottom = Math.min(
      Math.floor((WORLD.h - 30) / 48),
      Math.ceil((camera.y + halfH) / 48),
    );
    c.lineCap = "round";
    for (let row = top; row <= bottom; row++) {
      for (let column = left; column <= right; column++) {
        const canonical = ((column % columns) + columns) % columns;
        const phase = canonical * 2.39 + row * 1.73;
        const pulse = (Math.sin(t * (0.6 + roughness * 0.4) + phase) + 1) / 2;
        const x =
          column * spacing +
          Math.sin(row * 12.7) * 25 +
          Math.cos(t * 0.28 + phase) * 5;
        const y =
          row * 48 + Math.sin(phase * 3) * 16 + Math.sin(t * 0.48 + phase) * 3;
        const length = 18 + (Math.sin(phase) + 1) * 15;
        c.save();
        c.translate(x, y);
        c.rotate(Math.sin(windAngle) * 0.12);
        c.strokeStyle = `rgba(37,81,78,${0.035 + pulse * 0.065})`;
        c.lineWidth = 3.5;
        c.beginPath();
        c.moveTo(-length, 3);
        c.bezierCurveTo(-length * 0.3, -2, length * 0.4, 7, length, 1);
        c.stroke();
        c.strokeStyle = `rgba(247,237,197,${0.06 + pulse ** 3 * (0.22 + roughness * 0.12)})`;
        c.lineWidth = 0.8 / z;
        c.beginPath();
        c.moveTo(-length * 0.8, 0);
        c.bezierCurveTo(
          -length * 0.35,
          -3,
          length * 0.25,
          3,
          length * 0.72,
          -1,
        );
        c.stroke();
        if (pulse > 0.65) {
          c.globalAlpha = (pulse - 0.65) * 1.8;
          c.beginPath();
          c.moveTo(-length * 0.2, 5);
          c.lineTo(length * 0.45, 6);
          c.stroke();
        }
        c.restore();
      }
    }
    for (const { surf, offset } of visible) {
      c.save();
      c.translate(offset, 0);
      c.lineJoin = "round";
      for (let layer = 0; layer < 2; layer++) {
        const pulse = (t * 0.16 + layer * 0.5) % 1;
        c.strokeStyle = `rgba(248,237,195,${Math.sin(pulse * Math.PI) * 0.22})`;
        c.lineWidth = 4 + pulse * 16;
        c.setLineDash([12, 9, 3, 17]);
        c.lineDashOffset = -t * 2;
        c.stroke(surf);
      }
      c.restore();
    }
    c.restore();
  }

  function drawWake(c, trail, time, camera, vw, vh) {
    const sections = buildWakeRibbon(trail, time, WORLD.w);
    if (sections.length < 2) return;
    c.save();
    const visible = visibleCoasts(camera, vw, vh);
    clipWater(c, visible);
    const offset =
      nearestWrapped(sections[0].x, camera.x, WORLD.w) - sections[0].x;
    c.translate(offset, 0);
    c.lineCap = "round";
    for (let i = 1; i < sections.length; i++) {
      const a = sections[i - 1],
        b = sections[i];
      const angle = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
      const nx = Math.cos(angle),
        ny = Math.sin(angle);
      c.strokeStyle = `rgba(226,233,198,${b.alpha * 0.3})`;
      c.lineWidth = b.width * 2;
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(b.x, b.y);
      c.stroke();
      c.strokeStyle = `rgba(255,243,201,${b.alpha})`;
      c.lineWidth = 1.2 / camera.zoom;
      for (const side of [-1, 1]) {
        c.beginPath();
        c.moveTo(a.x + nx * a.width * side, a.y + ny * a.width * side);
        c.lineTo(b.x + nx * b.width * side, b.y + ny * b.width * side);
        c.stroke();
      }
    }
    c.restore();
  }
  return { drawSurface, drawWake };
}
