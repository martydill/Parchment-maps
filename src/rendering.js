import {
  expandPolygon,
  pointInPolygon,
  polygonCentroid,
} from "./core/geometry.js";
import { unwrapPath } from "./core/routes.js";
import { portEvolution } from "./core/regional.js";
import {
  forests,
  lands,
  mountains,
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
  const wrappedX = ((x % worldWidth) + worldWidth) % worldWidth;
  return landShapes.some((land) => pointInPolygon(wrappedX, y, land.poly));
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

function strokeHandDrawn(c, drawPath, color, width, z = 1) {
  c.save();
  c.strokeStyle = color;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.lineWidth = width / z;
  drawPath();
  c.stroke();
  c.globalAlpha = 0.34;
  c.translate(0.55 / z, -0.35 / z);
  c.lineWidth = Math.max(0.65 / z, (width * 0.55) / z);
  drawPath();
  c.stroke();
  c.restore();
}

export function drawMerchantShip(c, merchant, z = 1, renderX = merchant.x) {
  c.save();
  c.translate(renderX, merchant.y);
  c.rotate(merchant.angle + Math.PI / 2);
  c.fillStyle = "rgba(35,24,14,.2)";
  c.beginPath();
  c.ellipse(3, 5, 7, 16, -0.08, 0, Math.PI * 2);
  c.fill();

  c.fillStyle = "#704425";
  c.beginPath();
  c.moveTo(0, -14);
  c.quadraticCurveTo(7, -5, 6, 9);
  c.quadraticCurveTo(4, 13, 0, 16);
  c.quadraticCurveTo(-5, 12, -6, 8);
  c.quadraticCurveTo(-7, -5, 0, -14);
  c.closePath();
  c.fill();
  strokeHandDrawn(
    c,
    () => {
      c.beginPath();
      c.moveTo(0, -14);
      c.quadraticCurveTo(7, -5, 6, 9);
      c.quadraticCurveTo(4, 13, 0, 16);
      c.quadraticCurveTo(-5, 12, -6, 8);
      c.quadraticCurveTo(-7, -5, 0, -14);
      c.closePath();
    },
    "#2b1a10",
    1.25,
    z,
  );

  strokeHandDrawn(
    c,
    () => {
      c.beginPath();
      c.moveTo(-4, 7);
      c.quadraticCurveTo(0, 10, 5, 7);
      c.moveTo(0, -10);
      c.lineTo(0, 9);
    },
    "#342116",
    0.9,
    z,
  );

  c.fillStyle = "#ead9aa";
  c.beginPath();
  c.moveTo(1, -9);
  c.quadraticCurveTo(7, -4, 9, 4);
  c.quadraticCurveTo(5, 3, 1, 6);
  c.closePath();
  c.fill();
  strokeHandDrawn(
    c,
    () => {
      c.beginPath();
      c.moveTo(1, -9);
      c.quadraticCurveTo(7, -4, 9, 4);
      c.quadraticCurveTo(5, 3, 1, 6);
      c.closePath();
    },
    "#483321",
    0.85,
    z,
  );

  c.fillStyle = merchant.color;
  c.beginPath();
  c.moveTo(1, -5);
  c.lineTo(7, -1);
  c.lineTo(1, 1);
  c.closePath();
  c.fill();
  c.restore();
}

export function drawShip(c, x, y, a) {
  c.save();
  c.translate(x, y);
  c.rotate(a + Math.PI / 2);

  c.fillStyle = "rgba(37,25,14,.2)";
  c.beginPath();
  c.ellipse(5, 7, 12, 27, -0.08, 0, Math.PI * 2);
  c.fill();

  c.fillStyle = "#754726";
  c.beginPath();
  c.moveTo(0, -25);
  c.quadraticCurveTo(13, -12, 11, 17);
  c.quadraticCurveTo(8, 23, 0, 28);
  c.quadraticCurveTo(-8, 23, -11, 17);
  c.quadraticCurveTo(-13, -11, 0, -25);
  c.closePath();
  c.fill();
  strokeHandDrawn(
    c,
    () => {
      c.beginPath();
      c.moveTo(0, -25);
      c.quadraticCurveTo(13, -12, 11, 17);
      c.quadraticCurveTo(8, 23, 0, 28);
      c.quadraticCurveTo(-8, 23, -11, 17);
      c.quadraticCurveTo(-13, -11, 0, -25);
      c.closePath();
    },
    "#2b1b11",
    2,
  );

  c.fillStyle = "rgba(47,29,17,.24)";
  c.beginPath();
  c.moveTo(-8, 14);
  c.quadraticCurveTo(0, 19, 9, 14);
  c.lineTo(8, 20);
  c.quadraticCurveTo(0, 25, -8, 20);
  c.closePath();
  c.fill();

  strokeHandDrawn(
    c,
    () => {
      c.beginPath();
      c.moveTo(-9, 11);
      c.quadraticCurveTo(0, 16, 10, 11);
      c.moveTo(-8, 17);
      c.quadraticCurveTo(0, 22, 8, 17);
    },
    "#4b2b19",
    1,
  );

  strokeHandDrawn(
    c,
    () => {
      c.beginPath();
      c.moveTo(0, -17);
      c.lineTo(0, 15);
    },
    "#332217",
    1.7,
  );
  strokeHandDrawn(
    c,
    () => {
      c.beginPath();
      c.moveTo(-8, 13);
      c.lineTo(0, -16);
      c.lineTo(10, 12);
    },
    "rgba(61,43,28,.72)",
    0.8,
  );

  c.fillStyle = "#ead9aa";
  c.beginPath();
  c.moveTo(1, -12);
  c.quadraticCurveTo(12, -5, 17, 6);
  c.quadraticCurveTo(9, 5, 1, 10);
  c.closePath();
  c.fill();
  strokeHandDrawn(
    c,
    () => {
      c.beginPath();
      c.moveTo(1, -12);
      c.quadraticCurveTo(12, -5, 17, 6);
      c.quadraticCurveTo(9, 5, 1, 10);
      c.closePath();
    },
    "#493321",
    1.25,
  );

  strokeHandDrawn(
    c,
    () => {
      c.beginPath();
      c.moveTo(3, -8);
      c.quadraticCurveTo(8, -5, 13, 1);
      c.moveTo(3, 5);
      c.quadraticCurveTo(8, 3, 14, 4);
    },
    "rgba(122,88,49,.55)",
    0.7,
  );

  c.fillStyle = "#9c3d2c";
  c.beginPath();
  c.moveTo(2, -5);
  c.quadraticCurveTo(8, -2, 12, 0);
  c.lineTo(2, 3);
  c.closePath();
  c.fill();

  c.fillStyle = "#d8b768";
  for (const deckX of [-5, 5]) {
    c.beginPath();
    c.arc(deckX, 12, 1.1, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

export function createMapRendering({ WORLD, game, merchantRoutePaths }) {
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
  minimapFog.width = 1440;
  minimapFog.height = 540;
  const minimapFogCtx = minimapFog.getContext("2d");

  function drawTree(c, x, y, s) {
    c.save();
    c.translate(x, y);
    c.strokeStyle = "rgba(39,31,20,.9)";
    c.fillStyle = "rgba(63,67,37,.72)";
    c.lineWidth = Math.max(1.4, s * 0.07);
    const trunks = [
      [-0.34, 0.06, 0.72],
      [0, -0.02, 1],
      [0.33, 0.08, 0.7],
    ];
    trunks.forEach(([ox, oy, sc]) => {
      c.beginPath();
      c.moveTo(ox * s, oy * s + s * 0.42 * sc);
      c.lineTo(ox * s, oy * s - s * 0.42 * sc);
      c.stroke();
      for (let tier = 0; tier < 3; tier++) {
        const yy = oy * s - s * (0.36 - tier * 0.2) * sc,
          w = s * (0.28 + tier * 0.08) * sc;
        c.beginPath();
        c.moveTo(ox * s, yy - s * 0.22 * sc);
        c.lineTo(ox * s - w, yy + s * 0.18 * sc);
        c.lineTo(ox * s + w, yy + s * 0.18 * sc);
        c.closePath();
        c.fill();
        c.stroke();
      }
    });
    c.restore();
  }
  function drawMountain(c, x, y, s) {
    c.save();
    c.translate(x, y);
    c.strokeStyle = "rgba(43,33,21,.9)";
    c.lineWidth = Math.max(1.5, s * 0.065);
    c.fillStyle = "rgba(111,93,57,.28)";
    c.beginPath();
    c.moveTo(-s, s * 0.58);
    c.lineTo(0, -s);
    c.lineTo(s, s * 0.58);
    c.closePath();
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(-s * 0.38, -s * 0.39);
    c.lineTo(0, -s);
    c.lineTo(s * 0.34, -s * 0.43);
    c.lineTo(s * 0.1, -s * 0.54);
    c.lineTo(-s * 0.04, -s * 0.34);
    c.closePath();
    c.stroke();
    c.lineWidth = Math.max(1, s * 0.035);
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.moveTo(-s * 0.82 + i * s * 0.16, s * 0.48);
      c.lineTo(-s * 0.22 + i * s * 0.08, -s * 0.13);
      c.stroke();
      c.beginPath();
      c.moveTo(s * 0.82 - i * s * 0.15, s * 0.48);
      c.lineTo(s * 0.24 - i * s * 0.07, -s * 0.08);
      c.stroke();
    }
    c.restore();
  }
  function drawPortIcon(c, p) {
    c.save();
    c.translate(p.x, p.y);
    const regional = game.regionalEconomy[p.name];
    const evolution = regional ? portEvolution(regional) : {};
    c.strokeStyle = "#291b10";
    c.fillStyle = "#a83f2f";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(0, 0, 8, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    if (evolution.warehouses) {
      c.fillStyle = "rgba(111,66,31,.78)";
      c.fillRect(7, -21, 20, 14);
      c.strokeRect(7, -21, 20, 14);
      c.beginPath();
      c.moveTo(5, -21);
      c.lineTo(17, -29);
      c.lineTo(29, -21);
      c.stroke();
    }
    if (evolution.cranes) {
      c.beginPath();
      c.moveTo(31, -6);
      c.lineTo(31, -39);
      c.lineTo(52, -39);
      c.lineTo(39, -31);
      c.moveTo(47, -37);
      c.lineTo(47, -21);
      c.stroke();
    }
    if (evolution.foundries) {
      c.fillStyle = "rgba(67,51,38,.82)";
      c.fillRect(-39, -29, 9, 23);
      c.strokeRect(-39, -29, 9, 23);
      c.fillStyle = "rgba(76,67,56,.3)";
      c.beginPath();
      c.arc(-34, -37, 7, 0, Math.PI * 2);
      c.fill();
    }
    if (evolution.fortifications) {
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
    c.fillStyle = "#2a1b10";
    c.font = "700 20px Georgia";
    c.textAlign = "center";
    c.fillText(p.name, 0, 29);
    if (p.home) {
      c.font = "700 12px Georgia";
      c.fillStyle = "rgba(53,31,16,.82)";
      c.fillText("HOME PORT", 0, 46);
    }
    c.restore();
  }
  function polyPath(c, poly) {
    c.beginPath();
    poly.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    c.closePath();
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
    base.addColorStop(0, "#dec58f");
    base.addColorStop(0.5, "#c9aa70");
    base.addColorStop(1, "#b98f51");
    c.fillStyle = base;
    c.fillRect(0, 0, WORLD.w, WORLD.h);
    const rnd = seeded(9917);
    c.save();
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

    // ancient trade routes beneath labels
    drawRoute(
      m,
      [
        [650, 485],
        [850, 570],
        [1070, 780],
        [1190, 1050],
        [1450, 1185],
      ],
      "The Amber Run",
    );
    drawRoute(
      m,
      [
        [1000, 360],
        [1280, 430],
        [1545, 470],
        [1770, 610],
        [2000, 765],
      ],
      "The Moonroad",
    );
    drawRoute(
      m,
      [
        [360, 1140],
        [650, 1215],
        [1030, 1260],
        [1450, 1185],
        [1950, 1105],
      ],
      "Kingfisher Passage",
    );
    merchantRoutePaths
      .slice(9)
      .forEach((route) => drawRoute(m, route.points, null));

    // shoals, bars, currents and hazards
    drawShoal(m, 315, 660, 135, 44, "The Glass Shoals");
    drawShoal(m, 1815, 720, 150, 48, "Whispering Sand");
    drawShoal(m, 1050, 1260, 100, 35, "Widow Bank");
    drawShoal(m, 1290, 560, 85, 28, null);
    drawCurrent(m, 980, 930, 0.18, "Southward Current");
    drawCurrent(m, 1810, 1030, -0.38, "The Grey Drift");
    drawSeaMonster(m, 760, 660, 0.92);
    drawSeaMonster(m, 1760, 1240, 0.66);
    worldShoals.slice(4).forEach((v) => drawShoal(m, ...v));
    worldCurrents.slice(2).forEach((v) => drawCurrent(m, ...v));
    worldMonsters.slice(2).forEach((v) => drawSeaMonster(m, ...v));

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

    // islands with layered coast contours and internal parchment texture
    lands.forEach((l, li) => {
      for (const off of [22, 14, 7]) {
        polyPath(m, expandPolygon(l.poly, off));
        m.strokeStyle = `rgba(54,43,25,${off === 22 ? 0.22 : off === 14 ? 0.34 : 0.48})`;
        m.lineWidth = off === 22 ? 2 : 1.5;
        m.stroke();
      }
      polyPath(m, l.poly);
      m.fillStyle = l.color;
      m.fill();
      m.strokeStyle = "#3b2b1a";
      m.lineWidth = 7;
      m.stroke();
      polyPath(m, l.poly);
      m.strokeStyle = "rgba(230,211,157,.54)";
      m.lineWidth = 2;
      m.stroke();

      // land stipple and short hatching clipped to each island
      m.save();
      polyPath(m, l.poly);
      m.clip();
      const lr = seeded(400 + li * 31);
      m.fillStyle = "rgba(52,38,22,.16)";
      for (let i = 0; i < 320; i++) {
        const x = lr() * WORLD.w,
          y = lr() * WORLD.h;
        if (pointInPolygon(x, y, l.poly))
          m.fillRect(x, y, 1 + lr() * 1.5, 1 + lr() * 1.5);
      }
      m.strokeStyle = "rgba(47,36,23,.12)";
      m.lineWidth = 1;
      for (let i = 0; i < 90; i++) {
        const x = lr() * WORLD.w,
          y = lr() * WORLD.h;
        if (pointInPolygon(x, y, l.poly)) {
          m.beginPath();
          m.moveTo(x, y);
          m.lineTo(x + 8 + lr() * 12, y - 3 - lr() * 5);
          m.stroke();
        }
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

      if (l.name) {
        const cent = polygonCentroid(l.poly);
        m.fillStyle = "rgba(46,34,20,.58)";
        m.font = "italic 29px Georgia";
        m.textAlign = "center";
        m.fillText(l.name, cent.x, cent.y);
      }
    });

    // original landmarks plus denser procedural groves and ranges
    forests.forEach((v) => drawTree(m, ...v));
    mountains.forEach((v) => drawMountain(m, ...v));
    const detailRnd = seeded(774);
    const forestLands = [
      "Avelorn",
      "Eldergreen",
      "Mistmere",
      "Crownsward",
      "Varkesh",
      "Thornwake",
      "Serpent Coast",
      "Dawnmarch",
      "Dawnward Keys",
      "Duskward Keys",
      "Southmarch",
      "The Jade Dominion",
      "Tempest Crown",
      "Whalegrave",
      "Isle of Saints",
      "Kestrel Chain",
    ];
    const mountainLands = [
      "The Dragonspine",
      "Varkesh",
      "The Ashen Reach",
      "Needle Isle",
      "Thornwake",
      "Serpent Coast",
      "The Ivory Steppe",
      "Dawnmarch",
      "Southmarch",
      "The Jade Dominion",
      "Tempest Crown",
      "Whalegrave",
      "Frostcrown",
    ];
    lands.forEach((l) => {
      if (forestLands.includes(l.name)) {
        for (let i = 0; i < 22; i++) {
          let x,
            y,
            g = 0;
          do {
            x = l.poly[0][0] + detailRnd() * 900;
            y = l.poly[0][1] + detailRnd() * 650;
            g++;
          } while (!pointInPolygon(x, y, l.poly) && g < 80);
          if (pointInPolygon(x, y, l.poly))
            drawTree(m, x, y, 9 + detailRnd() * 10);
        }
      }
      if (mountainLands.includes(l.name)) {
        for (let i = 0; i < 10; i++) {
          let x,
            y,
            g = 0;
          do {
            x = l.poly[0][0] + detailRnd() * 820;
            y = l.poly[0][1] + detailRnd() * 620;
            g++;
          } while (!pointInPolygon(x, y, l.poly) && g < 80);
          if (pointInPolygon(x, y, l.poly))
            drawMountain(m, x, y, 12 + detailRnd() * 15);
        }
      }
    });

    ports.forEach((p) => drawPortIcon(m, p));

    // sea regions, calligraphic labels, and decorative flourishes
    m.fillStyle = "rgba(45,42,29,.55)";
    m.textAlign = "center";
    m.font = "italic 38px Georgia";
    m.fillText("THE SAPPHIRE SEA", 1200, 520);
    m.font = "italic 27px Georgia";
    m.fillText("THE WESTERN DEEPS", 300, 700);
    m.fillText("SEA OF WHISPERS", 1900, 930);
    m.font = "italic 20px Georgia";
    m.fillText("Calmwater Reach", 470, 830);
    m.fillText("Wyrmwatch Sound", 1510, 690);
    m.fillText("The Pale Expanse", 2050, 450);
    for (const [label, x, y, size] of seaRegionLabels.slice(3)) {
      m.font = "italic " + size + "px Georgia";
      m.fillText(label, x, y);
    }
    m.strokeStyle = "rgba(53,37,20,.42)";
    m.lineWidth = 1.5;
    m.beginPath();
    m.moveTo(1030, 540);
    m.quadraticCurveTo(1200, 575, 1370, 540);
    m.stroke();
    m.beginPath();
    m.moveTo(1135, 550);
    m.quadraticCurveTo(1200, 585, 1265, 550);
    m.stroke();

    drawCompassRose(m, 2200, 235, 84);
    drawCompassRose(m, 4470, 300, 70);
    drawCompassRose(m, 6020, 2180, 66);

    // title cartouche in the empty northwestern sea
    m.save();
    m.translate(285, 210);
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
