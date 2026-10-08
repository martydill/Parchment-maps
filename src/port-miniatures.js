import { mixSeasonColor } from "./core/seasons.js";
import { getHarborLayout } from "./harbor-layouts.js";
import { MAP_TILT_TAN } from "./core/projection.js";
import { PORT_NAMES } from "./names.js";
import { createAlphaPalette } from "./style-palette.js";
import { LIGHT_DIRECTION, sceneLighting } from "./core/lighting.js";
import { harborDevelopment, harborProfile } from "./core/harbors.js";

import {
  portLayerOffset,
  portPlateLighting,
  portScenePalette,
} from "./core/port-scene.js";

let miniatureLighting = sceneLighting();

const foundryGlowStyle = createAlphaPalette("249,148,68", 0.26, 0.38, 128);
const foundrySparkStyle = createAlphaPalette("255,183,86", 0, 0.7, 128);
const chimneySmokeStyle = createAlphaPalette("79,73,65", 0, 0.15, 128);

// The same tilted, orthographic ground plane used by the ship models. The town
// grid turns toward its nearest coastline when a scene is drawn.
const DEFAULT_HEADING = -0.34;
let gridCos = Math.cos(DEFAULT_HEADING);
let gridSin = Math.sin(DEFAULT_HEADING);
let gridHeading = DEFAULT_HEADING;
let localFrame = { u: 0, v: 0, z: 0, angle: 0, scale: 1 };

function setGridHeading(heading) {
  gridCos = Math.cos(heading);
  gridSin = Math.sin(heading);
  gridHeading = heading;
  localFrame = { u: 0, v: 0, z: 0, angle: 0, scale: 1 };
}

// Rotate footprints in the map's ground plane. Canvas rotation would tilt the
// towers too; this keeps every vertical wall upright at any building angle.
function withFrame({ u = 0, v = 0, z = 0, angle = 0, scale = 1 }, draw) {
  const parent = localFrame;
  const cos = Math.cos(parent.angle),
    sin = Math.sin(parent.angle);
  localFrame = {
    u: parent.u + (u * cos - v * sin) * parent.scale,
    v: parent.v + (u * sin + v * cos) * parent.scale,
    z: parent.z + z * parent.scale,
    angle: parent.angle + angle,
    scale: parent.scale * scale,
  };
  try {
    return draw();
  } finally {
    localFrame = parent;
  }
}
const INK = "#64503b";
const pigmentCache = new Map();

// Dry watercolor leaves the paper visible instead of shading like a 3D model.
function paperPigment(color) {
  if (!/^#[\da-f]{6}$/i.test(color)) return color;
  if (!pigmentCache.has(color)) {
    const paper = [242, 226, 191];
    const channels = [1, 3, 5].map((offset, index) =>
      Math.round(
        parseInt(color.slice(offset, offset + 2), 16) * 0.66 +
          paper[index] * 0.34,
      ),
    );
    pigmentCache.set(color, `rgb(${channels.join(",")})`);
  }
  return pigmentCache.get(color);
}

function variation(u, v, seed = 0) {
  const value = Math.sin(u * 12.9898 + v * 78.233 + seed * 37.719) * 43758.5453;
  return value - Math.floor(value);
}
const SCENES = new Map([
  [
    PORT_NAMES.orvessaQuay,
    {
      kind: "quays",
      ground: "#a48c64",
      wall: "#d4bd91",
      side: "#937457",
      roof: "#875743",
      roofShade: "#624234",
      flag: [-5, -18, 78],
      smoke: [[-45, -18, 53]],
    },
  ],
  [
    PORT_NAMES.narthkel,
    {
      kind: "citadel",
      ground: "#807f77",
      wall: "#b7b1a0",
      side: "#77756e",
      roof: "#625e5d",
      roofShade: "#444346",
      flag: [0, -17, 112],
      smoke: [],
    },
  ],
  [
    PORT_NAMES.mirravel,
    {
      kind: "lighthouse",
      ground: "#b3a88e",
      wall: "#e4d7b2",
      side: "#a29b84",
      roof: "#628487",
      roofShade: "#43686b",
      flag: [46, -10, 51],
      smoke: [],
    },
  ],
  [
    PORT_NAMES.drazhOvek,
    {
      kind: "foundry",
      ground: "#67594d",
      wall: "#8d7764",
      side: "#4d4845",
      roof: "#473c37",
      roofShade: "#302c2b",
      flag: [41, -16, 75],
      smoke: [
        [-32, -20, 95],
        [-12, -19, 80],
      ],
    },
  ],
  [
    PORT_NAMES.heliovar,
    {
      kind: "terraces",
      ground: "#c6a36b",
      wall: "#e5c48a",
      side: "#a47d55",
      roof: "#a96d46",
      roofShade: "#7f4d37",
      flag: [7, -19, 111],
      smoke: [],
    },
  ],
  [
    PORT_NAMES.vesperport,
    {
      kind: "windmills",
      ground: "#8b956c",
      wall: "#d2c19d",
      side: "#89755b",
      roof: "#616b62",
      roofShade: "#47544e",
      flag: [49, -15, 59],
      smoke: [[-50, -12, 36]],
    },
  ],
]);

// Every named harbor keeps its own palette and variation on the chart and in
// its inspection artwork. Existing landmark cities supply the older templates.
const templates = new Map(
  [...SCENES.values()].map((scene) => [scene.kind, scene]),
);
for (const name of Object.values(PORT_NAMES)) {
  const profile = harborProfile(name);
  SCENES.set(name, {
    ...templates.get(profile.kind),
    ...profile,
    layout: getHarborLayout(name),
    flag: getHarborLayout(name).flag,
    smoke: getHarborLayout(name).smoke ?? [],
    seed: [...name].reduce(
      (sum, letter) => (Math.imul(sum, 31) + letter.charCodeAt(0)) >>> 0,
      7,
    ),
  });
}

export function hasPortMiniature(name) {
  return SCENES.has(name);
}

// Architecture is costly to trace, but changes only when the harbor develops.
// Keep one transparent plate per port; live workers, flags and boats stay separate.
export function createPortMiniatureCache(resolution = 2) {
  const plates = new Map();
  return {
    draw(
      c,
      name,
      evolution = {},
      heading = DEFAULT_HEADING,
      lighting = sceneLighting(),
      season,
    ) {
      if (!SCENES.has(name)) return false;
      const plateLighting = portPlateLighting(lighting);
      const key = JSON.stringify([
        heading,
        harborDevelopment(evolution),
        plateLighting,
        season?.key,
      ]);
      let plate = plates.get(name);
      if (!plate || plate.key !== key) {
        const canvas = plate?.canvas ?? document.createElement("canvas");
        canvas.width = 224 * resolution;
        canvas.height = 224 * resolution;
        const art = canvas.getContext("2d");
        art.scale(resolution, resolution);
        art.translate(112, 136);
        drawPortMiniature(art, name, evolution, heading, plateLighting, season);
        art.save();
        art.globalCompositeOperation = "source-atop";
        art.fillStyle = `rgba(12,24,48,${plateLighting.night * 0.48})`;
        art.fillRect(-112, -136, 224, 224);
        art.fillStyle = `rgba(225,116,58,${plateLighting.dusk * 0.12})`;
        art.fillRect(-112, -136, 224, 224);
        art.fillStyle = `rgba(63,96,128,${plateLighting.storm * 0.15})`;
        art.fillRect(-112, -136, 224, 224);
        art.restore();
        plate = { key, canvas };
        plates.set(name, plate);
      }
      c.drawImage(plate.canvas, -112, -136, 224, 224);
      return true;
    },
  };
}

function point(u, v, height = 0) {
  const cos = Math.cos(localFrame.angle),
    sin = Math.sin(localFrame.angle);
  const x = localFrame.u + (u * cos - v * sin) * localFrame.scale;
  v = localFrame.v + (u * sin + v * cos) * localFrame.scale;
  u = x;
  height = localFrame.z + height * localFrame.scale;
  return [
    u * gridCos - v * gridSin,
    u * gridSin + v * gridCos - height * MAP_TILT_TAN,
  ];
}

function face(c, vertices, fill, stroke = INK, width = 0.48) {
  const points = vertices.map((vertex) => point(...vertex));
  c.beginPath();
  points.forEach(([x, y], index) => {
    if (!index) c.moveTo(x, y);
    else {
      const [px, py] = points[index - 1];
      const bend = (variation(x, y) - 0.5) * 0.48;
      c.quadraticCurveTo((px + x) / 2 + bend, (py + y) / 2 - bend, x, y);
    }
  });
  c.closePath();
  c.fillStyle = paperPigment(fill);
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = width;
    c.stroke();
  }
  // Fine broken etching follows the shadow side, never a screen-space texture.
  if (
    stroke &&
    /^#/.test(fill) &&
    points.length >= 4 &&
    vertices.some((vertex) => vertex[2] !== vertices[0][2])
  ) {
    c.save();
    c.clip();
    const xs = points.map(([x]) => x),
      ys = points.map(([, y]) => y);
    const left = Math.min(...xs),
      right = Math.max(...xs);
    const top = Math.min(...ys),
      bottom = Math.max(...ys);
    c.strokeStyle = "rgba(78,57,36,.16)";
    c.lineWidth = 0.28;
    c.beginPath();
    for (let x = left - (bottom - top); x < right; x += 3.4) {
      const inset = variation(x, top) * 2;
      c.moveTo(x + inset, bottom - inset);
      c.lineTo(x + (bottom - top) * 0.7, top + inset);
    }
    c.stroke();
    c.restore();
  }
}

function line(c, a, b, color = "rgba(76,53,33,.5)", width = 0.55) {
  const [ax, ay] = point(...a);
  const [bx, by] = point(...b);
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(ax, ay);
  const bend = (variation(ax, by) - 0.5) * 0.45;
  c.quadraticCurveTo((ax + bx) / 2 + bend, (ay + by) / 2 - bend, bx, by);
  c.stroke();
}

function terrace(c, u, v, w, d, base, top, color, edge = "#67523d") {
  const a = u - w / 2,
    b = u + w / 2,
    back = v - d / 2,
    front = v + d / 2;
  face(
    c,
    [
      [a, front, base],
      [b, front, base],
      [b, front, top],
      [a, front, top],
    ],
    edge,
  );
  face(
    c,
    [
      [a, back, base],
      [a, front, base],
      [a, front, top],
      [a, back, top],
    ],
    "#665345",
  );
  face(
    c,
    [
      [a, back, top],
      [b, back, top],
      [b, front, top],
      [a, front, top],
    ],
    color,
  );
  line(
    c,
    [a, front, top - 0.8],
    [b, front, top - 0.8],
    "rgba(255,234,182,.62)",
    0.9,
  );
  for (let x = a + 5; x < b; x += 8)
    line(
      c,
      [x, front, base + 1],
      [x, front, top - 1],
      "rgba(22,28,24,.18)",
      0.5,
    );
}

function landform(c, outline, base, top, color, edge) {
  // The quay is cut stone with an irregular contour, rather than a solid plinth.
  outline = outline.flatMap(([u, v], index) => {
    const next = outline[(index + 1) % outline.length];
    return [
      [u, v],
      [
        (u + next[0]) / 2 + (variation(u, v) - 0.5) * 3,
        (v + next[1]) / 2 + (variation(v, u) - 0.5) * 3,
      ],
    ];
  });
  const walls = outline.map((first, index) => ({
    first,
    second: outline[(index + 1) % outline.length],
  }));
  walls.sort(
    (a, b) =>
      point((a.first[0] + a.second[0]) / 2, (a.first[1] + a.second[1]) / 2)[1] -
      point((b.first[0] + b.second[0]) / 2, (b.first[1] + b.second[1]) / 2)[1],
  );
  for (const { first, second } of walls)
    face(
      c,
      [
        [first[0], first[1], base],
        [second[0], second[1], base],
        [second[0], second[1], top],
        [first[0], first[1], top],
      ],
      edge,
    );
  face(
    c,
    outline.map(([u, v]) => [u, v, top]),
    color,
  );
  c.save();
  c.clip();
  for (let row = -34; row < 25; row += 4) {
    for (let col = -64; col < 64; col += 7) {
      const u = col + ((row / 4) % 2) * 3.5;
      const v = row + variation(col, row) * 1.5;
      line(
        c,
        [u, v, top + 0.1],
        [u + 3 + variation(row, col) * 2, v, top + 0.1],
        "rgba(93,73,47,.2)",
        0.3,
      );
    }
  }
  c.restore();
}

function windowFront(c, u, v, z, size = 2.6, lit = false) {
  face(
    c,
    [
      [u - size / 2, v, z],
      [u + size / 2, v, z],
      [u + size / 2, v, z + size * 1.45],
      [u - size / 2, v, z + size * 1.45],
    ],
    miniatureLighting.night > 0.4
      ? "rgba(255,199,108,.95)"
      : lit
        ? "#bc965b"
        : "#685d4c",
    "#cbb99a",
    0.4,
  );
  line(
    c,
    [u, v + 0.03, z + 0.5],
    [u, v + 0.03, z + size * 1.3],
    "rgba(250,227,171,.55)",
    0.45,
  );
}

function building(c, scene, spec) {
  const character = variation(spec.u, spec.v, scene.seed);
  withFrame(spec, () =>
    drawBuilding(c, scene, { ...spec, u: 0, v: 0, z: 0, character }),
  );
}

function drawBuilding(c, scene, spec) {
  const {
    u,
    v,
    w,
    d,
    h,
    z = 0,
    roof = "gable",
    windows = 2,
    tint,
    character = 0.5,
  } = spec;
  const angle = gridHeading + localFrame.angle;
  const a = u - w / 2,
    b = u + w / 2;
  const front = v + (Math.cos(angle) >= 0 ? d / 2 : -d / 2);
  const back = v - (front - v);
  const side = Math.sin(angle) <= 0 ? a : b;
  const top = z + h;
  const shadowU =
    -(
      LIGHT_DIRECTION.x * Math.cos(angle) +
      LIGHT_DIRECTION.y * Math.sin(angle)
    ) *
    h *
    0.32;
  const shadowV =
    -(
      -LIGHT_DIRECTION.x * Math.sin(angle) +
      LIGHT_DIRECTION.y * Math.cos(angle)
    ) *
    h *
    0.32;
  face(
    c,
    [
      [a, back, z],
      [b, back, z],
      [b + shadowU, front + shadowV, z],
      [a + shadowU, front + shadowV, z],
    ],
    "rgba(93,75,48,.08)",
    null,
  );
  face(
    c,
    [
      [a - 1, back - 1, z],
      [b + 1, back - 1, z],
      [b + 1, front + 2, z],
      [a - 1, front + 2, z],
    ],
    "rgba(93,75,48,.07)",
    null,
  );
  face(
    c,
    [
      [side, back, z],
      [side, front, z],
      [side, front, top],
      [side, back, top],
    ],
    scene.side,
  );
  face(
    c,
    [
      [a, front, z],
      [b, front, z],
      [b, front, top],
      [a, front, top],
    ],
    tint || scene.wall,
  );
  line(
    c,
    [a + 1, front + 0.03, top - 2],
    [b - 1, front + 0.03, top - 2],
    "rgba(255,236,188,.63)",
  );
  for (let course = z + 7; course < top - 4; course += 7) {
    line(
      c,
      [a + 1, front + 0.04, course],
      [b - 1, front + 0.04, course],
      "rgba(59,41,29,.21)",
      0.48,
    );
    for (
      let joint = a + 5 + (Math.round(course) % 2) * 4;
      joint < b - 2;
      joint += 9
    )
      line(
        c,
        [joint, front + 0.05, course],
        [joint, front + 0.05, course + 3],
        "rgba(59,41,29,.18)",
        0.45,
      );
  }
  if (windows) {
    for (let index = 0; index < windows; index++) {
      const x = a + (w * (index + 1)) / (windows + 1);
      windowFront(
        c,
        x,
        front + 0.08,
        z + h * 0.46,
        Math.min(2.8, w / 5),
        index === 0 && h > 24,
      );
      if (h > 24) windowFront(c, x, front + 0.08, z + h * 0.76, 2.1);
      if (h > 48) windowFront(c, x, front + 0.08, z + h * 0.26, 2.1);
      if (character > 0.45)
        for (const side of [-1, 1])
          line(
            c,
            [x + side * 2.1, front + 0.1, z + h * 0.46],
            [x + side * 2.1, front + 0.1, z + h * 0.46 + 3.5],
            scene.roof,
            0.8,
          );
    }
  }
  if (roof === "flat") {
    face(
      c,
      [
        [a, back, top],
        [b, back, top],
        [b, front, top],
        [a, front, top],
      ],
      scene.roof,
    );
    line(c, [a, front, top + 2], [b, front, top + 2], "#514135", 1.3);
    if (scene.snow) {
      c.save();
      c.globalAlpha *= scene.snow;
      line(c, [a, front, top + 2.5], [b, front, top + 2.5], "#f4f7f1", 2.4);
      c.restore();
    }
  } else {
    const ridge = top + Math.min(10, w * 0.34);
    face(
      c,
      [
        [u, back, ridge],
        [b, back, top],
        [b, front, top],
        [u, front, ridge],
      ],
      scene.roofShade,
    );
    face(
      c,
      [
        [a, back, top],
        [u, back, ridge],
        [u, front, ridge],
        [a, front, top],
      ],
      scene.roof,
    );
    face(
      c,
      [
        [a, front, top],
        [u, front, ridge],
        [b, front, top],
      ],
      scene.roof,
    );
    if (scene.snow) {
      c.save();
      c.globalAlpha *= scene.snow;
      line(c, [u, back, ridge + 0.8], [u, front, ridge + 0.8], "#f4f7f1", 2.2);
      line(c, [a, front, top + 0.8], [u, front, ridge + 0.8], "#eef4ef", 1.8);
      c.restore();
    }
    for (
      let stripe = Math.min(back, front) + 3;
      stripe < Math.max(back, front);
      stripe += 5
    )
      line(
        c,
        [a + 1, stripe, top + 0.4],
        [u - 1, stripe, ridge - 0.7],
        "rgba(250,223,168,.3)",
        0.52,
      );
    line(
      c,
      [u, back, ridge + 0.25],
      [u, front, ridge + 0.25],
      "rgba(255,231,179,.56)",
      0.9,
    );
  }

  if (windows && w > 10) {
    facadeDetails(c, scene, {
      u,
      v,
      w,
      d,
      h,
      z,
      roof,
      character,
      facadeV: front,
    });
  }
}

// An address can be a timber merchant's house, an arcaded counting hall, or
// a shop with a hanging sign. Details are fixed across frames and save reloads.
function facadeDetails(
  c,
  scene,
  { u, v, w, d, h, z, roof, character, facadeV },
) {
  const front = facadeV + Math.sign(facadeV - v) * 0.12,
    a = u - w / 2,
    b = u + w / 2,
    top = z + h;
  const timber = ["quays", "fishing", "windmills", "marsh"].includes(
    scene.kind,
  );
  if (
    roof !== "flat" &&
    ["quays", "canals"].includes(scene.kind) &&
    character > 0.35
  ) {
    const ridge = top + Math.min(10, w * 0.34);
    const gable = [[a, front, top]];
    for (let step = 0; step < 4; step++) {
      const x = a + (w * (step + 1)) / 8;
      const height = top + ((ridge - top) * (step + 1)) / 4;
      gable.push([x - w / 8, front, height], [x, front, height]);
    }
    for (let step = 3; step >= 0; step--) {
      const x = b - (w * (step + 1)) / 8;
      const height = top + ((ridge - top) * (step + 1)) / 4;
      gable.push([x, front, height], [x + w / 8, front, height]);
    }
    gable.push([b, front, top]);
    face(c, gable, scene.wall, INK, 0.45);
    windowFront(c, u, front + 0.1, top + 1, 1.9);
  }
  if (timber && character > 0.3) {
    for (const x of [a + 1, u, b - 1])
      line(c, [x, front, z], [x, front, top], "#78634a", 0.7);
    line(
      c,
      [a, front, z + h * 0.36],
      [b, front, z + h * 0.36],
      "#78634a",
      0.65,
    );
    for (const x of [a + 1, u])
      line(
        c,
        [x, front, z + h * 0.4],
        [x + w / 2 - 1, front, top - 2],
        "#78634a",
        0.55,
      );
  }
  // Recessed arched doors with stone voussoirs and a threshold.
  const [dx, dy] = point(u, front, z + 0.8);
  const doorW = Math.min(3.2, w * 0.14),
    doorH = Math.min(10, h * 0.38) * MAP_TILT_TAN;
  c.fillStyle = "#7e6c53";
  c.strokeStyle = "#b9a281";
  c.lineWidth = 0.65;
  c.beginPath();
  c.moveTo(dx - doorW, dy);
  c.lineTo(dx - doorW, dy - doorH);
  c.quadraticCurveTo(dx, dy - doorH - 3, dx + doorW, dy - doorH);
  c.lineTo(dx + doorW, dy);
  c.closePath();
  c.fill();
  c.stroke();
  line(c, [u - 4, front + 1, z], [u + 4, front + 1, z], "#cbb590", 0.9);
  if (character > 0.66 && h < 45) {
    line(c, [b - 2, front, z + h * 0.4], [b + 4, front, z + h * 0.4], INK, 0.5);
    line(
      c,
      [b + 3, front, z + h * 0.4],
      [b + 3, front, z + h * 0.4 - 5],
      INK,
      0.4,
    );
    face(
      c,
      [
        [b + 1, front, z + h * 0.4 - 3],
        [b + 5, front, z + h * 0.4 - 3],
        [b + 5, front, z + h * 0.4 - 7],
        [b + 1, front, z + h * 0.4 - 7],
      ],
      scene.roof,
      INK,
      0.4,
    );
  }
  if (roof !== "flat") {
    const ridge = top + Math.min(10, w * 0.34);
    for (let row = 0.2; row < 0.95; row += 0.19) {
      const x = a + w * 0.5 * row,
        height = top + (ridge - top) * row;
      line(
        c,
        [x, v - d / 2, height],
        [x, front, height],
        "rgba(67,45,29,.32)",
        0.35,
      );
      for (let tile = v - d / 2 + 1; tile < v + d / 2; tile += 3)
        line(
          c,
          [x, tile, height],
          [x + 1.3, tile, height + 0.7],
          "rgba(67,45,29,.27)",
          0.3,
        );
    }
    if (character > 0.48) {
      // A little dormer breaks up the otherwise uniform roof silhouette.
      face(
        c,
        [
          [a + 2, v, top + 2],
          [a + 7, v, top + 2],
          [a + 7, v, top + 8],
          [a + 4.5, v, top + 11],
          [a + 2, v, top + 8],
        ],
        scene.wall,
      );
      windowFront(c, a + 4.5, v + 0.05, top + 4, 1.7);
      line(c, [a + 1, v, top + 8], [a + 4.5, v, top + 12], scene.roof, 1);
      line(c, [a + 4.5, v, top + 12], [a + 8, v, top + 8], scene.roof, 1);
    }
    if (character < 0.38) {
      face(
        c,
        [
          [b - 4, v - 2, top + 1],
          [b - 1, v - 2, top + 1],
          [b - 1, v - 2, top + 12],
          [b - 4, v - 2, top + 12],
        ],
        scene.wall,
      );
      line(c, [b - 5, v - 2, top + 12], [b, v - 2, top + 12], INK, 0.75);
    }
  }
}

function battlement(c, scene, u, v, w, d, z, h) {
  building(c, scene, { u, v, w, d, h, z, roof: "flat", windows: 0 });
  const front =
    v + (Math.cos(gridHeading + localFrame.angle) >= 0 ? d / 2 : -d / 2);
  for (let x = u - w / 2 + 2; x < u + w / 2 - 1; x += 7)
    face(
      c,
      [
        [x, front, z + h],
        [x + 4, front, z + h],
        [x + 4, front, z + h + 5],
        [x, front, z + h + 5],
      ],
      scene.wall,
    );
}

function frustum(
  c,
  u,
  v,
  base,
  height,
  bottomRadius,
  topRadius,
  colors,
  segments = 8,
) {
  const sides = [];
  for (let index = 0; index < segments; index++) {
    const first = (index / segments) * Math.PI * 2;
    const second = ((index + 1) / segments) * Math.PI * 2;
    const q = (angle, radius, z) => [
      u + Math.cos(angle) * radius,
      v + Math.sin(angle) * radius,
      z,
    ];
    sides.push({
      vertices: [
        q(first, bottomRadius, base),
        q(second, bottomRadius, base),
        q(second, topRadius, height),
        q(first, topRadius, height),
      ],
      depth: Math.sin((first + second) / 2 + gridHeading + localFrame.angle),
      index,
    });
  }
  sides.sort((a, b) => a.depth - b.depth);
  for (const side of sides)
    face(
      c,
      side.vertices,
      colors[side.index % colors.length],
      "rgba(82,63,42,.4)",
      0.3,
    );
  face(
    c,
    Array.from({ length: segments }, (_, index) => {
      const angle = (index / segments) * Math.PI * 2;
      return [
        u + Math.cos(angle) * topRadius,
        v + Math.sin(angle) * topRadius,
        height,
      ];
    }),
    colors[0],
  );
}

function cone(c, u, v, radius, base, rise, color) {
  const triangles = [];
  for (let index = 0; index < 8; index++) {
    const angle = (index / 8) * Math.PI * 2;
    const next = ((index + 1) / 8) * Math.PI * 2;
    triangles.push({
      vertices: [
        [u + Math.cos(angle) * radius, v + Math.sin(angle) * radius, base],
        [u + Math.cos(next) * radius, v + Math.sin(next) * radius, base],
        [u, v, base + rise],
      ],
      depth: Math.sin((angle + next) / 2 + gridHeading + localFrame.angle),
      index,
    });
  }
  triangles.sort((a, b) => a.depth - b.depth);
  for (const triangle of triangles)
    face(c, triangle.vertices, color, "rgba(82,63,42,.4)", 0.3);
}

function pier(c, u, v, w = 12, d = 23, color = "#816143") {
  terrace(c, u, v, w, d, -4, 3, color, "#553d2e");
  for (let plank = v - d / 2 + 3; plank < v + d / 2; plank += 4)
    line(
      c,
      [u - w / 2 + 1, plank, 3.2],
      [u + w / 2 - 1, plank, 3.2],
      "rgba(69,51,33,.42)",
      0.4,
    );
  for (const y of [v - d / 2 + 3, v + d / 2 - 3]) {
    line(c, [u - w / 2 + 2, y, 3], [u - w / 2 + 2, y, 10], "#493728", 1.6);
    line(c, [u - w / 2 + 2, y, 10], [u - w / 2 + 4, y, 10], "#b99b6c", 1.1);
  }
}

function crane(c, u, v, h = 40) {
  line(c, [u, v, 3], [u, v, h], "#796144", 1.2);
  line(c, [u, v, h], [u + 20, v - 5, h - 4], "#90744e", 1.1);
  line(c, [u + 20, v - 5, h - 4], [u + 20, v - 5, 11], "#655340", 0.7);
  line(c, [u, v, h], [u - 10, v + 4, 4], "#4e3a2b", 0.85);
  line(c, [u + 18, v - 5, 11], [u + 22, v - 5, 11], "#53402f", 1.8);
  face(
    c,
    [
      [u - 4, v - 3, 3],
      [u + 4, v - 3, 3],
      [u + 4, v + 3, 3],
      [u - 4, v + 3, 3],
    ],
    "#99734c",
  );
}

function cargo(c, u, v, count = 2) {
  for (let index = 0; index < count; index++) {
    const x = u + index * 5;
    face(
      c,
      [
        [x, v, 4],
        [x + 4, v, 4],
        [x + 4, v, 10],
        [x, v, 10],
      ],
      "#805a3c",
    );
    face(
      c,
      [
        [x, v - 4, 10],
        [x + 4, v - 4, 10],
        [x + 4, v, 10],
        [x, v, 10],
      ],
      "#bc9259",
    );
    line(c, [x, v, 4], [x + 4, v, 10], "rgba(50,35,26,.65)", 0.6);
  }
}

function awning(c, u, v, width, height, color) {
  face(
    c,
    [
      [u - width / 2, v, height],
      [u + width / 2, v, height],
      [u + width / 2, v + 8, height - 5],
      [u - width / 2, v + 8, height - 5],
    ],
    color,
  );
  line(
    c,
    [u - width / 2, v + 8, 7],
    [u - width / 2, v + 8, height - 5],
    "#6b4c31",
  );
  line(
    c,
    [u + width / 2, v + 8, 7],
    [u + width / 2, v + 8, height - 5],
    "#6b4c31",
  );
}

function lighthouse(c, u, v) {
  frustum(c, u, v, 0, 89, 11, 7, ["#e6d8ad", "#cbbd99", "#fff0c3", "#c0af8f"]);
  frustum(c, u, v, 33, 42, 8.8, 8.2, ["#b85b43", "#934b3a", "#ce7554"]);
  frustum(c, u, v, 87, 93, 10, 10, ["#554a3f", "#66564a"]);
  frustum(c, u, v, 93, 108, 6.5, 6.5, ["#f6d895", "#bd9665"]);
  cone(c, u, v, 8, 108, 12, "#755042");
  line(c, [u, v, 120], [u, v, 126], "#513d2e", 0.8);
  for (const z of [23, 59, 76]) windowFront(c, u, v + 10, z, 2.2);
}

function windmill(c, u, v, height = 67) {
  frustum(c, u, v, 0, height, 8, 5.5, [
    "#dbcaa3",
    "#b9a988",
    "#e5d5b1",
    "#a39278",
  ]);
  cone(c, u, v, 8.5, height, 8, "#5e6359");
  windowFront(c, u, v + 7, 16, 2.7);
  rotor(c, u, v, height - 6, 0.27 + u * 0.02, 1);
}

function rotor(c, u, v, z, angle, alpha) {
  const [x, y] = point(u, v + 5, z);
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.globalAlpha *= alpha;
  for (let blade = 0; blade < 4; blade++) {
    c.rotate(Math.PI / 2);
    c.fillStyle = blade % 2 ? "#efe2bd" : "#d7c597";
    c.strokeStyle = "#473729";
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(-1.2, -3);
    c.lineTo(1.2, -3);
    c.lineTo(4, -21);
    c.lineTo(-2, -21);
    c.closePath();
    c.fill();
    c.stroke();
    c.strokeStyle = "rgba(105,78,48,.55)";
    c.lineWidth = 0.5;
    for (let seam = -7; seam > -19; seam -= 4) {
      c.beginPath();
      c.moveTo(-1.5, seam);
      c.lineTo(3, seam);
      c.stroke();
    }
  }
  c.fillStyle = "#46352a";
  c.beginPath();
  c.arc(0, 0, 2.6, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function chimney(c, scene, u, v, height) {
  building(c, scene, { u, v, w: 7, d: 7, h: height, roof: "flat", windows: 0 });
  face(
    c,
    [
      [u - 4, v - 4, height + 5],
      [u + 4, v - 4, height + 5],
      [u + 4, v + 4, height + 5],
      [u - 4, v + 4, height + 5],
    ],
    "#403932",
  );
  for (let z = 16; z < height; z += 10)
    line(
      c,
      [u - 3, v + 3.6, z],
      [u + 3, v + 3.6, z],
      "rgba(230,181,133,.43)",
      0.7,
    );
}

function dome(c, scene, u, v, z, radius) {
  const [x, y] = point(u, v, z);
  c.fillStyle = paperPigment(scene.roof);
  c.strokeStyle = INK;
  c.lineWidth = 0.5;
  c.beginPath();
  c.moveTo(x - radius, y);
  c.bezierCurveTo(
    x - radius,
    y - radius * 1.2,
    x + radius,
    y - radius * 1.2,
    x + radius,
    y,
  );
  c.quadraticCurveTo(x, y + radius * 0.3, x - radius, y);
  c.fill();
  c.stroke();
  for (const rib of [-0.55, 0, 0.55]) {
    c.beginPath();
    c.moveTo(x + rib * radius, y);
    c.quadraticCurveTo(
      x + rib * radius * 0.6,
      y - radius * 0.7,
      x,
      y - radius * 0.9,
    );
    c.stroke();
  }
  line(c, [u, v, z + radius * 1.8], [u, v, z + radius * 2.4], INK, 0.55);
}

function tree(c, u, v, height, seed) {
  line(c, [u, v, 4], [u, v, height], "#7b6b4e", 0.7);
  const [x, y] = point(u, v, height);
  c.beginPath();
  for (let lobe = 0; lobe <= 24; lobe++) {
    const angle = (lobe / 24) * Math.PI * 2;
    const radius = 5 + variation(lobe, seed) * 2;
    const px = x + Math.cos(angle) * radius,
      py = y + Math.sin(angle) * radius * 0.8;
    if (!lobe) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.closePath();
  c.fillStyle = "#a6ae88";
  c.fill();
  c.strokeStyle = "rgba(75,83,52,.45)";
  c.lineWidth = 0.35;
  c.stroke();
  for (let sprig = 0; sprig < 26; sprig++) {
    const angle = sprig * 2.4,
      radius = variation(sprig, seed) * 5;
    const px = x + Math.cos(angle) * radius,
      py = y + Math.sin(angle) * radius * 0.8;
    c.beginPath();
    c.moveTo(px - 1, py + 0.5);
    c.quadraticCurveTo(px, py - 1.3, px + 1.2, py);
    c.strokeStyle = sprig % 3 ? "rgba(77,91,51,.4)" : "rgba(242,230,190,.7)";
    c.lineWidth = 0.3;
    c.stroke();
  }
}

function palm(c, u, v, h = 40) {
  line(c, [u, v, 5], [u + 3, v, h], "#71583b", 1.2);
  const [x, y] = point(u + 3, v, h);
  c.strokeStyle = "#70805a";
  c.lineWidth = 1.8;
  for (let leaf = -2; leaf <= 2; leaf++) {
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x + leaf * 6, y - 7, x + leaf * 9, y + 6);
    c.stroke();
  }
}

function drawLandmark(c, scene, mark) {
  const { type, h = 55, r = 7, w = 16, d = 18 } = mark;
  withFrame({ ...mark, z: mark.z ?? 5 }, () => {
    switch (type) {
      case "lighthouse":
        lighthouse(c, 0, 0);
        break;
      case "windmill":
        windmill(c, 0, 0, h);
        break;
      case "chimney":
        chimney(c, scene, 0, 0, h);
        break;
      case "spire":
        frustum(c, 0, 0, 0, h, r, r * 0.72, [scene.wall, scene.side]);
        cone(c, 0, 0, r * 1.3, h, 17, scene.roof);
        windowFront(c, 0, r, h * 0.4, 2);
        break;
      case "turret":
      case "furnace":
        frustum(c, 0, 0, 0, h, r, r * 0.88, [scene.wall, scene.side]);
        if (type === "furnace") dome(c, scene, 0, 0, h, r * 0.9);
        else {
          frustum(c, 0, 0, h, h + 4, r + 1, r + 1, [scene.wall, scene.side]);
          for (let merlon = 0; merlon < 10; merlon++) {
            const angle = (merlon / 10) * Math.PI * 2;
            const u = Math.cos(angle) * r,
              v = Math.sin(angle) * r;
            line(c, [u, v, h + 4], [u, v, h + 8], scene.wall, 2.2);
          }
          windowFront(c, 0, r, h * 0.5, 2.6);
        }
        break;
      case "dome":
        frustum(c, 0, 0, 0, h, r * 0.9, r * 0.9, [scene.wall, scene.side]);
        dome(c, scene, 0, 0, h, r);
        break;
      case "keep":
        battlement(c, scene, 0, 0, w, d, 0, h);
        break;
      case "clock": {
        building(c, scene, { u: 0, v: 0, w, d, h, windows: 2 });
        const front =
          Math.cos(gridHeading + localFrame.angle) >= 0 ? d / 2 : -d / 2;
        const [x, y] = point(0, front, h * 0.8);
        c.beginPath();
        c.ellipse(x, y, 3.4, 4.2, 0, 0, Math.PI * 2);
        c.fillStyle = "#e8d8ac";
        c.fill();
        c.strokeStyle = INK;
        c.lineWidth = 0.45;
        c.stroke();
        c.beginPath();
        c.moveTo(x, y - 2.8);
        c.lineTo(x, y);
        c.lineTo(x + 2, y + 0.8);
        c.stroke();
        break;
      }
      case "ribs":
        for (let rib = 0; rib < 9; rib++) {
          const [x, y] = point(0, -19 + rib * 4, 5);
          c.beginPath();
          c.moveTo(x - 9, y);
          c.bezierCurveTo(x - 10, y - 12, x + 10, y - 12, x + 9, y);
          c.strokeStyle = "#8c8066";
          c.lineWidth = 0.9;
          c.stroke();
        }
        break;
    }
  });
}

function drawNets(c, u, v, angle) {
  withFrame({ u, v, angle }, () => {
    for (const x of [-9, 9]) line(c, [x, 0, 5], [x, 0, 26], "#786a50", 1);
    line(c, [-9, 0, 26], [9, 0, 26], "#786a50", 0.7);
    for (let thread = -7; thread < 9; thread += 3) {
      line(c, [thread, 0, 23], [thread + 2, 0, 8], "rgba(64,80,67,.5)", 0.4);
      line(
        c,
        [-7, 0, 15 + thread],
        [9, 0, 15 + thread],
        "rgba(64,80,67,.4)",
        0.4,
      );
    }
  });
}

function drawDock(c, scene, [u, v, w, d, angle]) {
  withFrame({ u, v, angle }, () => {
    pier(c, 0, 0, w, d, scene.side);
    const [x, y] = point(w / 2 + 2, -d / 2 + 3, 3);
    c.beginPath();
    c.ellipse(x, y, 2.1, 0.9, 0, 0, Math.PI * 2);
    c.strokeStyle = "#9a825d";
    c.lineWidth = 0.45;
    c.stroke();
  });
}

function samplePromenade(points, progress) {
  const position = progress * (points.length - 1);
  const index = Math.min(points.length - 2, Math.floor(position));
  const blend = position - index;
  return points[index].map(
    (value, coordinate) =>
      value + (points[index + 1][coordinate] - value) * blend,
  );
}

export function drawPortMiniature(
  c,
  name,
  evolution = {},
  heading = DEFAULT_HEADING,
  lighting = sceneLighting(),
  season,
) {
  const base = SCENES.get(name);
  const scene =
    base && season
      ? {
          ...base,
          roof: mixSeasonColor(base.roof, "#eff3ed", season.snow * 0.95),
          roofShade: mixSeasonColor(
            base.roofShade,
            "#b8cdd0",
            season.snow * 0.92,
          ),
          ground: mixSeasonColor(base.ground, season.ground, 0.45),
          snow: season.snow,
        }
      : base;
  if (!scene) return false;
  const layout = scene.layout;
  setGridHeading(heading + layout.angle);
  miniatureLighting = lighting;
  c.save();
  c.scale(layout.scale, layout.scale);
  c.lineJoin = "round";
  c.lineCap = "round";
  if (layout.water) {
    face(
      c,
      layout.water.map(([u, v]) => [u, v, -4]),
      "rgba(96,151,145,.18)",
      null,
    );
    c.save();
    c.clip();
    for (let v = -24; v < 52; v += 6)
      for (let u = -60; u < 65; u += 17) {
        const offset = variation(u, v) * 5;
        line(
          c,
          [u + offset, v, -4],
          [u + offset + 9, v, -4],
          "rgba(67,117,112,.22)",
          0.3,
        );
      }
    c.restore();
  }
  for (const { outline, z } of layout.grounds)
    landform(c, outline, z > 10 ? -3 : z - 4, z, scene.ground, scene.side);
  if (season) drawSeasonalGardens(c, season);
  for (const [u, v, w, d, angle, z] of layout.bridges ?? [])
    withFrame({ u, v, angle }, () =>
      terrace(c, 0, 0, w, d, z - 3, z, scene.wall, scene.side),
    );
  for (const [u, v, w, d, count, bottom, top] of layout.steps ?? [])
    for (let step = 0; step < count; step++)
      terrace(
        c,
        u,
        v + (step * d) / 2,
        w,
        d / 2,
        bottom,
        top - ((top - bottom) * step) / count,
        scene.wall,
        scene.side,
      );
  for (let index = 1; index < layout.walk.length; index++)
    line(
      c,
      layout.walk[index - 1],
      layout.walk[index],
      "rgba(234,217,174,.65)",
      2,
    );
  const development = harborDevelopment(evolution);
  layout.docks
    .slice(0, Math.min(layout.docks.length, development.docks + 1))
    .forEach((dock) => drawDock(c, scene, dock));
  const objects = [];
  for (const [u, v, w, d, h, angle, z = 5, roof = "gable"] of layout.houses)
    objects.push({
      u,
      v,
      draw() {
        if (layout.stilted)
          withFrame({ u, v, angle }, () => {
            for (const side of [-1, 1])
              line(
                c,
                [(side * w) / 3, d / 3, -4],
                [(side * w) / 3, d / 3, z],
                "#747457",
                1.1,
              );
            terrace(c, 0, 0, w + 3, d + 3, z - 2, z, scene.ground, scene.side);
          });
        building(c, scene, {
          u,
          v,
          w,
          d,
          h,
          angle,
          z,
          roof,
          windows: Math.max(1, Math.floor(w / 8)),
        });
      },
    });
  for (const mark of layout.landmarks)
    objects.push({ ...mark, draw: () => drawLandmark(c, scene, mark) });
  for (const [u, v, w, d, angle, z, h] of layout.walls ?? [])
    objects.push({
      u,
      v,
      draw: () =>
        withFrame({ u, v, angle }, () =>
          battlement(c, scene, 0, 0, w, d, z, h),
        ),
    });
  for (const [u, v, h] of layout.trees)
    objects.push({ u, v, draw: () => tree(c, u, v, h, scene.seed) });
  for (const [u, v, h] of layout.palms ?? [])
    objects.push({ u, v, draw: () => palm(c, u, v, h) });
  for (const [u, v, angle] of layout.nets ?? [])
    objects.push({ u, v, draw: () => drawNets(c, u, v, angle) });
  for (const [u, v, h, angle] of layout.cranes ?? [])
    objects.push({
      u,
      v,
      draw: () => withFrame({ u, v, angle }, () => crane(c, 0, 0, h)),
    });
  for (const [u, v, width, height] of layout.awnings ?? [])
    objects.push({
      u,
      v,
      draw: () => awning(c, u, v, width, height, scene.roof),
    });
  const [warehouse, works] = layout.expansion;
  const [wu, wv, wa, wz] = warehouse,
    [tu, tv, ta, tz] = works;
  if (development.warehouses)
    objects.push({
      u: wu,
      v: wv,
      draw: () =>
        building(c, scene, {
          u: wu,
          v: wv,
          w: 16,
          d: 12,
          h: 17,
          angle: wa,
          z: wz,
          windows: 2,
        }),
    });
  if (development.cranes)
    objects.push({
      u: tu,
      v: tv,
      draw: () =>
        withFrame({ u: tu, v: tv, angle: ta }, () => crane(c, 0, 0, 30)),
    });
  if (development.foundries)
    objects.push({
      u: wu,
      v: wv,
      draw: () =>
        withFrame({ u: wu, v: wv, z: wz }, () => chimney(c, scene, 0, 0, 34)),
    });
  if (development.fortifications)
    objects.push({
      u: tu,
      v: tv,
      draw: () =>
        withFrame({ u: tu, v: tv, angle: ta }, () =>
          battlement(c, scene, 0, 0, 10, 9, tz, 14),
        ),
    });
  objects.sort((a, b) => point(a.u, a.v)[1] - point(b.u, b.v)[1]);
  objects.forEach((object) => object.draw());
  for (const [u, v] of layout.reeds ?? [])
    for (let reed = 0; reed < 5; reed++) {
      line(
        c,
        [u + reed * 2, v, 0],
        [u + reed * 2 - 2, v, 12 + (reed % 3) * 3],
        "#82845d",
        0.6,
      );
      line(
        c,
        [u + reed * 2 - 2, v, 11],
        [u + reed * 2 - 2, v, 15],
        "#90764c",
        1.1,
      );
    }
  for (let index = 0; index < development.cargo; index++) {
    const [u, v, z] = samplePromenade(
      layout.walk,
      (index + 1) / (development.cargo + 1),
    );
    withFrame(
      { u, v, z: z - 5, angle: layout.houses[index % layout.houses.length][5] },
      () => cargo(c, 0, 0, 1),
    );
  }
  c.restore();
  return true;
}

function drawSeasonalGardens(c, season) {
  for (const [u, v] of [
    [-65, -9],
    [58, -23],
    [69, 3],
  ]) {
    line(c, [u, v, 5], [u, v, 24], "#62533b", 1.6);
    const [x, y] = point(u, v, 23);
    c.fillStyle = season.leaf;
    c.beginPath();
    c.ellipse(x, y, 7, 9, -0.2, 0, Math.PI * 2);
    c.fill();
    if (Math.max(season.blossoms, season.snow) > 0) {
      c.save();
      c.globalAlpha *= Math.max(season.blossoms, season.snow);
      for (let petal = 0; petal < 8; petal++) {
        const angle = petal * 2.4;
        c.fillStyle = season.snow
          ? "#edf4ef"
          : petal % 2
            ? "#f0b9bb"
            : "#fff0df";
        c.beginPath();
        c.arc(
          x + Math.cos(angle) * 5,
          y + Math.sin(angle) * 6 - 2,
          2.5,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
      c.restore();
    }
  }
}

function harborBoat(c, u, v, seconds, phase, windAngle, season) {
  const sway = Math.sin(seconds * 0.7 + phase) * 2.3;
  const bob = Math.sin(seconds * 1.2 + phase) * 0.45;
  u += sway;
  face(
    c,
    [
      [u - 7, v - 3, bob],
      [u + 7, v - 3, bob],
      [u + 5, v + 4, bob],
      [u - 5, v + 4, bob],
    ],
    "#9c6a3c",
  );
  face(
    c,
    [
      [u - 5, v + 4, bob - 3],
      [u + 5, v + 4, bob - 3],
      [u + 5, v + 4, bob],
      [u - 5, v + 4, bob],
    ],
    "#4c3629",
  );
  line(c, [u, v, bob + 1], [u, v, bob + 17], "#4b3527", 0.95);
  const belly = Math.sin(seconds * 0.9 + phase) * 1.1;
  face(
    c,
    [
      [u, v, bob + 15],
      [u + 6 + belly * Math.cos(windAngle), v + 0.5, bob + 4],
      [u, v, bob + 4],
    ],
    season?.sail ?? "#eee0b8",
    "#8a744e",
    0.6,
  );
  line(c, [u - 11, v + 5, 0], [u - 7, v + 5, 0], "rgba(224,219,183,.56)", 0.7);
  if (season) {
    // A trailing mesh distinguishes the seasonal fishing craft from traders.
    for (let strand = 0; strand < 4; strand++) {
      line(
        c,
        [u - 5 + strand * 3, v + 4, bob],
        [u - 7 + strand * 3, v + 10, -1],
        "rgba(202,213,185,.65)",
        0.5,
      );
      line(
        c,
        [u - 7, v + 5 + strand * 1.5, -1],
        [u + 2, v + 5 + strand * 1.5, -1],
        "rgba(202,213,185,.55)",
        0.5,
      );
    }
  }
}

export function drawPortActivity(
  c,
  name,
  time,
  zoom,
  windAngle = 0,
  heading = DEFAULT_HEADING,
  evolution = {},
  lighting = sceneLighting(),
  season,
) {
  const scene = SCENES.get(name);
  if (!scene || zoom < 1.08) return;
  const layout = scene.layout;
  setGridHeading(heading + layout.angle);
  miniatureLighting = lighting;
  const seconds = time / 1000;
  const development = harborDevelopment(evolution);
  c.save();
  c.scale(layout.scale, layout.scale);
  c.lineJoin = "round";
  c.lineCap = "round";
  // Workers walk between the market and the quays. Prosperity changes the
  // crowd density, while distressed harbors keep only a small working crew.
  for (let worker = 0; worker < development.workers; worker++) {
    const progress =
      ((worker + 0.5) / development.workers +
        Math.sin(seconds * 0.16 + worker) * 0.025 +
        1) %
      1;
    const [u, v, z] = samplePromenade(layout.walk, progress);
    const [x, y] = point(u, v, z + 5);
    c.fillStyle = worker % 3 ? "#4b5145" : "#9c6045";
    c.fillRect(x - 1, y - 3, 2, 4);
    c.fillStyle = "#d9bd8c";
    c.beginPath();
    c.arc(x, y - 4, 1.15, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#494033";
    c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(x - 1, y + 1);
    c.lineTo(x + Math.sin(seconds * 2 + worker), y + 3);
    c.stroke();
  }
  if (["canals", "tropical", "quays"].includes(scene.kind)) {
    for (let pennant = 0; pennant < 5; pennant++) {
      const [u, v, z] = samplePromenade(layout.walk, (pennant + 1) / 6);
      const [x, y] = point(u, v, z + 18);
      c.fillStyle = ["#aa5844", "#5b7e79", "#c69b52"][pennant % 3];
      c.beginPath();
      c.moveTo(x - 3, y);
      c.lineTo(x + 3, y);
      c.lineTo(x + Math.sin(seconds * 2 + pennant) * 2, y + 7);
      c.closePath();
      c.fill();
    }
  }
  if (scene.kind === "lighthouse") {
    const beacon = layout.landmarks.find((mark) => mark.type === "lighthouse");
    const [x, y] = point(
      beacon?.u ?? layout.flag[0],
      beacon?.v ?? layout.flag[1],
      (beacon?.z ?? 5) + 100 * (beacon?.scale ?? 1),
    );
    const glow = c.createRadialGradient(x, y, 1, x, y, 28);
    glow.addColorStop(0, "rgba(255,233,162,.46)");
    glow.addColorStop(1, "rgba(255,217,133,0)");
    c.fillStyle = glow;
    c.beginPath();
    c.arc(x, y, 28, 0, Math.PI * 2);
    c.fill();
    c.save();
    c.translate(x, y);
    c.rotate(Math.sin(seconds * 0.24) * 0.4);
    c.fillStyle = "rgba(255,224,155,.1)";
    c.beginPath();
    c.moveTo(2, -2);
    c.lineTo(43, -8);
    c.lineTo(43, 8);
    c.lineTo(2, 2);
    c.fill();
    c.restore();
  }
  for (const mark of layout.landmarks.filter(
    (mark) => mark.type === "windmill",
  ))
    withFrame(mark, () =>
      rotor(
        c,
        0,
        0,
        mark.h - 6,
        0.27 + Math.sin(seconds * 0.45 + mark.u) * 0.045,
        0.35,
      ),
    );
  if (scene.kind === "foundry") {
    const [x, y] = point(...layout.forge);
    c.fillStyle = foundryGlowStyle(0.32 + Math.sin(seconds * 1.8) * 0.06);
    c.beginPath();
    c.ellipse(x, y, 11, 4, 0, 0, Math.PI * 2);
    c.fill();
    for (let spark = 0; spark < 5; spark++) {
      const rise = (seconds * (8 + spark * 1.4) + spark * 9) % 28;
      c.fillStyle = foundrySparkStyle((1 - rise / 28) * 0.7);
      c.beginPath();
      c.arc(
        x + Math.sin(spark * 2.7) * rise * 0.55,
        y - rise,
        1.1,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
  }
  if (scene.kind === "quays") {
    const craneSite = layout.docks[1];
    const [x, y] = point(craneSite[0], craneSite[1] - 13, 28);
    const sway = Math.sin(seconds * 0.8) * 3;
    c.strokeStyle = "rgba(59,43,30,.75)";
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + sway, y + 17);
    c.stroke();
    c.fillStyle = "#8d633c";
    c.strokeStyle = "#493423";
    c.fillRect(x + sway - 4, y + 16, 8, 6);
    c.strokeRect(x + sway - 4, y + 16, 8, 6);
  }
  if (scene.kind === "terraces") {
    const [u, v, width, height] = layout.awnings[1];
    const [x, y] = point(u, v, height);
    const flutter = Math.sin(seconds * 2.1) * 1.6;
    c.fillStyle = "rgba(171,81,52,.8)";
    c.beginPath();
    c.moveTo(x - width / 2, y);
    c.lineTo(x + width / 2, y);
    c.lineTo(x + 10, y + 7 + flutter);
    c.lineTo(x - 10, y + 7 - flutter);
    c.closePath();
    c.fill();
  }
  const [fu, fv, fz] = scene.flag;
  const [fx, fy] = point(fu, fv, fz);
  const wind = Math.cos(windAngle) >= 0 ? 1 : -1;
  const flutter = Math.sin(seconds * 3 + fu) * 1.4;
  line(c, [fu, fv, fz - 15], [fu, fv, fz + 4], "#3e3025", 1.1);
  c.fillStyle = development.crisis
    ? "#75664d"
    : scene.kind === "monastery"
      ? "#eee2bc"
      : "#a74836";
  c.strokeStyle = "#493429";
  c.lineWidth = 0.7;
  c.beginPath();
  c.moveTo(fx, fy - 4);
  c.lineTo(fx + wind * 14, fy - 2 + flutter);
  c.lineTo(fx + wind * 7, fy + 3 + flutter * 0.4);
  c.lineTo(fx, fy + 3);
  c.closePath();
  c.fill();
  c.stroke();
  for (const [u, v, z] of scene.smoke) {
    const [sx, sy] = point(u, v, z);
    for (let index = 0; index < 3; index++) {
      const rise = (seconds * 4 + index * 10) % 30;
      c.fillStyle = chimneySmokeStyle(0.15 * (1 - rise / 30));
      c.beginPath();
      c.ellipse(
        sx + Math.cos(windAngle) * rise * 0.55,
        sy - rise * MAP_TILT_TAN,
        2 + rise * 0.12,
        1.6 + rise * 0.08,
        0,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
  }
  if (season && Math.max(season.snow, season.blossoms, season.autumn) > 0) {
    const density = Math.max(season.snow, season.blossoms, season.autumn);
    c.save();
    const baseAlpha = c.globalAlpha;
    for (let particle = 0; particle < 14; particle++) {
      const phase = (seconds * 0.07 + particle * 0.618) % 1;
      c.globalAlpha = baseAlpha * density * Math.sin(phase * Math.PI) * 0.65;
      c.fillStyle =
        season.snow > 0.5
          ? "#eff5ef"
          : season.autumn > 0.5
            ? "#d0934e"
            : "#f6dad0";
      const x =
        -70 + ((particle * 37 + Math.cos(windAngle) * phase * 30) % 140);
      const y = -100 + phase * 115;
      c.beginPath();
      c.ellipse(
        x + Math.sin(seconds * 0.7 + particle) * 3,
        y,
        1.5,
        season.snow > 0.5 ? 1.5 : 0.75,
        seconds * 0.3 + particle,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
    c.restore();
  }
  c.restore();
}

export function drawHarborBoats(
  c,
  name,
  time,
  zoom,
  windAngle,
  outwardX,
  outwardY,
  heading = DEFAULT_HEADING,
  evolution = {},
  lighting = sceneLighting(),
  season,
) {
  if (!SCENES.has(name) || zoom < 1.08) return;
  setGridHeading(heading);
  miniatureLighting = lighting;
  const seconds = time / 1000;
  c.save();
  c.scale(0.75, 0.75);
  const development = harborDevelopment(evolution);
  const boats = season
    ? Math.min(
        7,
        Math.max(
          1,
          Math.round(
            development.boats *
              season.fishing *
              (SCENES.get(name).kind === "fishing" ? 1.3 : 1),
          ),
        ),
      )
    : development.boats;
  for (let index = 0; index < boats; index++) {
    const side = index % 2 ? 1 : -1;
    const x =
      outwardX * (9 + Math.floor(index / 2) * 18) - outwardY * side * 19;
    const y =
      outwardY * (9 + Math.floor(index / 2) * 18) + outwardX * side * 19;
    const u = x * gridCos + y * gridSin;
    const v = -x * gridSin + y * gridCos;
    harborBoat(c, u, v, seconds, side * 1.2 + index, windAngle, season);
  }
  c.restore();
}

export function drawSeasonalFishingBoat(
  c,
  time,
  windAngle,
  heading,
  season,
  lighting = sceneLighting(),
) {
  setGridHeading(heading);
  miniatureLighting = lighting;
  c.save();
  c.scale(0.9, 0.9);
  harborBoat(c, 0, 0, time / 1000, heading, windAngle, season);
  c.restore();
}

// Painted layers share the chart's architecture, but move at different depths
// in an inspected harbor. Each transform is scoped so activity stays attached
// to its town and foreground craft move independently of the distant coast.
export function drawPortScene(
  c,
  {
    width,
    height,
    name,
    time = 0,
    lighting = sceneLighting(),
    season,
    evolution = {},
    windAngle = 0,
    pointer = {},
    reducedMotion = false,
    architecture,
    ship,
    drawPlayerShip,
  },
) {
  if (!SCENES.has(name)) return false;
  const palette = portScenePalette(lighting, season);
  const clock = reducedMotion ? 0 : time;
  const layer = (depth, draw) => {
    const offset = portLayerOffset(pointer, depth, reducedMotion);
    c.save();
    c.translate((offset.x * width) / 720, (offset.y * height) / 380);
    draw();
    c.restore();
  };
  c.save();
  c.clearRect(0, 0, width, height);
  const sky = c.createLinearGradient(0, 0, 0, height * 0.78);
  sky.addColorStop(0, palette.sky);
  sky.addColorStop(0.67, palette.horizon);
  sky.addColorStop(1, palette.sea);
  c.fillStyle = sky;
  c.fillRect(0, 0, width, height);
  layer(0.15, () => {
    if (lighting.stars > 0.01) {
      c.fillStyle = "#f3e6cc";
      c.globalAlpha = lighting.stars * 0.75;
      for (let star = 0; star < 48; star++) {
        const x = (((star * 137 + name.length * 17) % 997) / 997) * width;
        const y = (((star * 71) % 389) / 389) * height * 0.43;
        c.fillRect(x, y, height / 450, height / 450);
      }
    }
    c.globalAlpha =
      (1 - lighting.storm) *
      Math.max(lighting.daylight, lighting.dusk, lighting.night * 0.7);
    c.fillStyle =
      lighting.daylight > 0.5 || lighting.dusk > 0.5 ? "#ffe4a5" : "#dce3da";
    c.beginPath();
    c.arc(
      width * 0.77,
      height * (0.21 + lighting.dusk * 0.25),
      height * 0.025,
      0,
      Math.PI * 2,
    );
    c.fill();
    c.globalAlpha = 0.09 + lighting.storm * 0.15;
    c.fillStyle = palette.ridge;
    for (let cloud = 0; cloud < 5; cloud++) {
      c.beginPath();
      c.ellipse(
        width * (cloud * 0.26 - 0.04),
        height * (0.18 + (cloud % 2) * 0.085),
        width * 0.18,
        height * (0.023 + lighting.storm * 0.04),
        -0.025,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
  });
  layer(0.3, () => {
    for (let ridge = 0; ridge < 3; ridge++) {
      c.fillStyle = palette.ridge;
      c.globalAlpha = 0.25 + ridge * 0.12;
      c.beginPath();
      c.moveTo(-width * 0.05, height * 0.73);
      for (let x = -width * 0.05; x <= width * 1.05; x += width / 50) {
        const y =
          height * (0.49 + ridge * 0.038) +
          Math.sin((x / width) * (5 + ridge) + name.length) * height * 0.05 +
          Math.sin((x / width) * 21 + ridge) * height * 0.017;
        c.lineTo(x, y);
      }
      c.lineTo(width * 1.05, height * 0.73);
      c.closePath();
      c.fill();
    }
  });
  layer(0.5, () => {
    for (let building = 0; building < 18; building++) {
      const x = width * (0.07 + building * 0.049);
      const w = width * (0.022 + (building % 3) * 0.005);
      const h = height * (0.04 + ((building * 7 + name.length) % 6) * 0.013);
      const y = height * 0.63 - h;
      c.globalAlpha = 0.38;
      c.fillStyle = palette.ridge;
      c.fillRect(x, y, w, h);
      c.beginPath();
      c.moveTo(x - 3, y);
      c.lineTo(x + w * 0.5, y - h * 0.24);
      c.lineTo(x + w + 3, y);
      c.fillStyle = mixSeasonColor(
        palette.ridge,
        "#e9f0e9",
        (season?.snow ?? 0) * (1 - lighting.night * 0.8),
      );
      c.fill();
      c.fillStyle = "#ffd08b";
      c.globalAlpha = lighting.night * 0.65;
      for (let window = 0; window < 3; window++)
        c.fillRect(
          x + w * (0.2 + window * 0.25),
          y + h * 0.32,
          w * 0.1,
          h * 0.2,
        );
    }
  });
  const water = c.createLinearGradient(0, height * 0.64, 0, height);
  water.addColorStop(0, palette.horizon);
  water.addColorStop(1, palette.sea);
  c.fillStyle = water;
  c.beginPath();
  c.moveTo(0, height * 0.7);
  c.bezierCurveTo(
    width * 0.3,
    height * 0.68,
    width * 0.4,
    height * 0.95,
    width,
    height * 0.62,
  );
  c.lineTo(width, height);
  c.lineTo(0, height);
  c.fill();
  layer(0.7, () => {
    c.strokeStyle = palette.reflection;
    c.globalAlpha = 0.28;
    c.lineWidth = height / 380;
    for (let row = 0; row < 11; row++) {
      c.beginPath();
      for (let x = -width * 0.05; x <= width * 1.05; x += width / 60) {
        const y =
          height * (0.76 + row * 0.024) +
          Math.sin((x / width) * 15 + clock / 1500 + row) * height * 0.004;
        if (x === -width * 0.05) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    }
  });
  layer(1, () => {
    c.translate(width * 0.5, height * 0.74);
    c.scale(height / 205, height / 205);
    architecture.draw(c, name, evolution, DEFAULT_HEADING, lighting, season);
    drawPortActivity(
      c,
      name,
      clock,
      2,
      windAngle,
      DEFAULT_HEADING,
      evolution,
      lighting,
      season,
    );
  });
  layer(1.7, () => {
    c.translate(width * 0.84, height * 0.89);
    c.scale(height / 240, height / 240);
    drawHarborBoats(
      c,
      name,
      clock,
      2,
      windAngle,
      0,
      1,
      DEFAULT_HEADING,
      evolution,
      lighting,
      season,
    );
  });
  if (ship && drawPlayerShip)
    layer(1.4, () => {
      const x =
        ship.x * width +
        ((ship.x + 0.12) / 0.81) * (height * 0.36 - width * 0.19);
      const y = ship.y * height;
      if (ship.speed > 0 && !reducedMotion) {
        c.save();
        c.translate(x, y);
        c.rotate(ship.angle);
        c.strokeStyle = palette.reflection;
        c.globalAlpha = (ship.speed / 65) * 0.45;
        c.lineWidth = height / 500;
        const wake = height * 0.16 * (ship.speed / 65);
        for (const side of [-1, 1]) {
          c.beginPath();
          c.moveTo(-height * 0.02, side * height * 0.008);
          c.quadraticCurveTo(
            -wake * 0.6,
            side * height * 0.014,
            -wake,
            side * height * 0.026,
          );
          c.stroke();
        }
        c.restore();
      }
      drawPlayerShip(
        c,
        {
          ...ship,
          // Keep the berth beside the miniature's right pier even when the
          // full-screen painting contracts into a wide waterfront banner.
          x,
          y,
          scale: (ship.scale * height) / 380,
        },
        lighting,
        clock,
      );
    });
  c.restore();
  return true;
}
