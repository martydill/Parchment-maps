import {
  planPigmentGrains,
  sampleShoreBreak,
  shorelineMaterialRibbons,
} from "./core/shoreline.js";
import { createAlphaPalette } from "./style-palette.js";

const foamStroke = createAlphaPalette("255,245,211", 0, 0.72, 48);
const sprayFill = createAlphaPalette("255,249,223", 0, 0.55, 32);

// Drawn over the sea inside its existing land/cliff masks. The narrow patches
// stay within the painted shelf and never replace the authored coastline.
export function drawTidalShore(c, patch, depth, tide) {
  if (tide.exposure < 0.001) return;
  const sand = patch.kind === "sand";
  c.save();
  c.translate(patch.x, patch.y + depth);
  c.rotate(patch.angle);
  c.scale(patch.along, patch.across * (0.25 + tide.exposure * 0.75));
  c.globalAlpha *= tide.exposure;
  c.beginPath();
  c.moveTo(-1, 0);
  if (sand) {
    c.bezierCurveTo(-0.7, -0.75, 0.45, -0.85, 1, -0.12);
    c.bezierCurveTo(0.6, 0.75, -0.45, 0.9, -1, 0);
  } else {
    c.lineTo(-0.65, -0.7);
    c.lineTo(0.2, -0.9);
    c.lineTo(0.95, -0.2);
    c.lineTo(0.65, 0.65);
    c.lineTo(-0.4, 0.8);
  }
  c.closePath();
  c.fillStyle = sand ? "#c5b780" : materials[patch.kind].face;
  c.fill();
  c.clip();
  // The lower edge stays dark and wet, with a small reflected sky plane.
  c.fillStyle = sand ? "rgba(110,109,74,.35)" : "rgba(22,46,44,.52)";
  c.fillRect(-1, 0.2, 2, 0.8);
  c.fillStyle = sand ? "rgba(239,221,165,.5)" : "rgba(165,181,155,.28)";
  c.fillRect(-0.6, -0.5, 1.05, 0.12);
  if (patch.pool) {
    const center = (patch.grain - 0.9) * 3;
    c.beginPath();
    c.ellipse(
      center,
      0.02,
      0.25 + patch.grain * 0.1,
      0.4,
      -0.15,
      0,
      Math.PI * 2,
    );
    c.fillStyle = "#264e50";
    c.fill();
    c.beginPath();
    c.ellipse(center - 0.02, -0.05, 0.25, 0.24, -0.15, 0, Math.PI * 2);
    c.fillStyle = "#5e9188";
    c.fill();
    c.fillStyle = "rgba(225,238,205,.5)";
    c.fillRect(center - 0.17, -0.16, 0.25, 0.06);
  }
  c.restore();
}

const materials = {
  sand: {
    pool: "107,91,53",
    water: "116,181,155",
    edge: "#e4cf98",
    face: "#bea574",
  },
  rock: {
    pool: "59,65,55",
    water: "56,116,113",
    edge: "#8d927a",
    face: "#636f64",
  },
  basalt: {
    pool: "44,53,52",
    water: "41,96,104",
    edge: "#656d60",
    face: "#3b4b49",
  },
  marsh: {
    pool: "49,79,61",
    water: "42,77,65",
    edge: "#7f9670",
    face: "#536e56",
  },
};

function polygonPath(c, poly, drop = 0) {
  c.beginPath();
  poly.forEach(([x, y], i) =>
    i ? c.lineTo(x, y + drop) : c.moveTo(x, y + drop),
  );
  c.closePath();
}

function wash(c, x, y, along, across, angle, rgb, opacity) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.scale(along, across);
  const pigment = c.createRadialGradient(0, 0, 0, 0, 0, 1);
  pigment.addColorStop(0, `rgba(${rgb},${opacity})`);
  pigment.addColorStop(0.45, `rgba(${rgb},${opacity * 0.65})`);
  pigment.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = pigment;
  c.fillRect(-1, -1, 2, 2);
  c.restore();
}

export function drawPigmentGranulation(
  c,
  poly,
  seed,
  ground,
  light,
  count = 100,
) {
  c.save();
  polygonPath(c, poly);
  c.clip();
  const alpha = c.globalAlpha;
  for (const grain of planPigmentGrains(poly, seed, count)) {
    c.globalAlpha = alpha * grain.alpha;
    c.fillStyle = grain.light ? light : ground;
    c.fillRect(grain.x, grain.y, grain.radius * 1.6, grain.radius);
  }
  c.restore();
}

// Feathered wet-on-wet shelves, masked against both the top and raised face.
// These gradients are baked into the chart once, never allocated per frame.
export function drawCoastalWater(c, poly, segments, depth) {
  c.save();
  for (const drop of [0, depth]) {
    c.beginPath();
    const xs = poly.map(([x]) => x),
      ys = poly.map(([, y]) => y);
    const left = Math.min(...xs) - 150,
      top = Math.min(...ys) - 150;
    c.rect(
      left,
      top,
      Math.max(...xs) - left + 150,
      Math.max(...ys) - top + depth + 150,
    );
    poly.forEach(([x, y], i) =>
      i ? c.lineTo(x, y + drop) : c.moveTo(x, y + drop),
    );
    c.closePath();
    c.clip("evenodd");
  }
  for (const s of segments) {
    const x = (s.a.x + s.b.x) / 2 + s.nx * 5;
    const y = (s.a.y + s.b.y) / 2 + depth + s.ny * 5;
    wash(
      c,
      x,
      y,
      Math.max(24, s.length * 1.6),
      s.shelf * 1.3,
      Math.atan2(s.ty, s.tx),
      materials[s.kind].water,
      s.kind === "marsh" ? 0.23 : 0.2,
    );
    wash(
      c,
      x,
      y,
      Math.max(18, s.length * 1.1),
      s.shelf * 0.43,
      Math.atan2(s.ty, s.tx),
      s.kind === "sand" ? "212,221,177" : materials[s.kind].pool,
      s.kind === "sand" ? 0.18 : 0.14,
    );
  }
  c.restore();
}

export function drawCoastalFaces(c, segments, depth) {
  c.save();
  for (const s of segments) {
    if (s.ny <= 0) continue;
    const material = materials[s.kind];
    c.save();
    polygonPath(c, [
      [s.a.x, s.a.y],
      [s.b.x, s.b.y],
      [s.b.x, s.b.y + depth],
      [s.a.x, s.a.y + depth],
    ]);
    c.clip();
    // Shade perpendicular to the edge so adjacent subdivisions agree along
    // the entire sloping coast, rather than revealing separate rectangular tiles.
    const face = c.createLinearGradient(
      s.a.x,
      s.a.y,
      s.a.x + s.nx * s.ny * depth,
      s.a.y + s.ny * s.ny * depth,
    );
    face.addColorStop(0, material.edge);
    face.addColorStop(1, material.face);
    c.fillStyle = face;
    c.fill();
    // Broad shadow planes replace the comb of vertical cliff lines.
    if ((s.kind === "rock" || s.kind === "basalt") && s.grain > 0.74) {
      polygonPath(c, [
        [s.a.x, s.a.y + depth * 0.2],
        [s.b.x, s.b.y + depth * (0.25 + s.grain * 0.3)],
        [s.b.x - s.tx * s.length * 0.3, s.b.y + depth],
        [s.a.x, s.a.y + depth],
      ]);
      c.fillStyle = "rgba(28,46,40,.18)";
      c.fill();
    }
    c.restore();
  }
  c.restore();
}

export function drawCoastalLand(c, poly, segments) {
  c.save();
  polygonPath(c, poly);
  c.clip();
  for (const s of segments) {
    wash(
      c,
      (s.a.x + s.b.x) / 2 - s.nx * 3,
      (s.a.y + s.b.y) / 2 - s.ny * 3,
      Math.max(22, s.length * 1.6),
      23 + s.grain * 8,
      Math.atan2(s.ty, s.tx),
      materials[s.kind].pool,
      0.16,
    );
  }
  const alpha = c.globalAlpha;
  // One connected filled area per material, with a gently varying inland edge.
  for (const ribbon of shorelineMaterialRibbons(segments)) {
    polygonPath(
      c,
      ribbon.points.map((point) => [point.x, point.y]),
    );
    c.globalAlpha = alpha * 0.2;
    c.fillStyle = materials[ribbon.kind].edge;
    c.fill();
    c.globalAlpha = alpha;
  }
  for (const s of segments) {
    const x = s.a.x + (s.b.x - s.a.x) * s.grain - s.nx * 5;
    const y = s.a.y + (s.b.y - s.a.y) * s.grain - s.ny * 5;
    if (s.kind === "sand") {
      // Pale, diffuse dry sand merges inland instead of outlining the beach.
      wash(
        c,
        x - s.nx * 6,
        y - s.ny * 6,
        27,
        15,
        Math.atan2(s.ty, s.tx),
        "232,218,167",
        0.19,
      );
    } else if (s.kind === "marsh" && s.grain > 0.83) {
      const reach = 24 + s.grain * 19,
        width = 3 + s.grain * 5;
      c.beginPath();
      c.moveTo(x - s.tx * width, y - s.ty * width);
      c.bezierCurveTo(
        x - s.nx * reach * 0.32 - s.tx * width * 0.65,
        y - s.ny * reach * 0.32 - s.ty * width * 0.65,
        x - s.nx * reach * 0.7 + s.tx * width * 0.12,
        y - s.ny * reach * 0.7 + s.ty * width * 0.12,
        x - s.nx * reach,
        y - s.ny * reach,
      );
      c.bezierCurveTo(
        x - s.nx * reach * 0.7 + s.tx * width * 0.68,
        y - s.ny * reach * 0.7 + s.ty * width * 0.68,
        x - s.nx * reach * 0.32 + s.tx * width * 0.95,
        y - s.ny * reach * 0.32 + s.ty * width * 0.95,
        x + s.tx * width,
        y + s.ty * width,
      );
      c.closePath();
      c.fillStyle = "rgba(38,72,60,.42)";
      c.fill();
      // Reeds grow in occasional patches beside pools, rather than a perimeter fence.
      for (let tuft = 0; tuft < 4; tuft++) {
        const rx = x - s.nx * (12 + tuft * 3) + s.tx * (tuft - 1.5) * 4;
        const ry = y - s.ny * (12 + tuft * 3) + s.ty * (tuft - 1.5) * 4;
        polygonPath(c, [
          [rx - 2, ry],
          [rx - 3, ry - 6],
          [rx, ry - 3],
          [rx + 2, ry - 8],
          [rx + 2, ry],
        ]);
        c.fillStyle =
          tuft % 2 ? "rgba(163,178,116,.52)" : "rgba(70,100,56,.48)";
        c.fill();
      }
    } else if ((s.kind === "rock" || s.kind === "basalt") && s.grain > 0.79) {
      const size = 7 + s.grain * 6;
      polygonPath(c, [
        [x - s.tx * size, y - s.ty * size],
        [
          x - s.nx * size * 0.8 - s.tx * size * 0.4,
          y - s.ny * size * 0.8 - s.ty * size * 0.4,
        ],
        [
          x - s.nx * size * 1.2 + s.tx * size * 0.3,
          y - s.ny * size * 1.2 + s.ty * size * 0.3,
        ],
        [x + s.tx * size * 0.85, y + s.ty * size * 0.85],
        [x + s.nx * 2, y + s.ny * 2],
      ]);
      c.fillStyle =
        s.kind === "basalt" ? "rgba(52,68,59,.44)" : "rgba(83,100,79,.4)";
      c.fill();
      // An offset wash gives a slab a lit plane without tracing its perimeter.
      wash(
        c,
        x - s.nx * size * 0.45 - s.tx * 2,
        y - s.ny * size * 0.45 - s.ty * 2,
        size * 0.8,
        size * 0.48,
        Math.atan2(s.ty, s.tx),
        "192,199,167",
        0.22,
      );
    }
  }
  c.restore();
}

export function drawShoreBreak(c, segment, depth, time, roughness, zoom, tide) {
  if (segment.grain < 0.38) return;
  const wave = sampleShoreBreak(segment, time, roughness);
  if (!wave || wave.alpha < 0.025) return;
  const s = segment;
  const reach = wave.reach + (tide?.waterline ?? 0);
  const x = (s.a.x + s.b.x) / 2 + s.nx * reach;
  const y = (s.a.y + s.b.y) / 2 + depth + s.ny * reach;
  const half = s.length * (s.kind === "sand" ? 0.25 + s.grain * 0.2 : 0.18);
  c.strokeStyle = foamStroke(wave.alpha * 0.68);
  c.lineWidth = (s.kind === "sand" ? 0.7 : 1.15) / zoom;
  c.beginPath();
  c.moveTo(x - s.tx * half, y - s.ty * half);
  c.quadraticCurveTo(
    x + s.nx * 1.5,
    y + s.ny * 1.5,
    x + s.tx * half,
    y + s.ty * half,
  );
  c.stroke();
  if (wave.spray > 0.4) {
    c.fillStyle = sprayFill(wave.spray * 0.55);
    c.beginPath();
    for (let drop = 0; drop < 3; drop++) {
      const reach = (drop + 1) * 2.4 * wave.spray;
      const xx = x + s.nx * reach + s.tx * (drop - 1) * 3;
      const yy = y + s.ny * reach + s.ty * (drop - 1) * 3;
      c.moveTo(xx + 0.7 / zoom, yy);
      c.arc(xx, yy, 0.7 / zoom, 0, Math.PI * 2);
    }
    c.fill();
  }
}
