import {
  sampleDeckCrew,
  sampleShipMotion,
  sampleWaterReflection,
} from "./core/seascape.js";
import { getShipModelProfile } from "./core/ship-models.js";
import { sailStitchLines } from "./core/ship-materials.js";
import { MAP_TILT_COS, MAP_TILT_SIN, MAP_TILT_TAN } from "./core/projection.js";
import { LIGHT_DIRECTION, litPigment, sceneLighting } from "./core/lighting.js";
import {
  SAIL_TEAR_GRID,
  damageNoise,
  sailTearLayout,
  smokePuffRender,
  splinterFlecks,
  createSmokeTrail,
  updateSmokeTrail,
} from "./core/ship-damage.js";
import { clamp, wrappedDelta } from "./core/math.js";
import {
  BIOLUMINESCENT_RGB,
  bioluminescentTwinkle,
} from "./core/bioluminescence.js";
import { createAlphaPalette } from "./style-palette.js";
import { createRadialStamp } from "./radial-stamp.js";

export { getShipModelProfile as shipDrawProfile } from "./core/ship-models.js";

const bowWaterStyle = createAlphaPalette("35,88,86", 0, 0.16, 128);
const bowFoamStyle = createAlphaPalette("255,247,213", 0, 0.24, 128);
const sternFoamStyle = createAlphaPalette("255,248,213", 0, 0.4, 128);
const sternCrestStyle = createAlphaPalette("255,249,218", 0, 0.2, 128);
const bowSprayStyle = createAlphaPalette("255,245,216", 0, 0.65, 128);
const reflectionInkStyle = createAlphaPalette("45,57,45", 0, 0.34, 128);
const splinterPitchStyle = createAlphaPalette("46,30,17", 0.14, 0.72, 64);
const splinterWoodStyle = createAlphaPalette("171,124,66", 0.14, 0.76, 64);
const eddyGlowStyle = createAlphaPalette(BIOLUMINESCENT_RGB, 0, 0.3, 48);
const eddySpeckStyle = createAlphaPalette(BIOLUMINESCENT_RGB, 0, 0.85, 96);
const CONTACT_SHADOWS = [
  [1.45, "rgba(21,47,43,0.045)"],
  [1.2, "rgba(21,47,43,0.085)"],
  [1, "rgba(18,39,35,0.22)"],
];

// Presentation-only per-vessel state: smoke trails and the one-shot patch
// spawn animation. Keys are the persistent vessel objects the callers pass.
const smokeTrails = new WeakMap();
const patchSpawns = new WeakMap();
let smokeStamp = null;
function getSmokeStamp() {
  if (!smokeStamp) {
    smokeStamp = createRadialStamp({
      stops: [
        [0, "rgba(209,204,194,0.9)"],
        [0.5, "rgba(146,142,136,0.42)"],
        [1, "rgba(118,114,108,0)"],
      ],
      size: 64,
    });
  }
  return smokeStamp;
}

const HULL_STATIONS = Object.freeze([
  [-0.5, 0.05],
  [-0.42, 0.54],
  [-0.29, 0.82],
  [-0.12, 0.98],
  [0.12, 0.94],
  [0.3, 0.78],
  [0.43, 0.57],
  [0.5, 0.05],
]);

function rotatePoint([x, y, z], heading, motion) {
  // Roll around the keel, then pitch around the beam, before heading and
  // orthographic projection. Rigging and cloth use this same transform.
  const rolledX = x * Math.cos(motion.roll) + z * Math.sin(motion.roll);
  const rolledZ = z * Math.cos(motion.roll) - x * Math.sin(motion.roll);
  const pitchedY =
    y * Math.cos(motion.pitch) - rolledZ * Math.sin(motion.pitch);
  z =
    y * Math.sin(motion.pitch) +
    rolledZ * Math.cos(motion.pitch) +
    motion.heave;
  x = rolledX;
  y = pitchedY;
  const cosine = Math.cos(heading);
  const sine = Math.sin(heading);
  return {
    x: x * cosine - y * sine,
    y: x * sine + y * cosine,
    z,
  };
}

function projectedPoint(point, heading, motion) {
  const world = rotatePoint(point, heading, motion);
  return [world.x, world.y - world.z * MAP_TILT_TAN];
}

function deckHeight(profile, along) {
  const end = Math.max(0, (Math.abs(along) - 0.28) / 0.22);
  return (
    profile.deckHeight +
    (along < 0 ? profile.bowRise : profile.sternRise) * Math.min(1, end)
  );
}

function hullWidth(profile, along) {
  const position = Math.max(-0.5, Math.min(0.5, along));
  const stationIndex = HULL_STATIONS.findIndex(
    ([station]) => station >= position,
  );
  if (stationIndex <= 0) return profile.beam * HULL_STATIONS[0][1];
  const [start, startWidth] = HULL_STATIONS[stationIndex - 1];
  const [end, endWidth] = HULL_STATIONS[stationIndex];
  const ratio = (position - start) / (end - start);
  return profile.beam * (startWidth + (endWidth - startWidth) * ratio);
}

function buildHullFaces(profile, seed = 0) {
  const length = profile.length;
  const stations = HULL_STATIONS.map(([along, width]) => {
    const y = along * length;
    const halfBeam = width * profile.beam;
    const top = deckHeight(profile, along);
    return {
      along,
      starboardTop: [halfBeam, y, top],
      starboardBottom: [halfBeam * 0.72, y, 0.7],
      portTop: [-halfBeam, y, top],
      portBottom: [-halfBeam * 0.72, y, 0.7],
    };
  });

  const faces = [];
  for (let index = 0; index < stations.length - 1; index++) {
    const current = stations[index];
    const next = stations[index + 1];
    faces.push({
      vertices: [
        current.starboardTop,
        current.starboardBottom,
        next.starboardBottom,
        next.starboardTop,
      ],
      fill: index % 2 ? "#79502d" : "#704426",
      outline: "#392419",
    });
    faces.push({
      vertices: [
        current.portTop,
        next.portTop,
        next.portBottom,
        current.portBottom,
      ],
      fill: index % 2 ? "#603a22" : "#704426",
      outline: "#392419",
    });
  }

  // Three timber strakes follow the hull's taper. Pigment varies by board,
  // never by frame, and fine grain stays on each depth-sorted surface.
  const timber = ["#75492b", "#805332", "#704329", "#875735", "#79502e"];
  const mix = (a, b, amount) =>
    a.map((value, axis) => value + (b[axis] - value) * amount);
  const strakes = faces.flatMap((face, index) => {
    const [a, b, d, e] = face.vertices;
    // Port faces run along the keel first; starboard faces run down the side.
    const [topA, bottomA, bottomB, topB] =
      index % 2 ? [a, e, d, b] : [a, b, d, e];
    return Array.from({ length: 3 }, (_, row) => {
      const top = row / 3;
      const bottom = (row + 1) / 3;
      const vertices = [
        mix(topA, bottomA, top),
        mix(topA, bottomA, bottom),
        mix(topB, bottomB, bottom),
        mix(topB, bottomB, top),
      ];
      return {
        vertices: index % 2 ? vertices.toReversed() : vertices,
        fill: timber[
          Math.floor(
            damageNoise(seed * 19 + index * 7 + row * 31) * timber.length,
          ) % timber.length
        ],
        outline: "rgba(48,31,19,.26)",
        grain: [mix(topA, bottomA, top + 0.16), mix(topB, bottomB, top + 0.16)],
      };
    });
  });
  faces.splice(0, faces.length, ...strakes);

  const bow = stations[0];
  const stern = stations.at(-1);
  faces.push({
    vertices: [
      bow.portTop,
      bow.starboardTop,
      bow.starboardBottom,
      bow.portBottom,
    ],
    fill: "#8a5a31",
    outline: "#392419",
  });
  faces.push({
    vertices: [
      stern.starboardTop,
      stern.portTop,
      stern.portBottom,
      stern.starboardBottom,
    ],
    fill: "#56351f",
    outline: "#392419",
  });

  const deckTones = ["#a8753d", "#b18149", "#a4713b", "#b5874e", "#ac7c43"];
  for (let plank = 0; plank < 5; plank++) {
    const edge = (station, across) => [
      station.starboardTop[0] * across,
      station.starboardTop[1],
      station.starboardTop[2],
    ];
    faces.push({
      deck: true,
      vertices: [
        ...stations.map((station) => edge(station, -1 + (plank + 1) * 0.4)),
        ...stations
          .toReversed()
          .map((station) => edge(station, -1 + plank * 0.4)),
      ],
      fill: deckTones[(plank + Math.abs(Math.trunc(seed))) % deckTones.length],
      outline: "rgba(57,36,25,.28)",
    });
  }

  return faces;
}

// The caller centers/scales this pass and clips it to water. Mirror height
// across z = 0, keeping the keel's map position and the live hull's pose.
export function drawHullReflection(c, profile, heading, environment = {}) {
  const motion = sampleShipMotion(environment);
  // A damaged hull lists and settles; its ink reflection leans with it.
  motion.roll += environment.heel || 0;
  motion.heave -= environment.settle || 0;
  const time = environment.reducedMotion ? 0 : (environment.time ?? 0);
  const roughness = environment.roughness ?? 0;
  const daylight = environment.lighting?.daylight ?? 1;
  const polygons = buildHullFaces(profile).map(({ vertices }) => {
    const points = vertices.map((vertex) => {
      const point = rotatePoint(vertex, heading, motion);
      return [point.x, point.y + Math.max(0, point.z) * MAP_TILT_TAN];
    });
    // Matching winding makes one ink silhouette, without dark seams where
    // adjacent or overlapping hull faces meet in the mirrored projection.
    const area = points.reduce((sum, [x, y], index) => {
      const next = points[(index + 1) % points.length];
      return sum + x * next[1] - next[0] * y;
    }, 0);
    return area < 0 ? points.toReversed() : points;
  });
  const points = polygons.flat();
  const left = Math.min(...points.map(([x]) => x)) - 6;
  const right = Math.max(...points.map(([x]) => x)) + 6;
  const top = Math.min(...points.map(([, y]) => y));
  const bottom = Math.max(...points.map(([, y]) => y));
  const sliceHeight = (bottom - top) / 8;
  const phase = (environment.seed ?? 0) * 2.399963;

  for (let row = 0; row < 8; row++) {
    const ripple = sampleWaterReflection(time + phase, row, roughness);
    const fade = 1 - (row / 8) * 0.65;
    c.save();
    c.beginPath();
    c.rect(
      left,
      top + row * sliceHeight,
      right - left,
      sliceHeight * (0.78 + ripple.width * 0.17),
    );
    c.clip();
    // Shift the ink itself, rather than moving a wide clipping rectangle.
    c.translate(ripple.offset, 0);
    c.fillStyle = reflectionInkStyle(
      (0.18 + daylight * 0.16) * fade * ripple.alpha,
    );
    c.beginPath();
    for (const polygon of polygons) {
      polygon.forEach(([x, y], index) => {
        if (index) c.lineTo(x, y);
        else c.moveTo(x, y);
      });
      c.closePath();
    }
    c.fill();
    c.restore();
  }
}

function boxFaces(x1, x2, y1, y2, z1, z2, colors = {}) {
  const a = [x1, y1, z1],
    b = [x2, y1, z1],
    c = [x2, y2, z1],
    d = [x1, y2, z1],
    A = [x1, y1, z2],
    B = [x2, y1, z2],
    C = [x2, y2, z2],
    D = [x1, y2, z2];
  return [
    { vertices: [a, d, c, b], fill: colors.bottom || "#634021" },
    {
      vertices: [a, b, B, A],
      fill: colors.bow || "#73492b",
      outline: "#402719",
    },
    {
      vertices: [d, D, C, c],
      fill: colors.stern || "#57371f",
      outline: "#402719",
    },
    {
      vertices: [a, A, D, d],
      fill: colors.port || "#644025",
      outline: "#402719",
    },
    {
      vertices: [b, c, C, B],
      fill: colors.starboard || "#815430",
      outline: "#402719",
    },
    {
      vertices: [A, B, C, D],
      fill: colors.top || "#c09051",
      outline: "#402719",
    },
  ];
}

function worldFace(face, heading, order, motion, lighting) {
  const vertices = face.vertices.map((vertex) =>
    rotatePoint(vertex, heading, motion),
  );
  const first = vertices[0];
  const second = vertices[1];
  // Deck station edges curve along the keel. Cross an actual plank width to
  // find its upward normal, rather than three points on that curved edge.
  const third = face.deck ? vertices.at(-1) : vertices[2];
  const ab = [second.x - first.x, second.y - first.y, second.z - first.z];
  const ac = [third.x - first.x, third.y - first.y, third.z - first.z];
  let normal = [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0],
  ];
  const length = Math.hypot(...normal) || 1;
  normal = normal.map((component) => component / length);
  const facing = normal[1] * MAP_TILT_SIN + normal[2] * MAP_TILT_COS;
  if (!face.doubleSided && facing <= 0.001) return null;
  const depth =
    vertices.reduce(
      (total, point) => total + point.y * MAP_TILT_SIN + point.z * MAP_TILT_COS,
      0,
    ) / vertices.length;
  return {
    ...face,
    fill: litPigment(face.fill, normal, lighting),
    projected: vertices.map((point) => [
      point.x,
      point.y - point.z * MAP_TILT_TAN,
    ]),
    grain: face.grain?.map((point) => projectedPoint(point, heading, motion)),
    stitches: face.stitches?.map((line) =>
      line.map((point) => projectedPoint(point, heading, motion)),
    ),
    opacity: face.cloth ? 0.98 - lighting.daylight * 0.045 : 1,
    depth,
    order,
  };
}

function paintFaces(c, faces, z) {
  faces.sort((a, b) => a.depth - b.depth || a.order - b.order);
  for (const face of faces) {
    c.save();
    c.beginPath();
    face.projected.forEach(([x, y], index) => {
      if (index) c.lineTo(x, y);
      else c.moveTo(x, y);
    });
    c.closePath();
    c.fillStyle = face.fill;
    c.globalAlpha = face.opacity;
    c.fill();
    c.globalAlpha = 1;
    if (face.outline) {
      c.strokeStyle = face.outline;
      c.lineWidth = 0.85 / z;
      c.lineJoin = "round";
      c.stroke();
    }
    if (face.grain || face.stitches?.length) {
      c.clip();
      c.strokeStyle = face.grain ? "rgba(48,31,19,.2)" : "rgba(104,81,48,.32)";
      c.lineWidth = (face.grain ? 0.35 : 0.45) / z;
      c.beginPath();
      for (const [a, b] of face.grain ? [face.grain] : face.stitches) {
        c.moveTo(...a);
        c.lineTo(...b);
      }
      c.stroke();
      if (face.stitches?.length) {
        c.setLineDash([0.55 / z, 1.25 / z]);
        c.strokeStyle = "rgba(255,243,207,.65)";
        c.stroke();
      }
    }
    c.restore();
  }
}

function drawLine3d(c, a, b, heading, color, width, z, motion, alpha = 1) {
  const pa = projectedPoint(a, heading, motion);
  const pb = projectedPoint(b, heading, motion);
  c.save();
  c.globalAlpha = alpha;
  c.strokeStyle = color;
  c.lineWidth = width / z;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(pa[0], pa[1]);
  c.lineTo(pb[0], pb[1]);
  c.stroke();
  c.restore();
}

function sailFaces(mast, profile, windX, windY, mastIndex, tear = 0, seed = 0) {
  const faces = [];
  const fringes = [];
  const seams = [];
  const baseY = mast.y;
  const sails = Math.max(1, mast.sails);
  const addCloth = (vertices, panel = 0) => {
    let panelIndex = panel;
    const center = vertices.reduce(
      (sum, vertex) =>
        sum.map((value, index) => value + vertex[index] / vertices.length),
      [0, 0, 0],
    );
    const bowed = [center[0] + windX, center[1] + windY, center[2]];
    const emit = (triangle, outline) =>
      faces.push({
        vertices: triangle,
        fill: panelIndex % 2 ? "#dfcda5" : "#eadbb8",
        outline: outline ? "rgba(105,82,49,.22)" : undefined,
        cloth: true,
        stitches: sailStitchLines(triangle),
        doubleSided: true,
        order: 20 + mastIndex * 10 + panelIndex,
      });
    const layout =
      tear > 0
        ? sailTearLayout(seed * 7 + mastIndex * 131 + panel * 29, tear)
        : null;
    if (!layout || !layout.torn.size) {
      for (let index = 0; index < vertices.length; index++) {
        const next = (index + 1) % vertices.length;
        emit([vertices[index], vertices[next], bowed], true);
        panelIndex++;
      }
      return center;
    }
    // Torn cloth: the intact lattice cells of each fan triangle stay up while
    // the ripped ones leave genuine gaps that the sky and sea show through.
    for (let index = 0; index < vertices.length; index++) {
      const next = (index + 1) % vertices.length;
      const a = vertices[index];
      const b = vertices[next];
      const corner = (u, v) => [
        a[0] + (b[0] - a[0]) * u + (bowed[0] - a[0]) * v,
        a[1] + (b[1] - a[1]) * u + (bowed[1] - a[1]) * v,
        a[2] + (b[2] - a[2]) * u + (bowed[2] - a[2]) * v,
      ];
      layout.cells.forEach((cell, cellIndex) => {
        if (layout.torn.has(cellIndex)) return;
        emit(
          cell.points.map(([u, v]) =>
            corner(u / SAIL_TEAR_GRID, v / SAIL_TEAR_GRID),
          ),
          false,
        );
        panelIndex++;
      });
      // The remaining cloth keeps its panel outline along the fan edges.
      seams.push([a, b], [a, bowed], [b, bowed]);
      for (const [start, end] of layout.fringes)
        fringes.push([
          corner(start[0] / SAIL_TEAR_GRID, start[1] / SAIL_TEAR_GRID),
          corner(end[0] / SAIL_TEAR_GRID, end[1] / SAIL_TEAR_GRID),
        ]);
    }
    return center;
  };

  if (profile.rig === "lateen") {
    const yard = mast.yard;
    const lower = deckHeight(profile, baseY / profile.length) + 1;
    const peak = [0, baseY - 2, mast.height];
    const forward = [-yard * 0.28, baseY - 4, mast.height * 0.9];
    const aft = [yard * 0.9, baseY + 11, lower];
    addCloth([peak, forward, aft], mastIndex);
    return { faces, fringes, seams };
  }

  if (profile.rig === "gaff" || (profile.rig === "barque" && mastIndex === 2)) {
    const low = deckHeight(profile, baseY / profile.length) + 1;
    const top = [0, baseY - 1, mast.height];
    const peak = [mast.yard * 0.9, baseY + 5, mast.height * 0.8];
    const clew = [mast.yard * 0.72, baseY + 12, low];
    const tack = [-mast.yard * 0.22, baseY + 7, low];
    addCloth([top, peak, clew, tack], mastIndex);
    return { faces, fringes, seams };
  }

  for (let tier = 0; tier < sails; tier++) {
    const yard = mast.yard * (1 - tier * 0.08);
    const top = mast.height * (0.83 - tier * 0.22);
    const bottom = mast.height * (0.58 - tier * 0.22);
    const vertices = [
      [-yard * 0.5, baseY, top],
      [yard * 0.5, baseY, top],
      [yard * 0.44, baseY + 1.4, bottom],
      [-yard * 0.44, baseY + 1.4, bottom],
    ];
    addCloth(vertices, tier + mastIndex);
  }
  return { faces, fringes, seams };
}

// Deck hands scramble as the storm arc builds: tiny ink figures hurry between
// the rail and the mast, appearing one by one, leaning into the work. They are
// drawn large for their scale so the scramble still reads at sailing zoom.
function drawDeckCrew(c, profile, heading, z, motion, intensity) {
  const time = motion.time || 0;
  for (let index = 0; index < 5; index++) {
    const pose = sampleDeckCrew(time, index, intensity);
    if (pose.alpha <= 0.03) continue;
    const along = pose.along;
    const half = hullWidth(profile, along) * 0.5 * pose.side;
    const footY = along * profile.length;
    const footZ = deckHeight(profile, along) + 0.35;
    const bob = Math.abs(pose.step) * 0.5;
    const lean = pose.side * 0.55;
    drawLine3d(
      c,
      [half, footY, footZ],
      [half + lean, footY - 0.8, footZ + 2.6 + bob],
      heading,
      "#2a1a0e",
      1.7,
      z,
      motion,
      pose.alpha * 0.9,
    );
    const head = projectedPoint(
      [half + lean, footY - 0.8, footZ + 3.2 + bob],
      heading,
      motion,
    );
    c.beginPath();
    c.arc(head[0], head[1], 0.66, 0, Math.PI * 2);
    c.fillStyle = `rgba(42,26,14,${pose.alpha * 0.9})`;
    c.fill();
    // The closest hands reach out to the rigging as they work.
    if (index < 2)
      drawLine3d(
        c,
        [half + lean, footY - 0.6, footZ + 2 + bob],
        [half * 1.9, footY + 1.4, footZ + 3.6 + bob],
        heading,
        "#2a1a0e",
        1.1,
        z,
        motion,
        pose.alpha * 0.75,
      );
  }
}

function shipDeckLines(c, profile, heading, z, motion) {
  c.save();
  c.strokeStyle = "rgba(67,43,25,.6)";
  c.lineWidth = 0.65 / z;
  for (let y = -profile.length * 0.34; y <= profile.length * 0.36; y += 3.2) {
    const along = y / profile.length;
    const half = hullWidth(profile, along) * 0.82;
    const height = deckHeight(profile, along) + 0.06;
    drawLine3d(
      c,
      [-half, y, height],
      [half, y, height],
      heading,
      "rgba(74,48,28,.5)",
      0.55,
      z,
      motion,
      0.75,
    );
  }
  const hatchY = profile.length * 0.03;
  const hatchSize = profile.beam * 0.25;
  drawLine3d(
    c,
    [-hatchSize, hatchY - 1.2, profile.deckHeight + 0.12],
    [hatchSize, hatchY - 1.2, profile.deckHeight + 0.12],
    heading,
    "#49301e",
    0.8,
    z,
    motion,
  );
  drawLine3d(
    c,
    [hatchSize, hatchY - 1.2, profile.deckHeight + 0.12],
    [hatchSize, hatchY + 1.2, profile.deckHeight + 0.12],
    heading,
    "#49301e",
    0.8,
    z,
    motion,
  );
  drawLine3d(
    c,
    [hatchSize, hatchY + 1.2, profile.deckHeight + 0.12],
    [-hatchSize, hatchY + 1.2, profile.deckHeight + 0.12],
    heading,
    "#49301e",
    0.8,
    z,
    motion,
  );
  drawLine3d(
    c,
    [-hatchSize, hatchY + 1.2, profile.deckHeight + 0.12],
    [-hatchSize, hatchY - 1.2, profile.deckHeight + 0.12],
    heading,
    "#49301e",
    0.8,
    z,
    motion,
  );
  c.restore();
}

function drawHullDetails(c, profile, heading, z, motion, lighting) {
  const facingSide = Math.sin(heading) >= 0 ? 1 : -1;
  if (profile.guns) {
    c.fillStyle = "#241810";
    for (const y of [
      -profile.length * 0.2,
      -profile.length * 0.02,
      profile.length * 0.16,
      profile.length * 0.32,
    ]) {
      const x = facingSide * hullWidth(profile, y / profile.length) * 0.83;
      const point = projectedPoint(
        [x, y, profile.deckHeight * 0.55],
        heading,
        motion,
      );
      c.beginPath();
      c.ellipse(point[0], point[1], 1.1 / z, 0.82 / z, 0, 0, Math.PI * 2);
      c.fill();
      drawLine3d(
        c,
        [x + facingSide * 0.25, y, profile.deckHeight * 0.53],
        [x + facingSide * 2.1, y, profile.deckHeight * 0.53],
        heading,
        "#392719",
        0.65,
        z,
        motion,
      );
    }
  }
  if (profile.outrigger) {
    for (const side of [-1, 1]) {
      const beam = side * (profile.beam + 5);
      drawLine3d(
        c,
        [side * profile.beam * 0.75, -profile.length * 0.12, 2],
        [beam, -profile.length * 0.12, 1.5],
        heading,
        "#4b321f",
        0.9,
        z,
        motion,
      );
      drawLine3d(
        c,
        [beam, -profile.length * 0.12, 1.5],
        [beam, profile.length * 0.3, 1.5],
        heading,
        "#4b321f",
        1.1,
        z,
        motion,
      );
      drawLine3d(
        c,
        [side * profile.beam * 0.75, profile.length * 0.22, 2],
        [beam, profile.length * 0.22, 1.5],
        heading,
        "#4b321f",
        0.9,
        z,
        motion,
      );
    }
  }
  for (let index = 0; index < profile.cargo; index++) {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = (column ? 1 : -1) * profile.beam * 0.23;
    const y = profile.length * (0.1 + row * 0.1);
    const size = profile.beam * 0.24;
    const faces = boxFaces(
      x - size,
      x + size,
      y - 1.2,
      y + 1.2,
      profile.deckHeight + 0.12,
      profile.deckHeight + 2.2,
      {
        top: index % 2 ? "#c49a5c" : "#b1844b",
        bow: "#79502e",
        stern: "#684328",
        port: "#835632",
        starboard: "#9a6939",
      },
    );
    paintFaces(
      c,
      faces
        .map((face, order) => worldFace(face, heading, order, motion, lighting))
        .filter(Boolean),
      z,
    );
  }
}

function drawHullWater(
  c,
  profile,
  motion,
  heading,
  z,
  bioluminescence,
  windX,
  windY,
) {
  const strength = motion.wake;
  if (strength < 0.02) return;
  const beam = profile.beam;
  const length = profile.length;
  c.save();
  c.rotate(heading);
  c.lineCap = "round";

  // The bow pushes a shallow, dark wedge outward before foam gathers on its lip.
  for (const side of [-1, 1]) {
    c.fillStyle = bowWaterStyle(strength * 0.16);
    c.beginPath();
    c.moveTo(side * beam * 0.3, -length * 0.5);
    c.quadraticCurveTo(
      side * (beam + 4 * strength),
      -length * 0.46,
      side * (beam + 8 * strength),
      -length * 0.16,
    );
    c.quadraticCurveTo(
      side * beam * 0.95,
      -length * 0.28,
      side * beam * 0.48,
      -length * 0.43,
    );
    c.closePath();
    c.fill();
    for (let fleck = 0; fleck < 7; fleck++) {
      const spread = (fleck + Math.sin(fleck * 2.4) * 0.25) / 7;
      const x = side * (beam * (0.38 + spread * 0.62) + strength * spread * 4);
      const y = -length * (0.49 - spread * 0.36);
      c.fillStyle = bowFoamStyle(strength * (0.12 + (1 - spread) * 0.12));
      c.beginPath();
      c.ellipse(
        x,
        y,
        0.5 + spread * 0.4,
        0.35 + spread * 0.2,
        0,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
    c.strokeStyle = bowSprayStyle(strength * 0.55);
    c.lineWidth = (0.8 + strength * 0.5) / z;
    c.beginPath();
    c.moveTo(side * beam * 0.24, -length * 0.52);
    c.bezierCurveTo(
      side * beam * 0.85,
      -length * 0.54,
      side * (beam + 5 * strength),
      -length * 0.4,
      side * (beam + 7 * strength),
      -length * 0.24,
    );
    c.stroke();
    for (let drop = 0; drop < 5; drop++) {
      const spread = drop / 5;
      const lift = Math.abs(motion.heave) * 0.8 + motion.spray * strength * 2;
      const drift = motion.spray * (0.5 + spread) * 2.5;
      c.fillStyle = bowSprayStyle(
        strength * (0.48 - spread * 0.3) * (0.8 + motion.spray * 0.2),
      );
      c.beginPath();
      c.ellipse(
        side * (beam * 0.7 + spread * strength * 10) + windX * drift,
        -length * (0.48 - spread * 0.2) - lift * (1 - spread) + windY * drift,
        (0.65 + strength * 0.5) * (1 - spread * 0.5),
        0.45 + strength * 0.4,
        heading * 0.12,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
  }

  // Uneven foam flecks mark the disturbed water behind the stern.
  for (let fleck = 0; fleck < 11; fleck++) {
    const distance = (fleck + Math.sin(fleck * 3.9) * 0.3) / 11;
    const cross = Math.sin(fleck * 9.13) * beam * (0.38 + distance * 0.48);
    const x = cross + motion.flutter * 0.25;
    const y = length * (0.48 + distance * 0.65);
    c.fillStyle = sternFoamStyle(strength * (0.18 + (1 - distance) * 0.22));
    c.beginPath();
    c.ellipse(
      x,
      y,
      0.65 + (fleck % 3) * 0.38,
      0.4 + (fleck % 4) * 0.2,
      0,
      0,
      Math.PI * 2,
    );
    c.fill();
    if (fleck % 4 === 0) {
      c.strokeStyle = sternCrestStyle(strength * (0.2 - distance * 0.08));
      c.lineWidth = 0.9 / z;
      c.beginPath();
      c.moveTo(x - 2.2, y + 0.8);
      c.quadraticCurveTo(x, y - 2.3, x + 2.9, y + 0.7);
      c.stroke();
    }
  }
  if (bioluminescence && bioluminescence.strength > 0.01)
    drawHullBioluminescence(c, profile, bioluminescence, strength);
  c.restore();
}

// In the luminous seas the hull's own churn wakes the plankton: specks cling
// to both bow-wave shoulders and scatter through the stern eddy around one
// soft pool astern. Screen composite keeps the teal out of the hull ink, and
// each speck keeps its own slow twinkle, flaring as it brightens.
function drawHullBioluminescence(c, profile, bioluminescence, strength) {
  const glow = bioluminescence.strength;
  const t = bioluminescence.time;
  const phase = bioluminescence.phase || 0;
  const beam = profile.beam;
  const length = profile.length;
  c.save();
  c.globalCompositeOperation = "screen";
  const speck = (x, y, radius, alpha) => {
    c.fillStyle = eddySpeckStyle(alpha);
    c.beginPath();
    c.ellipse(x, y, radius, radius * 0.72, 0, 0, Math.PI * 2);
    c.fill();
  };
  for (const side of [-1, 1]) {
    for (let fleck = 0; fleck < 3; fleck++) {
      const spread = (fleck + Math.sin(fleck * 3.3 + side) * 0.3) / 3;
      const twinkle = bioluminescentTwinkle(
        t,
        phase + fleck * 1.9 + side * 3.1,
      );
      if (twinkle < 0.3) continue;
      speck(
        side * (beam * (0.52 + spread * 0.55) + strength * 1.5),
        -length * (0.47 - spread * 0.3),
        0.4 + twinkle * 0.85,
        glow * twinkle * 0.85,
      );
    }
  }
  c.fillStyle = eddyGlowStyle(glow * 0.2);
  c.beginPath();
  c.ellipse(0, length * 0.62, beam * 1.35, length * 0.34, 0, 0, Math.PI * 2);
  c.fill();
  for (let fleck = 0; fleck < 5; fleck++) {
    const spread = (fleck + Math.sin(fleck * 2.7 + phase) * 0.25) / 5;
    const twinkle = bioluminescentTwinkle(t, phase + fleck * 2.63 + 0.7);
    if (twinkle < 0.3) continue;
    speck(
      Math.sin(fleck * 7.31 + phase) * beam * (0.35 + spread * 0.5),
      length * (0.5 + spread * 0.62),
      0.45 + twinkle * 0.95,
      glow * twinkle * 0.78,
    );
  }
  c.restore();
}

// Wood chips and torn timbers float in the ship's wake after a battering.
// Positions are deterministic; animation time only streams them slowly aft.
function drawSplinterFlecks(
  c,
  profile,
  heading,
  z,
  motion,
  damage,
  time,
  seed,
) {
  const flecks = splinterFlecks(seed, damage.splinters);
  if (!flecks.length) return;
  // The hull's clock freezes under reduced motion, and the chips follow it.
  const t = Number(motion.time ?? time) || 0;
  c.save();
  c.rotate(heading);
  for (const fleck of flecks) {
    const drift = (t * 0.05 + fleck.phase) % 0.45;
    const wobble = 0.5 + 0.5 * Math.sin(t * 1.2 + fleck.phase * 7);
    const x =
      fleck.side * profile.beam * fleck.athwart +
      Math.sin(t * 0.6 + fleck.phase * 9) * 0.9 +
      motion.flutter * 0.3;
    const y = (fleck.along * 1.3 - drift + 0.22) * profile.length;
    c.fillStyle = fleck.fresh
      ? splinterWoodStyle(0.22 + wobble * 0.32)
      : splinterPitchStyle(0.2 + wobble * 0.36);
    c.beginPath();
    c.ellipse(
      x,
      y,
      fleck.size * 1.5,
      fleck.size * 0.55,
      fleck.spin + wobble * 0.6,
      0,
      Math.PI * 2,
    );
    c.fill();
  }
  c.restore();
}

// Fresh canvas nailed over mended planking. Patches pop on over a few frames
// after a repair, then weather and fade across the following days.
const PATCH_FRAMES = 16;
function drawRepairPatches(
  c,
  profile,
  heading,
  z,
  motion,
  damage,
  damageKey,
  lighting,
  seed,
) {
  let spawn = patchSpawns.get(damageKey);
  if (!spawn || spawn.day !== damage.patchedDay) {
    spawn = { day: damage.patchedDay, frames: 0 };
    patchSpawns.set(damageKey, spawn);
  }
  spawn.frames += 1;
  const grow = 1 - Math.pow(1 - Math.min(1, spawn.frames / PATCH_FRAMES), 3);
  const side = Math.sin(heading) >= 0 ? 1 : -1;
  const dim = 0.55 + 0.45 * (lighting?.strength ?? 1);
  for (let index = 0; index < 3; index++) {
    const along = Math.max(
      -0.34,
      Math.min(
        0.4,
        -0.26 + index * 0.27 + (damageNoise(seed, 300 + index) - 0.5) * 0.12,
      ),
    );
    const py = along * profile.length;
    const px = side * hullWidth(profile, along) * 1.04;
    const centerZ = clamp(
      1.6 + damageNoise(seed, 320 + index) * profile.deckHeight * 0.5,
      1.4,
      Math.max(1.4, deckHeight(profile, along) - 0.6),
    );
    const halfY = profile.beam * (0.3 + damageNoise(seed, 340 + index) * 0.14);
    const halfZ = 0.9 + damageNoise(seed, 360 + index) * 0.7;
    const corners = [
      [px, py - halfY, centerZ - halfZ],
      [px, py + halfY, centerZ - halfZ],
      [px, py + halfY, centerZ + halfZ],
      [px, py - halfY, centerZ + halfZ],
    ].map(([, y, height]) => [
      px,
      py + (y - py) * grow,
      centerZ + (height - centerZ) * grow,
    ]);
    const fresh = damage.patch;
    const tone = 196 + Math.round(38 * fresh);
    const alpha = (0.5 + fresh * 0.36) * dim;
    c.beginPath();
    corners
      .map((corner) => projectedPoint(corner, heading, motion))
      .forEach(([x, y], cornerIndex) => {
        if (cornerIndex) c.lineTo(x, y);
        else c.moveTo(x, y);
      });
    c.closePath();
    c.fillStyle = `rgba(${tone},${tone - 24},${Math.round(tone * 0.72)},${alpha.toFixed(3)})`;
    c.fill();
    c.strokeStyle = `rgba(84,60,34,${(0.7 * dim).toFixed(3)})`;
    c.lineWidth = 0.7 / z;
    c.stroke();
    // A cross-stitch and four nails hold each patch to the planking.
    drawLine3d(
      c,
      corners[0],
      corners[2],
      heading,
      `rgba(96,68,38,${(0.55 * dim).toFixed(3)})`,
      0.5,
      z,
      motion,
    );
    c.fillStyle = `rgba(59,42,26,${(0.9 * dim).toFixed(3)})`;
    for (const corner of corners) {
      const [x, y] = projectedPoint(corner, heading, motion);
      c.beginPath();
      c.arc(x, y, 0.3 / z, 0, Math.PI * 2);
      c.fill();
    }
  }
}

// Thin smoke streaming from a critically holed hull. The trail lives in world
// space and is keyed to the persistent vessel so it survives across frames.
export function drawShipSmokeTrail(
  c,
  damageKey,
  x,
  y,
  z,
  environment = {},
  damage = null,
) {
  if (!damageKey || !damage?.smoke || environment.reducedMotion) return;
  const time = environment.time ?? 0;
  let trail = smokeTrails.get(damageKey);
  if (!trail) {
    trail = createSmokeTrail();
    smokeTrails.set(damageKey, trail);
  }
  const puffs = updateSmokeTrail(trail, {
    x,
    y,
    smoke: damage.smoke,
    time,
  });
  if (!puffs.length) return;
  const worldWidth = environment.worldWidth ?? 0;
  const daylight = environment.lighting?.daylight ?? 1;
  const stamp = getSmokeStamp();
  c.save();
  for (const puff of puffs) {
    const render = smokePuffRender(puff, environment);
    const px = worldWidth
      ? x + wrappedDelta(render.x, x, worldWidth)
      : render.x;
    const py = render.y - render.z * MAP_TILT_TAN;
    const size = render.radius * 2.2;
    c.globalAlpha = clamp(render.alpha * (0.5 + daylight * 0.5), 0, 1);
    c.drawImage(stamp, px - size / 2, py - size / 2, size, size);
  }
  c.restore();
}

function drawShipModel(
  c,
  vesselClass,
  seed,
  color,
  x,
  y,
  heading,
  z,
  windX = 0,
  windY = 0,
  motion = sampleShipMotion(),
  lighting = sceneLighting(),
  isPlayer = false,
  damage = null,
  damageKey = null,
  time = 0,
  crew = 0,
  bioluminescence = null,
) {
  const profile = getShipModelProfile(vesselClass, seed);
  // A holed hull lists to one side and settles lower into the water.
  if (damage)
    motion = {
      ...motion,
      roll: motion.roll + damage.heel,
      heave: motion.heave - damage.settle,
    };
  c.save();
  c.translate(x, y);
  drawHullWater(c, profile, motion, heading, z, bioluminescence, windX, windY);
  // Soft contact shadow stays on the water as the hull rises and falls.
  // The contact shadow falls southeast of the shared northwest light.
  for (const [spread, style] of CONTACT_SHADOWS) {
    c.fillStyle = style;
    c.beginPath();
    c.ellipse(
      -LIGHT_DIRECTION.x * 5,
      -LIGHT_DIRECTION.y * 8,
      profile.beam * spread,
      profile.length * 0.43 * spread,
      heading,
      0,
      Math.PI * 2,
    );
    c.fill();
  }
  if (damage?.splinters > 0)
    drawSplinterFlecks(c, profile, heading, z, motion, damage, time, seed);

  const hull = buildHullFaces(profile, seed);
  const cabinStart = profile.length * 0.17;
  const cabinEnd = profile.length * 0.43;
  const cabinWidth = profile.beam * (profile.cabin === "high" ? 0.62 : 0.48);
  const cabinHeight =
    profile.cabin === "high"
      ? 7.5
      : profile.cabin === "survey"
        ? 5.4
        : profile.cabin === "tiny"
          ? 2.8
          : 4.1;
  const structures = boxFaces(
    -cabinWidth,
    cabinWidth,
    cabinStart,
    cabinEnd,
    deckHeight(profile, 0.3) + 0.1,
    deckHeight(profile, 0.3) + cabinHeight,
    {
      top: "#c49758",
      bow: "#78502f",
      stern: "#56361f",
      port: "#684329",
      starboard: "#92633b",
    },
  );
  const sails = profile.masts.map((mast, index) =>
    sailFaces(mast, profile, windX, windY, index, damage?.tear ?? 0, seed),
  );
  const faces = [...hull, ...structures, ...sails.flatMap((sail) => sail.faces)]
    .map((face, order) => worldFace(face, heading, order, motion, lighting))
    .filter(Boolean);
  paintFaces(c, faces, z);

  // Ragged cloth threads hang off every tear, and the surviving panels keep
  // their outline so a shredded sail still reads as canvas, not noise.
  if (damage?.tear > 0) {
    for (const sail of sails) {
      for (const [a, b] of sail.seams)
        drawLine3d(c, a, b, heading, "rgba(70,49,29,.75)", 0.85, z, motion);
      for (const [a, b] of sail.fringes)
        drawLine3d(
          c,
          a,
          b,
          heading,
          "rgba(58,40,24,.85)",
          0.55,
          z,
          motion,
          0.9,
        );
    }
  }

  // A narrow painted waterline carries each vessel's color across the hull.
  // It also keeps smaller ships identifiable when their pennants are tiny.
  {
    const side = Math.sin(heading) >= 0 ? 1 : -1;
    for (let index = 0; index < HULL_STATIONS.length - 1; index++) {
      const [from] = HULL_STATIONS[index];
      const [to] = HULL_STATIONS[index + 1];
      drawLine3d(
        c,
        [side * hullWidth(profile, from) * 0.92, from * profile.length, 2.3],
        [side * hullWidth(profile, to) * 0.92, to * profile.length, 2.3],
        heading,
        color,
        1.25,
        z,
        motion,
        0.85,
      );
    }
  }
  if (damage?.patch > 0 && damageKey)
    drawRepairPatches(
      c,
      profile,
      heading,
      z,
      motion,
      damage,
      damageKey,
      lighting,
      seed,
    );

  // The raised stern works as a quarterdeck; a rail and cabin windows make
  // the larger merchant hulls read clearly even at chart scale.
  const railY = profile.length * 0.39;
  const railZ = deckHeight(profile, 0.39) + cabinHeight + 0.45;
  drawLine3d(
    c,
    [-cabinWidth, railY, railZ],
    [cabinWidth, railY, railZ],
    heading,
    "#3f291a",
    0.9,
    z,
    motion,
  );
  for (const side of [-1, 1]) {
    const xSide = side * cabinWidth * 0.74;
    for (const yWindow of [profile.length * 0.23, profile.length * 0.32]) {
      drawLine3d(
        c,
        [xSide, yWindow, deckHeight(profile, 0.3) + cabinHeight * 0.43],
        [xSide, yWindow, deckHeight(profile, 0.3) + cabinHeight * 0.64],
        heading,
        "#39271b",
        1.2,
        z,
        motion,
      );
    }
    // Small rail caps catch the shared scene light, without metallic outlines.
    drawLine3d(
      c,
      [side * cabinWidth, railY - 0.6, railZ + 0.12],
      [side * cabinWidth, railY + 0.6, railZ + 0.12],
      heading,
      litPigment("#c39b55", [0, 0, 1], lighting),
      0.8,
      z,
      motion,
      0.85,
    );
  }
  shipDeckLines(c, profile, heading, z, motion);
  if (isPlayer && crew > 0.02)
    drawDeckCrew(c, profile, heading, z, motion, crew);
  drawHullDetails(c, profile, heading, z, motion, lighting);

  // Standing rigging and bowsprit give the model a readable three dimensional
  // silhouette. Sails are faceted cloth panels with seams and a wind belly.
  const mastHeads = [];
  for (const mast of profile.masts) {
    const base = deckHeight(profile, mast.y / profile.length) + 0.6;
    const top = [0, mast.y, mast.height];
    mastHeads.push(top);
    for (const side of [-1, 1]) {
      drawLine3d(
        c,
        [0, mast.y, base],
        [side * mast.yard * 0.6, mast.y, mast.height * 0.45],
        heading,
        "#5b432a",
        0.55,
        z,
        motion,
        0.78,
      );
    }
    drawLine3d(c, [0, mast.y, base], top, heading, "#352519", 1.55, z, motion);
    drawLine3d(
      c,
      [-0.75, mast.y, base + 1.3],
      [0.75, mast.y, base + 1.3],
      heading,
      litPigment("#c39b55", [0, 0, 1], lighting),
      0.7,
      z,
      motion,
      0.8,
    );
    drawLine3d(
      c,
      [-0.7, mast.y, base + 1],
      [0.7, mast.y, mast.height - 1],
      heading,
      "#b58c50",
      0.55,
      z,
      motion,
    );
    const tierCount = mast.sails;
    for (let tier = 0; tier < tierCount; tier++) {
      const yardZ = mast.height * (0.72 - tier * 0.21);
      const yard = mast.yard * (1 - tier * 0.08);
      drawLine3d(
        c,
        [-yard * 0.55, mast.y, yardZ],
        [yard * 0.55, mast.y, yardZ],
        heading,
        "#493321",
        1.1,
        z,
        motion,
      );
      drawLine3d(
        c,
        [-yard * 0.55, mast.y, yardZ + 0.45],
        [yard * 0.55, mast.y, yardZ + 0.45],
        heading,
        "#bd9a62",
        0.45,
        z,
        motion,
        0.85,
      );
      if (
        profile.rig === "square" ||
        (profile.rig === "barque" && mast !== profile.masts.at(-1))
      ) {
        const seamZ = mast.height * (0.67 - tier * 0.21);
        drawLine3d(
          c,
          [-yard * 0.34 + windX * 0.4, mast.y + windY * 0.4, seamZ],
          [yard * 0.34 + windX * 0.4, mast.y + windY * 0.4, seamZ],
          heading,
          color,
          0.75,
          z,
          motion,
          0.62,
        );
      }
    }
  }
  if (mastHeads.length > 1) {
    drawLine3d(
      c,
      [-1, -profile.length * 0.47, profile.deckHeight + 1],
      mastHeads[0],
      heading,
      "#5b432a",
      0.6,
      z,
      motion,
      0.8,
    );
    for (let index = 0; index < mastHeads.length - 1; index++)
      drawLine3d(
        c,
        mastHeads[index],
        mastHeads[index + 1],
        heading,
        "#5b432a",
        0.55,
        z,
        motion,
        0.76,
      );
    drawLine3d(
      c,
      mastHeads.at(-1),
      [1, profile.length * 0.46, deckHeight(profile, 0.46) + 1],
      heading,
      "#5b432a",
      0.55,
      z,
      motion,
      0.72,
    );
  }

  // A tiny two-tone pennant is the only bright color on the timber model.
  const leadMast = profile.masts[Math.floor(profile.masts.length / 2)];
  const pennantTop = projectedPoint(
    [0, leadMast.y, leadMast.height],
    heading,
    motion,
  );
  const windLength = Math.hypot(windX, windY);
  const pennantLength = (isPlayer ? 9 : 6) * (0.92 + motion.gust * 0.08);
  const pennantX = windX / windLength;
  const pennantY = windY / windLength;
  const pennantTip = projectedPoint(
    [
      pennantX * pennantLength - pennantY * motion.flutter,
      leadMast.y + pennantY * pennantLength + pennantX * motion.flutter,
      leadMast.height - 1.1 + motion.flutter * 0.7,
    ],
    heading,
    motion,
  );
  const pennantBase = projectedPoint(
    [0, leadMast.y, leadMast.height - (isPlayer ? 2.6 : 1.7)],
    heading,
    motion,
  );
  c.beginPath();
  c.moveTo(...pennantTop);
  c.lineTo(...pennantTip);
  c.lineTo(...pennantBase);
  c.closePath();
  c.fillStyle = color;
  c.fill();
  c.strokeStyle = isPlayer ? "#f3d58f" : "#3d2618";
  c.lineWidth = (isPlayer ? 0.9 : 0.55) / z;
  c.stroke();
  c.restore();
}

// The hull eddy glow is presentation-only state: strength 0..1 from the
// caller's region lookup, a shimmer clock already zeroed for reduced motion,
// and the vessel's seed so each hull scatters its colonies differently.
function hullBioluminescence(environment) {
  const strength = environment.bioluminescence;
  if (!(strength > 0.01)) return null;
  return {
    strength,
    time: environment.time ?? 0,
    phase: (environment.seed ?? 0) * 2.399963,
  };
}

export function drawMerchantShip(
  c,
  merchant,
  z = 1,
  renderX = merchant.x,
  environment = {},
) {
  const angle = merchant.angle || 0;
  const damage = merchant.damage || null;
  const damageKey = merchant.damageKey || null;
  const motion = sampleShipMotion({
    time: 0,
    speed: merchant.speed || 0,
    ...environment,
    seed: merchant.idNum || 0,
  });
  const relativeWind = (environment.windAngle || 0) - angle;
  const lighting = environment.lighting || sceneLighting();
  drawShipModel(
    c,
    merchant.vesselClass,
    merchant.idNum,
    merchant.color || "#a83f2f",
    renderX,
    merchant.y,
    angle + Math.PI / 2,
    z,
    Math.sin(relativeWind) * motion.billow,
    -Math.cos(relativeWind) * motion.billow,
    motion,
    lighting,
    false,
    damage,
    damageKey,
    environment.time ?? 0,
    0,
    hullBioluminescence({ ...environment, seed: merchant.idNum || 0 }),
  );
  // Smoke climbs from the deck and drifts astern, so it renders above the
  // hull while the oldest puffs fall away behind it.
  if (damage?.smoke)
    drawShipSmokeTrail(
      c,
      damageKey,
      renderX,
      merchant.y,
      z,
      environment,
      damage,
    );
}

export function drawShip(
  c,
  x,
  y,
  angle,
  windAngle = 0,
  windStrength = 0,
  vesselClass = "cutter",
  z = 1,
  environment = {},
) {
  const relativeWind = windAngle - angle;
  const damage = environment.damage || null;
  const damageKey = environment.damageKey || null;
  const clock = environment.time ?? performance.now() / 1000;
  const motion = {
    ...sampleShipMotion({
      time: clock,
      ...environment,
      windStrength,
    }),
    // Deck hands sample the same frozen clock the hull does.
    time: environment.reducedMotion ? 0 : clock,
  };
  const lighting = environment.lighting || sceneLighting();
  c.save();
  c.translate(x, y);
  const playerScale = 1.82;
  c.scale(playerScale, playerScale);
  drawShipModel(
    c,
    vesselClass,
    0,
    "#b84a30",
    0,
    0,
    angle + Math.PI / 2,
    z / playerScale,
    Math.sin(relativeWind) * motion.billow,
    -Math.cos(relativeWind) * motion.billow,
    motion,
    lighting,
    true,
    damage,
    damageKey,
    environment.time ?? 0,
    environment.crew || 0,
    hullBioluminescence(environment),
  );
  c.restore();
  // Smoke climbs from the deck and drifts astern, drawn in the caller's
  // transform so its sizes match the merchant fleet's smoke.
  if (damage?.smoke)
    drawShipSmokeTrail(c, damageKey, x, y, z, environment, damage);
}
