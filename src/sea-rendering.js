import { nearestWrapped } from "./core/math.js";
import { polygonContainsBounds } from "./core/geometry.js?v=3";
import { MAP_TILT_COS, MAP_TILT_TAN } from "./core/projection.js";
import { createAlphaPalette } from "./style-palette.js";
import { createRadialStamp } from "./radial-stamp.js";
import {
  buildWakeRibbon,
  coastalFlockSize,
  coastFaceDepth,
  sampleCoastalBird,
  sampleCreatureAppearance,
  sampleSeaLife,
  sampleShoreAnimal,
  sampleWaterReflection,
} from "./core/seascape.js";
import { getShipModelProfile } from "./core/ship-models.js";

const surfaceShadowStyle = createAlphaPalette("37,81,78", 0.035, 0.1);
// Finer opacity steps preserve the subtle response to daylight and storms.
const surfaceGlintStyle = createAlphaPalette("247,237,197", 0, 0.48, 128);
const surfStyle = createAlphaPalette("248,237,195", 0, 0.35);
const foamStrokeStyle = createAlphaPalette("255,244,206", 0, 0.62);
const foamFillStyle = createAlphaPalette("255,247,213", 0, 0.52);
const wakeStrokeStyle = createAlphaPalette("250,244,211", 0, 0.48, 128);
const wakeFillStyle = createAlphaPalette("255,249,221", 0, 0.48, 128);
const wakeBodyStyle = createAlphaPalette("26,87,86", 0, 0.14, 128);
const reflectionHullStyle = createAlphaPalette("31,66,61", 0, 0.32, 128);
const reflectionSailStyle = createAlphaPalette("244,224,177", 0, 0.38, 128);
const reflectionLampStyle = createAlphaPalette("255,206,124", 0, 0.65, 128);
const stormSeaStyle = createAlphaPalette("22,49,67", 0, 0.22, 128);
const currentShadowStyles = Array.from(
  { length: 4 },
  (_, strength) => `rgba(38,104,107,${0.055 + strength * 0.009})`,
);
const currentFoamStyles = Array.from(
  { length: 4 },
  (_, strength) => `rgba(238,236,193,${0.2 + strength * 0.035})`,
);

const shadowCurve = [-1, 3, -0.3, -2, 0.4, 7, 1, 1];
const glintCurve = [-0.8, 0, -0.35, -3, 0.25, 3, 0.72, -1];
const crestLine = [-0.2, 5, 0.45, 6];

function appendWaveMark(batches, style, shape, x, y, length) {
  let batch = batches.get(style);
  if (!batch) {
    batch = { points: [], count: 0 };
    batches.set(style, batch);
  }
  // Retain the numeric buffers between frames instead of allocating a path
  // or point object for each mark. Each curve starts its own subpath.
  for (let index = 0; index < shape.length; index += 2) {
    batch.points[batch.count++] = x + shape[index] * length;
    batch.points[batch.count++] = y + shape[index + 1];
  }
}

function strokeWaveBatches(c, batches, stride) {
  for (const [style, { points, count }] of batches) {
    if (!count) continue;
    c.strokeStyle = style;
    c.beginPath();
    for (let index = 0; index < count; index += stride) {
      c.moveTo(points[index], points[index + 1]);
      if (stride === 4) c.lineTo(points[index + 2], points[index + 3]);
      else
        c.bezierCurveTo(
          points[index + 2],
          points[index + 3],
          points[index + 4],
          points[index + 5],
          points[index + 6],
          points[index + 7],
        );
    }
    c.stroke();
  }
}

function wakeNoise(index, salt) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

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
    const animals = satellite
      ? []
      : [0.25, 0.67]
          .map((fraction, animalIndex) => {
            const mark = foam[Math.floor(foam.length * fraction)];
            return mark && (index + animalIndex) % 3 !== 0
              ? {
                  x: mark.x - mark.nx * 38,
                  y: mark.y - mark.ny * 38 - depth,
                  index: index * 2 + animalIndex,
                }
              : null;
          })
          .filter(Boolean);
    return { bounds, masks, land, surf, foam, flocks, animals, index, poly };
  });
  const surfaceMarks = new Map();
  const lightBandStamps = new Map();
  const waveShadows = new Map();
  const waveGlints = new Map();
  const waveCrests = new Map();
  function surfaceMark(row, column, columns, spacing, rowOffset) {
    const key = row * columns + column;
    if (surfaceMarks.has(key)) return surfaceMarks.get(key);
    const phase = column * 2.39 + row * 1.73;
    const x = column * spacing + rowOffset;
    const y = row * 48 + Math.sin(phase * 3) * 16;
    // Enclose both strokes and the crest through every phase and wind angle,
    // plus their maximum line widths and antialiasing at the minimum zoom.
    const hidden = coasts.some(({ bounds, poly }) => {
      const center = (bounds.left + bounds.right) / 2;
      const offset = Math.round((x - center) / WORLD.w) * WORLD.w;
      const box = {
        left: x - offset - 64,
        right: x - offset + 64,
        top: y - 24,
        bottom: y + 24,
      };
      if (
        box.left < bounds.left ||
        box.right > bounds.right ||
        box.top < bounds.top ||
        box.bottom > bounds.bottom
      )
        return false;
      return polygonContainsBounds(poly, box);
    });
    const mark = { phase, y, length: 18 + (Math.sin(phase) + 1) * 15, hidden };
    surfaceMarks.set(key, mark);
    return mark;
  }
  const seaLife = [];
  for (let row = 0; row < Math.floor(WORLD.h / 285); row++) {
    for (let column = 0; column < Math.floor(WORLD.w / 360); column++) {
      const index = row * Math.floor(WORLD.w / 360) + column;
      if (wakeNoise(index, 49) < 0.72) continue;
      seaLife.push({
        x: (column + 0.25 + wakeNoise(index, 50) * 0.5) * 360,
        y: (row + 0.25 + wakeNoise(index, 51) * 0.5) * 285,
        index,
        kind: index % 5,
      });
    }
  }

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
        c.strokeStyle = currentShadowStyles[3 - Math.abs(lane)];
        c.lineWidth = 7 + roughness * 2;
        c.stroke();
        c.setLineDash([19, 23, 4, 42]);
        c.lineDashOffset = -time * (13 + roughness * 13) - lane * 31;
        c.strokeStyle = currentFoamStyles[3 - Math.abs(lane)];
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
        for (let bird = 0; bird < coastalFlockSize(flock.index); bird++) {
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

  function drawSeaLife(c, camera, time, halfW, halfH) {
    for (const life of seaLife) {
      const x = nearestWrapped(life.x, camera.x, WORLD.w);
      if (
        Math.abs(x - camera.x) > halfW + 75 ||
        Math.abs(life.y - camera.y) > halfH + 75
      )
        continue;
      const pose = sampleSeaLife(time, life.index);
      if (pose.opacity <= 0) continue;
      c.save();
      c.translate(x + pose.x, life.y + pose.y);
      c.globalAlpha = pose.opacity * 0.8;
      c.lineCap = "round";
      c.strokeStyle = "rgba(35,65,62,.8)";
      c.fillStyle = "rgba(50,83,79,.65)";
      c.lineWidth = 1.2;
      if (life.kind < 3) {
        // Loose, staggered schools read as fish at both sailing and chart zoom.
        for (let fish = 0; fish < 7 + life.kind * 2; fish++) {
          const fx = (fish % 4) * 13 - 23 + Math.sin(fish * 4.1) * 5;
          const fy = Math.floor(fish / 4) * 11 - 12 + Math.cos(fish * 2.7) * 4;
          const sway = pose.swim * (1 + (fish % 3));
          c.beginPath();
          c.moveTo(fx - 6, fy);
          c.quadraticCurveTo(fx, fy - 4, fx + 7, fy + sway);
          c.quadraticCurveTo(fx, fy + 4, fx - 6, fy);
          c.fill();
          c.stroke();
          c.beginPath();
          c.moveTo(fx - 6, fy);
          c.lineTo(fx - 11, fy - 4 + sway);
          c.lineTo(fx - 11, fy + 4 + sway);
          c.closePath();
          c.fill();
        }
      } else if (life.kind === 3) {
        // A broad whale shadow, flukes, and a few broken surface glints.
        c.beginPath();
        c.moveTo(-34, 2);
        c.bezierCurveTo(-18, -13, 17, -13, 33, 0);
        c.bezierCurveTo(11, 13, -20, 14, -34, 2);
        c.fill();
        c.stroke();
        c.beginPath();
        c.moveTo(-33, 1);
        c.lineTo(-45, -10 + pose.swim * 2);
        c.lineTo(-42, 2);
        c.lineTo(-45, 13 + pose.swim * 2);
        c.closePath();
        c.fill();
        c.strokeStyle = "rgba(246,236,196,.62)";
        c.beginPath();
        c.moveTo(-12, -12);
        c.quadraticCurveTo(8, -19, 27, -9);
        c.stroke();
      } else {
        // A sea turtle with four paddling flippers and a scored shell.
        c.beginPath();
        c.ellipse(0, 0, 16, 11, 0, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.beginPath();
        c.arc(19, 0, 5, 0, Math.PI * 2);
        c.fill();
        for (const side of [-1, 1]) {
          c.beginPath();
          c.moveTo(-7, side * 8);
          c.quadraticCurveTo(-16, side * (20 + pose.swim * 3), -23, side * 19);
          c.moveTo(8, side * 8);
          c.quadraticCurveTo(17, side * (21 - pose.swim * 3), 19, side * 18);
          c.stroke();
        }
        c.strokeStyle = "rgba(232,216,168,.48)";
        c.beginPath();
        c.moveTo(-10, 0);
        c.lineTo(10, 0);
        c.moveTo(0, -9);
        c.lineTo(0, 9);
        c.stroke();
      }
      c.restore();
    }
  }

  function drawShoreAnimals(c, visible, time) {
    for (const { animals, land, offset } of visible) {
      if (!animals.length) continue;
      c.save();
      c.translate(offset, 0);
      c.clip(land);
      for (const animal of animals) {
        const pack =
          animal.index % 3 === 0 ? 3 : animal.index % 3 === 1 ? 2 : 1;
        for (let member = 0; member < pack; member++) {
          const pose = sampleShoreAnimal(time, animal.index + member);
          c.save();
          c.translate(
            animal.x + pose.x + member * 14,
            animal.y + pose.y + member * 7,
          );
          c.scale(pose.facing * (1 - member * 0.13), 1 - member * 0.13);
          c.fillStyle = "rgba(75,66,42,.76)";
          c.strokeStyle = "rgba(46,44,30,.86)";
          c.lineWidth = 1.2;
          c.beginPath();
          c.ellipse(0, 0, 10, 5, 0, 0, Math.PI * 2);
          c.fill();
          c.stroke();
          c.beginPath();
          c.moveTo(7, -2);
          c.lineTo(13, -7);
          c.lineTo(17, -5);
          c.lineTo(16, -1);
          c.lineTo(9, 2);
          c.fill();
          c.stroke();
          c.beginPath();
          for (const leg of [-6, 5]) {
            c.moveTo(leg, 3);
            c.lineTo(leg + pose.step * 1.5, 10);
          }
          c.stroke();
          if (animal.index % 2 === 0) {
            c.beginPath();
            c.moveTo(14, -7);
            c.lineTo(13, -14);
            c.lineTo(10, -17);
            c.moveTo(13, -13);
            c.lineTo(18, -17);
            c.stroke();
          } else {
            c.beginPath();
            c.moveTo(-9, -1);
            c.lineTo(-17, -4);
            c.stroke();
          }
          c.restore();
        }
      }
      c.restore();
    }
  }

  function drawSeaLightBands(c, camera, t, lighting, windAngle, halfW, halfH) {
    const daylight = lighting?.daylight ?? 1;
    const dusk = Math.max(lighting?.sunrise ?? 0, lighting?.sunset ?? 0);
    const storm = lighting?.storm ?? 0;
    const strength = (daylight * 0.1 + dusk * 0.055) * (1 - storm * 0.8);
    if (strength < 0.003) return;
    const columns = Math.ceil(WORLD.w / 360);
    const spacing = WORLD.w / columns;
    const left = Math.floor((camera.x - halfW - 220) / spacing);
    const right = Math.ceil((camera.x + halfW + 220) / spacing);
    const top = Math.floor((camera.y - halfH - 60) / 170);
    const bottom = Math.ceil((camera.y + halfH + 60) / 170);
    c.save();
    c.globalCompositeOperation = "screen";
    const baseAlpha = c.globalAlpha;
    for (let row = top; row <= bottom; row++) {
      for (let column = left; column <= right; column++) {
        const canonical = ((column % columns) + columns) % columns;
        const phase = canonical * 2.17 + row * 3.31;
        const x =
          column * spacing +
          Math.sin(phase) * 75 +
          Math.sin(t * 0.12 + phase) * 14;
        const y = row * 170 + Math.cos(phase * 1.4) * 36;
        const width = 145 + (Math.sin(phase * 2.3) + 1) * 50;
        // Width is fixed for each wrapped tile. Cache its normalized five-unit
        // center as well as the ramp, rather than approximating it by scaling.
        const key = row * columns + canonical;
        let stamp = lightBandStamps.get(key);
        if (!stamp) {
          stamp = createRadialStamp({
            innerRadius: 5 / width,
            stops: [
              [0, "rgba(255,235,181,1)"],
              [0.55, "rgba(244,227,181,0.4)"],
              [1, "rgba(244,227,181,0)"],
            ],
          });
          lightBandStamps.set(key, stamp);
        }
        c.save();
        c.translate(x, y);
        c.rotate(windAngle * 0.18 + Math.sin(phase) * 0.12);
        c.scale(1, 0.23);
        const alpha =
          strength * (0.55 + (Math.sin(t * 0.7 + phase) + 1) * 0.22);
        // Retain the existing 128-step opacity palette without color strings.
        const opacityStep = Math.max(
          0,
          Math.min(127, Math.round((alpha / 0.16) * 127)),
        );
        c.globalAlpha = baseAlpha * ((opacityStep / 127) * 0.16);
        c.drawImage(stamp, -width, -width, width * 2, width * 2);
        c.restore();
      }
    }
    c.restore();
  }

  function drawSurface(
    c,
    {
      camera,
      vw,
      vh,
      time,
      roughness,
      windAngle,
      reducedMotion,
      lighting,
      front,
    },
  ) {
    const visible = visibleCoasts(camera, vw, vh);
    c.save();
    // Do not constrain longitude: the atlas wraps indefinitely.
    clipWater(c, visible);
    const t = reducedMotion ? 0 : time / 1000;
    const z = camera.zoom;
    const halfW = vw / (2 * z) + 100;
    const halfH = vh / (2 * z * MAP_TILT_COS) + 60;
    if (front?.seaDarkness > 0.01) {
      c.fillStyle = stormSeaStyle(front.seaDarkness * 0.22);
      c.fillRect(camera.x - halfW, camera.y - halfH, halfW * 2, halfH * 2);
    }
    drawSeaLightBands(c, camera, t, lighting, windAngle, halfW, halfH);
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
    const rotation = Math.sin(windAngle) * 0.12;
    const rotationCos = Math.cos(rotation);
    const rotationSin = Math.sin(rotation);
    const light =
      (lighting?.daylight ?? 1) * (1 - (lighting?.storm ?? 0) * 0.45);
    for (const batches of [waveShadows, waveGlints, waveCrests])
      for (const batch of batches.values()) batch.count = 0;
    for (let row = top; row <= bottom; row++) {
      const rowOffset = Math.sin(row * 12.7) * 25;
      for (let column = left; column <= right; column++) {
        const canonical = ((column % columns) + columns) % columns;
        const mark = surfaceMark(row, canonical, columns, spacing, rowOffset);
        if (mark.hidden && z >= 0.7) continue;
        const { phase, length } = mark;
        const pulse = (Math.sin(t * (0.6 + roughness * 0.4) + phase) + 1) / 2;
        const x = column * spacing + rowOffset + Math.cos(t * 0.28 + phase) * 5;
        const y = mark.y + Math.sin(t * 0.48 + phase) * 3;
        // Counter-rotate each center so one shared layer rotation preserves
        // the original translate(x, y) / rotate(rotation) geometry.
        const centerX = x * rotationCos + y * rotationSin;
        const centerY = y * rotationCos - x * rotationSin;
        appendWaveMark(
          waveShadows,
          surfaceShadowStyle(0.035 + pulse * 0.065),
          shadowCurve,
          centerX,
          centerY,
          length,
        );
        const glintAlpha =
          (0.055 + pulse ** 3 * (0.27 + roughness * 0.15)) *
          (0.32 + light * 0.68);
        appendWaveMark(
          waveGlints,
          surfaceGlintStyle(glintAlpha),
          glintCurve,
          centerX,
          centerY,
          length,
        );
        if (pulse > 0.65) {
          const quantizedGlint =
            (Math.max(0, Math.min(127, Math.round((glintAlpha / 0.48) * 127))) /
              127) *
            0.48;
          appendWaveMark(
            waveCrests,
            surfaceGlintStyle(quantizedGlint * (pulse - 0.65) * 1.8),
            crestLine,
            centerX,
            centerY,
            length,
          );
        }
      }
    }
    c.save();
    c.rotate(rotation);
    c.lineWidth = 3.5;
    strokeWaveBatches(c, waveShadows, 8);
    c.lineWidth = 0.8 / z;
    strokeWaveBatches(c, waveGlints, 8);
    // Crests previously replaced globalAlpha rather than inheriting it.
    c.globalAlpha = 1;
    strokeWaveBatches(c, waveCrests, 4);
    c.restore();
    drawCurrentFlow(c, camera, t, roughness, halfW, halfH);
    drawSeaLife(c, camera, t, halfW, halfH);
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
        c.strokeStyle = surfStyle(
          Math.sin(pulse * Math.PI) * (0.27 + roughness * 0.08),
        );
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
        c.strokeStyle = foamStrokeStyle((pulse - 0.28) * 0.86);
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
          c.fillStyle = foamFillStyle((pulse - 0.8) * 2.6);
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
    drawShoreAnimals(c, visible, t);
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
      if (b.alpha < 0.006) continue;
      const seed = b.seed;
      const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const dx = (b.x - a.x) / length;
      const dy = (b.y - a.y) / length;
      const nx = -dy;
      const ny = dx;

      // A translucent trough and two broken foam ribbons follow the actual
      // turn history, rather than a straight streak behind the current bow.
      c.fillStyle = wakeBodyStyle(b.alpha * 0.28);
      c.beginPath();
      c.moveTo(a.x + nx * a.width * 0.7, a.y + ny * a.width * 0.7);
      c.lineTo(b.x + nx * b.width * 0.7, b.y + ny * b.width * 0.7);
      c.lineTo(b.x - nx * b.width * 0.7, b.y - ny * b.width * 0.7);
      c.lineTo(a.x - nx * a.width * 0.7, a.y - ny * a.width * 0.7);
      c.closePath();
      c.fill();

      // Occasional outer crests catch the light as the disturbed water spreads.
      for (const side of [-1, 1]) {
        const crest = wakeNoise(seed, side + 4);
        if (crest < 0.32) continue;
        const along = 0.17 + wakeNoise(seed, side + 7) * 0.56;
        const lateral = (a.width + b.width) * (0.35 + crest * 0.23);
        const x = a.x + dx * length * along + nx * lateral * side;
        const y = a.y + dy * length * along + ny * lateral * side;
        c.strokeStyle = wakeStrokeStyle(b.alpha * (0.65 + crest * 0.35));
        c.lineWidth = (1 + b.alpha * 0.8) / camera.zoom;
        c.beginPath();
        c.moveTo(x - dx * 4, y - dy * 4);
        c.quadraticCurveTo(
          x + nx * side * (5 + b.width * 0.15),
          y + ny * side * (5 + b.width * 0.15),
          x + dx * (8 + crest * 4) + nx * side * 6,
          y + dy * (8 + crest * 4) + ny * side * 6,
        );
        c.stroke();
      }

      // Specks of foam collect unevenly through the centre, then dissolve.
      for (let fleck = 0; fleck < 4; fleck++) {
        const scatter = wakeNoise(seed, fleck + 11);
        if (scatter < 0.23) continue;
        const along = wakeNoise(seed, fleck + 17);
        const cross = (wakeNoise(seed, fleck + 23) - 0.5) * b.width * 1.5;
        const x = a.x + dx * length * along + nx * cross;
        const y = a.y + dy * length * along + ny * cross;
        c.fillStyle = wakeFillStyle(b.alpha * (0.4 + scatter * 0.6));
        c.beginPath();
        c.ellipse(
          x,
          y,
          0.8 + scatter * 1.7,
          0.5 + scatter * 1.1,
          0,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
    }
    c.restore();
  }

  function drawReflections(
    c,
    {
      camera,
      vw,
      vh,
      time,
      roughness = 0,
      reducedMotion = false,
      lighting,
      vessels = [],
      lamps = [],
    },
  ) {
    if (!vessels.length && !lamps.length) return;
    const halfW = vw / (2 * camera.zoom) + 150;
    const halfH = vh / (2 * camera.zoom * MAP_TILT_COS) + 150;
    const t = reducedMotion ? 0 : time / 1000;
    const daylight = lighting?.daylight ?? 1;
    const night = lighting?.night ?? 0;
    c.save();
    clipWater(c, visibleCoasts(camera, vw, vh));
    for (const vessel of vessels) {
      const x = nearestWrapped(vessel.x, camera.x, WORLD.w);
      if (
        Math.abs(x - camera.x) > halfW ||
        Math.abs(vessel.y - camera.y) > halfH
      )
        continue;
      const profile = getShipModelProfile(vessel.vesselClass, vessel.idNum);
      const size = vessel.scale ?? 1;
      const heading = (vessel.angle || 0) + Math.PI / 2;
      const cos = Math.cos(heading),
        sin = Math.sin(heading);
      c.save();
      c.translate(x, vessel.y);
      c.scale(size, size);
      const top = -profile.length * 0.6;
      const span = profile.length * 1.2 + 42 * MAP_TILT_TAN;
      // One striped clip per vessel breaks the mirrored silhouette into
      // ripples. All geometry remains on the water side of coastline masks.
      c.beginPath();
      for (let row = 0; row < 14; row++) {
        const ripple = sampleWaterReflection(t, row, roughness);
        const y = top + (row * span) / 14;
        c.rect(-75 + ripple.offset, y, 150, (span / 14) * ripple.width * 0.72);
      }
      c.clip();
      c.fillStyle = reflectionHullStyle(0.16 + daylight * 0.16);
      c.beginPath();
      c.ellipse(
        0,
        profile.deckHeight * MAP_TILT_TAN,
        profile.beam * 0.85,
        profile.length * 0.46,
        heading,
        0,
        Math.PI * 2,
      );
      c.fill();
      c.fillStyle = reflectionSailStyle(
        (0.1 + daylight * 0.28) * (1 - Math.min(1, roughness) * 0.55),
      );
      for (const mast of profile.masts) {
        const vertices =
          profile.rig === "lateen"
            ? [
                [0, mast.y, mast.height],
                [mast.yard * 0.8, mast.y, mast.height * 0.25],
                [0, mast.y, mast.height * 0.25],
              ]
            : [
                [-mast.yard * 0.5, mast.y, mast.height * 0.88],
                [mast.yard * 0.5, mast.y, mast.height * 0.88],
                [mast.yard * 0.45, mast.y, mast.height * 0.3],
                [-mast.yard * 0.45, mast.y, mast.height * 0.3],
              ];
        c.beginPath();
        vertices.forEach(([u, v, height], i) => {
          const rx =
            u * cos -
            v * sin +
            Math.sin(t * 1.8 + height * 0.5) * (0.6 + roughness * 1.8);
          const ry = u * sin + v * cos + height * MAP_TILT_TAN;
          if (i) c.lineTo(rx, ry);
          else c.moveTo(rx, ry);
        });
        c.closePath();
        c.fill();
      }
      c.restore();
    }
    if (night > 0.12) {
      c.lineCap = "round";
      for (const lamp of lamps) {
        const x = nearestWrapped(lamp.x, camera.x, WORLD.w);
        if (
          Math.abs(x - camera.x) > halfW ||
          Math.abs(lamp.y - camera.y) > halfH
        )
          continue;
        c.save();
        c.translate(x, lamp.y);
        for (let row = 0; row < 11; row++) {
          const ripple = sampleWaterReflection(
            t,
            row + (lamp.index || 0),
            roughness,
          );
          const fade = (1 - row / 11) ** 1.5;
          const y = 3 + row * 4.5;
          const width = (2.5 + row * 0.9) * ripple.width;
          c.strokeStyle = reflectionLampStyle(
            night * fade * ripple.alpha * 0.65,
          );
          c.lineWidth = (1.2 + fade * 1.4) / camera.zoom;
          c.beginPath();
          c.moveTo(ripple.offset - width, y);
          c.quadraticCurveTo(ripple.offset, y + 1.4, ripple.offset + width, y);
          c.stroke();
        }
        c.restore();
      }
    }
    c.restore();
  }
  return {
    drawSurface,
    drawWake,
    drawReflections,
    setRivers(paths) {
      riverPaths = paths;
    },
  };
}
