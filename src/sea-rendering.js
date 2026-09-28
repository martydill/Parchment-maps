import { nearestWrapped } from "./core/math.js";
import { MAP_TILT_COS, MAP_TILT_TAN } from "./core/projection.js";
import {
  buildWakeRibbon,
  coastFaceDepth,
  sampleCoastalBird,
  sampleCreatureAppearance,
} from "./core/seascape.js";

// All expensive coastline work is done once. Per-frame work is limited to the
// visible part of the chart, with no extra world-sized animation canvases.
export function createSeaRendering({
  WORLD,
  lands,
  currents = [],
  creatures = [],
}) {
  let riverPaths = [];
  const coasts = lands.map(({ poly, satellite }, index) => {
    const depth = coastFaceDepth(index, satellite) * MAP_TILT_TAN;
    const xs = poly.map(([x]) => x);
    const ys = poly.map(([, y]) => y);
    const bounds = {
      left: Math.min(...xs),
      right: Math.max(...xs),
      top: Math.min(...ys),
      bottom: Math.max(...ys) + depth,
    };
    // Exclude both the land top and its raised cliff face from moving water.
    const masks = [0, depth].map((drop) => {
      const path = new Path2D();
      path.rect(-WORLD.w, -WORLD.h, WORLD.w * 3, WORLD.h * 3);
      poly.forEach(([x, y], i) =>
        i ? path.lineTo(x, y + drop) : path.moveTo(x, y + drop),
      );
      path.closePath();
      return path;
    });
    const land = new Path2D();
    poly.forEach(([x, y], i) => (i ? land.lineTo(x, y) : land.moveTo(x, y)));
    land.closePath();
    const surf = new Path2D();
    poly.forEach(([x, y], i) =>
      i ? surf.lineTo(x, y + depth) : surf.moveTo(x, y + depth),
    );
    surf.closePath();
    let signedArea = 0;
    poly.forEach(([x, y], i) => {
      const [nextX, nextY] = poly[(i + 1) % poly.length];
      signedArea += x * nextY - nextX * y;
    });
    const facing = Math.sign(signedArea) || 1;
    const foam = [];
    let distanceSinceSample = 0;
    for (let i = 0; i < poly.length; i++) {
      const [x, y] = poly[i];
      const [nextX, nextY] = poly[(i + 1) % poly.length];
      const dx = nextX - x;
      const dy = nextY - y;
      const length = Math.hypot(dx, dy);
      if (length < 0.01) continue;
      distanceSinceSample += length;
      if (distanceSinceSample < 25) continue;
      distanceSinceSample = 0;
      foam.push({
        x: (x + nextX) / 2,
        y: (y + nextY) / 2 + depth,
        tx: dx / length,
        ty: dy / length,
        nx: (facing * dy) / length,
        ny: (-facing * dx) / length,
        phase: i * 1.73 + index * 2.31,
      });
    }
    const flocks = satellite
      ? []
      : [0.16, 0.48, 0.8]
          .map((fraction, flockIndex) => {
            const mark = foam[Math.floor(foam.length * fraction)];
            return mark
              ? {
                  x: mark.x + mark.nx * 48,
                  y: mark.y + mark.ny * 48,
                  index: index * 3 + flockIndex,
                }
              : null;
          })
          .filter(Boolean);
    return { bounds, masks, land, surf, foam, flocks, index };
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

  function drawCurrentFlow(c, camera, time, roughness, halfW, halfH) {
    for (const [x, y, angle] of currents) {
      const nearestX = nearestWrapped(x, camera.x, WORLD.w);
      if (
        Math.abs(nearestX - camera.x) > halfW + 230 ||
        Math.abs(y - camera.y) > halfH + 230
      )
        continue;
      c.save();
      c.translate(nearestX, y);
      c.rotate(angle);
      c.lineCap = "round";
      for (let lane = -3; lane <= 3; lane++) {
        const cross = lane * 27;
        const drift = Math.sin(time * 0.3 + lane * 1.9) * 5;
        c.beginPath();
        c.moveTo(-205, cross + drift);
        c.bezierCurveTo(-70, cross - 18, 70, cross + 20, 205, cross + drift);
        c.strokeStyle = `rgba(38,104,107,${0.055 + (3 - Math.abs(lane)) * 0.009})`;
        c.lineWidth = 7 + roughness * 2;
        c.stroke();
        c.setLineDash([19, 23, 4, 42]);
        c.lineDashOffset = -time * (13 + roughness * 13) - lane * 31;
        c.strokeStyle = `rgba(238,236,193,${0.2 + (3 - Math.abs(lane)) * 0.035})`;
        c.lineWidth = 1.4 / camera.zoom;
        c.stroke();
      }
      c.setLineDash([]);
      c.restore();
    }
  }

  function drawCreature(c, x, y, scale, index, time) {
    const { rise, phase } = sampleCreatureAppearance(time * 1000, index);
    if (rise <= 0.02) return;
    const kind = index % 3;
    c.save();
    c.translate(x + Math.sin(phase * 0.5 + index) * 16, y);
    c.rotate(Math.sin(index * 4.1) * 0.32);
    c.scale(scale, scale);
    c.lineCap = "round";
    c.strokeStyle = `rgba(246,237,195,${rise * 0.48})`;
    c.lineWidth = 1.8;
    for (const ring of [0, 1]) {
      c.beginPath();
      c.ellipse(
        0,
        5,
        21 + ring * 15 + phase * 1.8,
        8 + ring * 5,
        0,
        0,
        Math.PI * 2,
      );
      c.stroke();
    }
    c.fillStyle = `rgba(39,66,66,${rise * 0.7})`;
    c.strokeStyle = `rgba(31,45,39,${rise * 0.8})`;
    c.lineWidth = 1.5;
    if (kind === 0) {
      // A whale's back breaks the surface, then a brief ivory spout follows.
      c.beginPath();
      c.moveTo(-32, 5);
      c.bezierCurveTo(-23, -14 * rise, 11, -16 * rise, 30, 5);
      c.quadraticCurveTo(1, 12, -32, 5);
      c.fill();
      c.stroke();
      c.beginPath();
      c.moveTo(-5, -8 * rise);
      c.lineTo(1, -18 * rise);
      c.lineTo(9, -8 * rise);
      c.fill();
      if (phase > 2 && phase < 4.5) {
        c.strokeStyle = `rgba(247,239,205,${rise * 0.68})`;
        c.beginPath();
        c.moveTo(13, -10);
        c.quadraticCurveTo(20, -28 - rise * 13, 13, -36 - rise * 15);
        c.moveTo(13, -36 - rise * 15);
        c.lineTo(5, -41 - rise * 15);
        c.moveTo(13, -36 - rise * 15);
        c.lineTo(22, -42 - rise * 15);
        c.stroke();
      }
    } else if (kind === 1) {
      // Paired dolphins arc through the surf at slightly different heights.
      for (const [dx, dy, size] of [
        [-13, 0, 1],
        [18, 8, 0.68],
      ]) {
        c.save();
        c.translate(dx, dy - rise * 24 * size);
        c.scale(size, size);
        c.beginPath();
        c.moveTo(-18, 3);
        c.quadraticCurveTo(-2, -10, 16, -2);
        c.quadraticCurveTo(8, 7, -18, 3);
        c.fill();
        c.stroke();
        c.beginPath();
        c.moveTo(-2, -5);
        c.lineTo(1, -14);
        c.lineTo(7, -4);
        c.fill();
        c.beginPath();
        c.moveTo(-17, 2);
        c.lineTo(-24, -3);
        c.moveTo(-17, 2);
        c.lineTo(-24, 8);
        c.stroke();
        c.restore();
      }
    } else {
      // A dark dorsal fin with a bright line of spray.
      c.beginPath();
      c.moveTo(-25, 5);
      c.quadraticCurveTo(-2, 0, 2, -24 * rise);
      c.quadraticCurveTo(14, -6 * rise, 24, 5);
      c.closePath();
      c.fill();
      c.stroke();
      c.strokeStyle = `rgba(238,235,191,${rise * 0.72})`;
      c.beginPath();
      c.moveTo(-17, 0);
      c.quadraticCurveTo(1, -4, 19, 1);
      c.stroke();
    }
    c.restore();
  }

  function drawRiverFlow(c, visible, time, zoom) {
    c.save();
    c.lineCap = "round";
    for (const { land, index, offset } of visible) {
      const rivers = riverPaths[index];
      if (!rivers?.length) continue;
      c.save();
      c.translate(offset, 0);
      c.clip(land);
      c.strokeStyle = "rgba(225,236,199,.65)";
      c.lineWidth = 1.2 / zoom;
      c.setLineDash([5, 13]);
      c.lineDashOffset = -time * 15;
      for (const river of rivers) {
        if (river.length < 2) continue;
        c.beginPath();
        c.moveTo(river[0].x, river[0].y);
        for (let i = 1; i < river.length - 1; i++) {
          const a = river[i],
            b = river[i + 1];
          c.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
        }
        c.lineTo(river.at(-1).x, river.at(-1).y);
        c.stroke();
      }
      c.restore();
    }
    c.restore();
  }

  function drawCoastalBirds(c, visible, time, zoom) {
    c.save();
    c.lineCap = "round";
    c.lineJoin = "round";
    for (const { flocks, offset } of visible) {
      for (const flock of flocks) {
        for (let bird = 0; bird < 5; bird++) {
          const pose = sampleCoastalBird(time, flock.index, bird);
          const x = flock.x + offset + pose.x;
          const y = flock.y + pose.y;
          const wingHeight = pose.size * (0.55 + pose.wing * 0.4);
          c.fillStyle = "rgba(34,58,51,.12)";
          c.beginPath();
          c.ellipse(x + 7, y + 15, pose.size * 0.75, 1.9, 0, 0, Math.PI * 2);
          c.fill();
          c.strokeStyle = "rgba(35,42,34,.72)";
          c.lineWidth = 1.45 / zoom;
          c.beginPath();
          c.moveTo(x - pose.size, y);
          c.quadraticCurveTo(x - pose.size * 0.5, y - wingHeight, x, y);
          c.quadraticCurveTo(
            x + pose.size * 0.5,
            y - wingHeight,
            x + pose.size,
            y,
          );
          c.stroke();
          c.strokeStyle = "rgba(248,239,198,.43)";
          c.lineWidth = 0.55 / zoom;
          c.beginPath();
          c.moveTo(x - pose.size * 0.75, y - 0.6);
          c.lineTo(x - pose.size * 0.2, y - wingHeight * 0.47);
          c.stroke();
        }
      }
    }
    c.restore();
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
    drawCurrentFlow(c, camera, t, roughness, halfW, halfH);
    creatures.forEach(([x, y, scale], index) => {
      const nearestX = nearestWrapped(x, camera.x, WORLD.w);
      if (
        Math.abs(nearestX - camera.x) <= halfW + 60 &&
        Math.abs(y - camera.y) <= halfH + 60
      )
        drawCreature(c, nearestX, y, scale, index, t);
    });
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
    for (const { foam, offset } of visible) {
      c.save();
      c.translate(offset, 0);
      c.lineCap = "round";
      for (const mark of foam) {
        const pulse = (Math.sin(t * 2.3 + mark.phase) + 1) * 0.5;
        if (pulse < 0.28) continue;
        const reach = 3 + pulse * (8 + roughness * 6);
        const x = mark.x + mark.nx * reach;
        const y = mark.y + mark.ny * reach;
        c.strokeStyle = `rgba(255,244,206,${(pulse - 0.28) * 0.55})`;
        c.lineWidth = (0.8 + pulse * 1.2) / z;
        c.beginPath();
        c.moveTo(x - mark.tx * 6, y - mark.ty * 6);
        c.quadraticCurveTo(
          x + mark.nx * 3,
          y + mark.ny * 3,
          x + mark.tx * 6,
          y + mark.ty * 6,
        );
        c.stroke();
        if (pulse > 0.8) {
          c.fillStyle = `rgba(255,247,213,${(pulse - 0.8) * 1.8})`;
          c.beginPath();
          c.arc(x + mark.nx * 5, y + mark.ny * 5, 1.2 / z, 0, Math.PI * 2);
          c.fill();
        }
      }
      c.restore();
    }
    c.restore();
    drawRiverFlow(c, visible, t, z);
    drawCoastalBirds(c, visible, t, z);
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
  return {
    drawSurface,
    drawWake,
    setRivers(paths) {
      riverPaths = paths;
    },
  };
}
