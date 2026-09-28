import { PORT_NAMES, LAND_NAMES } from "./names.js";
import {
  expandPolygon,
  pointInWrappedPolygon,
  polygonCentroid,
} from "./core/geometry.js";
import { unwrapPath } from "./core/routes.js";
import { portEvolution } from "./core/regional.js";
import { MAP_TILT_TAN } from "./core/projection.js";
import { LIGHT_DIRECTION } from "./core/lighting.js";
import { drawPortMiniature } from "./port-miniatures.js";
import { planTerrainIllustration, terrainBiome } from "./core/terrain.js";
import {
  drawTerrainIllustration,
  terrainPalette,
} from "./terrain-rendering.js";
export {
  drawMerchantShip,
  drawShip,
  shipDrawProfile,
} from "./ship-rendering.js";
import {
  lands,
  ports,
  roughSeas,
  seaRegionLabels,
  worldCurrents,
  worldMonsters,
  worldShoals,
} from "./world-data.js";

function seeded(n) {
  let t = n + 0x6d2b79f5;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function isLandPoint(x, y, worldWidth, landShapes = lands) {
  return landShapes.some((land) =>
    pointInWrappedPolygon(x, y, land.poly, worldWidth),
  );
}

// Cache for viewport calculations to avoid redundant math operations
const viewportCache = {
  lastCameraX: 0,
  lastCameraY: 0,
  lastZoom: 0,
  lastViewportWidth: 0,
  lastViewportHeight: 0,
  lastWorldWidth: 0,
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  dirty: true,

  update(cameraX, cameraY, viewportWidth, viewportHeight, zoom, worldWidth) {
    if (
      this.dirty ||
      Math.abs(this.lastCameraX - cameraX) > 1 ||
      Math.abs(this.lastCameraY - cameraY) > 1 ||
      Math.abs(this.lastZoom - zoom) > 0.01 ||
      this.lastViewportWidth !== viewportWidth ||
      this.lastViewportHeight !== viewportHeight ||
      this.lastWorldWidth !== worldWidth
    ) {
      this.lastCameraX = cameraX;
      this.lastCameraY = cameraY;
      this.lastZoom = zoom;
      this.lastViewportWidth = viewportWidth;
      this.lastViewportHeight = viewportHeight;
      this.lastWorldWidth = worldWidth;

      const visibleHalfWidth = viewportWidth / (2 * zoom);
      const visibleHalfHeight = viewportHeight / (2 * zoom);

      this.left = cameraX - visibleHalfWidth;
      this.right = cameraX + visibleHalfWidth;
      this.top = cameraY - visibleHalfHeight;
      this.bottom = cameraY + visibleHalfHeight;
      this.dirty = false;
    }
  },

  checkCircle(x, y, radius, cameraX, worldWidth) {
    const wrappedX = x + Math.round((cameraX - x) / worldWidth) * worldWidth;
    return (
      wrappedX + radius >= this.left &&
      wrappedX - radius <= this.right &&
      y + radius >= this.top &&
      y - radius <= this.bottom
    );
  },
};

export function wrappedCircleIntersectsViewport(
  x,
  y,
  radius,
  cameraX,
  cameraY,
  viewportWidth,
  viewportHeight,
  zoom,
  worldWidth,
) {
  viewportCache.update(
    cameraX,
    cameraY,
    viewportWidth,
    viewportHeight,
    zoom,
    worldWidth,
  );
  return viewportCache.checkCircle(x, y, radius, cameraX, worldWidth);
}

export function createRoughSeaParticles(seas, isOnLand) {
  return seas.map((sea, seaIndex) => {
    const rnd = seeded(9300 + seaIndex * 131);
    const particles = [];
    const count = Math.round(22 * sea.strength);
    for (let i = 0; i < count; i++) {
      const baseX = (rnd() - 0.5) * sea.rx * 1.75;
      const baseY = (rnd() - 0.5) * sea.ry * 1.75;
      const speed = 0.00042 + rnd() * 0.0002;
      const phaseOffset = rnd() * Math.PI * 2;
      const swell = 4 + rnd() * 7;
      const scale = 0.7 + rnd() * 0.7;
      const rotation = sea.angle + (rnd() - 0.5) * 0.24;
      if (!isOnLand(sea.x + baseX, sea.y + baseY))
        particles.push({
          baseX,
          baseY,
          phaseOffset,
          rotation,
          scale,
          speed,
          swell,
        });
    }
    return particles;
  });
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function clamp255(v) {
  return (v < 0 ? 0 : v > 255 ? 255 : v) | 0;
}

const lightningState = { nextStrike: 0, flashUntil: 0, boltX: 0, boltSeed: 0 };

// Deterministic, allocation-free pseudo-random in [0, 1) keyed by (index, salt)
// so cloud, fog, and rain particles keep stable shapes across frames.
function weatherRand(i, salt = 0) {
  let t = Math.imul((i | 0) + Math.imul(salt | 0, 2654435761), 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function drawWeatherClouds(
  c,
  cloud,
  storm,
  windAngle,
  windStrength,
  vw,
  vh,
  time,
) {
  if (cloud <= 0.01) return;
  const count = Math.round(8 + cloud * 9 + storm * 11);
  // Clouds roll across the whole screen with the wind — fast enough to read
  // as motion even when the wind blows mostly north/south, and over the
  // player's circle of visibility rather than only at the horizon.
  const rollDir = Math.cos(windAngle) >= 0 ? 1 : -1;
  const rollSpeed = 0.022 + windStrength * 0.05 + storm * 0.05;
  const sway = Math.sin(windAngle);
  c.save();

  // Pre-calculate common values to reduce redundant calculations
  const stormLightBoost = storm * 0.12;
  const fairLightBoost = (1 - storm) * 0.58;
  const cloudAlphaFactor = (0.55 + cloud * 0.5) * (0.7 + storm * 0.5);
  const stormTint = storm > 0.4 ? 8 : 0;

  for (let i = 0; i < count; i++) {
    const layer = i % 3; // 0 far .. 2 near — nearer banks loom larger
    const speed = rollSpeed * (0.45 + layer * 0.45 + weatherRand(i, 1) * 0.5);
    const span = vw + 900;
    let x = (weatherRand(i, 2) * span + time * speed * rollDir) % span;
    if (x < 0) x += span;
    x -= 450;
    const baseY = weatherRand(i, 3) * (vh + 360) - 180;
    const y = baseY + Math.sin(time * 0.0004 + i) * 10 * sway;
    const size = 150 + weatherRand(i, 4) * (180 + layer * 90);
    const rx = size;
    const ry = size * (0.42 + weatherRand(i, 5) * 0.28);
    // Per-cloud lightness: storms skew dark, fair weather skews bright, and
    // every cloud varies across the full dark-to-light range.
    const baseLight = clamp01(
      stormLightBoost + fairLightBoost + (weatherRand(i, 7) - 0.5) * 0.7,
    );
    // Per-cloud thickness: some dense and heavy, some thin and wispy.
    const thick = weatherRand(i, 9);
    const alpha = clamp01((0.06 + thick * 0.24) * cloudAlphaFactor);
    // A cloud is a small cluster of overlapping puffs so its body varies in
    // colour and thickness instead of reading as a flat disc.
    const puffs = layer === 2 ? 4 : 3;
    for (let j = 0; j < puffs; j++) {
      const px = x + (j / (puffs - 1) - 0.5) * rx * 0.7;
      const py = y + (j / (puffs - 1) - 0.5) * ry * 0.5;
      const puffLight = clamp01(
        baseLight + (weatherRand(i * 7 + j, 12) - 0.5) * 0.4,
      );
      const val = 45 + puffLight * 205;
      const tint = (weatherRand(i * 5 + j, 13) - 0.5) * 18;
      const cr = clamp255(val + tint);
      const cg = clamp255(val + tint * 0.5);
      const cb = clamp255(val - tint * 0.3 + stormTint);
      const pr = rx * (0.55 + weatherRand(i * 3 + j, 14) * 0.4);
      const pa = alpha * (0.6 + weatherRand(i * 4 + j, 15) * 0.5);
      const grad = c.createRadialGradient(px, py, 0, px, py, pr);
      grad.addColorStop(0, `rgba(${cr},${cg},${cb},${pa})`);
      grad.addColorStop(0.7, `rgba(${cr},${cg},${cb},${pa * 0.4})`);
      grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      c.fillStyle = grad;
      c.beginPath();
      c.ellipse(px, py, pr, pr * 0.7, windAngle, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.restore();
}

function drawWeatherFog(c, fog, vw, vh, time) {
  if (fog <= 0.01) return;
  c.save();
  // Flat wash mutes the whole scene into murk.
  c.fillStyle = `rgba(216,220,224,${0.05 + fog * 0.09})`;
  c.fillRect(0, 0, vw, vh);
  // Close-in edge fog so the horizon feels swallowed by the mist.
  const cx = vw / 2;
  const cy = vh / 2;
  const edge = c.createRadialGradient(
    cx,
    cy,
    Math.min(vw, vh) * 0.16,
    cx,
    cy,
    Math.max(vw, vh) * 0.6,
  );
  edge.addColorStop(0, "rgba(220,224,228,0)");
  edge.addColorStop(1, `rgba(220,224,228,${0.12 + fog * 0.5})`);
  c.fillStyle = edge;
  c.fillRect(0, 0, vw, vh);
  // Drifting low fog banks rolling across the water.
  const count = 4 + Math.round(fog * 5);
  const baseAlpha = fog;
  const span = vw + 500;

  for (let i = 0; i < count; i++) {
    const speed = 0.004 + weatherRand(i, 11) * 0.01;
    let x = (weatherRand(i, 12) * span + time * speed) % span;
    if (x < 0) x += span;
    x -= 250;
    const y = weatherRand(i, 13) * (vh + 300) - 150;
    const rx = 220 + weatherRand(i, 14) * 220;
    const ry = 90 + weatherRand(i, 15) * 70;
    const a = (0.05 + weatherRand(i, 16) * 0.06) * baseAlpha;
    const bank = c.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    bank.addColorStop(0, `rgba(224,228,232,${a})`);
    bank.addColorStop(1, "rgba(224,228,232,0)");
    c.fillStyle = bank;
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

// Cache for directional fog calculations
const dirFogCache = {
  lastAheadVis: 0,
  lastAsternVis: 0,
  lastHeading: 0,
  lastVW: 0,
  lastVH: 0,
  lastGradient: null,
  lastContrast: 0,
  lastDirection: 0,
  lastCX: 0,
  lastCY: 0,
  lastDX: 0,
  lastDY: 0,
  valid: false,
};

function drawDirectionalFog(
  c,
  aheadVisibilityKm,
  asternVisibilityKm,
  headingAngle,
  vw,
  vh,
) {
  if (aheadVisibilityKm == null || asternVisibilityKm == null) return;
  const aheadFog = clamp01((7.5 - aheadVisibilityKm) / 5.5);
  const asternFog = clamp01((7.5 - asternVisibilityKm) / 5.5);
  const contrast = Math.abs(aheadFog - asternFog);
  if (contrast <= 0.04) return;

  // Check cache validity
  if (
    dirFogCache.valid &&
    Math.abs(dirFogCache.lastAheadVis - aheadVisibilityKm) < 0.1 &&
    Math.abs(dirFogCache.lastAsternVis - asternVisibilityKm) < 0.1 &&
    Math.abs(dirFogCache.lastHeading - headingAngle) < 0.01 &&
    dirFogCache.lastVW === vw &&
    dirFogCache.lastVH === vh &&
    Math.abs(dirFogCache.lastContrast - contrast) < 0.01
  ) {
    c.save();
    c.fillStyle = dirFogCache.lastGradient;
    c.fillRect(0, 0, vw, vh);
    c.restore();
    return;
  }

  const denseAhead = aheadFog > asternFog;
  const direction = headingAngle - Math.PI / 2 + (denseAhead ? 0 : Math.PI);
  const cx = vw / 2;
  const cy = vh / 2;
  const span = Math.hypot(vw, vh);
  const dx = Math.cos(direction) * span;
  const dy = Math.sin(direction) * span;

  const gradient = c.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  gradient.addColorStop(0, "rgba(222,226,213,0)");
  gradient.addColorStop(0.48, `rgba(222,226,213,${contrast * 0.08})`);
  gradient.addColorStop(1, `rgba(222,226,213,${contrast * 0.36})`);

  // Update cache
  dirFogCache.lastAheadVis = aheadVisibilityKm;
  dirFogCache.lastAsternVis = asternVisibilityKm;
  dirFogCache.lastHeading = headingAngle;
  dirFogCache.lastVW = vw;
  dirFogCache.lastVH = vh;
  dirFogCache.lastGradient = gradient;
  dirFogCache.lastContrast = contrast;
  dirFogCache.lastDirection = direction;
  dirFogCache.lastCX = cx;
  dirFogCache.lastCY = cy;
  dirFogCache.lastDX = dx;
  dirFogCache.lastDY = dy;
  dirFogCache.valid = true;

  c.save();
  c.fillStyle = gradient;
  c.fillRect(0, 0, vw, vh);
  c.restore();
}

function drawWeatherRain(c, rain, windAngle, windStrength, vw, vh, time) {
  if (rain <= 0.01) return;
  const count = Math.round(50 + rain * 280);
  const slant = Math.cos(windAngle) * (6 + windStrength * 7 + rain * 6);
  const len = 11 + rain * 16;
  const fall = 0.55 + rain * 1.1;
  c.save();
  c.strokeStyle = `rgba(188,204,228,${0.16 + rain * 0.2})`;
  c.lineWidth = 1;
  c.beginPath();
  for (let i = 0; i < count; i++) {
    const ox = weatherRand(i, 21) * (vw + 240) - 120;
    const sp = 0.6 + weatherRand(i, 22) * 0.7;
    let y = (weatherRand(i, 23) * vh + time * fall * sp) % (vh + 50);
    if (y < 0) y += vh + 50;
    c.moveTo(ox, y);
    c.lineTo(ox + slant, y + len);
  }
  c.stroke();
  c.restore();
}

function drawWeatherLightning(c, lightning, vw, vh, time) {
  if (lightning <= 0.01) {
    lightningState.flashUntil = 0;
    return;
  }
  const s = lightningState;
  if (time >= s.nextStrike) {
    s.flashUntil = time + 150 + lightning * 90;
    s.boltX = vw * (0.12 + weatherRand(time | 0, 31) * 0.76);
    s.boltSeed = (time | 0) & 0xffff;
    // Heavier storms throw strikes more often.
    s.nextStrike =
      time + 2400 + weatherRand(time | 0, 32) * (5600 - lightning * 3000);
  }
  if (time >= s.flashUntil) return;
  const remain = (s.flashUntil - time) / 240;
  c.save();
  c.fillStyle = `rgba(222,230,255,${Math.max(0, remain) * (0.28 + lightning * 0.4)})`;
  c.fillRect(0, 0, vw, vh);
  // Jagged bolt, brightest in the first instant of the flash.
  const boltA = Math.min(1, Math.max(0, remain) * 2.6);
  if (boltA > 0.05) {
    c.strokeStyle = `rgba(236,242,255,${boltA})`;
    c.lineWidth = 2.2;
    c.shadowColor = "rgba(214,226,255,0.95)";
    c.shadowBlur = 22;
    c.beginPath();
    let bx = s.boltX;
    c.moveTo(bx, 0);
    const segs = 9;
    for (let i = 1; i <= segs; i++) {
      bx += (weatherRand(i + s.boltSeed, 41) - 0.5) * 90;
      c.lineTo(bx, (vh / segs) * i);
    }
    c.stroke();
  }
  c.restore();
}

// Cache for weather calculations to avoid redundant string operations and math
const weatherCache = {
  lastName: "",
  lastRoughness: -1,
  lastVisibilityKm: -1,
  cachedResult: null,

  calculate(name, roughness, visibilityKm) {
    if (
      this.cachedResult &&
      this.lastName === name &&
      Math.abs(this.lastRoughness - roughness) < 0.01 &&
      Math.abs(this.lastVisibilityKm - visibilityKm) < 0.1
    ) {
      return this.cachedResult;
    }

    const lower = (name || "").toLowerCase();
    const storm = clamp01((roughness - 0.2) / 0.28);
    let nameFog = 0;
    if (/mist/.test(lower)) nameFog = 0.62;
    if (/fog/.test(lower)) nameFog = Math.max(nameFog, 0.82);
    if (/haze/.test(lower)) nameFog = Math.max(nameFog, 0.26);
    const visFog =
      visibilityKm == null ? 0 : clamp01((7.5 - visibilityKm) / 5.5);
    const fog = Math.max(nameFog, visFog);
    const cloud = clamp01(
      (/(cloud|overcast|haze)/.test(lower) ? 0.5 : 0) + storm * 0.6,
    );
    const rain = clamp01(storm + (/rain/.test(lower) ? 0.4 : 0));
    const lightning = clamp01((storm - 0.45) / 0.2);

    this.lastName = name;
    this.lastRoughness = roughness;
    this.lastVisibilityKm = visibilityKm;
    this.cachedResult = { storm, fog, cloud, rain, lightning };

    return this.cachedResult;
  },
};

// Renders the full atmospheric stack for the current weather. `opts.roughness`
// and `opts.visibilityKm` come from the interpolated weather pattern; the name
// adds hints (mist/fog/cloud/rain) on top of the continuous values.
export function drawWeatherEffects(c, opts) {
  const roughness = opts.roughness || 0;
  const visibilityKm = opts.visibilityKm;
  const vw = opts.vw;
  const vh = opts.vh;
  const time = opts.time || 0;
  const windAngle = opts.windAngle || 0;
  const windStrength = opts.windStrength || 0;
  const aheadVisibilityKm = opts.aheadVisibilityKm;
  const asternVisibilityKm = opts.asternVisibilityKm;
  const headingAngle = opts.headingAngle || 0;

  const weather = weatherCache.calculate(opts.name, roughness, visibilityKm);
  const { storm, fog, cloud, rain, lightning } = weather;

  if (storm <= 0.01 && fog <= 0.01 && cloud <= 0.01 && rain <= 0.01) return;

  // A cool wash unifies the weather while leaving chart ink legible.
  if (storm > 0.01) {
    c.save();
    c.fillStyle = `rgba(49,72,98,${storm * 0.18})`;
    c.fillRect(0, 0, vw, vh);
    c.restore();
  }

  drawWeatherClouds(c, cloud, storm, windAngle, windStrength, vw, vh, time);
  drawWeatherFog(c, fog, vw, vh, time);
  drawDirectionalFog(
    c,
    aheadVisibilityKm,
    asternVisibilityKm,
    headingAngle,
    vw,
    vh,
  );
  drawWeatherRain(c, rain, windAngle, windStrength, vw, vh, time);
  // A frozen animation clock must not leave a lightning flash stuck on screen.
  drawWeatherLightning(c, opts.reducedMotion ? 0 : lightning, vw, vh, time);
}

export function drawSceneLightWash(c, lighting, width, height) {
  c.save();
  if (lighting.dusk > 0.01) {
    c.fillStyle = `rgba(171,100,43,${lighting.dusk * 0.11})`;
    c.fillRect(0, 0, width, height);
  }
  if (lighting.storm > 0.01) {
    c.fillStyle = `rgba(63,96,128,${lighting.storm * 0.11})`;
    c.fillRect(0, 0, width, height);
  }
  c.restore();
}

export function createMapRendering({
  WORLD,
  game,
  merchantRoutePaths,
  portMiniaturePlacements = new Map(),
}) {
  const onLand = (x, y) => isLandPoint(x, y, WORLD.w);
  const wrappedDistance = (x1, y1, x2, y2) => {
    const directX = Math.abs(x1 - x2);
    const dx = Math.min(directX, WORLD.w - directX);
    return Math.hypot(dx, y1 - y2);
  };
  const mapLayer = document.createElement("canvas");
  mapLayer.width = WORLD.w;
  mapLayer.height = WORLD.h;
  const m = mapLayer.getContext("2d");

  // A lower-resolution persistent exploration mask keeps fog rendering fast on
  // mobile while retaining a soft, hand-painted edge on the parchment chart.
  const FOG_MASK_SCALE = 0.18;
  const exploredMask = document.createElement("canvas");
  exploredMask.width = Math.ceil(WORLD.w * FOG_MASK_SCALE);
  exploredMask.height = Math.ceil(WORLD.h * FOG_MASK_SCALE);
  const exploredCtx = exploredMask.getContext("2d");
  const fogCanvas = document.createElement("canvas");
  const fogCtx = fogCanvas.getContext("2d");
  const minimapFog = document.createElement("canvas");
  minimapFog.width = 1200;
  minimapFog.height = 800;
  const minimapFogCtx = minimapFog.getContext("2d");

  function drawPortIcon(c, p) {
    c.save();
    c.translate(p.x, p.y);
    const regional = game.regionalEconomy[p.name];
    const evolution = regional ? portEvolution(regional) : {};
    c.fillStyle = "rgba(41,35,28,.16)";
    c.beginPath();
    c.ellipse(
      -LIGHT_DIRECTION.x * 15,
      -LIGHT_DIRECTION.y * 12,
      34,
      8,
      0,
      0,
      Math.PI * 2,
    );
    c.fill();
    const placement = portMiniaturePlacements.get(p.name);
    const illustrated = Boolean(placement);
    if (placement) {
      c.save();
      c.setLineDash([3, 4]);
      c.strokeStyle = "rgba(75,56,38,.48)";
      c.lineWidth = 1.2;
      for (const offset of [-WORLD.w, 0, WORLD.w]) {
        c.beginPath();
        c.moveTo(offset, 0);
        c.lineTo(placement.x - p.x + offset, placement.y - p.y);
        c.stroke();
      }
      c.restore();
      for (const offset of [-WORLD.w, 0, WORLD.w]) {
        c.save();
        c.translate(placement.x - p.x + offset, placement.y - p.y);
        c.scale(placement.scale, placement.scale);
        drawPortMiniature(c, p.name, evolution, placement.heading);
        c.restore();
      }
    }
    c.strokeStyle = "#291b10";
    c.fillStyle = "#a83f2f";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(0, 0, illustrated ? 5 : 8, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    if (!illustrated && evolution.warehouses) {
      c.fillStyle = "rgba(111,66,31,.78)";
      c.fillRect(7, -21, 20, 14);
      c.strokeRect(7, -21, 20, 14);
      c.fillStyle = "rgba(44,31,23,.28)";
      c.fillRect(22, -20, 5, 12);
      c.beginPath();
      c.moveTo(5, -21);
      c.lineTo(17, -29);
      c.lineTo(29, -21);
      c.stroke();
    }
    if (!illustrated && evolution.cranes) {
      c.beginPath();
      c.moveTo(31, -6);
      c.lineTo(31, -39);
      c.lineTo(52, -39);
      c.lineTo(39, -31);
      c.moveTo(47, -37);
      c.lineTo(47, -21);
      c.stroke();
    }
    if (!illustrated && evolution.foundries) {
      c.fillStyle = "rgba(67,51,38,.82)";
      c.fillRect(-39, -29, 9, 23);
      c.strokeRect(-39, -29, 9, 23);
      c.fillStyle = "rgba(76,67,56,.3)";
      c.beginPath();
      c.arc(-34, -37, 7, 0, Math.PI * 2);
      c.fill();
    }
    if (!illustrated && evolution.fortifications) {
      c.beginPath();
      c.moveTo(-45, -4);
      c.lineTo(-45, -18);
      c.lineTo(-39, -18);
      c.lineTo(-39, -13);
      c.lineTo(-31, -13);
      c.lineTo(-31, -4);
      c.stroke();
    }
    if (evolution.crisis) {
      c.fillStyle = "#8d231c";
      c.font = "700 18px Georgia";
      c.fillText("!", -52, -24);
    }
    if (!illustrated) {
      c.beginPath();
      c.moveTo(0, -10);
      c.lineTo(0, -34);
      c.lineTo(20, -25);
      c.lineTo(0, -18);
      c.stroke();
      c.lineWidth = 1.6;
      c.fillStyle = "rgba(85,55,28,.72)";
      c.fillRect(-25, -18, 8, 12);
      c.strokeRect(-25, -18, 8, 12);
      c.fillRect(-15, -25, 10, 19);
      c.strokeRect(-15, -25, 10, 19);
      c.fillStyle = "rgba(36,29,22,.26)";
      c.fillRect(-8, -24, 3, 18);
      c.beginPath();
      c.moveTo(-28, -18);
      c.lineTo(-21, -27);
      c.lineTo(-14, -18);
      c.stroke();
      c.beginPath();
      c.moveTo(-17, -25);
      c.lineTo(-10, -35);
      c.lineTo(-3, -25);
      c.stroke();
      c.strokeStyle = "rgba(244,211,148,.74)";
      c.lineWidth = 1.3;
      c.beginPath();
      c.moveTo(-28, -18);
      c.lineTo(-21, -27);
      c.lineTo(-17, -22);
      c.moveTo(-17, -25);
      c.lineTo(-10, -35);
      c.lineTo(-6, -29);
      c.stroke();
    }
    c.fillStyle = "#2a1b10";
    c.font = "700 20px Georgia";
    c.textAlign = "center";
    c.strokeStyle = "rgba(244,225,179,.8)";
    c.lineWidth = 3;
    c.strokeText(p.name, 0, 29);
    c.fillText(p.name, 0, 29);
    if (p.home) {
      c.font = "700 12px Georgia";
      c.fillStyle = "rgba(53,31,16,.82)";
      c.strokeText("HOME PORT", 0, 46);
      c.fillText("HOME PORT", 0, 46);
    }
    c.restore();
  }
  function polyPath(c, poly) {
    c.beginPath();
    poly.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    c.closePath();
  }
  function appendPolyPath(c, poly) {
    poly.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    c.closePath();
  }
  function translatedPoly(poly, offsetX) {
    return poly.map(([x, y]) => [x + offsetX, y]);
  }
  function polygonWorldOffsets(poly, margin = 0) {
    const xs = poly.map(([x]) => x);
    const offsets = [0];
    if (Math.min(...xs) < margin) offsets.push(WORLD.w);
    if (Math.max(...xs) > WORLD.w - margin) offsets.push(-WORLD.w);
    return offsets;
  }
  function drawWrappedPolyPath(c, poly, drawPath, margin = 0) {
    for (const offset of polygonWorldOffsets(poly, margin)) {
      drawPath(translatedPoly(poly, offset));
    }
  }
  function wrappedClipPath(c, poly) {
    c.beginPath();
    for (const offset of polygonWorldOffsets(poly)) {
      appendPolyPath(c, translatedPoly(poly, offset));
    }
  }
  function drawWaveGlyph(c, x, y, s = 1, alpha = 0.18) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    c.strokeStyle = `rgba(48,58,49,${alpha})`;
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(-7, 0, 7, Math.PI * 0.08, Math.PI * 0.92);
    c.arc(7, 0, 7, Math.PI * 0.08, Math.PI * 0.92);
    c.stroke();
    c.restore();
  }
  function drawRoughWaterMark(c, x, y, s, angle = 0, alpha = 0.32) {
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    c.scale(s, s);
    c.strokeStyle = `rgba(43,48,39,${alpha})`;
    c.lineCap = "round";
    c.lineWidth = 1.35;
    c.beginPath();
    c.moveTo(-14, 3);
    c.quadraticCurveTo(-8, -8, -2, 1);
    c.quadraticCurveTo(4, 10, 11, -2);
    c.quadraticCurveTo(15, -7, 20, 1);
    c.stroke();
    c.globalAlpha = 0.58;
    c.beginPath();
    c.moveTo(-9, 8);
    c.quadraticCurveTo(-3, 3, 3, 8);
    c.quadraticCurveTo(9, 13, 15, 7);
    c.stroke();
    c.restore();
  }
  function drawRock(c, x, y, s = 8) {
    c.save();
    c.translate(x, y);
    c.strokeStyle = "rgba(50,37,22,.72)";
    c.fillStyle = "rgba(105,79,44,.45)";
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(-s, 4);
    c.lineTo(-s * 0.42, -s * 0.72);
    c.lineTo(s * 0.15, -s);
    c.lineTo(s * 0.78, -s * 0.25);
    c.lineTo(s, 4);
    c.closePath();
    c.fill();
    c.stroke();
    c.beginPath();
    c.ellipse(0, 7, s * 1.5, s * 0.45, 0, 0, Math.PI * 2);
    c.strokeStyle = "rgba(65,54,34,.28)";
    c.stroke();
    c.restore();
  }
  function drawShoal(c, x, y, rx, ry, label) {
    const rnd = seeded(Math.round(x * 7 + y * 13));
    c.save();
    c.translate(x, y);
    c.rotate(-0.16);
    c.strokeStyle = "rgba(69,55,32,.28)";
    c.setLineDash([2, 6]);
    c.lineWidth = 1.2;
    for (let ring = 0; ring < 3; ring++) {
      c.beginPath();
      c.ellipse(0, 0, rx - ring * 12, ry - ring * 7, 0, 0, Math.PI * 2);
      c.stroke();
    }
    c.setLineDash([]);
    c.fillStyle = "rgba(68,52,28,.25)";
    for (let i = 0; i < 170; i++) {
      const a = rnd() * Math.PI * 2,
        r = Math.sqrt(rnd());
      c.fillRect(Math.cos(a) * rx * r, Math.sin(a) * ry * r, 1.2, 1.2);
    }
    c.restore();
    if (label) {
      c.save();
      c.fillStyle = "rgba(45,33,20,.7)";
      c.font = "italic 20px Georgia";
      c.textAlign = "center";
      c.fillText(label, x, y - ry - 13);
      c.restore();
    }
  }
  function drawRoute(c, points, label) {
    const unwrapped = unwrapPath(points, points[0][0], WORLD.w);
    for (const offset of [-WORLD.w, 0, WORLD.w]) {
      c.save();
      c.translate(offset, 0);
      c.strokeStyle = "rgba(55,39,22,.40)";
      c.fillStyle = "rgba(55,39,22,.50)";
      c.lineWidth = 1.7;
      c.setLineDash([9, 10]);
      c.beginPath();
      unwrapped.forEach((p, i) =>
        i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]),
      );
      c.stroke();
      c.setLineDash([]);
      for (let i = 1; i < unwrapped.length - 1; i++) {
        const [x, y] = unwrapped[i];
        c.save();
        c.translate(x, y);
        c.rotate(Math.PI / 4);
        c.strokeRect(-5, -5, 10, 10);
        c.restore();
      }
      if (label) {
        const mid = unwrapped[Math.floor(unwrapped.length / 2)];
        c.font = "italic 17px Georgia";
        c.textAlign = "center";
        c.fillText(label, mid[0], mid[1] - 16);
      }
      c.restore();
    }
  }
  function drawCurrent(c, x, y, angle, label) {
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    c.strokeStyle = "rgba(54,62,48,.34)";
    c.lineWidth = 2;
    for (let row = -1; row <= 1; row++) {
      c.beginPath();
      c.moveTo(-55, row * 15);
      c.bezierCurveTo(-15, row * 15 - 12, 20, row * 15 + 12, 55, row * 15);
      c.stroke();
      c.beginPath();
      c.moveTo(45, row * 15 - 7);
      c.lineTo(58, row * 15);
      c.lineTo(45, row * 15 + 7);
      c.stroke();
    }
    c.restore();
    c.save();
    c.fillStyle = "rgba(47,39,25,.58)";
    c.font = "italic 18px Georgia";
    c.textAlign = "center";
    c.fillText(label, x, y + 52);
    c.restore();
  }
  function drawSeaMonster(c, x, y, s = 1) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    c.strokeStyle = "rgba(51,39,23,.68)";
    c.fillStyle = "rgba(86,74,42,.22)";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-35, 18);
    c.bezierCurveTo(-10, -18, 8, -24, 20, -2);
    c.bezierCurveTo(32, 20, 13, 33, -3, 25);
    c.bezierCurveTo(-18, 18, -14, 5, -4, 2);
    c.stroke();
    c.beginPath();
    c.moveTo(15, -3);
    c.quadraticCurveTo(34, -25, 45, -12);
    c.quadraticCurveTo(52, -3, 38, 5);
    c.stroke();
    c.beginPath();
    c.arc(37, -10, 2.3, 0, Math.PI * 2);
    c.fillStyle = "rgba(45,31,18,.8)";
    c.fill();
    c.beginPath();
    c.moveTo(42, -18);
    c.lineTo(48, -29);
    c.lineTo(50, -16);
    c.stroke();
    c.beginPath();
    c.moveTo(-10, 26);
    c.bezierCurveTo(-20, 43, -38, 45, -45, 31);
    c.stroke();
    c.restore();
  }
  function drawCompassRose(c, cx, cy, r = 86) {
    c.save();
    c.translate(cx, cy);
    c.strokeStyle = "rgba(42,28,16,.78)";
    c.fillStyle = "rgba(91,59,28,.2)";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.arc(0, 0, r * 0.72, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    for (let i = 0; i < 32; i++) {
      const a = (i * Math.PI) / 16 - Math.PI / 2,
        rr =
          i % 8 === 0
            ? r * 0.92
            : i % 4 === 0
              ? r * 0.66
              : i % 2 === 0
                ? r * 0.46
                : r * 0.27;
      const px = Math.cos(a) * rr,
        py = Math.sin(a) * rr;
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.closePath();
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(0, -r * 0.96);
    c.lineTo(-9, 4);
    c.lineTo(0, -8);
    c.lineTo(9, 4);
    c.closePath();
    c.fillStyle = "rgba(48,31,17,.65)";
    c.fill();
    c.stroke();
    c.fillStyle = "rgba(45,30,17,.86)";
    c.font = "700 21px Georgia";
    c.textAlign = "center";
    c.fillText("N", 0, -r - 12);
    c.fillText("S", 0, r + 25);
    c.fillText("W", -r - 18, 7);
    c.fillText("E", r + 18, 7);
    c.restore();
  }

  function roundedRectPath(c, x, y, width, height, radius) {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    c.moveTo(x + safeRadius, y);
    c.lineTo(x + width - safeRadius, y);
    c.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    c.lineTo(x + width, y + height - safeRadius);
    c.quadraticCurveTo(
      x + width,
      y + height,
      x + width - safeRadius,
      y + height,
    );
    c.lineTo(x + safeRadius, y + height);
    c.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    c.lineTo(x, y + safeRadius);
    c.quadraticCurveTo(x, y, x + safeRadius, y);
    c.closePath();
  }

  function drawParchmentBase(c) {
    c.clearRect(0, 0, WORLD.w, WORLD.h);
    const base = c.createLinearGradient(0, 0, 0, WORLD.h);
    // Desaturated verdigris pigment, with the same paper grain and engraved
    // marks as the land. The sea reads as a watercolor wash on the atlas.
    base.addColorStop(0, "#b9c7af");
    base.addColorStop(0.5, "#93afa2");
    base.addColorStop(1, "#78998e");
    c.fillStyle = base;
    c.fillRect(0, 0, WORLD.w, WORLD.h);
    const rnd = seeded(9917);
    c.save();
    for (let i = 0; i < 110; i++) {
      const x = rnd() * WORLD.w;
      const y = rnd() * WORLD.h;
      const radius = 120 + rnd() * 280;
      // Repeat pigment blooms over the seam, just like the land contours.
      for (const offset of [-WORLD.w, 0, WORLD.w]) {
        const wash = c.createRadialGradient(
          x + offset,
          y,
          0,
          x + offset,
          y,
          radius,
        );
        wash.addColorStop(
          0,
          i % 3 ? "rgba(31,91,91,.10)" : "rgba(245,228,172,.16)",
        );
        wash.addColorStop(1, "rgba(134,169,148,0)");
        c.fillStyle = wash;
        c.fillRect(x + offset - radius, y - radius, radius * 2, radius * 2);
      }
    }
    for (let i = 0; i < 85; i++) {
      const x = rnd() * WORLD.w,
        y = rnd() * WORLD.h,
        rx = 18 + rnd() * 120,
        ry = 10 + rnd() * 72;
      const g = c.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
      g.addColorStop(0, `rgba(88,48,18,${0.02 + rnd() * 0.07})`);
      g.addColorStop(1, "rgba(88,48,18,0)");
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(x, y, rx, ry, rnd() * Math.PI, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 0.2;
    for (let i = 0; i < 26000; i++) {
      const x = rnd() * WORLD.w,
        y = rnd() * WORLD.h,
        a = 0.08 + rnd() * 0.34;
      c.fillStyle = `rgba(70,42,20,${a})`;
      c.fillRect(x, y, 0.5 + rnd() * 1.7, 0.5 + rnd() * 1.7);
    }
    c.globalAlpha = 0.13;
    c.strokeStyle = "rgba(72,40,17,.55)";
    for (let i = 0; i < 1300; i++) {
      const x = rnd() * WORLD.w,
        y = rnd() * WORLD.h,
        len = 7 + rnd() * 32;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + len, y + (rnd() - 0.5) * 2);
      c.stroke();
    }
    c.restore();
    // folded creases
    c.save();
    c.globalAlpha = 0.18;
    c.strokeStyle = "rgba(76,42,17,.34)";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(WORLD.w * 0.49, 0);
    c.bezierCurveTo(
      WORLD.w * 0.5,
      320,
      WORLD.w * 0.47,
      760,
      WORLD.w * 0.5,
      WORLD.h,
    );
    c.stroke();
    c.strokeStyle = "rgba(255,244,205,.32)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(WORLD.w * 0.49 + 4, 0);
    c.bezierCurveTo(
      WORLD.w * 0.5 + 4,
      320,
      WORLD.w * 0.47 + 4,
      760,
      WORLD.w * 0.5 + 4,
      WORLD.h,
    );
    c.stroke();
    c.restore();
    // Polar wear darkens north and south only. East and west remain seamless
    // because those chart edges touch when sailing around the globe.
    const polar = c.createLinearGradient(0, 0, 0, WORLD.h);
    polar.addColorStop(0, "rgba(49,24,8,.43)");
    polar.addColorStop(0.08, "rgba(75,39,14,.12)");
    polar.addColorStop(0.22, "rgba(75,39,14,0)");
    polar.addColorStop(0.78, "rgba(75,39,14,0)");
    polar.addColorStop(0.92, "rgba(75,39,14,.12)");
    polar.addColorStop(1, "rgba(49,24,8,.43)");
    c.fillStyle = polar;
    c.fillRect(0, 0, WORLD.w, WORLD.h);
  }
  function buildMapLayer() {
    drawParchmentBase(m);
    const rnd = seeded(91);

    // sea glyphs and tiny ink specks
    for (let y = 55; y < WORLD.h - 40; y += 31) {
      for (
        let x = 45 + (Math.floor(y / 31) % 2) * 36;
        x < WORLD.w - 40;
        x += 76
      ) {
        if (!onLand(x, y) && rnd() > 0.11)
          drawWaveGlyph(
            m,
            x + (rnd() - 0.5) * 18,
            y + (rnd() - 0.5) * 8,
            0.58 + rnd() * 0.55,
            0.1 + rnd() * 0.11,
          );
      }
    }
    roughSeas.forEach((sea, seaIndex) => {
      const seaRnd = seeded(8200 + seaIndex * 97);
      for (let i = 0; i < 155 * sea.strength; i++) {
        const theta = seaRnd() * Math.PI * 2;
        const radius = Math.sqrt(seaRnd());
        const x = sea.x + Math.cos(theta) * sea.rx * radius;
        const y = sea.y + Math.sin(theta) * sea.ry * radius;
        if (!onLand(x, y)) {
          drawRoughWaterMark(
            m,
            x,
            y,
            0.55 + seaRnd() * 0.75,
            sea.angle + (seaRnd() - 0.5) * 0.32,
            0.15 + seaRnd() * 0.14,
          );
        }
      }
    });

    // Trade routes are generated with the same transform as their ports.
    merchantRoutePaths.forEach((route) => drawRoute(m, route.points, null));

    // shoals, bars, currents and hazards
    worldShoals.forEach((values) => drawShoal(m, ...values));
    worldCurrents.forEach((values) => drawCurrent(m, ...values));
    worldMonsters.forEach((values) => drawSeaMonster(m, ...values));

    // small islets and reefs, visually rich but not collision obstacles
    for (let i = 0; i < 210; i++) {
      let x = rnd() * WORLD.w,
        y = rnd() * WORLD.h,
        guard = 0;
      while (
        (onLand(x, y) ||
          ports.some((p) => wrappedDistance(x, y, p.x, p.y) < 70)) &&
        guard++ < 20
      ) {
        x = rnd() * WORLD.w;
        y = rnd() * WORLD.h;
      }
      if (!onLand(x, y)) drawRock(m, x, y, 4 + rnd() * 8);
    }

    // Latitude and longitude lines reinforce that this is an encircling world.
    m.save();
    m.strokeStyle = "rgba(62,45,26,.13)";
    m.lineWidth = 1;
    m.setLineDash([5, 12]);
    for (let x = 0; x <= WORLD.w; x += 800) {
      m.beginPath();
      m.moveTo(x, 35);
      m.lineTo(x, WORLD.h - 35);
      m.stroke();
    }
    for (let y = 400; y < WORLD.h; y += 400) {
      m.beginPath();
      m.moveTo(0, y);
      m.lineTo(WORLD.w, y);
      m.stroke();
    }
    m.setLineDash([]);
    m.strokeStyle = "rgba(55,32,16,.72)";
    m.lineWidth = 7;
    m.beginPath();
    m.moveTo(0, 21);
    m.lineTo(WORLD.w, 21);
    m.moveTo(0, WORLD.h - 21);
    m.lineTo(WORLD.w, WORLD.h - 21);
    m.stroke();
    m.strokeStyle = "rgba(92,58,29,.58)";
    m.lineWidth = 2;
    m.beginPath();
    m.moveTo(0, 34);
    m.lineTo(WORLD.w, 34);
    m.moveTo(0, WORLD.h - 34);
    m.lineTo(WORLD.w, WORLD.h - 34);
    m.stroke();
    m.restore();

    const mountainLands = new Set([
      LAND_NAMES.thrymmSpires,
      LAND_NAMES.drazhmark,
      LAND_NAMES.veyrAshreach,
      LAND_NAMES.sivvynIsle,
      LAND_NAMES.thornvayle,
      LAND_NAMES.sythrenCoast,
      LAND_NAMES.orynthSteppe,
      LAND_NAMES.aurelmarch,
      LAND_NAMES.solvyrMarch,
      LAND_NAMES.verdantate,
      LAND_NAMES.stormvaneCrown,
      PORT_NAMES.ossuwhale,
      LAND_NAMES.rimevault,
    ]);

    // islands with layered coast contours and internal parchment texture
    lands.forEach((l, li) => {
      // Layered shallow-water pigment and an ivory tide line sit underneath
      // the engraved coast and raised cliffs. Built once, not each frame.
      for (const [width, color] of [
        [62, "rgba(50,110,100,.08)"],
        [42, "rgba(195,210,164,.16)"],
        [25, "rgba(220,224,178,.24)"],
        [12, "rgba(249,234,188,.45)"],
      ]) {
        drawWrappedPolyPath(
          m,
          l.poly,
          (poly) => {
            m.save();
            m.translate(0, 38 * MAP_TILT_TAN);
            polyPath(m, poly);
            m.lineJoin = "round";
            m.strokeStyle = color;
            m.lineWidth = width;
            m.stroke();
            m.restore();
          },
          70,
        );
      }
      for (const off of [22, 14, 7]) {
        drawWrappedPolyPath(m, expandPolygon(l.poly, off), (poly) => {
          polyPath(m, poly);
          m.strokeStyle = `rgba(54,43,25,${off === 22 ? 0.22 : off === 14 ? 0.34 : 0.48})`;
          m.lineWidth = off === 22 ? 2 : 1.5;
          m.stroke();
        });
      }
      // Each coast has a vertical face projected from the raised top edge to
      // the sea plane. Back faces are hidden by the land surface drawn next.
      const coastDepth = 38 * MAP_TILT_TAN;
      drawWrappedPolyPath(
        m,
        l.poly,
        (poly) => {
          m.save();
          m.shadowColor = "rgba(35,22,10,.46)";
          m.shadowBlur = 12;
          m.shadowOffsetY = 4;
          m.translate(0, coastDepth);
          polyPath(m, poly);
          m.fillStyle = "#5e4629";
          m.fill();
          m.restore();

          let area = 0;
          for (let i = 0; i < poly.length; i++) {
            const a = poly[i];
            const b = poly[(i + 1) % poly.length];
            area += a[0] * b[1] - b[0] * a[1];
          }
          const facing = Math.sign(area) || 1;
          for (let i = 0; i < poly.length; i++) {
            const a = poly[i];
            const b = poly[(i + 1) % poly.length];
            if ((b[0] - a[0]) * facing >= 0) continue;
            m.beginPath();
            m.moveTo(a[0], a[1]);
            m.lineTo(b[0], b[1]);
            m.lineTo(b[0], b[1] + coastDepth);
            m.lineTo(a[0], a[1] + coastDepth);
            m.closePath();
            m.fillStyle = b[1] > a[1] ? "#a38354" : "#80613e";
            m.fill();
            m.save();
            m.clip();
            const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
            m.strokeStyle = "rgba(235,211,164,.24)";
            m.lineWidth = 0.9;
            for (const layer of [0.28, 0.67]) {
              m.beginPath();
              m.moveTo(a[0], a[1] + coastDepth * layer);
              m.lineTo(b[0], b[1] + coastDepth * layer);
              m.stroke();
            }
            m.strokeStyle = "rgba(45,35,25,.28)";
            m.lineWidth = 1;
            for (let step = 8; step < length; step += 13) {
              const t = step / length;
              const x = a[0] + (b[0] - a[0]) * t;
              const y = a[1] + (b[1] - a[1]) * t;
              m.beginPath();
              m.moveTo(x, y + 2);
              m.lineTo(x + 2, y + coastDepth * 0.75);
              m.stroke();
            }
            m.restore();
          }
        },
        40,
      );
      drawWrappedPolyPath(m, l.poly, (poly) => {
        polyPath(m, poly);
        const top = Math.min(...poly.map(([, y]) => y));
        const bottom = Math.max(...poly.map(([, y]) => y));
        const pigment = m.createLinearGradient(0, top, 0, bottom);
        pigment.addColorStop(0, terrainPalette(terrainBiome(l.name)).paper);
        pigment.addColorStop(1, l.color);
        m.fillStyle = pigment;
        m.fill();
        m.strokeStyle = "#3b2b1a";
        m.lineWidth = 7;
        m.stroke();
        polyPath(m, poly);
        m.strokeStyle = "rgba(230,211,157,.54)";
        m.lineWidth = 2;
        m.stroke();
      });

      // land stipple and short hatching clipped to each island
      m.save();
      wrappedClipPath(m, l.poly);
      m.clip();
      const lr = seeded(400 + li * 31);
      m.fillStyle = "rgba(52,38,22,.16)";
      for (let i = 0; i < 320; i++) {
        const x = lr() * WORLD.w,
          y = lr() * WORLD.h;
        if (pointInWrappedPolygon(x, y, l.poly, WORLD.w))
          m.fillRect(x, y, 1 + lr() * 1.5, 1 + lr() * 1.5);
      }
      m.strokeStyle = "rgba(47,36,23,.12)";
      m.lineWidth = 1;
      for (let i = 0; i < 90; i++) {
        const x = lr() * WORLD.w,
          y = lr() * WORLD.h;
        if (pointInWrappedPolygon(x, y, l.poly, WORLD.w)) {
          m.beginPath();
          m.moveTo(x, y);
          m.lineTo(x + 8 + lr() * 12, y - 3 - lr() * 5);
          m.stroke();
        }
      }
      m.restore();

      const center = polygonCentroid(l.poly);
      const clearings = ports.map((port) => ({
        x: port.x + Math.round((center.x - port.x) / WORLD.w) * WORLD.w,
        y: port.y,
        rx: Math.max(48, port.name.length * 5.5),
        ry: 50,
      }));
      if (l.name)
        clearings.push({
          x: center.x,
          y: center.y - 8,
          rx: Math.max(45, l.name.length * 7),
          ry: 23,
        });
      const terrain = planTerrainIllustration(l.poly, 1349 + li * 97, {
        mountainous: mountainLands.has(l.name),
        biome: terrainBiome(l.name),
        clearings,
      });
      m.save();
      wrappedClipPath(m, l.poly);
      m.clip();
      for (const offset of polygonWorldOffsets(l.poly)) {
        m.save();
        m.translate(offset, 0);
        drawTerrainIllustration(m, terrain);
        m.restore();
      }
      m.restore();

      // Short, irregular hachures give the shore the engraved depth of a
      // navigator's hand-inked chart without obscuring ports or terrain.
      m.save();
      m.strokeStyle = "rgba(48,34,20,.25)";
      m.lineWidth = 1;
      for (let i = 0; i < l.poly.length; i += 3) {
        const [x, y] = l.poly[i];
        const cent = polygonCentroid(l.poly);
        const dx = x - cent.x,
          dy = y - cent.y,
          distance = Math.hypot(dx, dy) || 1,
          nx = dx / distance,
          ny = dy / distance;
        for (let hatch = 0; hatch < 3; hatch++) {
          const shift = hatch * 5;
          m.beginPath();
          m.moveTo(x + nx * (9 + shift), y + ny * (9 + shift));
          m.lineTo(x + nx * (18 + shift), y + ny * (18 + shift));
          m.stroke();
        }
      }
      m.restore();
    });

    lands.forEach((land) => {
      if (!land.name) return;
      const center = polygonCentroid(land.poly);
      m.save();
      m.fillStyle = "rgba(46,34,20,.58)";
      m.strokeStyle = "rgba(204,186,133,.48)";
      m.lineWidth = 2.5;
      m.lineJoin = "round";
      m.font = "italic 29px Georgia";
      m.textAlign = "center";
      for (const offset of polygonWorldOffsets(land.poly)) {
        m.strokeText(land.name, center.x + offset, center.y);
        m.fillText(land.name, center.x + offset, center.y);
      }
      m.restore();
    });

    ports.forEach((p) => drawPortIcon(m, p));

    // sea regions, calligraphic labels, and decorative flourishes
    m.fillStyle = "rgba(45,42,29,.55)";
    m.textAlign = "center";
    for (const [label, x, y, size] of seaRegionLabels) {
      m.font = "italic " + size + "px Georgia";
      m.fillText(label, x, y);
    }

    drawCompassRose(m, WORLD.w * 0.36, WORLD.h * 0.1, 84);
    drawCompassRose(m, WORLD.w * 0.72, WORLD.h * 0.13, 70);
    drawCompassRose(m, WORLD.w * 0.94, WORLD.h * 0.88, 66);

    // title cartouche in the empty northwestern sea
    m.save();
    m.translate(WORLD.w * 0.08, WORLD.h * 0.08);
    m.strokeStyle = "rgba(56,34,17,.55)";
    m.fillStyle = "rgba(222,195,135,.25)";
    m.lineWidth = 2;
    m.beginPath();
    roundedRectPath(m, -130, -45, 260, 90, 18);
    m.fill();
    m.stroke();
    m.fillStyle = "rgba(47,29,15,.78)";
    m.font = "700 24px Georgia";
    m.textAlign = "center";
    m.fillText("THE ENCIRCLING WORLD", 0, -5);
    m.font = "italic 15px Georgia";
    m.fillText("East and west meet beyond the First Meridian", 0, 20);
    m.restore();
  }

  buildMapLayer();
  return {
    exploredCtx,
    exploredMask,
    FOG_MASK_SCALE,
    fogCanvas,
    fogCtx,
    mapLayer,
    minimapFog,
    minimapFogCtx,
  };
}
