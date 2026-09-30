import { MAP_TILT_TAN } from "./core/projection.js";
import { PORT_NAMES } from "./names.js";
import { createAlphaPalette } from "./style-palette.js";

const foundryGlowStyle = createAlphaPalette("249,148,68", 0.26, 0.38, 128);
const foundrySparkStyle = createAlphaPalette("255,183,86", 0, 0.7, 128);
const chimneySmokeStyle = createAlphaPalette("79,73,65", 0, 0.15, 128);

// The same tilted, orthographic ground plane used by the ship models. The town
// grid turns toward its nearest coastline when a scene is drawn.
const DEFAULT_HEADING = -0.34;
let gridCos = Math.cos(DEFAULT_HEADING);
let gridSin = Math.sin(DEFAULT_HEADING);

function setGridHeading(heading) {
  gridCos = Math.cos(heading);
  gridSin = Math.sin(heading);
}
const INK = "#35271e";
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

export function hasPortMiniature(name) {
  return SCENES.has(name);
}

function point(u, v, height = 0) {
  return [
    u * gridCos - v * gridSin,
    u * gridSin + v * gridCos - height * MAP_TILT_TAN,
  ];
}

function face(c, vertices, fill, stroke = INK, width = 0.8) {
  c.beginPath();
  vertices.forEach(([u, v, height], index) => {
    const [x, y] = point(u, v, height);
    if (index) c.lineTo(x, y);
    else c.moveTo(x, y);
  });
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = width;
    c.stroke();
  }
}

function line(c, a, b, color = "rgba(48,35,25,.5)", width = 0.7) {
  const [ax, ay] = point(...a);
  const [bx, by] = point(...b);
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(ax, ay);
  c.lineTo(bx, by);
  c.stroke();
}

function halo(c) {
  const glow = c.createRadialGradient(-12, -22, 3, 0, -12, 78);
  glow.addColorStop(0, "rgba(255,227,168,.32)");
  glow.addColorStop(1, "rgba(129,103,65,0)");
  c.fillStyle = glow;
  c.beginPath();
  c.ellipse(0, -19, 78, 58, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "rgba(43,43,34,.17)";
  c.beginPath();
  c.ellipse(9, 8, 66, 16, -0.13, 0, Math.PI * 2);
  c.fill();
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
  const walls = outline.map((first, index) => ({
    first,
    second: outline[(index + 1) % outline.length],
  }));
  walls.sort(
    (a, b) => (a.first[1] + a.second[1]) / 2 - (b.first[1] + b.second[1]) / 2,
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
    lit ? "#d8a75d" : "#3d3831",
    "#e9d1a3",
    0.48,
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
  const { u, v, w, d, h, z = 5, roof = "gable", windows = 2, tint } = spec;
  const a = u - w / 2,
    b = u + w / 2,
    back = v - d / 2,
    front = v + d / 2;
  const top = z + h;
  face(
    c,
    [
      [a, back, z],
      [a, front, z],
      [a, front, top],
      [a, back, top],
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
      if (h > 32) windowFront(c, x, front + 0.08, z + h * 0.72, 2.2);
    }
    windowFront(c, a - 0.08, v + d * 0.05, z + h * 0.56, 2.1);
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
    for (let stripe = back + 3; stripe < front; stripe += 5)
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
}

function battlement(c, scene, u, v, w, d, z, h) {
  building(c, scene, { u, v, w, d, h, z, roof: "flat", windows: 0 });
  const front = v + d / 2;
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
      depth: Math.sin((first + second) / 2),
      index,
    });
  }
  sides.sort((a, b) => a.depth - b.depth);
  for (const side of sides)
    face(
      c,
      side.vertices,
      colors[side.index % colors.length],
      "rgba(49,37,29,.58)",
      0.55,
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
      depth: Math.sin((angle + next) / 2),
      index,
    });
  }
  triangles.sort((a, b) => a.depth - b.depth);
  for (const triangle of triangles)
    face(
      c,
      triangle.vertices,
      triangle.index % 2 ? color : "#d3ae77",
      "rgba(52,37,28,.55)",
      0.55,
    );
}

function pier(c, u, v, w = 12, d = 23, color = "#816143") {
  terrace(c, u, v, w, d, -4, 3, color, "#553d2e");
  for (let plank = v - d / 2 + 3; plank < v + d / 2; plank += 4)
    line(
      c,
      [u - w / 2 + 1, plank, 3.2],
      [u + w / 2 - 1, plank, 3.2],
      "rgba(37,29,24,.42)",
      0.7,
    );
  for (const y of [v - d / 2 + 3, v + d / 2 - 3]) {
    line(c, [u - w / 2 + 2, y, 3], [u - w / 2 + 2, y, 10], "#493728", 1.6);
    line(c, [u - w / 2 + 2, y, 10], [u - w / 2 + 4, y, 10], "#b99b6c", 1.1);
  }
}

function crane(c, u, v, h = 40) {
  line(c, [u, v, 3], [u, v, h], "#543a28", 2.1);
  line(c, [u, v, h], [u + 20, v - 5, h - 4], "#765436", 2);
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
  frustum(c, u, v, 5, 89, 11, 7, ["#e6d8ad", "#cbbd99", "#fff0c3", "#c0af8f"]);
  frustum(c, u, v, 33, 42, 8.8, 8.2, ["#b85b43", "#934b3a", "#ce7554"]);
  frustum(c, u, v, 87, 93, 10, 10, ["#554a3f", "#66564a"]);
  frustum(c, u, v, 93, 108, 6.5, 6.5, ["#f6d895", "#bd9665"]);
  cone(c, u, v, 8, 108, 12, "#755042");
  line(c, [u, v, 120], [u, v, 126], "#513d2e", 0.8);
  for (const z of [23, 59, 76]) windowFront(c, u, v + 10, z, 2.2);
}

function windmill(c, u, v, height = 67) {
  frustum(c, u, v, 5, height, 8, 5.5, [
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

function drawQuays(c, scene) {
  landform(
    c,
    [
      [-60, -32],
      [39, -32],
      [55, -20],
      [60, 9],
      [32, 15],
      [-58, 13],
      [-63, -4],
    ],
    -4,
    5,
    scene.ground,
    "#70563d",
  );
  for (const [u, v, w, d, h] of [
    [-48, -24, 17, 15, 28],
    [-28, -25, 16, 14, 34],
    [-8, -26, 19, 16, 29],
    [13, -25, 17, 15, 37],
    [35, -24, 17, 14, 31],
    [52, -20, 13, 13, 24],
  ])
    building(c, scene, { u, v, w, d, h, windows: 2 });
  for (const [u, v, w, d, h] of [
    [-51, -6, 14, 13, 22],
    [-33, -5, 16, 14, 29],
    [-15, -4, 15, 13, 26],
    [26, -4, 18, 13, 26],
    [46, -3, 16, 13, 23],
  ])
    building(c, scene, { u, v, w, d, h, windows: 2 });
  battlement(c, scene, 5, -17, 18, 18, 5, 62);
  building(c, scene, {
    u: 5,
    v: -17,
    w: 21,
    d: 20,
    h: 8,
    z: 68,
    roof: "gable",
    windows: 0,
  });
  pier(c, -39, 23);
  pier(c, 35, 23);
  crane(c, 48, 9, 45);
  crane(c, -51, 5, 39);
  cargo(c, -25, 12, 3);
  cargo(c, 17, 10, 2);
}

function drawCitadel(c, scene) {
  landform(
    c,
    [
      [-63, -25],
      [-43, -36],
      [43, -36],
      [63, -20],
      [59, 15],
      [-56, 16],
    ],
    -7,
    8,
    scene.ground,
    "#66635d",
  );
  battlement(c, scene, 0, -9, 112, 37, 8, 16);
  for (const u of [-48, 48]) battlement(c, scene, u, -17, 16, 16, 8, 42);
  terrace(c, 0, -17, 82, 30, 24, 34, "#999588", "#6d6a64");
  for (const u of [-33, -18, 18, 33])
    building(c, scene, {
      u,
      v: -20,
      w: 13,
      d: 12,
      h: 27,
      z: 34,
      roof: "flat",
      windows: 1,
    });
  battlement(c, scene, 0, -23, 29, 25, 34, 67);
  battlement(c, scene, 0, -23, 18, 17, 101, 8);
  face(
    c,
    [
      [-7, 10, 8],
      [7, 10, 8],
      [7, 10, 24],
      [-7, 10, 24],
    ],
    "#514b43",
  );
  for (const z of [50, 68, 86]) windowFront(c, 0, -10, z, 2.2);
  line(c, [-58, 15, 18], [58, 15, 18], "rgba(240,225,185,.47)", 1.1);
}

function drawLighthouseCity(c, scene) {
  landform(
    c,
    Array.from({ length: 12 }, (_, index) => {
      const angle = (index / 12) * Math.PI * 2;
      return [Math.cos(angle) * 60, -9 + Math.sin(angle) * 27];
    }),
    -4,
    5,
    scene.ground,
    "#8d8673",
  );
  face(
    c,
    [
      [-17, 0, 5.1],
      [-4, 0, 5.1],
      [1, 16, 5.1],
      [-13, 16, 5.1],
    ],
    "#688a8b",
    "#4f7173",
  );
  line(c, [-16, 5, 7], [-2, 5, 7], "#d4c5a2", 2);
  pier(c, -40, 23, 11, 25, "#9b8a6c");
  pier(c, 42, 22, 11, 24, "#9b8a6c");
  for (const [u, v, w, d, h] of [
    [-51, -23, 14, 14, 23],
    [-35, -23, 17, 14, 30],
    [-18, -24, 14, 13, 25],
    [35, -22, 15, 14, 29],
    [52, -20, 12, 12, 22],
    [-46, -3, 13, 13, 20],
    [-26, -4, 16, 13, 25],
    [41, -4, 16, 13, 23],
  ])
    building(c, scene, { u, v, w, d, h, windows: 2 });
  lighthouse(c, 9, -17);
  frustum(c, -10, -22, 28, 48, 10, 8, ["#d7c6a0", "#b7a98f", "#eedbb6"]);
  cone(c, -10, -22, 9, 48, 10, "#578081");
  cargo(c, -47, 10, 2);
}

function drawFoundry(c, scene) {
  landform(
    c,
    [
      [-61, -20],
      [-51, -34],
      [-30, -29],
      [-11, -37],
      [21, -33],
      [57, -25],
      [63, 4],
      [49, 14],
      [8, 11],
      [-33, 17],
      [-62, 7],
    ],
    -8,
    5,
    scene.ground,
    "#493f39",
  );
  terrace(c, -8, -17, 92, 30, 5, 17, "#766354", "#403833");
  for (const [u, v, w, d, h] of [
    [-48, -20, 17, 15, 25],
    [-25, -20, 20, 17, 28],
    [2, -21, 22, 16, 31],
    [29, -22, 18, 15, 26],
    [49, -19, 15, 13, 24],
    [-39, -3, 18, 14, 22],
    [-13, -3, 17, 13, 25],
    [16, -4, 21, 14, 23],
    [40, -2, 17, 13, 27],
  ])
    building(c, scene, {
      u,
      v,
      w,
      d,
      h,
      z: v < -10 ? 17 : 5,
      roof: "flat",
      windows: 2,
    });
  chimney(c, scene, -32, -20, 90);
  chimney(c, scene, -12, -19, 75);
  chimney(c, scene, 16, -24, 64);
  pier(c, -42, 22, 14, 21, "#675146");
  crane(c, 48, 3, 51);
  cargo(c, 25, 9, 3);
}

function drawTerraceCity(c, scene) {
  landform(
    c,
    [
      [-61, 15],
      [-55, -14],
      [-34, -34],
      [32, -34],
      [55, -15],
      [62, 14],
    ],
    -5,
    7,
    scene.ground,
    "#9c744f",
  );
  terrace(c, 0, -18, 102, 31, 7, 19, "#d2ad78", "#a27952");
  terrace(c, 0, -25, 77, 24, 19, 33, "#e2bd84", "#a27a52");
  for (const [u, v, w, d, h, z] of [
    [-48, -7, 17, 14, 25, 7],
    [-29, -8, 16, 13, 27, 7],
    [31, -8, 16, 13, 29, 7],
    [49, -7, 15, 13, 24, 7],
    [-32, -23, 14, 12, 28, 33],
    [32, -23, 14, 12, 28, 33],
  ])
    building(c, scene, { u, v, w, d, h, z, windows: 2 });
  battlement(c, scene, 0, -27, 33, 20, 33, 44);
  frustum(c, 0, -27, 77, 98, 9, 8, ["#f0d49a", "#c09a67", "#e3c58b"]);
  cone(c, 0, -27, 11, 98, 17, "#b7784b");
  for (const u of [-57, 57]) {
    frustum(c, u, -21, 7, 68, 6, 4, ["#e7c384", "#ba915f"]);
    cone(c, u, -21, 6, 68, 9, "#a76548");
  }
  for (const u of [-17, -8, 8, 17])
    line(c, [u, 10, 7], [u, 10, 20], "#876a4d", 1.2);
  for (const [u, color] of [
    [-36, "#9f5b47"],
    [-19, "#567d79"],
    [19, "#b87f4b"],
    [36, "#74724e"],
  ])
    awning(c, u, 3, 12, 19, color);
  pier(c, -45, 25, 11, 20, "#9d764e");
}

function drawWindmillCity(c, scene) {
  landform(
    c,
    Array.from({ length: 12 }, (_, index) => {
      const angle = (index / 12) * Math.PI * 2;
      return [Math.cos(angle) * 62, -9 + Math.sin(angle) * 25];
    }),
    -4,
    5,
    scene.ground,
    "#697451",
  );
  terrace(c, 0, -24, 109, 26, 5, 15, "#a2a77e", "#737959");
  for (const [u, v, w, d, h] of [
    [-52, -6, 15, 13, 23],
    [-31, -4, 17, 14, 27],
    [-8, -5, 15, 13, 25],
    [30, -4, 18, 14, 26],
    [51, -5, 15, 13, 23],
  ])
    building(c, scene, { u, v, w, d, h, windows: 2 });
  windmill(c, -43, -27, 72);
  windmill(c, 0, -30, 83);
  windmill(c, 43, -27, 68);
  pier(c, -48, 22, 10, 20, "#746b4b");
  pier(c, 45, 22, 10, 20, "#746b4b");
  cargo(c, 21, 10, 2);
}

export function drawPortMiniature(
  c,
  name,
  evolution = {},
  heading = DEFAULT_HEADING,
) {
  const scene = SCENES.get(name);
  if (!scene) return false;
  setGridHeading(heading);
  c.save();
  c.lineJoin = "round";
  halo(c);
  switch (scene.kind) {
    case "quays":
      drawQuays(c, scene);
      break;
    case "citadel":
      drawCitadel(c, scene);
      break;
    case "lighthouse":
      drawLighthouseCity(c, scene);
      break;
    case "foundry":
      drawFoundry(c, scene);
      break;
    case "terraces":
      drawTerraceCity(c, scene);
      break;
    case "windmills":
      drawWindmillCity(c, scene);
      break;
  }
  if (evolution.warehouses)
    building(c, scene, { u: 62, v: 5, w: 13, d: 11, h: 21, windows: 1 });
  if (evolution.cranes) crane(c, 61, 12, 36);
  if (evolution.foundries) chimney(c, scene, -62, -9, 42);
  if (evolution.fortifications) battlement(c, scene, -62, 0, 12, 14, 5, 18);
  c.restore();
  return true;
}

function harborBoat(c, u, v, seconds, phase, windAngle) {
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
    "#eee0b8",
    "#8a744e",
    0.6,
  );
  line(c, [u - 11, v + 5, 0], [u - 7, v + 5, 0], "rgba(224,219,183,.56)", 0.7);
}

export function drawPortActivity(
  c,
  name,
  time,
  zoom,
  windAngle = 0,
  heading = DEFAULT_HEADING,
) {
  const scene = SCENES.get(name);
  if (!scene || zoom < 1.08) return;
  setGridHeading(heading);
  const seconds = time / 1000;
  c.save();
  c.lineJoin = "round";
  if (scene.kind === "lighthouse") {
    const [x, y] = point(9, -17, 100);
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
  if (scene.kind === "windmills") {
    for (const [u, v, z] of [
      [-43, -27, 66],
      [0, -30, 77],
      [43, -27, 62],
    ])
      rotor(
        c,
        u,
        v,
        z,
        0.27 + u * 0.02 + Math.sin(seconds * 0.45 + u) * 0.045,
        0.35,
      );
  }
  if (scene.kind === "foundry") {
    const [x, y] = point(-12, 2, 12);
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
    const [x, y] = point(45, 8, 29);
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
    const [x, y] = point(22, 11, 19);
    const flutter = Math.sin(seconds * 2.1) * 1.6;
    c.fillStyle = "rgba(171,81,52,.8)";
    c.beginPath();
    c.moveTo(x - 13, y);
    c.lineTo(x + 13, y);
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
  c.fillStyle = "#a74836";
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
) {
  if (!SCENES.has(name) || zoom < 1.08) return;
  setGridHeading(heading);
  const seconds = time / 1000;
  c.save();
  c.scale(0.75, 0.75);
  for (const side of [-1, 1]) {
    const x = outwardX * 9 - outwardY * side * 19;
    const y = outwardY * 9 + outwardX * side * 19;
    const u = x * gridCos + y * gridSin;
    const v = -x * gridSin + y * gridCos;
    harborBoat(c, u, v, seconds, side * 1.2, windAngle);
  }
  c.restore();
}
