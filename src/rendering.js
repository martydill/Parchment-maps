import { PORT_NAMES, LAND_NAMES } from "./names.js";
import {
  expandPolygon,
  pointInWrappedPolygon,
  polygonCentroid,
} from "./core/geometry.js";
import { unwrapPath } from "./core/routes.js";
import { portEvolution } from "./core/regional.js";
import { MAP_TILT_TAN } from "./core/projection.js";
import { coastFaceDepth } from "./core/seascape.js";
import { LIGHT_DIRECTION, litPigment } from "./core/lighting.js";
import {
  WIND_ROSE_NAMES,
  cartoucheInscription,
  coastAspect,
  createRhumbWeb,
  edgeDepthAt,
  foldCreases,
  foxingClusters,
  islandTint,
  portChartLabel,
  rhumbInk,
  rhumbRayAngles,
  scaleBarSpec,
  tatteredEdge,
  tidelineRingPoints,
  tidelines,
  waxDrops,
} from "./core/chart-decor.js";
import { createRadialStamp } from "./radial-stamp.js";
import { GRAPHICS_PROFILES } from "./core/graphics-quality.js";
import { weatherAppearance } from "./core/weather.js";
import { planTerrainIllustration, terrainBiome } from "./core/terrain.js";
import {
  drawTerrainIllustration,
  terrainPalette,
} from "./terrain-rendering.js?v=3";
export {
  drawMerchantShip,
  drawShip,
  shipDrawProfile,
} from "./ship-rendering.js?v=4";
import {
  lands,
  ports,
  roughSeas,
  seaRegionLabels,
  worldCurrents,
  worldMonsters,
  worldShoals,
} from "./world-data.js";

const REGIONAL_PIGMENTS = [
  "#aa6446",
  "#5f8279",
  "#8c7452",
  "#6f7890",
  "#876b84",
  "#7d885b",
];

export function portAccentColor(port) {
  if (port.home) return "#bb8544";
  const region = port.land || port.realm || port.name;
  let hash = 0;
  for (const character of region)
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return REGIONAL_PIGMENTS[hash % REGIONAL_PIGMENTS.length];
}

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

// At most 28 clouds with four puffs each. Rebuild a puff's stamp only when
// its pigment changes; motion and thickness use transforms and globalAlpha.
const cloudPuffStyles = Array.from({ length: 28 * 4 }, () => ({
  rgb: "",
  alpha: 0,
  stamp: null,
}));
let cloudStyleCloud = -1;
let cloudStyleStorm = -1;
let cloudShadowStamp;
const fogBankStamps = [];
let stormFrontStamp;
let sunbreakStamp;
let sunbeamStamp;

function drawStormFront(c, front, windAngle, vw, vh, time) {
  if (!front || front.storm <= 0.01 || front.cloud <= 0.01) return;
  stormFrontStamp ||= createRadialStamp({
    size: 256,
    stops: [
      [0, "rgba(25,39,59,1)"],
      [0.55, "rgba(38,52,68,.65)"],
      [1, "rgba(38,52,68,0)"],
    ],
  });
  const span = Math.hypot(vw, vh);
  c.save();
  c.translate(vw / 2, vh / 2);
  c.rotate(windAngle);
  c.globalAlpha *= front.cloud * front.storm * 0.24;
  // One connected bank advances from the windward edge. Uneven scallops and
  // a broad transparent falloff leave a readable clear side of the front.
  const advance = -span * (0.72 - front.storm * 0.65);
  for (let i = 0; i < 6; i++) {
    const drift = Math.sin(time * 0.00012 + i * 1.7) * 22;
    const radius = span * (0.42 + weatherRand(i, 91) * 0.1);
    c.drawImage(
      stormFrontStamp,
      advance + drift - radius,
      (i / 5 - 0.5) * span - radius * 0.65,
      radius * 2,
      radius * 1.3,
    );
  }
  c.restore();
}

function drawSunbreak(c, strength, daylight, vw, vh, time) {
  const light = strength * daylight;
  if (light <= 0.01) return;
  sunbreakStamp ||= createRadialStamp({
    size: 256,
    stops: [
      [0, "rgba(255,234,171,1)"],
      [0.5, "rgba(255,238,192,.35)"],
      [1, "rgba(255,238,192,0)"],
    ],
  });
  sunbeamStamp ||= createRadialStamp({
    size: 256,
    stops: [
      [0, "rgba(255,241,193,1)"],
      [0.5, "rgba(255,241,193,.6)"],
      [1, "rgba(255,241,193,0)"],
    ],
  });
  c.save();
  c.globalCompositeOperation = "screen";
  c.globalAlpha *= light * 0.28;
  const opening = vw * 0.68 + Math.sin(time * 0.00008) * vw * 0.025;
  for (let i = 0; i < 3; i++) {
    // Stretched falloffs give each shaft soft edges and a tapered end.
    c.save();
    c.translate(opening + (i - 1) * vw * 0.16 - vw * 0.2, vh * 0.46);
    c.rotate(Math.atan2(vw * (0.28 + i * 0.035), vh));
    c.drawImage(sunbeamStamp, -vw * 0.055, -vh * 0.85, vw * 0.11, vh * 1.7);
    c.restore();
  }
  c.drawImage(sunbreakStamp, opening - vw * 0.65, -vh * 0.2, vw, vh * 1.4);
  c.restore();
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
  cullOffscreen = false,
  particleScale = 1,
) {
  if (cloud <= 0.01) return;
  const count = Math.round((8 + cloud * 9 + storm * 11) * particleScale);
  // Clouds roll across the whole screen with the wind — fast enough to read
  // as motion even when the wind blows mostly north/south, and over the
  // player's circle of visibility rather than only at the horizon.
  const rollDir = Math.cos(windAngle) >= 0 ? 1 : -1;
  const rollSpeed = 0.022 + windStrength * 0.05 + storm * 0.05;
  const sway = Math.sin(windAngle);
  c.save();
  c.rotate(windAngle);
  const cos = Math.cos(-windAngle);
  const sin = Math.sin(-windAngle);

  // Pre-calculate common values to reduce redundant calculations
  const stormLightBoost = storm * 0.12;
  const fairLightBoost = (1 - storm) * 0.58;
  const cloudAlphaFactor = (0.55 + cloud * 0.5) * (0.7 + storm * 0.5);
  const stormTint = storm > 0.4 ? 8 : 0;
  const colorsChanged = cloudStyleCloud !== cloud || cloudStyleStorm !== storm;
  const baseAlpha = c.globalAlpha;

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
      const styleIndex = i * 4 + j;
      const style = cloudPuffStyles[styleIndex];
      if (colorsChanged) {
        const puffLight = clamp01(
          baseLight + (weatherRand(i * 7 + j, 12) - 0.5) * 0.4,
        );
        const val = 45 + puffLight * 205;
        const tint = (weatherRand(i * 5 + j, 13) - 0.5) * 18;
        const cr = clamp255(val + tint);
        const cg = clamp255(val + tint * 0.5);
        const cb = clamp255(val - tint * 0.3 + stormTint);
        style.alpha = alpha * (0.6 + weatherRand(i * 4 + j, 15) * 0.5);
        const rgb = `${cr},${cg},${cb}`;
        if (style.rgb !== rgb) {
          // The falloff never changes. Retint its alpha mask instead of
          // allocating a gradient and resizing a texture as the storm evolves.
          style.stamp ||= createRadialStamp({
            aspectRatio: 0.7,
            size: 192,
            stops: [
              [0, "rgba(255,255,255,1)"],
              [0.7, "rgba(255,255,255,0.4)"],
              [1, "rgba(255,255,255,0)"],
            ],
          });
          const pigment = style.stamp.getContext("2d");
          pigment.save();
          pigment.globalCompositeOperation = "source-in";
          pigment.fillStyle = `rgb(${rgb})`;
          pigment.fillRect(0, 0, style.stamp.width, style.stamp.height);
          pigment.restore();
          style.rgb = rgb;
        }
      }
      const pr = rx * (0.55 + weatherRand(i * 3 + j, 14) * 0.4);
      if (
        cullOffscreen &&
        (px + pr < -1 || px - pr > vw + 1 || py + pr < -1 || py - pr > vh + 1)
      )
        continue;
      const unrotX = px * cos - py * sin;
      const unrotY = px * sin + py * cos;
      c.globalAlpha = baseAlpha * style.alpha;
      c.drawImage(style.stamp, unrotX - pr, unrotY - pr, pr * 2, pr * 2);
    }
  }

  c.restore();
  cloudStyleCloud = cloud;
  cloudStyleStorm = storm;
}

function drawCloudShadows(c, cloud, storm, windAngle, vw, vh, time) {
  if (cloud < 0.1) return;
  const direction = Math.cos(windAngle) >= 0 ? 1 : -1;
  cloudShadowStamp ||= createRadialStamp({
    stops: [
      [0, "rgba(28,47,58,1)"],
      [1, "rgba(28,47,58,0)"],
    ],
  });
  c.save();
  c.globalAlpha *= cloud * (0.035 + storm * 0.085);
  for (let index = 0; index < 7; index++) {
    const span = vw + 600;
    const drift = (time * (0.012 + index * 0.001) * direction) % span;
    const x = ((weatherRand(index, 30) * span + drift + span) % span) - 300;
    const y = weatherRand(index, 31) * (vh + 250) - 125;
    const radius = 170 + weatherRand(index, 32) * 120;
    c.save();
    c.translate(x, y);
    c.rotate(windAngle * 0.2);
    c.scale(1, 0.55);
    c.drawImage(cloudShadowStamp, -radius, -radius, radius * 2, radius * 2);
    c.restore();
  }
  c.restore();
}

function drawRainImpacts(c, rain, vw, vh, time, particleScale = 1) {
  if (rain < 0.15) return;
  c.save();
  c.strokeStyle = `rgba(225,237,228,${rain * 0.2})`;
  c.lineWidth = 0.9;
  const count = Math.round((12 + rain * 35) * particleScale);
  for (let index = 0; index < count; index++) {
    const phase = (time * 0.0017 + weatherRand(index, 40)) % 1;
    const x = weatherRand(index, 41) * vw;
    const y = weatherRand(index, 42) * vh;
    c.globalAlpha = Math.sin(phase * Math.PI);
    c.beginPath();
    c.ellipse(x, y, 1 + phase * 8, (1 + phase * 8) * 0.35, 0, 0, Math.PI * 2);
    c.stroke();
  }
  c.restore();
}

function drawWeatherFog(c, fog, vw, vh, time, particleScale = 1) {
  if (fog <= 0.01) return;
  c.save();
  // Flat wash mutes the whole scene into murk.
  c.fillStyle = `rgba(216,220,224,${fog * 0.045})`;
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
  const count = Math.round((4 + Math.round(fog * 5)) * particleScale);
  const baseAlpha = fog;
  const span = vw + 500;
  const inheritedAlpha = c.globalAlpha;

  for (let i = 0; i < count; i++) {
    const speed = 0.004 + weatherRand(i, 11) * 0.01;
    let x = (weatherRand(i, 12) * span + time * speed) % span;
    if (x < 0) x += span;
    x -= 250;
    const y = weatherRand(i, 13) * (vh + 300) - 150;
    const rx = 220 + weatherRand(i, 14) * 220;
    const ry = 90 + weatherRand(i, 15) * 70;
    const a = (0.05 + weatherRand(i, 16) * 0.06) * baseAlpha;
    // Each bank's aspect ratio is deterministic and independent of weather.
    fogBankStamps[i] ||= createRadialStamp({
      aspectRatio: ry / rx,
      stops: [
        [0, "rgba(224,228,232,1)"],
        [1, "rgba(224,228,232,0)"],
      ],
    });
    c.globalAlpha = inheritedAlpha * a;
    c.drawImage(fogBankStamps[i], x - rx, y - rx, rx * 2, rx * 2);
  }
  c.restore();
}

// Cache for directional fog calculations
const dirFogCache = {
  context: null,
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
    dirFogCache.context === c &&
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
  dirFogCache.context = c;
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

function drawWeatherRain(
  c,
  rain,
  windAngle,
  windStrength,
  vw,
  vh,
  time,
  particleScale = 1,
) {
  if (rain <= 0.01) return;
  const count = Math.round(rain * 330 * particleScale);
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

// `bolt` comes from a graphics profile: intervalScale spaces strikes further
// apart, segments simplify the jag, and glow drops the expensive shadow pass.
function drawWeatherLightning(c, lightning, vw, vh, time, bolt) {
  if (lightning <= 0.01) {
    lightningState.flashUntil = 0;
    return;
  }
  const pace = bolt || GRAPHICS_PROFILES.high.lightning;
  const s = lightningState;
  if (time >= s.nextStrike) {
    s.flashUntil = time + 150 + lightning * 90;
    s.boltX = vw * (0.12 + weatherRand(time | 0, 31) * 0.76);
    s.boltSeed = (time | 0) & 0xffff;
    // Heavier storms throw strikes more often.
    s.nextStrike =
      time +
      2400 * pace.intervalScale +
      weatherRand(time | 0, 32) *
        (5600 - lightning * 3000) *
        pace.intervalScale;
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
    if (pace.glow) {
      c.shadowColor = "rgba(214,226,255,0.95)";
      c.shadowBlur = 22;
    }
    c.beginPath();
    let bx = s.boltX;
    c.moveTo(bx, 0);
    const segs = pace.segments;
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

    this.lastName = name;
    this.lastRoughness = roughness;
    this.lastVisibilityKm = visibilityKm;
    this.cachedResult = weatherAppearance({ name, roughness, visibilityKm });

    return this.cachedResult;
  },
};

let softWeatherCanvas;
let softWeatherContext;

function weatherSoftContext(opts, target) {
  if (!opts.softLayerScale) return target;
  softWeatherCanvas ||= document.createElement("canvas");
  softWeatherContext ||= softWeatherCanvas.getContext("2d");
  const width = Math.ceil(opts.vw * opts.softLayerScale);
  const height = Math.ceil(opts.vh * opts.softLayerScale);
  if (
    softWeatherCanvas.width !== width ||
    softWeatherCanvas.height !== height
  ) {
    softWeatherCanvas.width = width;
    softWeatherCanvas.height = height;
    dirFogCache.valid = false;
  }
  const soft = softWeatherContext;
  soft.setTransform(1, 0, 0, 1, 0, 0);
  soft.clearRect(0, 0, width, height);
  soft.globalAlpha = 1;
  soft.globalCompositeOperation = "source-over";
  soft.setTransform(width / opts.vw, 0, 0, height / opts.vh, 0, 0);
  return soft;
}

// Renders the full atmospheric stack for the current weather. `opts.roughness`
// and `opts.visibilityKm` come from the interpolated weather pattern; the name
// adds hints (mist/fog/cloud/rain) on top of the continuous values.
export function drawWeatherEffects(c, opts) {
  const roughness = opts.roughness || 0;
  const visibilityKm = opts.visibilityKm;
  const vw = opts.vw;
  const vh = opts.vh;
  const time = opts.reducedMotion ? 0 : opts.time || 0;
  const windAngle = opts.windAngle || 0;
  const windStrength = opts.windStrength || 0;
  const aheadVisibilityKm = opts.aheadVisibilityKm;
  const asternVisibilityKm = opts.asternVisibilityKm;
  const headingAngle = opts.headingAngle || 0;
  const particleScale = Number.isFinite(opts.particleScale)
    ? Math.max(0, Math.min(1, opts.particleScale))
    : 1;

  let weather =
    opts.front ?? weatherCache.calculate(opts.name, roughness, visibilityKm);
  // A named squall zone still takes precedence over a distant fair-weather front.
  if (opts.front && opts.name === "Squall waters") {
    const local = weatherCache.calculate(opts.name, roughness, visibilityKm);
    weather = { ...weather, sunbreak: 0 };
    for (const channel of ["storm", "cloud", "rain", "lightning"])
      weather[channel] = Math.max(weather[channel], local[channel]);
  }
  const { storm, fog, cloud, rain, lightning } = weather;

  if (storm <= 0.01 && fog <= 0.01 && cloud <= 0.01 && rain <= 0.01) return;

  // Cloud banks, washes, and fog are soft images. Composite them at a lower
  // resolution once; rain, lightning, and clearing rays retain sharp geometry.
  const soft = weatherSoftContext(opts, c);
  // A cool wash unifies the weather while leaving chart ink legible.
  if (storm > 0.01) {
    soft.save();
    soft.fillStyle = `rgba(49,72,98,${storm * 0.18})`;
    soft.fillRect(0, 0, vw, vh);
    soft.restore();
  }

  drawCloudShadows(soft, cloud, storm, windAngle, vw, vh, time);
  drawStormFront(soft, weather, windAngle, vw, vh, time);
  drawWeatherClouds(
    soft,
    cloud,
    storm,
    windAngle,
    windStrength,
    vw,
    vh,
    time,
    Boolean(opts.softLayerScale),
    particleScale,
  );
  drawWeatherFog(soft, fog, vw, vh, time, particleScale);
  drawDirectionalFog(
    soft,
    aheadVisibilityKm,
    asternVisibilityKm,
    headingAngle,
    vw,
    vh,
  );
  if (soft !== c) c.drawImage(softWeatherCanvas, 0, 0, vw, vh);
  drawWeatherRain(
    c,
    rain,
    windAngle,
    windStrength,
    vw,
    vh,
    time,
    particleScale,
  );
  drawRainImpacts(c, rain, vw, vh, time, particleScale);
  drawSunbreak(c, weather.sunbreak || 0, opts.daylight ?? 1, vw, vh, time);
  // A frozen animation clock must not leave a lightning flash stuck on screen.
  drawWeatherLightning(
    c,
    opts.reducedMotion ? 0 : lightning,
    vw,
    vh,
    time,
    opts.lightning,
  );
}

export function drawSceneLightWash(c, lighting, width, height) {
  c.save();
  if (lighting.daylight > 0.01) {
    c.globalCompositeOperation = "screen";
    c.fillStyle = `rgba(191,226,246,${lighting.daylight * (1 - lighting.storm) * 0.075})`;
    c.fillRect(0, 0, width, height);
    c.globalCompositeOperation = "source-over";
  }
  const twilight = Math.max(lighting.sunrise || 0, lighting.sunset || 0);
  if (twilight > 0.01) {
    c.fillStyle = `rgba(225,116,58,${twilight * 0.16})`;
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
  // The weathered-skin photograph may arrive after the first bake (it is
  // fetched out of band, without a top-level await, so the es2020 bundle
  // stays valid); assigning it re-bakes the sheet in place.
  let parchmentTexture = null;
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
  const riverPaths = [];

  // A lower-resolution persistent exploration mask keeps fog rendering fast on
  // mobile while retaining a soft, hand-painted edge on the parchment chart.
  const FOG_MASK_SCALE = 0.18;
  const exploredMask = document.createElement("canvas");
  exploredMask.width = Math.ceil(WORLD.w * FOG_MASK_SCALE);
  exploredMask.height = Math.ceil(WORLD.h * FOG_MASK_SCALE);
  const exploredCtx = exploredMask.getContext("2d", {
    willReadFrequently: true,
  });
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
      // Cached architectural plates are drawn with the live trade world so
      // investment and crises update the skyline without rebaking the atlas.
    }
    c.strokeStyle = "#291b10";
    c.fillStyle = "#a83f2f";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(0, 0, illustrated ? 5 : 8, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.strokeStyle = portAccentColor(p);
    c.lineWidth = 2.2;
    c.beginPath();
    c.arc(0, 0, illustrated ? 10 : 13, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = "#291b10";
    c.lineWidth = 2;
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
    // Sand washes and broken contours resemble an engraved reef shelf.
    for (let ring = 0; ring < 3; ring++) {
      c.beginPath();
      for (let point = 0; point <= 48; point++) {
        const angle = (point / 48) * Math.PI * 2;
        const contour =
          0.94 -
          ring * 0.16 +
          Math.sin(angle * 5 + x) * 0.07 +
          Math.cos(angle * 9 + y) * 0.045;
        const px = Math.cos(angle) * rx * contour;
        const py = Math.sin(angle) * ry * contour;
        if (point === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.closePath();
      c.fillStyle = `rgba(194,164,102,${ring === 0 ? 0.15 : 0.06})`;
      c.fill();
      c.strokeStyle = `rgba(80,65,39,${0.35 - ring * 0.06})`;
      c.lineWidth = ring === 0 ? 1.5 : 0.9;
      c.stroke();
    }
    c.fillStyle = "rgba(68,52,28,.3)";
    for (let i = 0; i < 120; i++) {
      const a = rnd() * Math.PI * 2,
        r = Math.sqrt(rnd()) * 0.75;
      const px = Math.cos(a) * rx * r;
      const py = Math.sin(a) * ry * r;
      if (i % 13 === 0) {
        c.beginPath();
        c.moveTo(px, py - 5);
        c.lineTo(px + 5, py + 3);
        c.lineTo(px - 6, py + 3);
        c.closePath();
        c.fill();
      } else c.fillRect(px, py, 1.2, 1.2);
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
  // A Catalan-style wind rose: split vermilion-and-gold petals on the
  // cardinal points, verdant ones between, a fleur-de-lis at north, a cross
  // at east, and the classical winds named around the rim.
  function drawCompassRose(c, cx, cy, r = 86) {
    c.save();
    c.translate(cx, cy);
    c.strokeStyle = "rgba(42,28,16,.62)";
    c.lineWidth = 1.6;
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.stroke();
    c.lineWidth = 1;
    c.beginPath();
    c.arc(0, 0, r * 0.72, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = "rgba(42,28,16,.45)";
    for (let index = 0; index < 32; index += 1) {
      const angle = -Math.PI / 2 + (index * Math.PI) / 16;
      const inner = index % 8 === 0 ? r * 0.72 : r * 0.79;
      c.beginPath();
      c.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      c.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      c.stroke();
    }
    const drawPetal = (angle, length, width, leftFill, rightFill) => {
      c.save();
      c.rotate(angle);
      c.fillStyle = leftFill;
      c.beginPath();
      c.moveTo(0, -length);
      c.lineTo(-width, 0);
      c.lineTo(0, 0);
      c.closePath();
      c.fill();
      c.fillStyle = rightFill;
      c.beginPath();
      c.moveTo(0, -length);
      c.lineTo(width, 0);
      c.lineTo(0, 0);
      c.closePath();
      c.fill();
      c.strokeStyle = "rgba(42,28,16,.55)";
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(0, -length);
      c.lineTo(-width, 0);
      c.lineTo(0, 0);
      c.lineTo(width, 0);
      c.closePath();
      c.stroke();
      c.restore();
    };
    const VERMILION = "rgba(146,44,34,.82)";
    const GOLD = "rgba(178,138,62,.8)";
    const VIRIDIAN = "rgba(44,98,66,.78)";
    const UMBER = "rgba(76,54,30,.78)";
    for (let index = 0; index < 8; index += 1) {
      const angle = (index * Math.PI) / 4;
      const cardinal = index % 2 === 0;
      drawPetal(
        angle,
        cardinal ? r * 0.95 : r * 0.72,
        cardinal ? r * 0.11 : r * 0.09,
        index % 2 === 0 ? VERMILION : VIRIDIAN,
        index % 2 === 0 ? GOLD : UMBER,
      );
    }
    for (let index = 0; index < 16; index += 1) {
      if (index % 2 === 0) continue;
      drawPetal(
        (index * Math.PI) / 8,
        r * 0.5,
        r * 0.055,
        "rgba(64,46,26,.5)",
        "rgba(64,46,26,.5)",
      );
    }
    // Gilded hub.
    c.fillStyle = GOLD;
    c.beginPath();
    c.arc(0, 0, r * 0.09, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(42,28,16,.7)";
    c.lineWidth = 1;
    c.stroke();
    // Fleur-de-lis marks north; the cross marks east.
    const fleur = (x, y, s) => {
      c.save();
      c.translate(x, y);
      c.scale(s, s);
      c.fillStyle = "rgba(48,31,17,.85)";
      c.beginPath();
      c.moveTo(0, -7);
      c.bezierCurveTo(3.2, -4.5, 3.4, -1.5, 0.9, 0.4);
      c.lineTo(2.6, 0.4);
      c.lineTo(2.6, 1.9);
      c.lineTo(-2.6, 1.9);
      c.lineTo(-2.6, 0.4);
      c.lineTo(-0.9, 0.4);
      c.bezierCurveTo(-3.4, -1.5, -3.2, -4.5, 0, -7);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(-1.9, 2.7);
      c.quadraticCurveTo(0, 5.6, 1.9, 2.7);
      c.quadraticCurveTo(1.4, 4.6, 0, 5);
      c.quadraticCurveTo(-1.4, 4.6, -1.9, 2.7);
      c.closePath();
      c.fill();
      c.restore();
    };
    fleur(0, -r - 9, 1.15);
    c.strokeStyle = "rgba(48,31,17,.85)";
    c.lineWidth = 1.7;
    c.save();
    c.translate(r + 8, 0);
    c.beginPath();
    c.moveTo(0, -4.5);
    c.lineTo(0, 4.5);
    c.moveTo(-4.5, 0);
    c.lineTo(4.5, 0);
    c.stroke();
    c.restore();
    // The eight classical winds in small capitals around the rim.
    c.fillStyle = "rgba(45,30,17,.78)";
    c.font = `700 ${Math.max(7, Math.round(r * 0.1))}px Georgia`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    for (const wind of WIND_ROSE_NAMES) {
      c.fillText(
        wind.label,
        Math.cos(wind.angle) * r * 1.22,
        Math.sin(wind.angle) * r * 1.22,
      );
    }
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
    base.addColorStop(0, "#a6bfad");
    base.addColorStop(0.5, "#729f98");
    base.addColorStop(1, "#527f7d");
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
    // The same weathered-skin photograph the opening scroll multiplies over
    // the chart, so the living map keeps the intro's physical material.
    if (parchmentTexture) {
      c.save();
      c.globalCompositeOperation = "multiply";
      c.globalAlpha = 0.36;
      const tileW = WORLD.w / 3;
      const tileH =
        tileW *
        (parchmentTexture.naturalHeight / parchmentTexture.naturalWidth);
      const rows = Math.ceil(WORLD.h / tileH);
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < 3; col++) {
          // Mirror alternate tiles so the photograph never shows a seam.
          const flipX = col % 2 === 1;
          const flipY = row % 2 === 1;
          c.save();
          c.translate(
            col * tileW + (flipX ? tileW : 0),
            row * tileH + (flipY ? tileH : 0),
          );
          c.scale(flipX ? -1 : 1, flipY ? -1 : 1);
          c.drawImage(parchmentTexture, 0, 0, tileW, tileH);
          c.restore();
        }
      }
      c.restore();
    }
    // folded creases — one deep vertical fold from storage plus softer
    // diagonal creases where the sheet was once half-opened on a table.
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
    for (const crease of foldCreases(WORLD.w, WORLD.h, 6067)) {
      c.beginPath();
      c.moveTo(crease.x0, crease.y0);
      c.quadraticCurveTo(crease.cx, crease.cy, crease.x1, crease.y1);
      c.stroke();
      c.strokeStyle = "rgba(255,244,205,.26)";
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(crease.x0 + 4, crease.y0);
      c.quadraticCurveTo(crease.cx + 4, crease.cy, crease.x1 + 4, crease.y1);
      c.stroke();
      c.strokeStyle = "rgba(76,42,17,.34)";
      c.lineWidth = 3;
    }
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
  function drawRhumbWeb(c, centers) {
    const rays = rhumbRayAngles(16);
    c.save();
    c.beginPath();
    c.rect(0, 38, WORLD.w, WORLD.h - 76);
    c.clip();
    for (const center of centers) {
      const offsets = [0];
      if (center.x - center.radius < 0) offsets.push(WORLD.w);
      if (center.x + center.radius > WORLD.w) offsets.push(-WORLD.w);
      for (const offset of offsets) {
        for (let index = 0; index < rays.length; index += 1) {
          const ink = rhumbInk(index);
          c.strokeStyle = `rgba(${ink.color},${center.major ? 0.22 : 0.15})`;
          c.lineWidth = center.major ? 1.1 : 0.9;
          c.beginPath();
          c.moveTo(center.x + offset, center.y);
          c.lineTo(
            center.x + offset + Math.cos(rays[index]) * center.radius,
            center.y + Math.sin(rays[index]) * center.radius,
          );
          c.stroke();
        }
      }
      if (!center.major) {
        // Blind centers leave a pinprick and a small star at their hub, the
        // way construction points show on surviving charts.
        c.strokeStyle = "rgba(58,44,26,.4)";
        c.lineWidth = 0.9;
        for (const angle of rhumbRayAngles(8)) {
          c.beginPath();
          c.moveTo(
            center.x + Math.cos(angle) * 4,
            center.y + Math.sin(angle) * 4,
          );
          c.lineTo(
            center.x + Math.cos(angle) * 11,
            center.y + Math.sin(angle) * 11,
          );
          c.stroke();
        }
        c.fillStyle = "rgba(58,44,26,.5)";
        c.beginPath();
        c.arc(center.x, center.y, 1.6, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.restore();
  }

  // Portolan toponymy inked onto the sheet itself: names run parallel to the
  // local coast, red in shield boxes for the great ports, plain black for
  // minor landings. The interactive screen-space labels stay on top.
  function drawPortChartLabels(c) {
    c.save();
    c.textAlign = "center";
    c.textBaseline = "middle";
    if ("letterSpacing" in c) c.letterSpacing = "1.5px";
    for (const port of ports) {
      const aspect = coastAspect(onLand, port.x, port.y, 46);
      if (!aspect) continue;
      const style = portChartLabel(
        port,
        portMiniaturePlacements.has(port.name),
      );
      const labelX = port.x + aspect.seaward.x * 26;
      const labelY = port.y + aspect.seaward.y * 26;
      const boxWidth = port.name.length * 7 + 14;
      const half = boxWidth / 2 + 8;
      const offsets = [0];
      if (labelX - half < 0) offsets.push(WORLD.w);
      if (labelX + half > WORLD.w) offsets.push(-WORLD.w);
      for (const offset of offsets) {
        c.save();
        c.translate(labelX + offset, labelY);
        c.rotate(aspect.angle);
        if (style.boxed) {
          c.strokeStyle = "rgba(146,44,34,.5)";
          c.lineWidth = 1.1;
          c.strokeRect(-boxWidth / 2, -8.5, boxWidth, 17);
        }
        c.font = "600 11.5px Georgia";
        c.fillStyle =
          style.tone === "red" ? "rgba(129,36,26,.78)" : "rgba(45,34,22,.66)";
        c.fillText(port.name.toUpperCase(), 0, 0.5);
        c.restore();
      }
    }
    c.restore();
  }

  function buildMapLayer() {
    drawParchmentBase(m);
    const rnd = seeded(91);

    // Broad, translucent soundings make the open sea read as a set of basins
    // instead of a single flat wash. Repeat fields at the meridian seam.
    seaRegionLabels.forEach(([, x, y], index) => {
      const radius = 300 + ((index * 79) % 190);
      const verticalScale = 0.58 + (index % 3) * 0.09;
      const offsets = [0];
      if (x - radius < 0) offsets.push(WORLD.w);
      if (x + radius > WORLD.w) offsets.push(-WORLD.w);
      for (const offset of offsets) {
        m.save();
        m.translate(x + offset, y);
        m.scale(1, verticalScale);
        const wash = m.createRadialGradient(0, 0, 10, 0, 0, radius);
        wash.addColorStop(0, "rgba(18,57,77,.32)");
        wash.addColorStop(0.48, "rgba(27,76,89,.17)");
        wash.addColorStop(1, "rgba(40,94,97,0)");
        m.fillStyle = wash;
        m.beginPath();
        m.arc(0, 0, radius, 0, Math.PI * 2);
        m.fill();
        m.strokeStyle = "rgba(38,79,82,.11)";
        m.lineWidth = 1.4;
        m.setLineDash([14, 11, 3, 12]);
        for (const ring of [0.55, 0.78]) {
          m.beginPath();
          m.ellipse(
            0,
            0,
            radius * ring,
            radius * ring,
            index * 0.13,
            0,
            Math.PI * 2,
          );
          m.stroke();
        }
        m.restore();
      }
    });

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

    // The portolan rhumb web: fine bearing lines radiating from the great
    // roses and from blind centers hidden out at sea, alternating vermillion
    // and viridian ink like Benincasa's charts. Land painted later covers the
    // lattice, so it reads across open water exactly as a navigator used it.
    drawRhumbWeb(
      m,
      createRhumbWeb(
        {
          width: WORLD.w,
          height: WORLD.h,
          anchors: [
            [WORLD.w * 0.36, WORLD.h * 0.1],
            [WORLD.w * 0.72, WORLD.h * 0.13],
            [WORLD.w * 0.94, WORLD.h * 0.88],
          ],
        },
        (x, y) => !onLand(x, y),
        4711,
      ),
    );

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
    // Gilded north and south borders with the chartmaker's tick divisions.
    // East and west stay bare because those edges touch when sailing.
    m.setLineDash([]);
    const gold = m.createLinearGradient(0, 0, WORLD.w, 0);
    gold.addColorStop(0, "#8a5f28");
    gold.addColorStop(0.18, "#c49b47");
    gold.addColorStop(0.5, "#9a7132");
    gold.addColorStop(0.82, "#c49b47");
    gold.addColorStop(1, "#8a5f28");
    m.strokeStyle = gold;
    m.lineWidth = 4.5;
    m.beginPath();
    m.moveTo(0, 24);
    m.lineTo(WORLD.w, 24);
    m.moveTo(0, WORLD.h - 24);
    m.lineTo(WORLD.w, WORLD.h - 24);
    m.stroke();
    m.strokeStyle = "rgba(55,32,16,.72)";
    m.lineWidth = 1.6;
    m.beginPath();
    m.moveTo(0, 33);
    m.lineTo(WORLD.w, 33);
    m.moveTo(0, WORLD.h - 33);
    m.lineTo(WORLD.w, WORLD.h - 33);
    m.stroke();
    m.strokeStyle = "rgba(56,34,17,.6)";
    m.lineWidth = 1;
    m.beginPath();
    for (let x = 0; x <= WORLD.w; x += 100) {
      const long = x % 500 === 0;
      m.moveTo(x, 15);
      m.lineTo(x, long ? 24 : 20);
      m.moveTo(x, WORLD.h - 15);
      m.lineTo(x, WORLD.h - (long ? 24 : 20));
    }
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
      const coastDepth = coastFaceDepth(li, l.satellite) * MAP_TILT_TAN;
      // Layered shallow-water pigment and an ivory tide line sit underneath
      // the engraved coast and raised cliffs. Built once, not each frame.
      for (const [width, color] of [
        [180, "rgba(24,74,85,.10)"],
        [124, "rgba(40,130,127,.17)"],
        [78, "rgba(89,171,151,.25)"],
        [46, "rgba(151,200,160,.28)"],
        [25, "rgba(217,226,176,.37)"],
        [10, "rgba(255,241,199,.65)"],
      ]) {
        drawWrappedPolyPath(
          m,
          l.poly,
          (poly) => {
            m.save();
            m.translate(0, coastDepth);
            polyPath(m, poly);
            m.lineJoin = "round";
            m.strokeStyle = color;
            m.lineWidth = width;
            m.stroke();
            m.restore();
          },
          100,
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
      drawWrappedPolyPath(
        m,
        l.poly,
        (poly) => {
          m.save();
          m.shadowColor = "rgba(23,37,29,.58)";
          m.shadowBlur = 14;
          m.shadowOffsetX = -LIGHT_DIRECTION.x * coastDepth * 0.65;
          m.shadowOffsetY = -LIGHT_DIRECTION.y * coastDepth * 0.65;
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
            m.fillStyle = litPigment("#b49463", [
              (b[1] - a[1]) * facing,
              -(b[0] - a[0]) * facing,
              0,
            ]);
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
            m.strokeStyle = "rgba(36,30,24,.42)";
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
        // Hand-mixed pigment washes on some islands, the way late chartmakers
        // tinted their prize landfalls.
        const tint = islandTint(l.name, li);
        if (tint) {
          polyPath(m, poly);
          m.fillStyle = tint;
          m.fill();
        }
        // An inset lit rim and a shaded rim read as a raised paper relief.
        // Clipping leaves the sea's foam and shelf colors unobstructed.
        m.save();
        polyPath(m, poly);
        m.clip();
        let area = 0;
        poly.forEach(([x, y], i) => {
          const next = poly[(i + 1) % poly.length];
          area += x * next[1] - next[0] * y;
        });
        const facing = Math.sign(area) || 1;
        poly.forEach((a, i) => {
          const b = poly[(i + 1) % poly.length];
          const dx = b[0] - a[0],
            dy = b[1] - a[1];
          const light =
            ((dy * LIGHT_DIRECTION.x - dx * LIGHT_DIRECTION.y) * facing) /
            (Math.hypot(dx, dy) || 1);
          m.strokeStyle =
            light > 0 ? "rgba(255,238,184,.62)" : "rgba(64,47,27,.25)";
          m.lineWidth = light > 0 ? 6 : 9;
          m.beginPath();
          m.moveTo(...a);
          m.lineTo(...b);
          m.stroke();
        });
        m.restore();
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
      riverPaths[li] = [...terrain.rivers, ...terrain.tributaries];
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
    drawPortChartLabels(m);

    // sea regions, calligraphic labels, and decorative flourishes. The ink
    // varies between iron-black and faded brown like a hand-cut quill let the
    // chartmaker work at different hours.
    m.textAlign = "center";
    seaRegionLabels.forEach(([label, x, y, size], index) => {
      m.font = "italic " + size + "px Georgia";
      m.fillStyle =
        index % 3 === 2
          ? `rgba(86,62,34,${0.44 + (index % 5) * 0.03})`
          : `rgba(45,42,29,${0.48 + (index % 4) * 0.03})`;
      m.fillText(label, x, y);
    });

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
    roundedRectPath(m, -155, -52, 310, 112, 18);
    m.fill();
    m.stroke();
    m.strokeStyle = "rgba(196,155,71,.5)";
    m.lineWidth = 1;
    m.beginPath();
    roundedRectPath(m, -149, -46, 298, 100, 15);
    m.stroke();
    m.fillStyle = "rgba(47,29,15,.78)";
    m.font = "700 24px Georgia";
    m.textAlign = "center";
    m.fillText("THE ENCIRCLING WORLD", 0, -8);
    m.font = "italic 15px Georgia";
    m.fillText("East and west meet beyond the First Meridian", 0, 17);
    const homePort = ports.find((port) => port.home);
    m.font = "italic 12.5px Georgia";
    m.fillStyle = "rgba(84,60,32,.78)";
    m.fillText(
      cartoucheInscription(homePort?.name || PORT_NAMES.orvessaQuay, 17),
      0,
      40,
    );
    m.restore();

    drawScaleBar(m);

    // Physical wear sits over the ink: foxing blooms in the damp margins,
    // tide stains from an old soaking, drips of candle wax. Seeded so the
    // sheet reads as one surviving object.
    m.save();
    const sheet = { width: WORLD.w, height: WORLD.h };
    const foxingAnchors = [
      { x: 110, y: 150, spread: 62 },
      { x: WORLD.w - 80, y: 110, spread: 52 },
      { x: WORLD.w * 0.62, y: 190, spread: 70 },
      { x: WORLD.w * 0.38, y: WORLD.h - 160, spread: 64 },
      { x: 170, y: WORLD.h * 0.62, spread: 46 },
      { x: WORLD.w - 150, y: WORLD.h - 120, spread: 58 },
    ];
    for (const cluster of foxingClusters(911, foxingAnchors)) {
      for (const speckle of cluster.speckles) {
        m.fillStyle = `rgba(122,66,28,${speckle.alpha})`;
        m.beginPath();
        m.arc(
          cluster.x + speckle.dx,
          cluster.y + speckle.dy,
          speckle.r,
          0,
          Math.PI * 2,
        );
        m.fill();
      }
    }
    for (const stain of tidelines(sheet, 3391, 3)) {
      stain.rings.forEach((radius, ringIndex) => {
        const points = tidelineRingPoints(
          stain.x,
          stain.y,
          radius,
          stain.lobes,
          stain.wobble,
          stain.rotation,
        );
        m.beginPath();
        points.forEach(([px, py], index) =>
          index ? m.lineTo(px, py) : m.moveTo(px, py),
        );
        m.closePath();
        if (ringIndex === 0) {
          m.fillStyle = "rgba(112,66,26,.08)";
          m.fill();
        }
        m.strokeStyle = `rgba(96,54,22,${0.15 - ringIndex * 0.03})`;
        m.lineWidth = 2.6 - ringIndex * 0.7;
        m.stroke();
      });
    }
    for (const drop of waxDrops(sheet, 5153, 5)) {
      m.fillStyle = `rgba(232,206,142,${drop.alpha})`;
      m.beginPath();
      m.arc(drop.x, drop.y, drop.r, 0, Math.PI * 2);
      m.fill();
      m.strokeStyle = "rgba(120,86,38,.26)";
      m.lineWidth = 1;
      m.stroke();
      m.fillStyle = "rgba(255,240,200,.3)";
      m.beginPath();
      m.arc(
        drop.x - drop.r * 0.28,
        drop.y - drop.r * 0.3,
        drop.r * 0.32,
        0,
        Math.PI * 2,
      );
      m.fill();
    }
    m.restore();

    drawTatteredEdges(m);
  }

  function drawScaleBar(c) {
    const spec = scaleBarSpec({ width: WORLD.w, height: WORLD.h });
    if (!spec) return;
    c.save();
    c.translate(spec.x, spec.y);
    const frame = c.createLinearGradient(0, 0, spec.width, 0);
    frame.addColorStop(0, "#8a5f28");
    frame.addColorStop(0.5, "#caa24d");
    frame.addColorStop(1, "#8a5f28");
    c.strokeStyle = frame;
    c.lineWidth = 2.4;
    c.strokeRect(-10, -14, spec.width + 20, spec.height + 30);
    c.strokeStyle = "rgba(56,34,17,.5)";
    c.lineWidth = 1;
    c.strokeRect(-6, -10, spec.width + 12, spec.height + 22);
    // The ladder of leagues: filled and open steps alternate.
    for (let index = 0; index < spec.segments; index += 1) {
      const x = index * spec.segment;
      if (index % 2 === 0) {
        c.fillStyle = "rgba(129,52,36,.66)";
        c.fillRect(x, 0, spec.segment, 9);
      }
      c.strokeStyle = "rgba(56,34,17,.65)";
      c.lineWidth = 1;
      c.strokeRect(x, 0, spec.segment, 9);
    }
    c.fillStyle = "rgba(47,29,15,.8)";
    c.font = "10.5px Georgia";
    c.textAlign = "center";
    c.textBaseline = "alphabetic";
    for (const value of spec.values) {
      const x = (value / spec.total) * spec.width;
      c.fillText(String(value), x, 26);
      c.beginPath();
      c.moveTo(x, 9);
      c.lineTo(x, 13);
      c.stroke();
    }
    c.font = "italic 11.5px Georgia";
    c.textAlign = "left";
    c.fillText(spec.caption, 0, 40);
    c.restore();
  }

  // Torn, deckled north and south sheet edges — the vellum ends even though
  // the world it charts wraps east to west.
  function drawTatteredEdges(c) {
    const points = tatteredEdge(808, { maxDepth: 15, biteDepth: 24 });
    const step = 8;
    const topEdge = (offset) => {
      c.beginPath();
      for (let x = 0; x <= WORLD.w + step; x += step) {
        const y = edgeDepthAt(points, x / WORLD.w) + offset;
        if (x === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
    };
    const bottomEdge = (offset) => {
      c.beginPath();
      for (let x = 0; x <= WORLD.w + step; x += step) {
        const y = WORLD.h - edgeDepthAt(points, x / WORLD.w) - offset;
        if (x === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
    };
    c.save();
    c.globalCompositeOperation = "destination-out";
    topEdge(0);
    c.lineTo(WORLD.w, -2);
    c.lineTo(0, -2);
    c.closePath();
    c.fill();
    bottomEdge(0);
    c.lineTo(WORLD.w, WORLD.h + 2);
    c.lineTo(0, WORLD.h + 2);
    c.closePath();
    c.fill();
    c.restore();
    c.save();
    c.strokeStyle = "rgba(76,44,18,.5)";
    c.lineWidth = 1.2;
    topEdge(0);
    c.stroke();
    bottomEdge(0);
    c.stroke();
    c.strokeStyle = "rgba(240,214,160,.38)";
    c.lineWidth = 0.8;
    topEdge(2.2);
    c.stroke();
    bottomEdge(2.2);
    c.stroke();
    c.restore();
  }

  buildMapLayer();
  return {
    exploredCtx,
    exploredMask,
    FOG_MASK_SCALE,
    fogCanvas,
    fogCtx,
    mapLayer,
    riverPaths,
    minimapFog,
    minimapFogCtx,
    // Re-bakes the sheet with the weathered-skin photograph applied. Passing
    // the same or a missing texture is a no-op, so late or failed fetches
    // leave the procedural parchment untouched.
    setParchmentTexture(texture) {
      if (!texture || parchmentTexture === texture) return;
      parchmentTexture = texture;
      buildMapLayer();
    },
  };
}
