import { nearestWrapped } from "./core/math.js";
import {
  BIOLUMINESCENT_RGB,
  bioluminescentNightGain,
  bioluminescentSeaAt,
  bioluminescentTwinkle,
} from "./core/bioluminescence.js";
import { polygonContainsBounds } from "./core/geometry.js?v=3";
import { MAP_TILT_COS, MAP_TILT_TAN } from "./core/projection.js";
import { createAlphaPalette } from "./style-palette.js";
import { createRadialStamp } from "./radial-stamp.js";
import { createSeaLightRendering } from "./sea-light-rendering.js";
import { createSeaSurfaceRendering } from "./sea-surface-rendering.js";
import { createShallowCausticsRendering } from "./shallow-caustics-rendering.js";
import { glitterCorridor, seaLightSources } from "./core/sea-optics.js";
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
import { drawHullReflection } from "./ship-rendering.js";

const surfaceShadowStyle = createAlphaPalette("37,81,78", 0.035, 0.1);
// Finer opacity steps preserve the subtle response to daylight and storms.
const surfaceGlintStyle = createAlphaPalette("247,237,197", 0, 0.48, 128);
const groupedGlintStyle = createAlphaPalette("247,237,197", 0, 0.48, 64);
const groupedCrestStyle = createAlphaPalette("247,237,197", 0, 0.48, 32);
const surfStyle = createAlphaPalette("248,237,195", 0, 0.35);
const foamStrokeStyle = createAlphaPalette("255,244,206", 0, 0.62);
const foamFillStyle = createAlphaPalette("255,247,213", 0, 0.52);
const wakeStrokeStyle = createAlphaPalette("250,244,211", 0, 0.48, 128);
const wakeFillStyle = createAlphaPalette("255,249,221", 0, 0.48, 128);
const wakeBodyStyle = createAlphaPalette("26,87,86", 0, 0.14, 128);
const wakeGlowEnvelopeStyle = createAlphaPalette(
  BIOLUMINESCENT_RGB,
  0,
  0.3,
  48,
);
const wakeGlowSpeckStyle = createAlphaPalette(BIOLUMINESCENT_RGB, 0, 0.85, 96);
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
  let cachedView = null;
  let cachedVisible = [];
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
  const surfaceMarks = [];
  const lightBandStamps = new Map();
  const glitterBatches = new Map();
  const causticsRendering = createShallowCausticsRendering({
    WORLD,
    visibleCoasts,
    clipWater,
  });
  const seaLightRendering = createSeaLightRendering(
    (c, camera, t, lighting, windAngle, halfW, halfH, viewport) => {
      c.save();
      clipWater(
        c,
        visibleCoasts(
          camera,
          halfW * 2 * camera.zoom,
          halfH * 2 * camera.zoom * MAP_TILT_COS,
        ),
      );
      drawSeaLightBands(
        c,
        camera,
        t,
        lighting,
        windAngle,
        halfW,
        halfH,
        viewport,
      );
      c.restore();
    },
  );
  const seaSurfaceRendering = createSeaSurfaceRendering(
    (c, options) => drawSurfaceDirect(c, { ...options, skipLighting: true }),
    WORLD.w,
  );
  const waveShadows = new Map();
  const waveGlints = new Map();
  const waveCrests = new Map();
  function surfaceMark(row, column, columns, spacing, rowOffset) {
    const key = row * columns + column;
    if (surfaceMarks[key]) return surfaceMarks[key];
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
    const mark = {
      phase,
      sin: Math.sin(phase),
      cos: Math.cos(phase),
      y,
      length: 18 + (Math.sin(phase) + 1) * 15,
      hidden,
    };
    surfaceMarks[key] = mark;
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
    if (
      cachedView &&
      cachedView.x === camera.x &&
      cachedView.y === camera.y &&
      cachedView.zoom === camera.zoom &&
      cachedView.vw === vw &&
      cachedView.vh === vh
    )
      return cachedVisible;
    cachedView = { x: camera.x, y: camera.y, zoom: camera.zoom, vw, vh };
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
    cachedVisible = visible;
    return visible;
  }

  function clipWater(c, visible, region) {
    // A wake or reflection occupies a small part of the screen. Scissor first
    // so inverse coastline masks do not rasterize the entire Retina viewport.
    if (region) {
      c.beginPath();
      c.rect(
        region.left,
        region.top,
        region.right - region.left,
        region.bottom - region.top,
      );
      c.clip();
    }
    for (const { masks, offset, bounds } of visible) {
      if (
        region &&
        (bounds.right + offset < region.left ||
          bounds.left + offset > region.right ||
          bounds.bottom < region.top ||
          bounds.top > region.bottom)
      )
        continue;
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

  function drawRiverFlow(c, visible, time, zoom, view) {
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
        if (
          river.right + offset < view.left ||
          river.left + offset > view.right ||
          river.bottom < view.top ||
          river.top > view.bottom
        )
          continue;
        c.stroke(river.path);
      }
      c.restore();
    }
    c.restore();
  }

  function drawCoastalBirds(c, visible, time, zoom, view) {
    c.save();
    c.lineCap = "round";
    c.lineJoin = "round";
    for (const { flocks, offset } of visible) {
      for (const flock of flocks) {
        if (!inView(flock.x + offset, flock.y, 160, view)) continue;
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

  function drawShoreAnimals(c, visible, time, view) {
    for (const { animals, land, offset } of visible) {
      if (!animals.length) continue;
      c.save();
      c.translate(offset, 0);
      c.clip(land);
      for (const animal of animals) {
        if (!inView(animal.x + offset, animal.y, 90, view)) continue;
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

  function drawSeaLightBands(
    c,
    camera,
    t,
    lighting,
    windAngle,
    _halfW,
    _halfH,
    viewport,
  ) {
    const { vw, vh, roughness = 0, detail = 1 } = viewport;
    const z = camera.zoom;
    const left = camera.x - vw / (2 * z);
    const top = camera.y - vh / (2 * z * MAP_TILT_COS);
    const worldX = (x) => left + (x * vw) / z;
    const worldY = (y) => top + (y * vh) / (z * MAP_TILT_COS);
    c.save();
    c.globalCompositeOperation = "screen";
    c.lineCap = "round";
    const baseAlpha = c.globalAlpha;
    for (const source of seaLightSources(lighting)) {
      if (source.strength < 0.003) continue;
      const color =
        source.kind === "moon"
          ? "196,224,255"
          : source.warm
            ? "255,210,139"
            : "255,241,201";
      let stamp = lightBandStamps.get(color);
      if (!stamp) {
        stamp = createRadialStamp({
          stops: [
            [0, `rgba(${color},1)`],
            [0.4, `rgba(${color},0.5)`],
            [1, `rgba(${color},0)`],
          ],
        });
        lightBandStamps.set(color, stamp);
      }
      c.strokeStyle = `rgb(${color})`;
      for (const batch of glitterBatches.values()) batch.count = 0;
      const rows = Math.ceil(vh / (detail >= 0.9 ? 7 : 11));
      for (let row = 1; row <= rows; row++) {
        const depth = row / rows;
        const band = glitterCorridor(source, depth, roughness);
        const phase = row * 2.399963;
        const sway = Math.sin(t * 0.67 + phase) * band.width * 0.12;
        const x = worldX(band.x + sway);
        const y = worldY(band.y);
        const width = (band.width * vw) / z;
        const shimmer = 0.65 + Math.sin(t * 1.3 + phase) * 0.25;
        c.globalAlpha =
          baseAlpha * source.strength * band.intensity * shimmer * 0.7;
        c.drawImage(
          stamp,
          x - width,
          y - 5 / (z * MAP_TILT_COS),
          width * 2,
          10 / (z * MAP_TILT_COS),
        );
        // Broken wavelets resolve over the soft envelope, never a solid beam.
        for (let mark = -4; mark <= 4; mark++) {
          const seed = row * 13 + mark * 7;
          const twinkle = Math.max(
            0,
            Math.sin(t * (1.2 + roughness) + seed * 1.73),
          );
          if (twinkle < 0.2) continue;
          const across = (mark + Math.sin(seed * 2.1) * 0.4) / 4.6;
          const edge = (1 - Math.abs(across)) ** 1.7;
          const mx = x + across * width;
          const my = y + (Math.sin(t * 0.9 + seed) * 2) / (z * MAP_TILT_COS);
          const length = ((2 + depth * 14) * (0.4 + twinkle * 0.6)) / z;
          const opacity = Math.round(band.intensity * edge * twinkle * 15);
          if (!opacity) continue;
          const thickness = Math.round(depth * 2);
          const key = opacity * 3 + thickness;
          let batch = glitterBatches.get(key);
          if (!batch) {
            batch = {
              points: [],
              count: 0,
              alpha: opacity / 15,
              width: 0.8 + thickness * 0.55,
            };
            glitterBatches.set(key, batch);
          }
          const points = batch.points;
          points[batch.count++] = mx - length;
          points[batch.count++] = my;
          points[batch.count++] = mx;
          points[batch.count++] = my - Math.sin(windAngle) / z;
          points[batch.count++] = mx + length;
          points[batch.count++] = my;
        }
      }
      // A bounded set of opacity paths avoids a coastline blend per sparkle.
      for (const { points, count, alpha, width } of glitterBatches.values()) {
        if (!count) continue;
        c.globalAlpha = baseAlpha * source.strength * alpha * 5;
        c.lineWidth = width / z;
        c.beginPath();
        for (let index = 0; index < count; index += 6) {
          c.moveTo(points[index], points[index + 1]);
          c.quadraticCurveTo(
            points[index + 2],
            points[index + 3],
            points[index + 4],
            points[index + 5],
          );
        }
        c.stroke();
      }
    }
    c.restore();
  }

  function inView(x, y, margin, view) {
    return (
      x + margin >= view.left &&
      x - margin <= view.right &&
      y + margin >= view.top &&
      y - margin <= view.bottom
    );
  }

  function drawSurfaceDirect(
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
      detail = 1,
      focus,
      encounterCreature,
      cacheLightBands = false,
      skipLighting = false,
      deferLighting = false,
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
    const view = {
      left: camera.x - halfW,
      right: camera.x + halfW,
      top: camera.y - halfH,
      bottom: camera.y + halfH,
    };
    if (!skipLighting && front?.seaDarkness > 0.01) {
      c.fillStyle = stormSeaStyle(front.seaDarkness * 0.22);
      c.fillRect(camera.x - halfW, camera.y - halfH, halfW * 2, halfH * 2);
    }
    if (!skipLighting && !deferLighting) {
      if (cacheLightBands)
        seaLightRendering.draw(c, {
          camera,
          vw,
          vh,
          time: reducedMotion ? 0 : time,
          lighting,
          windAngle,
          roughness,
          detail,
        });
      else
        drawSeaLightBands(c, camera, t, lighting, windAngle, halfW, halfH, {
          vw,
          vh,
          roughness,
          detail,
        });
    }
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
    // On slower devices keep full motion around the ship, and sample fewer
    // distant decorative waves. Canonical columns keep this stable at the seam.
    const stride = detail >= 0.9 ? 1 : detail >= 0.7 ? 2 : 3;
    // Each opacity batch repeats the water clip on the GPU. Under load, group
    // near-identical shades more closely without changing any wave geometry.
    const glintStyle = detail >= 0.9 ? surfaceGlintStyle : groupedGlintStyle;
    const crestStyle = detail >= 0.9 ? surfaceGlintStyle : groupedCrestStyle;
    const focusX = focus?.x ?? camera.x;
    const focusY = focus?.y ?? camera.y;
    const focusRadius = focus?.radius ?? 480;
    const detailX = nearestWrapped(focusX, camera.x, WORLD.w);
    const detailView =
      stride === 1 || !focus
        ? view
        : {
            left: Math.max(view.left, detailX - focusRadius - 80),
            right: Math.min(view.right, detailX + focusRadius + 80),
            top: Math.max(view.top, focusY - focusRadius - 80),
            bottom: Math.min(view.bottom, focusY + focusRadius + 80),
          };
    const pulseTime = t * (0.6 + roughness * 0.4);
    const pulseSin = Math.sin(pulseTime),
      pulseCos = Math.cos(pulseTime);
    const driftCos = Math.cos(t * 0.28),
      driftSin = Math.sin(t * 0.28);
    const swaySin = Math.sin(t * 0.48),
      swayCos = Math.cos(t * 0.48);
    for (let row = top; row <= bottom; row++) {
      const rowOffset = Math.sin(row * 12.7) * 25;
      for (let column = left; column <= right; column++) {
        const canonical = ((column % columns) + columns) % columns;
        if (stride > 1 && (canonical + row) % stride !== 0) {
          const dx =
            nearestWrapped(column * spacing + rowOffset, focusX, WORLD.w) -
            focusX;
          const dy = row * 48 - focusY;
          if (dx * dx + dy * dy > (focusRadius + 80) ** 2) continue;
        }
        const mark = surfaceMark(row, canonical, columns, spacing, rowOffset);
        if (mark.hidden && z >= 0.7) continue;
        const { length, sin, cos } = mark;
        const pulse = (pulseSin * cos + pulseCos * sin + 1) / 2;
        const x =
          column * spacing + rowOffset + (driftCos * cos - driftSin * sin) * 5;
        const y = mark.y + (swaySin * cos + swayCos * sin) * 3;
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
          glintStyle(glintAlpha),
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
            crestStyle(quantizedGlint * (pulse - 0.65) * 1.8),
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
        drawCreature(
          c,
          nearestX,
          y,
          scale,
          index,
          // Hold the focal creature at the crest of its surfacing cycle so
          // it cannot disappear while the camera is introducing it.
          encounterCreature === index ? 1 - index * 3.7 : t,
        );
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
        if (!inView(mark.x + offset, mark.y, 36, detailView)) continue;
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
    drawRiverFlow(c, visible, t, z, detailView);
    drawCoastalBirds(c, visible, t, z, detailView);
    drawShoreAnimals(c, visible, t, detailView);
  }

  function drawSurface(c, options) {
    if (!options.bufferSurface) return drawSurfaceDirect(c, options);
    const { camera, vw, vh, front, reducedMotion, time } = options;
    c.save();
    if (front?.seaDarkness > 0.01) {
      clipWater(c, visibleCoasts(camera, vw, vh));
      c.fillStyle = stormSeaStyle(front.seaDarkness * 0.22);
      c.fillRect(
        camera.x - vw / (2 * camera.zoom),
        camera.y - vh / (2 * camera.zoom * MAP_TILT_COS),
        vw / camera.zoom,
        vh / (camera.zoom * MAP_TILT_COS),
      );
    }
    c.restore();
    if (!options.deferLighting)
      seaLightRendering.draw(c, { ...options, time: reducedMotion ? 0 : time });
    seaSurfaceRendering.draw(c, options);
  }

  function drawWake(c, trail, time, camera, vw, vh, environment = {}) {
    const sections = buildWakeRibbon(trail, time, WORLD.w);
    if (sections.length < 2) return;
    const offset =
      nearestWrapped(sections[0].x, camera.x, WORLD.w) - sections[0].x;
    const region = {
      left: Infinity,
      right: -Infinity,
      top: Infinity,
      bottom: -Infinity,
    };
    for (const section of sections) {
      const margin = section.width * 2 + 50 + 2 / camera.zoom;
      region.left = Math.min(region.left, section.x + offset - margin);
      region.right = Math.max(region.right, section.x + offset + margin);
      region.top = Math.min(region.top, section.y - margin);
      region.bottom = Math.max(region.bottom, section.y + margin);
    }
    c.save();
    const visible = visibleCoasts(camera, vw, vh);
    clipWater(c, visible, region);
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
    drawWakeBioluminescence(c, sections, time, environment);
    c.restore();
  }

  // In the named luminous seas the churned water itself glows: a faint teal
  // envelope carries the ribbon between specks that flare and gutter on their
  // own clocks. Screen composite keeps the glow off the ink beneath it, and
  // every section samples its own exposure so the fade at a sea's edge is
  // drawn rather than stepped.
  function drawWakeBioluminescence(c, sections, time, environment) {
    const night = bioluminescentNightGain(environment.lighting);
    if (night < 0.004 || !environment.bioluminescentSeas?.length) return;
    const t = environment.reducedMotion ? 0 : time / 1000;
    c.save();
    c.globalCompositeOperation = "screen";
    for (let i = 1; i < sections.length; i++) {
      const a = sections[i - 1],
        b = sections[i];
      const sea = bioluminescentSeaAt(
        b,
        environment.bioluminescentSeas,
        WORLD.w,
      );
      if (!sea) continue;
      const glow = night * sea.exposure;
      if (glow < 0.004) continue;
      const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const dx = (b.x - a.x) / length;
      const dy = (b.y - a.y) / length;
      const nx = -dy;
      const ny = dx;
      c.strokeStyle = wakeGlowEnvelopeStyle(glow * 0.32);
      c.lineWidth = b.width * 1.5;
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(b.x, b.y);
      c.stroke();
      for (let speck = 0; speck < 3; speck++) {
        const scatter = wakeNoise(b.seed, speck + 31);
        const twinkle = bioluminescentTwinkle(
          t,
          scatter * Math.PI * 2 + speck * 2.4,
        );
        if (twinkle < 0.22) continue;
        const along = wakeNoise(b.seed, speck + 37);
        const cross = (wakeNoise(b.seed, speck + 41) - 0.5) * b.width * 1.7;
        const x = a.x + dx * length * along + nx * cross;
        const y = a.y + dy * length * along + ny * cross;
        const radius = 0.7 + scatter * 1.9;
        const alpha = Math.min(0.85, glow * twinkle * (0.45 + b.alpha * 1.7));
        c.fillStyle = wakeGlowSpeckStyle(alpha);
        c.beginPath();
        c.ellipse(x, y, radius, radius * 0.72, 0, 0, Math.PI * 2);
        c.fill();
        if (twinkle > 0.72) {
          // The brightest organisms bloom once, then gutter back into the wake.
          c.fillStyle = wakeGlowSpeckStyle(alpha * 0.25);
          c.beginPath();
          c.ellipse(x, y, radius * 3.6, radius * 2.7, 0, 0, Math.PI * 2);
          c.fill();
        }
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
    const region = {
      left: Infinity,
      right: -Infinity,
      top: Infinity,
      bottom: -Infinity,
    };
    const include = (x, y, margin) => {
      region.left = Math.min(region.left, x - margin);
      region.right = Math.max(region.right, x + margin);
      region.top = Math.min(region.top, y - margin);
      region.bottom = Math.max(region.bottom, y + margin);
    };
    for (const vessel of vessels) {
      const x = nearestWrapped(vessel.x, camera.x, WORLD.w);
      if (
        Math.abs(x - camera.x) > halfW ||
        Math.abs(vessel.y - camera.y) > halfH
      )
        continue;
      const profile = getShipModelProfile(vessel.vesselClass, vessel.idNum);
      const margin =
        Math.max(85, profile.length * 0.6 + 42 * MAP_TILT_TAN) *
          (vessel.scale ?? 1) +
        10 / camera.zoom;
      include(x, vessel.y, margin);
    }
    if (night > 0.12)
      for (const lamp of lamps) {
        const x = nearestWrapped(lamp.x, camera.x, WORLD.w);
        if (
          Math.abs(x - camera.x) <= halfW &&
          Math.abs(lamp.y - camera.y) <= halfH
        )
          include(x, lamp.y, 80 + 3 / camera.zoom);
      }
    if (region.left === Infinity) return;
    c.save();
    clipWater(c, visibleCoasts(camera, vw, vh), region);
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
      drawHullReflection(c, profile, heading, {
        time: t,
        roughness,
        reducedMotion,
        seed: vessel.idNum || 0,
        speed: vessel.speed || 0,
        anchored: vessel.anchored ?? false,
        lighting,
      });
      const top = -profile.length * 0.6;
      const span = profile.length * 1.2 + 42 * MAP_TILT_TAN;
      // Sail glints retain their finer striped clip above the hull ink.
      c.beginPath();
      for (let row = 0; row < 14; row++) {
        const ripple = sampleWaterReflection(t, row, roughness);
        const y = top + (row * span) / 14;
        c.rect(-75 + ripple.offset, y, 150, (span / 14) * ripple.width * 0.72);
      }
      c.clip();
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
    drawLighting: (c, options) =>
      seaLightRendering.draw(c, {
        ...options,
        time: options.reducedMotion ? 0 : options.time,
      }),
    drawCaustics: (c, options) => causticsRendering.draw(c, options),
    drawWake,
    drawReflections,
    drawEncounterCreature(c, { x, y, scale, index }) {
      drawCreature(c, x, y, scale, index, 1 - index * 3.7);
    },
    setRivers(paths) {
      riverPaths = paths.map((rivers) =>
        rivers
          .map((river) => {
            const path = new Path2D();
            if (river.length < 2) return null;
            path.moveTo(river[0].x, river[0].y);
            for (let i = 1; i < river.length - 1; i++) {
              const a = river[i],
                b = river[i + 1];
              path.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
            }
            path.lineTo(river.at(-1).x, river.at(-1).y);
            const xs = river.map(({ x }) => x),
              ys = river.map(({ y }) => y);
            return {
              path,
              left: Math.min(...xs) - 2,
              right: Math.max(...xs) + 2,
              top: Math.min(...ys) - 2,
              bottom: Math.max(...ys) + 2,
            };
          })
          .filter(Boolean),
      );
    },
  };
}
