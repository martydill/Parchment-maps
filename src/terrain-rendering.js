import { LIGHT_DIRECTION } from "./core/lighting.js";

const palettes = {
  temperate: {
    paper: "#b2ac78",
    leaf: "#657044",
    leafLight: "#a7ac75",
    ground: "67,87,46",
    wash: "227,202,135",
  },
  alpine: {
    paper: "#b8b8a0",
    leaf: "#596b58",
    leafLight: "#b8c4a1",
    ground: "62,85,75",
    wash: "222,225,204",
  },
  tropical: {
    paper: "#adb77c",
    leaf: "#527047",
    leafLight: "#a7bb70",
    ground: "54,94,50",
    wash: "204,217,139",
  },
  volcanic: {
    paper: "#b09a7d",
    leaf: "#666044",
    leafLight: "#aea278",
    ground: "91,69,49",
    wash: "179,139,105",
  },
  arid: {
    paper: "#cbb17a",
    leaf: "#797048",
    leafLight: "#bcb075",
    ground: "120,97,52",
    wash: "237,196,125",
  },
  marsh: {
    paper: "#a9b494",
    leaf: "#637657",
    leafLight: "#adb88a",
    ground: "58,94,77",
    wash: "184,210,171",
  },
};

export function terrainPalette(biome) {
  return palettes[biome] || palettes.temperate;
}

function drawRidge(c, { a, b, width }) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length,
    ny = dx / length;
  // Parallel engraved contours tie individual summits into one landform.
  for (const side of [-1, 1]) {
    for (const level of [1, 1.55, 2.1]) {
      const spread = width * side * level;
      c.beginPath();
      c.moveTo(a.x + nx * spread, a.y + ny * spread + 8);
      c.quadraticCurveTo(
        (a.x + b.x) / 2 + nx * spread * 0.7,
        (a.y + b.y) / 2 + ny * spread * 0.7 + 6,
        b.x + nx * spread,
        b.y + ny * spread + 8,
      );
      c.strokeStyle = `rgba(66,53,32,${0.23 / level})`;
      c.lineWidth = 0.85;
      c.stroke();
    }
  }
  c.beginPath();
  c.moveTo(a.x, a.y - a.size * 0.55);
  c.lineTo(b.x, b.y - b.size * 0.55);
  c.lineTo(b.x - LIGHT_DIRECTION.x * width, b.y - LIGHT_DIRECTION.y * width);
  c.lineTo(a.x - LIGHT_DIRECTION.x * width, a.y - LIGHT_DIRECTION.y * width);
  c.closePath();
  c.fillStyle = "rgba(66,53,32,.18)";
  c.fill();
  c.strokeStyle = "rgba(62,48,28,.32)";
  c.lineWidth = 0.7;
  for (let along = 0; along < length; along += 6) {
    const t = along / length;
    const x = a.x + dx * t,
      y = a.y + dy * t;
    c.beginPath();
    c.moveTo(x + LIGHT_DIRECTION.x * 4, y + LIGHT_DIRECTION.y * 4);
    c.lineTo(
      x - LIGHT_DIRECTION.x * width * 0.9,
      y - LIGHT_DIRECTION.y * width * 0.9,
    );
    c.stroke();
  }
}

function drawTree(c, tree, biome) {
  const { x, y, size: s, variant } = tree;
  const palette = terrainPalette(biome);
  c.save();
  c.translate(x, y);
  c.fillStyle = "rgba(38,43,27,.14)";
  c.beginPath();
  c.ellipse(
    -LIGHT_DIRECTION.x * s * 0.5,
    -LIGHT_DIRECTION.y * s * 0.5,
    s * 0.68,
    s * 0.23,
    0,
    0,
    Math.PI * 2,
  );
  c.fill();
  c.strokeStyle = "rgba(46,43,28,.78)";
  c.lineWidth = 0.8;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(0, s * 0.24);
  c.lineTo(s * 0.1, -s * 0.9);
  c.stroke();
  if (biome === "tropical") {
    const top = -s * (0.85 + variant * 0.2);
    for (let side = -2; side <= 2; side++) {
      c.beginPath();
      c.moveTo(s * 0.1, top);
      c.quadraticCurveTo(
        side * s * 0.48,
        top - s * 0.45,
        side * s * 0.48,
        top + s * 0.45,
      );
      c.quadraticCurveTo(side * s * 0.25, top - s * 0.06, s * 0.1, top);
      c.fillStyle = side < 0 ? palette.leafLight : palette.leaf;
      c.fill();
      c.stroke();
    }
  } else if (biome === "alpine" || variant < 0.22) {
    for (let tier = 2; tier >= 0; tier--) {
      const yy = -s + tier * s * 0.29;
      const half = s * (0.28 + tier * 0.1);
      c.beginPath();
      c.moveTo(0, yy - s * 0.3);
      c.lineTo(half, yy + s * 0.34);
      c.lineTo(s * 0.09, yy + s * 0.22);
      c.lineTo(-half, yy + s * 0.34);
      c.closePath();
      c.fillStyle = palette.leaf;
      c.fill();
      c.stroke();
      c.beginPath();
      c.moveTo(0, yy - s * 0.22);
      c.lineTo(-half * 0.75, yy + s * 0.23);
      c.strokeStyle = palette.leafLight;
      c.stroke();
      c.strokeStyle = "rgba(46,43,28,.78)";
    }
  } else {
    c.beginPath();
    c.moveTo(-s * 0.55, -s * 0.25);
    c.bezierCurveTo(-s, -s * 0.55, -s * 0.65, -s, -s * 0.3, -s * 0.92);
    c.bezierCurveTo(
      -s * 0.25,
      -s * 1.4,
      s * 0.45,
      -s * 1.3,
      s * 0.48,
      -s * 0.83,
    );
    c.bezierCurveTo(s, -s * 0.84, s * 0.95, -s * 0.25, s * 0.4, -s * 0.18);
    c.closePath();
    c.fillStyle = palette.leaf;
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(-s * 0.5, -s * 0.4);
    c.bezierCurveTo(-s * 0.75, -s * 0.65, -s * 0.32, -s * 0.92, 0, -s * 0.9);
    c.strokeStyle = palette.leafLight;
    c.lineWidth = 1.1;
    c.stroke();
    c.beginPath();
    c.moveTo(s * 0.18, -s * 0.26);
    c.lineTo(s * 0.45, -s * 0.56);
    c.strokeStyle = "rgba(40,49,29,.38)";
    c.stroke();
  }
  c.restore();
}
function drawMountain(c, x, y, s, biome) {
  c.save();
  c.translate(x, y);
  const summit = -s * 0.08;
  c.fillStyle = "rgba(35,29,22,.16)";
  c.beginPath();
  c.ellipse(
    -LIGHT_DIRECTION.x * s * 0.65,
    -LIGHT_DIRECTION.y * s * 0.9,
    s,
    s * 0.27,
    0,
    0,
    Math.PI * 2,
  );
  c.fill();
  c.fillStyle = "rgba(209,190,140,.42)";
  c.beginPath();
  c.moveTo(-s, s * 0.58);
  c.lineTo(-s * 0.61, s * 0.03);
  c.lineTo(-s * 0.4, -s * 0.24);
  c.lineTo(summit, -s);
  c.lineTo(s * 0.13, -s * 0.08);
  c.lineTo(s * 0.08, s * 0.58);
  c.closePath();
  c.fill();
  c.fillStyle = "rgba(64,54,37,.48)";
  c.beginPath();
  c.moveTo(summit, -s);
  c.lineTo(s * 0.4, -s * 0.25);
  c.lineTo(s * 0.52, -s * 0.33);
  c.lineTo(s, s * 0.58);
  c.lineTo(s * 0.08, s * 0.58);
  c.lineTo(s * 0.13, -s * 0.08);
  c.closePath();
  c.fill();
  c.strokeStyle = "rgba(43,33,21,.72)";
  c.lineWidth = Math.max(1.2, s * 0.045);
  c.beginPath();
  c.moveTo(-s, s * 0.58);
  c.lineTo(-s * 0.61, s * 0.03);
  c.lineTo(-s * 0.4, -s * 0.24);
  c.lineTo(summit, -s);
  c.lineTo(s * 0.4, -s * 0.25);
  c.lineTo(s * 0.52, -s * 0.33);
  c.lineTo(s, s * 0.58);
  c.stroke();
  c.beginPath();
  c.moveTo(summit, -s);
  c.lineTo(s * 0.13, -s * 0.08);
  c.lineTo(s * 0.08, s * 0.58);
  c.stroke();
  c.strokeStyle = "rgba(238,223,180,.62)";
  c.beginPath();
  c.moveTo(-s * 0.25, -s * 0.43);
  c.lineTo(summit, -s);
  c.lineTo(s * 0.25, -s * 0.43);
  c.stroke();
  c.strokeStyle = "rgba(38,31,22,.35)";
  c.lineWidth = 0.8;
  for (let i = 0; i < 4; i++) {
    c.beginPath();
    c.moveTo(s * (0.18 + i * 0.05), s * (-0.02 + i * 0.12));
    c.lineTo(s * (0.45 + i * 0.12), s * (0.16 + i * 0.12));
    c.stroke();
  }
  if (biome === "alpine") {
    c.beginPath();
    c.moveTo(summit, -s);
    c.lineTo(s * 0.3, -s * 0.42);
    c.lineTo(s * 0.08, -s * 0.55);
    c.lineTo(-s * 0.03, -s * 0.35);
    c.lineTo(-s * 0.16, -s * 0.56);
    c.lineTo(-s * 0.32, -s * 0.42);
    c.closePath();
    c.fillStyle = "rgba(240,232,202,.85)";
    c.fill();
  } else if (biome === "volcanic") {
    c.beginPath();
    c.ellipse(summit, -s * 0.86, s * 0.18, s * 0.07, 0, 0, Math.PI * 2);
    c.fillStyle = "#635347";
    c.fill();
    c.strokeStyle = "rgba(219,173,119,.75)";
    c.stroke();
  }
  c.strokeStyle = "rgba(46,38,27,.28)";
  c.lineWidth = 0.65;
  for (let line = 0; line < 6; line++) {
    const t = line / 6;
    c.beginPath();
    c.moveTo(s * (0.12 + t * 0.34), s * (-0.08 + t * 0.55));
    c.lineTo(s * (0.3 + t * 0.57), s * (0.13 + t * 0.38));
    c.stroke();
  }
  c.restore();
}
function terrainPath(c, points) {
  c.beginPath();
  c.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i++) {
    const midpoint = {
      x: (points[i].x + points[i + 1].x) / 2,
      y: (points[i].y + points[i + 1].y) / 2,
    };
    c.quadraticCurveTo(points[i].x, points[i].y, midpoint.x, midpoint.y);
  }
  c.lineTo(points.at(-1).x, points.at(-1).y);
}
function terrainWash(c, x, y, rx, ry, angle, color, opacity) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.scale(rx, ry);
  const wash = c.createRadialGradient(0, 0, 0, 0, 0, 1);
  wash.addColorStop(0, `rgba(${color},${opacity})`);
  wash.addColorStop(0.5, `rgba(${color},${opacity * 0.45})`);
  wash.addColorStop(1, `rgba(${color},0)`);
  c.fillStyle = wash;
  c.fillRect(-1, -1, 2, 2);
  c.restore();
}
export function drawTerrainIllustration(c, terrain) {
  c.save();
  c.lineJoin = "round";
  const palette = terrainPalette(terrain.biome);
  for (const ridge of terrain.ridges) drawRidge(c, ridge);
  for (const plain of terrain.plains) {
    terrainWash(c, plain.x, plain.y, 60, 35, plain.angle, palette.wash, 0.22);
    c.save();
    c.translate(plain.x, plain.y);
    c.rotate(plain.angle);
    c.strokeStyle = "rgba(61,53,32,.25)";
    c.lineWidth = 0.9;
    for (let i = -1; i <= 1; i++) {
      c.beginPath();
      if (terrain.biome === "arid") {
        c.moveTo(-17 + i * 3, i * 7);
        c.bezierCurveTo(-5, i * 7 - 12, 7, i * 7 - 8, 20, i * 7 + 2);
      } else if (terrain.biome === "marsh") {
        c.moveTo(-17, i * 6 + 4);
        c.lineTo(18, i * 6 + 4);
        c.moveTo(i * 6, 0);
        c.lineTo(i * 6 - 2, -10);
        c.moveTo(i * 6, 0);
        c.lineTo(i * 6 + 3, -7);
      } else if (terrain.biome === "volcanic") {
        c.moveTo(i * 6 - 3, 4);
        c.lineTo(i * 6, -2);
        c.lineTo(i * 6 + 4, 3);
      } else {
        c.moveTo(i * 5 - 4, 3);
        c.quadraticCurveTo(i * 5, -2, i * 5 + 5, 1);
      }
      c.stroke();
    }
    c.restore();
  }
  for (const hill of terrain.hills) {
    terrainWash(
      c,
      hill.x - LIGHT_DIRECTION.x * hill.size * 0.4,
      hill.y - LIGHT_DIRECTION.y * hill.size * 0.4,
      hill.size * 1.5,
      hill.size * 0.8,
      -0.2,
      "54,46,28",
      0.2,
    );
    terrainWash(
      c,
      hill.x + LIGHT_DIRECTION.x * hill.size * 0.4,
      hill.y + LIGHT_DIRECTION.y * hill.size * 0.4,
      hill.size,
      hill.size * 0.6,
      -0.2,
      "235,215,159",
      0.24,
    );
    c.strokeStyle = "rgba(63,50,31,.27)";
    c.lineWidth = 1;
    c.save();
    c.translate(hill.x, hill.y);
    c.scale(hill.size, hill.size);
    c.lineWidth = 1 / hill.size;
    c.beginPath();
    c.moveTo(-1, 0.2);
    c.bezierCurveTo(-0.5, -0.6, 0.15, -0.85, 0.95, 0.12);
    c.stroke();
    c.strokeStyle = "rgba(63,50,31,.15)";
    c.beginPath();
    c.moveTo(-0.65, 0.45);
    c.bezierCurveTo(-0.1, 0.15, 0.65, 0.2, 1.2, 0.48);
    c.stroke();
    c.restore();
  }
  for (const range of terrain.ranges) {
    for (const peak of range.peaks) {
      terrainWash(
        c,
        peak.x - LIGHT_DIRECTION.x * 24,
        peak.y - LIGHT_DIRECTION.y * 24,
        peak.size * 2.4,
        peak.size * 1.7,
        range.angle,
        "47,38,24",
        0.24,
      );
      terrainWash(
        c,
        peak.x + LIGHT_DIRECTION.x * 20,
        peak.y + LIGHT_DIRECTION.y * 20,
        peak.size * 1.7,
        peak.size * 1.4,
        range.angle,
        "218,196,139",
        0.16,
      );
    }
  }
  for (const river of terrain.rivers) {
    for (let i = 0; i < river.length - 1; i++) {
      const a = river[i],
        b = river[i + 1];
      terrainWash(
        c,
        (a.x + b.x) / 2,
        (a.y + b.y) / 2,
        Math.hypot(b.x - a.x, b.y - a.y) + 24,
        30,
        Math.atan2(b.y - a.y, b.x - a.x),
        "216,211,146",
        0.19,
      );
    }
  }
  c.lineCap = "round";
  c.lineJoin = "round";
  for (const river of terrain.tributaries) {
    terrainPath(c, river);
    c.strokeStyle = "rgba(51,78,72,.6)";
    c.lineWidth = 1.6;
    c.stroke();
  }
  for (const river of terrain.rivers) {
    terrainPath(c, river);
    c.strokeStyle = "rgba(45,64,60,.65)";
    c.lineWidth = 3.8;
    c.stroke();
    terrainPath(c, river);
    c.strokeStyle = "rgba(154,180,163,.7)";
    c.lineWidth = 1.8;
    c.stroke();
  }
  for (const grove of terrain.groves) {
    terrainWash(
      c,
      grove.x,
      grove.y,
      grove.radius * 1.15,
      grove.radius * 0.85,
      -0.15,
      palette.ground,
      0.2,
    );
  }
  const silhouettes = [
    ...terrain.ranges.flatMap((range) =>
      range.peaks.map((peak) => ({ ...peak, kind: "peak" })),
    ),
    ...terrain.groves.flatMap((grove) =>
      grove.trees.map((tree) => ({ ...tree, kind: "tree" })),
    ),
  ].sort((a, b) => a.y - b.y);
  for (const mark of silhouettes) {
    if (mark.kind === "peak")
      drawMountain(c, mark.x, mark.y, mark.size, terrain.biome);
    else drawTree(c, mark, terrain.biome);
  }
  c.restore();
}
