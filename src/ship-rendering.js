import { sampleShipMotion } from "./core/seascape.js";
import { getShipModelProfile } from "./core/ship-models.js";
import { MAP_TILT_COS, MAP_TILT_SIN, MAP_TILT_TAN } from "./core/projection.js";

export { getShipModelProfile as shipDrawProfile } from "./core/ship-models.js";

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

function buildHullFaces(profile) {
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

  const deck = [
    ...stations.map((station) => station.starboardTop),
    ...stations.toReversed().map((station) => station.portTop),
  ];
  faces.push({ vertices: deck, fill: "#a8753d", outline: "#392419" });

  return faces;
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

function lightInk(color, normal) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  const light =
    0.86 +
    Math.max(0, -normal[0] * 0.45 - normal[1] * 0.3 + normal[2] * 0.84) * 0.23;
  const channels = [1, 3, 5].map((offset) =>
    Math.min(
      255,
      Math.round(parseInt(color.slice(offset, offset + 2), 16) * light),
    ),
  );
  return `rgb(${channels.join(",")})`;
}

function worldFace(face, heading, order, motion) {
  const vertices = face.vertices.map((vertex) =>
    rotatePoint(vertex, heading, motion),
  );
  const first = vertices[0];
  const second = vertices[1];
  const third = vertices[2];
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
    fill: lightInk(face.fill, normal),
    projected: vertices.map((point) => [
      point.x,
      point.y - point.z * MAP_TILT_TAN,
    ]),
    depth,
    order,
  };
}

function paintFaces(c, faces, z) {
  faces.sort((a, b) => a.depth - b.depth || a.order - b.order);
  for (const face of faces) {
    c.beginPath();
    face.projected.forEach(([x, y], index) => {
      if (index) c.lineTo(x, y);
      else c.moveTo(x, y);
    });
    c.closePath();
    c.fillStyle = face.fill;
    c.fill();
    if (face.outline) {
      c.strokeStyle = face.outline;
      c.lineWidth = 0.85 / z;
      c.lineJoin = "round";
      c.stroke();
    }
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

function sailFaces(mast, profile, windX, windY, mastIndex) {
  const faces = [];
  const baseY = mast.y;
  const sails = Math.max(1, mast.sails);
  const addCloth = (vertices, panel = 0) => {
    const center = vertices.reduce(
      (sum, vertex) =>
        sum.map((value, index) => value + vertex[index] / vertices.length),
      [0, 0, 0],
    );
    const bowed = [center[0] + windX, center[1] + windY, center[2]];
    for (let index = 0; index < vertices.length; index++) {
      const next = (index + 1) % vertices.length;
      faces.push({
        vertices: [vertices[index], vertices[next], bowed],
        fill: panel % 2 ? "#d8c697" : "#eadbb1",
        outline: "rgba(70,49,29,.75)",
        doubleSided: true,
        order: 20 + mastIndex * 10 + panel,
      });
      panel++;
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
    return faces;
  }

  if (profile.rig === "gaff" || (profile.rig === "barque" && mastIndex === 2)) {
    const low = deckHeight(profile, baseY / profile.length) + 1;
    const top = [0, baseY - 1, mast.height];
    const peak = [mast.yard * 0.9, baseY + 5, mast.height * 0.8];
    const clew = [mast.yard * 0.72, baseY + 12, low];
    const tack = [-mast.yard * 0.22, baseY + 7, low];
    addCloth([top, peak, clew, tack], mastIndex);
    return faces;
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
  return faces;
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

function drawHullDetails(c, profile, heading, z, motion) {
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
        .map((face, order) => worldFace(face, heading, order, motion))
        .filter(Boolean),
      z,
    );
  }
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
) {
  const profile = getShipModelProfile(vesselClass, seed);
  c.save();
  c.translate(x, y);
  c.save();
  c.rotate(heading);
  c.lineCap = "round";
  c.strokeStyle = `rgba(247,238,200,${0.12 + motion.wake * 0.4})`;
  c.lineWidth = 1 / z;
  c.beginPath();
  c.ellipse(
    0,
    0,
    profile.beam * 1.08,
    profile.length * 0.51,
    0,
    Math.PI * 0.9,
    Math.PI * 2.1,
  );
  c.stroke();
  if (motion.wake > 0.02) {
    for (const side of [-1, 1]) {
      c.beginPath();
      c.moveTo(0, -profile.length * 0.52);
      c.bezierCurveTo(
        side * profile.beam * 0.8,
        -profile.length * 0.4,
        side * profile.beam * 1.25,
        profile.length * 0.15,
        side * (profile.beam + 7 * motion.wake),
        profile.length * 0.75,
      );
      c.stroke();
    }
  }
  c.restore();
  // Soft contact shadow stays on the water as the hull rises and falls.
  // Align its long axis with the keel, under the shared northwest light.
  for (const [spread, alpha] of [
    [1.35, 0.035],
    [1.16, 0.06],
    [1, 0.13],
  ]) {
    c.fillStyle = `rgba(29,52,42,${alpha})`;
    c.beginPath();
    c.ellipse(
      2.5,
      4,
      profile.beam * spread,
      profile.length * 0.43 * spread,
      heading,
      0,
      Math.PI * 2,
    );
    c.fill();
  }

  const hull = buildHullFaces(profile);
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
  const faces = [
    ...hull,
    ...structures,
    ...profile.masts.flatMap((mast, index) =>
      sailFaces(mast, profile, windX, windY, index),
    ),
  ]
    .map((face, order) => worldFace(face, heading, order, motion))
    .filter(Boolean);
  paintFaces(c, faces, z);

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
  }
  shipDeckLines(c, profile, heading, z, motion);
  drawHullDetails(c, profile, heading, z, motion);

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
  const pennantTip = projectedPoint(
    [
      6 + motion.flutter,
      leadMast.y + 0.8 + motion.flutter * 1.4,
      leadMast.height - 1.1 + motion.flutter,
    ],
    heading,
    motion,
  );
  const pennantBase = projectedPoint(
    [0, leadMast.y + 1.7, leadMast.height - 2.3],
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
  c.strokeStyle = "#3d2618";
  c.lineWidth = 0.55 / z;
  c.stroke();
  c.restore();
}

export function drawMerchantShip(
  c,
  merchant,
  z = 1,
  renderX = merchant.x,
  environment = {},
) {
  const angle = merchant.angle || 0;
  const motion = sampleShipMotion({
    time: 0,
    speed: merchant.speed || 0,
    ...environment,
    seed: merchant.idNum || 0,
  });
  const relativeWind = (environment.windAngle || 0) - angle;
  drawShipModel(
    c,
    merchant.vesselClass,
    merchant.idNum,
    merchant.color || "#a83f2f",
    renderX,
    merchant.y,
    angle + Math.PI / 2,
    z,
    Math.cos(relativeWind) * motion.billow,
    Math.sin(relativeWind) * motion.billow,
    motion,
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
  const motion = sampleShipMotion({
    time: performance.now() / 1000,
    ...environment,
    windStrength,
  });
  c.save();
  c.translate(x, y);
  c.scale(1.7, 1.7);
  drawShipModel(
    c,
    vesselClass,
    0,
    "#9c3d2c",
    0,
    0,
    angle + Math.PI / 2,
    z / 1.7,
    Math.cos(relativeWind) * motion.billow,
    Math.sin(relativeWind) * motion.billow,
    motion,
  );
  c.restore();
}
