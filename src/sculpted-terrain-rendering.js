import { litPigment } from "./core/lighting.js";
import {
  cliffFacePlans,
  createTerrainDetailReveal,
} from "./core/terrain-detail.js";
import { MAP_TILT_COS } from "./core/projection.js";

function path(c, points, close = false) {
  c.beginPath();
  c.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) c.lineTo(point.x, point.y);
  if (close) c.closePath();
}

function clearTerrainSilhouette(c, { x, y, size: s, variant, kind }, biome) {
  c.save();
  c.translate(x, y);
  c.globalCompositeOperation = "destination-out";
  c.fillStyle = "#000";
  c.beginPath();
  if (kind === "peak") {
    c.moveTo(-s, s * 0.58);
    c.lineTo(-s * 0.61, s * 0.03);
    c.lineTo(-s * 0.4, -s * 0.24);
    c.lineTo(-s * 0.08, -s);
    c.lineTo(s * 0.4, -s * 0.25);
    c.lineTo(s * 0.52, -s * 0.33);
    c.lineTo(s, s * 0.58);
    c.closePath();
  } else if (biome === "tropical") {
    const top = -s * (0.85 + variant * 0.2);
    for (let side = -2; side <= 2; side++) {
      c.moveTo(s * 0.1, top);
      c.quadraticCurveTo(
        side * s * 0.48,
        top - s * 0.45,
        side * s * 0.48,
        top + s * 0.45,
      );
      c.quadraticCurveTo(side * s * 0.25, top - s * 0.06, s * 0.1, top);
      c.closePath();
    }
  } else if (biome === "alpine" || variant < 0.22) {
    for (let tier = 2; tier >= 0; tier--) {
      const yy = -s + tier * s * 0.29,
        half = s * (0.28 + tier * 0.1);
      c.moveTo(0, yy - s * 0.3);
      c.lineTo(half, yy + s * 0.34);
      c.lineTo(s * 0.09, yy + s * 0.22);
      c.lineTo(-half, yy + s * 0.34);
      c.closePath();
    }
  } else {
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
  }
  c.fill();
  c.restore();
}

export function drawSculptedRidge(c, ridge, palette) {
  for (const layer of ridge.layers) {
    const points = [...layer.spine, ...layer.foot];
    const top = Math.min(...points.map((point) => point.y));
    const bottom = Math.max(...points.map((point) => point.y));
    const pigment = c.createLinearGradient(0, top, 0, bottom);
    pigment.addColorStop(0, `rgba(${palette.wash},.84)`);
    pigment.addColorStop(0.32, `rgba(${palette.ground},.5)`);
    pigment.addColorStop(1, `rgba(${palette.ground},.04)`);
    path(c, points, true);
    c.fillStyle = pigment;
    c.fill();
    path(c, layer.spine);
    c.strokeStyle = `rgba(${palette.wash},.7)`;
    c.lineWidth = 1.05;
    c.stroke();
  }
}

function mountainDetail(c, peak, palette, fine) {
  const { x, y, size: s } = peak;
  c.save();
  c.translate(x, y);
  if (!fine) {
    // Broken planes follow the lit left face and the cool, receding right face.
    for (const [points, color] of [
      [
        [
          [-0.08, -0.94],
          [-0.4, -0.24],
          [-0.78, 0.34],
          [-0.31, 0.12],
        ],
        `rgba(${palette.wash},.27)`,
      ],
      [
        [
          [0.13, -0.08],
          [0.4, -0.25],
          [0.76, 0.3],
          [0.37, 0.16],
        ],
        "rgba(30,35,30,.28)",
      ],
      [
        [
          [-0.31, 0.12],
          [-0.78, 0.34],
          [-0.95, 0.56],
          [-0.05, 0.55],
        ],
        `rgba(${palette.ground},.18)`,
      ],
    ]) {
      path(
        c,
        points.map(([px, py]) => ({ x: px * s, y: py * s })),
        true,
      );
      c.fillStyle = color;
      c.fill();
    }
    const shade = c.createLinearGradient(-s * 0.1, -s * 0.4, s * 0.5, s * 0.55);
    shade.addColorStop(0, "rgba(52,45,34,.02)");
    shade.addColorStop(1, "rgba(31,39,35,.32)");
    path(
      c,
      [
        { x: s * 0.14, y: -s * 0.04 },
        { x: s * 0.43, y: s * 0.18 },
        { x: s * 0.7, y: s * 0.56 },
        { x: s * 0.08, y: s * 0.56 },
      ],
      true,
    );
    c.fillStyle = shade;
    c.fill();
  } else {
    c.lineWidth = 0.48;
    for (let line = 0; line < 9; line++) {
      const t = line / 9;
      c.strokeStyle =
        line % 3 ? "rgba(28,29,24,.36)" : `rgba(${palette.wash},.48)`;
      c.beginPath();
      c.moveTo(s * (0.15 + t * 0.22), s * (-0.04 + t * 0.39));
      c.lineTo(s * (0.25 + t * 0.3), s * (0.03 + t * 0.38));
      c.lineTo(s * (0.33 + t * 0.53), s * (0.13 + t * 0.39));
      c.stroke();
    }
    for (let spur = 0; spur < 4; spur++) {
      c.beginPath();
      c.moveTo(-s * (0.16 + spur * 0.08), s * (-0.62 + spur * 0.18));
      c.lineTo(-s * (0.26 + spur * 0.14), s * (-0.2 + spur * 0.16));
      c.lineTo(-s * (0.45 + spur * 0.13), s * (0.12 + spur * 0.13));
      c.strokeStyle = "rgba(69,56,36,.3)";
      c.stroke();
    }
  }
  c.restore();
}

function treeDetail(c, tree, biome, palette, fine) {
  const { x, y, size: s, variant } = tree;
  c.save();
  c.translate(x, y);
  if (biome === "alpine" || variant < 0.22) {
    c.lineWidth = fine ? 0.45 : 0.85;
    for (let tier = 0; tier < 3; tier++) {
      const top = -s * 1.22 + tier * s * 0.29;
      c.strokeStyle = fine ? "rgba(28,46,33,.48)" : palette.leafLight;
      for (let needle = 0; needle < (fine ? 5 : 2); needle++) {
        const yy = top + s * (0.17 + needle * 0.065);
        c.beginPath();
        c.moveTo(0, yy);
        c.lineTo(
          (fine ? 1 : -1) * s * (0.13 + needle * 0.035 + tier * 0.06),
          yy + s * 0.13,
        );
        c.stroke();
      }
    }
  } else if (biome === "tropical") {
    c.strokeStyle = fine ? "rgba(29,52,30,.55)" : palette.leafLight;
    c.lineWidth = fine ? 0.45 : 0.8;
    const top = -s * (0.85 + variant * 0.2);
    for (let side = -2; side <= 2; side++) {
      c.beginPath();
      c.moveTo(s * 0.1, top);
      c.quadraticCurveTo(
        side * s * 0.35,
        top - s * 0.25,
        side * s * 0.42,
        top + s * 0.22,
      );
      c.stroke();
    }
  } else {
    // Small overlapping crowns give the existing forest clusters volume.
    c.globalAlpha *= 0.65;
    for (let lobe = 0; lobe < (fine ? 11 : 4); lobe++) {
      const angle = lobe * 2.4 + variant * 5;
      const radius = fine ? s * 0.06 : s * 0.23;
      const xx = Math.cos(angle) * s * (fine ? 0.44 : 0.28);
      const yy = -s * 0.72 + Math.sin(angle) * s * (fine ? 0.3 : 0.2);
      c.beginPath();
      c.ellipse(xx, yy, radius * 1.2, radius, -0.3, 0, Math.PI * 2);
      c.fillStyle = lobe % 3 === 0 ? "rgba(26,43,28,.24)" : palette.leafLight;
      c.fill();
    }
  }
  c.restore();
}

export function drawTerrainDetails(c, terrain, palette, fine = false) {
  c.save();
  c.lineJoin = "round";
  for (const ridge of terrain.ridges) {
    for (const layer of ridge.layers) {
      if (!fine) continue;
      for (let i = 0; i < layer.spine.length; i++) {
        const a = layer.spine[i],
          b = layer.foot[layer.foot.length - i - 1];
        c.beginPath();
        c.moveTo(a.x + 2, a.y + 2);
        c.quadraticCurveTo((a.x + b.x) / 2 + 2, (a.y + b.y) / 2, b.x, b.y - 2);
        c.strokeStyle = `rgba(${palette.ground},.34)`;
        c.lineWidth = 0.55;
        c.stroke();
      }
    }
  }
  const marks = [
    ...terrain.ranges.flatMap((range) =>
      range.peaks.map((peak) => ({ ...peak, kind: "peak" })),
    ),
    ...terrain.groves.flatMap((grove) =>
      grove.trees.map((tree) => ({ ...tree, kind: "tree" })),
    ),
  ].sort((a, b) => a.y - b.y);
  // Remove rear engraving wherever a nearer silhouette overlaps it.
  for (const mark of marks) {
    clearTerrainSilhouette(c, mark, terrain.biome);
    if (mark.kind === "peak") mountainDetail(c, mark, palette, fine);
    else {
      treeDetail(c, mark, terrain.biome, palette, fine);
    }
  }
  c.restore();
}

export function drawCliffDetails(c, faces, fine = false) {
  c.save();
  for (const { a, b, depth, normal, fissures } of faces) {
    c.save();
    path(
      c,
      [a, b, { x: b.x, y: b.y + depth }, { x: a.x, y: a.y + depth }],
      true,
    );
    c.clip();
    if (!fine) {
      const shade = c.createLinearGradient(
        0,
        Math.min(a.y, b.y),
        0,
        Math.max(a.y, b.y) + depth,
      );
      shade.addColorStop(0, litPigment("#c5ac7b", normal));
      shade.addColorStop(0.45, "rgba(90,74,53,.38)");
      shade.addColorStop(1, "rgba(26,34,31,.7)");
      c.fillStyle = shade;
      c.fill();
    }
    c.lineWidth = fine ? 0.55 : 0.85;
    for (let stratum = 1; stratum < (fine ? 8 : 4); stratum++) {
      const fraction = stratum / (fine ? 8 : 4);
      c.beginPath();
      c.moveTo(a.x, a.y + depth * fraction);
      c.bezierCurveTo(
        a.x + (b.x - a.x) * 0.3,
        a.y + (b.y - a.y) * 0.3 + depth * (fraction + 0.05),
        a.x + (b.x - a.x) * 0.7,
        a.y + (b.y - a.y) * 0.7 + depth * (fraction - 0.05),
        b.x,
        b.y + depth * fraction,
      );
      c.strokeStyle =
        stratum % 2 ? "rgba(242,222,179,.36)" : "rgba(33,35,28,.4)";
      c.stroke();
    }
    if (fine)
      for (const fissure of fissures) {
        c.beginPath();
        c.moveTo(fissure.x, fissure.y + 1);
        c.lineTo(
          fissure.x + 1.5,
          fissure.y + depth * (0.3 + fissure.variant * 0.2),
        );
        c.lineTo(
          fissure.x - 0.8,
          fissure.y + depth * (0.65 + fissure.variant * 0.3),
        );
        c.strokeStyle = "rgba(24,31,27,.55)";
        c.stroke();
      }
    c.restore();
  }
  c.restore();
}

// Detail plates are baked only for visible islands, with a bounded LRU cache.
// Zoom changes opacity; it never changes geometry or triggers a map rebuild.
export function createTerrainDetailRendering({ world, islands, paletteFor }) {
  const cache = new Map();
  const reveal = createTerrainDetailReveal();
  const scale = 1.5;
  const maxPixels = 8_000_000;
  let cachedPixels = 0;
  let revision = 0;
  function bake(island) {
    let plate = cache.get(island);
    if (plate && plate.revision === revision) {
      cache.delete(island);
      cache.set(island, plate);
      return plate;
    }
    const xs = island.poly.map(([x]) => x),
      ys = island.poly.map(([, y]) => y);
    const x = Math.floor(Math.min(...xs) - 3),
      y = Math.floor(Math.min(...ys) - 3);
    const width = Math.ceil(Math.max(...xs) - x + 3);
    const height = Math.ceil(Math.max(...ys) - y + island.depth + 3);
    if (!plate) {
      const layers = [
        document.createElement("canvas"),
        document.createElement("canvas"),
      ];
      for (const canvas of layers) {
        canvas.width = Math.ceil(width * scale);
        canvas.height = Math.ceil(height * scale);
      }
      plate = {
        x,
        y,
        width,
        height,
        layers,
        pixels: layers[0].width * layers[0].height * 2,
      };
      cachedPixels += plate.pixels;
    }
    const faces = cliffFacePlans(island.poly, island.depth);
    const palette = paletteFor(island.terrain.biome);
    for (const [index, canvas] of plate.layers.entries()) {
      const c = canvas.getContext("2d");
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, canvas.width, canvas.height);
      c.setTransform(
        canvas.width / width,
        0,
        0,
        canvas.height / height,
        (-x * canvas.width) / width,
        (-y * canvas.height) / height,
      );
      drawCliffDetails(c, faces, index === 1);
      c.save();
      c.beginPath();
      island.poly.forEach(([px, py], point) =>
        point ? c.lineTo(px, py) : c.moveTo(px, py),
      );
      c.closePath();
      c.clip();
      // The island top hides cliff faces that project into concave coastlines.
      c.clearRect(x, y, width, height);
      drawTerrainDetails(c, island.terrain, palette, index === 1);
      c.restore();
    }
    plate.revision = revision;
    cache.set(island, plate);
    return plate;
  }
  return {
    invalidate() {
      revision++;
    },
    draw(
      c,
      {
        camera,
        vw,
        vh,
        detail = 1,
        time = performance.now(),
        reducedMotion = false,
      },
    ) {
      const levels = reveal.update(camera.zoom, detail, time, reducedMotion);
      if (levels.sculpting < 0.001) return;
      const halfW = vw / (2 * camera.zoom),
        halfH = vh / (2 * camera.zoom * MAP_TILT_COS);
      c.save();
      const alpha = c.globalAlpha;
      for (const island of islands) {
        const xs = island.poly.map(([x]) => x),
          ys = island.poly.map(([, y]) => y);
        const left = Math.min(...xs),
          right = Math.max(...xs);
        const top = Math.min(...ys),
          bottom = Math.max(...ys) + island.depth;
        if (bottom < camera.y - halfH || top > camera.y + halfH) continue;
        const first = Math.ceil((camera.x - halfW - right - 3) / world.w);
        const last = Math.floor((camera.x + halfW - left + 3) / world.w);
        if (first > last) continue;
        const plate = bake(island);
        for (let copy = first; copy <= last; copy++) {
          for (const [index, canvas] of plate.layers.entries()) {
            c.globalAlpha =
              alpha * (index ? levels.engraving : levels.sculpting);
            if (c.globalAlpha > 0)
              c.drawImage(
                canvas,
                plate.x + copy * world.w,
                plate.y,
                plate.width,
                plate.height,
              );
          }
        }
      }
      c.restore();
      while (cachedPixels > maxPixels && cache.size > 1) {
        const [island, plate] = cache.entries().next().value;
        cache.delete(island);
        cachedPixels -= plate.pixels;
        for (const canvas of plate.layers) canvas.width = canvas.height = 0;
      }
    },
  };
}
