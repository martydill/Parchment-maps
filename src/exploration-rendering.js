const INK = "#392b22";
const PAPER = "#ead5a4";
const STONE = "#aa9674";
const SHADE = "#796c56";
const WATER = "#7ca5a0";

function shape(c, points, fill, stroke = INK, width = 1.2) {
  c.beginPath();
  points.forEach(([x, y], index) => {
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

function line(c, points, color = INK, width = 1) {
  c.beginPath();
  points.forEach(([x, y], index) => {
    if (index) c.lineTo(x, y);
    else c.moveTo(x, y);
  });
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
}

function siteKind(site) {
  const name = site.name.toLowerCase();
  if (/observatory/.test(name)) return "observatory";
  if (/cliffs|headland|overlook/.test(name)) return "cliffs";
  if (/cairn/.test(name)) return "cairn";
  if (/watch|lookout/.test(name)) return "lookout";
  if (/landing/.test(name)) return "landing";
  if (/sounding/.test(name)) return "sounding";
  return "survey";
}

function drawCoast(c, surveyed = false) {
  // An irregular strip of coast gives the miniature a place on the chart.
  shape(
    c,
    [
      [-23, 4],
      [-18, 0],
      [-15, -4],
      [-5, -6],
      [3, -4],
      [12, -7],
      [20, -3],
      [24, 1],
      [19, 10],
      [10, 12],
      [2, 10],
      [-8, 13],
      [-19, 10],
    ],
    surveyed ? "#cedbb8" : PAPER,
  );
  shape(
    c,
    [
      [-23, 4],
      [-19, 9],
      [-8, 13],
      [2, 10],
      [10, 12],
      [19, 10],
      [24, 1],
      [22, 11],
      [13, 16],
      [3, 14],
      [-7, 18],
      [-20, 14],
    ],
    SHADE,
    null,
  );
  line(
    c,
    [
      [-22, 12],
      [-15, 15],
      [-8, 15],
    ],
    "#e6d2a6",
    1.1,
  );
  line(
    c,
    [
      [3, 18],
      [9, 18],
      [14, 16],
    ],
    WATER,
    1.7,
  );
  line(
    c,
    [
      [-16, 19],
      [-10, 19],
      [-5, 17],
    ],
    WATER,
    1.4,
  );
  line(
    c,
    [
      [18, 19],
      [22, 18],
      [25, 17],
    ],
    WATER,
    1.1,
  );
  line(
    c,
    [
      [-13, 4],
      [-8, 2],
      [-3, 3],
    ],
    "#998360",
    0.8,
  );
  line(
    c,
    [
      [8, 4],
      [13, 2],
      [17, 3],
    ],
    "#998360",
    0.8,
  );
}

function drawCliffs(c) {
  shape(
    c,
    [
      [-15, 1],
      [-11, -11],
      [-5, -14],
      [-1, -8],
      [4, -18],
      [9, -16],
      [16, -3],
      [13, 6],
      [2, 8],
      [-8, 6],
    ],
    STONE,
  );
  shape(
    c,
    [
      [4, -18],
      [9, -16],
      [16, -3],
      [13, 6],
      [2, 8],
      [6, -5],
    ],
    SHADE,
    null,
  );
  line(
    c,
    [
      [-9, -10],
      [-7, -3],
      [-9, 3],
    ],
    "#e4d1aa",
    1.2,
  );
  line(
    c,
    [
      [4, -15],
      [1, -9],
      [3, -2],
    ],
    INK,
    0.8,
  );
  line(
    c,
    [
      [9, -9],
      [12, -3],
      [10, 4],
    ],
    INK,
    0.8,
  );
  line(
    c,
    [
      [-15, 9],
      [-8, 11],
      [-2, 10],
    ],
    "#d9e4c9",
    1,
  );
}

function drawCairn(c) {
  shape(
    c,
    [
      [-11, 4],
      [-10, 0],
      [9, -1],
      [13, 3],
      [10, 7],
      [-9, 7],
    ],
    SHADE,
  );
  shape(
    c,
    [
      [-8, -1],
      [-6, -6],
      [7, -7],
      [10, -2],
      [7, 2],
      [-6, 2],
    ],
    STONE,
  );
  shape(
    c,
    [
      [-5, -8],
      [-3, -13],
      [4, -14],
      [7, -9],
      [4, -6],
      [-3, -5],
    ],
    PAPER,
  );
  shape(
    c,
    [
      [-2, -15],
      [0, -19],
      [3, -19],
      [5, -15],
      [3, -12],
      [0, -12],
    ],
    STONE,
  );
  line(
    c,
    [
      [-5, -3],
      [1, -4],
    ],
    "#e6d7b6",
    0.9,
  );
}

function drawLookout(c, flag) {
  shape(
    c,
    [
      [-12, 5],
      [-9, 1],
      [-6, 1],
      [-4, -13],
      [5, -13],
      [7, 1],
      [10, 1],
      [13, 5],
    ],
    STONE,
  );
  shape(
    c,
    [
      [-4, -13],
      [5, -13],
      [7, 1],
      [10, 1],
      [13, 5],
      [2, 5],
    ],
    SHADE,
    null,
  );
  shape(
    c,
    [
      [-7, -14],
      [-6, -18],
      [8, -18],
      [9, -14],
    ],
    "#674f3d",
  );
  shape(
    c,
    [
      [-1, -8],
      [2, -8],
      [3, -2],
      [-1, -2],
    ],
    "#463a30",
    null,
  );
  line(
    c,
    [
      [0, -18],
      [0, -24],
    ],
    INK,
    1,
  );
  shape(
    c,
    [
      [0, -24],
      [8, -22],
      [0, -20],
    ],
    flag,
    INK,
    0.8,
  );
  line(
    c,
    [
      [-12, 7],
      [-5, 8],
      [1, 7],
    ],
    "#e3cfaa",
    1,
  );
}

function drawLanding(c, flag) {
  shape(
    c,
    [
      [-17, -3],
      [-12, -8],
      [-5, -8],
      [1, -3],
      [7, -4],
      [14, 0],
      [15, 5],
      [-15, 6],
    ],
    STONE,
  );
  shape(
    c,
    [
      [-15, 5],
      [17, 5],
      [15, 9],
      [-16, 9],
    ],
    "#79583e",
  );
  for (const x of [-11, -2, 8, 15])
    line(
      c,
      [
        [x, 8],
        [x, 13],
      ],
      INK,
      1.5,
    );
  line(
    c,
    [
      [-15, 7],
      [17, 7],
    ],
    "#d3ac6d",
    0.8,
  );
  line(
    c,
    [
      [4, -4],
      [4, -14],
    ],
    INK,
    1,
  );
  shape(
    c,
    [
      [4, -14],
      [11, -12],
      [4, -10],
    ],
    flag,
    INK,
    0.8,
  );
  line(
    c,
    [
      [-8, 14],
      [-2, 14],
      [2, 13],
    ],
    "#d8e0c5",
    1,
  );
}

function drawSounding(c) {
  shape(
    c,
    [
      [-13, -1],
      [-7, -4],
      [5, -4],
      [13, -1],
      [9, 4],
      [-8, 4],
    ],
    "#78533d",
  );
  line(
    c,
    [
      [-5, 0],
      [8, 0],
    ],
    "#d6b07a",
    0.9,
  );
  line(
    c,
    [
      [0, -4],
      [0, -18],
    ],
    INK,
    1.3,
  );
  shape(
    c,
    [
      [0, -17],
      [8, -5],
      [0, -5],
    ],
    "#e8d7ac",
  );
  line(
    c,
    [
      [9, 0],
      [12, 7],
      [12, 16],
    ],
    INK,
    1,
  );
  shape(
    c,
    [
      [10, 16],
      [14, 16],
      [12, 20],
    ],
    "#ba9a64",
  );
  line(
    c,
    [
      [-16, 9],
      [-10, 8],
      [-5, 9],
    ],
    WATER,
    1,
  );
}

function drawObservatory(c) {
  shape(
    c,
    [
      [-14, 5],
      [-12, -4],
      [-8, -4],
      [-6, -10],
      [7, -10],
      [9, -4],
      [13, -4],
      [15, 5],
    ],
    STONE,
  );
  shape(
    c,
    [
      [-8, -10],
      [-5, -17],
      [5, -17],
      [8, -10],
    ],
    "#6a7772",
  );
  line(
    c,
    [
      [-5, -17],
      [0, -21],
      [5, -17],
    ],
    "#e7d9b2",
    0.9,
  );
  shape(
    c,
    [
      [-2, -5],
      [2, -5],
      [3, 5],
      [-3, 5],
    ],
    "#453b32",
    null,
  );
  line(
    c,
    [
      [-12, -1],
      [-7, -1],
    ],
    "#e4d4af",
    0.9,
  );
  line(
    c,
    [
      [8, -1],
      [13, -1],
    ],
    "#e4d4af",
    0.9,
  );
  line(
    c,
    [
      [-14, 7],
      [-7, 8],
      [-1, 7],
    ],
    WATER,
    1,
  );
}

function drawSurvey(c, flag) {
  // Brass sighting instrument on a wooden survey tripod.
  line(
    c,
    [
      [0, -10],
      [-9, 8],
    ],
    INK,
    2,
  );
  line(
    c,
    [
      [0, -10],
      [9, 8],
    ],
    INK,
    2,
  );
  line(
    c,
    [
      [0, -10],
      [0, 9],
    ],
    INK,
    1.6,
  );
  shape(
    c,
    [
      [-8, -14],
      [5, -16],
      [10, -13],
      [-4, -11],
    ],
    "#bd9259",
  );
  shape(
    c,
    [
      [-2, -11],
      [3, -11],
      [4, -8],
      [-3, -8],
    ],
    "#78583d",
  );
  line(
    c,
    [
      [-5, -13],
      [-8, -9],
    ],
    "#e9d4a0",
    1,
  );
  line(
    c,
    [
      [12, -4],
      [12, -17],
    ],
    INK,
    0.9,
  );
  shape(
    c,
    [
      [12, -17],
      [19, -15],
      [12, -12],
    ],
    flag,
    INK,
    0.7,
  );
  line(
    c,
    [
      [-12, 10],
      [-5, 11],
      [1, 10],
    ],
    "#e7d5aa",
    0.9,
  );
}

export function drawExplorationSite(
  c,
  site,
  x,
  y,
  size,
  surveyed = false,
  active = false,
) {
  c.save();
  c.translate(x, y);
  c.scale(size / 48, size / 48);
  if (active) {
    c.shadowColor = "rgba(252, 222, 150, .9)";
    c.shadowBlur = 13;
  } else {
    c.shadowColor = "rgba(25, 29, 24, .55)";
    c.shadowBlur = 3;
  }
  c.shadowOffsetY = 2;
  drawCoast(c, surveyed);
  c.shadowBlur = 0;
  c.shadowOffsetY = 0;
  const flag = surveyed ? "#78bd92" : "#e0ad5e";
  switch (siteKind(site)) {
    case "cliffs":
      drawCliffs(c);
      break;
    case "cairn":
      drawCairn(c);
      break;
    case "lookout":
      drawLookout(c, flag);
      break;
    case "landing":
      drawLanding(c, flag);
      break;
    case "sounding":
      drawSounding(c);
      break;
    case "observatory":
      drawObservatory(c);
      break;
    default:
      drawSurvey(c, flag);
  }
  // A small colored pennant in the surf keeps completion readable at chart scale.
  shape(
    c,
    [
      [-23, 12],
      [-17, 12],
      [-17, 18],
      [-23, 18],
    ],
    flag,
    INK,
    0.8,
  );
  line(
    c,
    [
      [-21, 14],
      [-19, 16],
      [-16, 12],
    ],
    surveyed ? "#244e3c" : "#7f5029",
    1,
  );
  c.restore();
}

function drawAnchor(c) {
  line(
    c,
    [
      [0, -17],
      [0, 5],
    ],
    INK,
    2,
  );
  line(
    c,
    [
      [-5, -13],
      [5, -13],
    ],
    INK,
    1.5,
  );
  c.beginPath();
  c.arc(0, -18, 2.5, 0, Math.PI * 2);
  c.strokeStyle = INK;
  c.lineWidth = 1.2;
  c.stroke();
  line(
    c,
    [
      [-10, 1],
      [-10, 4],
      [-5, 8],
      [0, 9],
      [5, 8],
      [10, 4],
      [10, 1],
    ],
    INK,
    1.8,
  );
  shape(
    c,
    [
      [-10, 1],
      [-13, 3],
      [-9, 6],
    ],
    "#ba8d52",
  );
  shape(
    c,
    [
      [10, 1],
      [13, 3],
      [9, 6],
    ],
    "#ba8d52",
  );
}

function drawReef(c) {
  shape(
    c,
    [
      [-16, 8],
      [-11, -10],
      [-8, -5],
      [-4, 7],
    ],
    STONE,
  );
  shape(
    c,
    [
      [-3, 8],
      [3, -17],
      [8, -9],
      [12, 8],
    ],
    SHADE,
  );
  shape(
    c,
    [
      [11, 7],
      [15, -5],
      [19, 7],
    ],
    STONE,
  );
  line(
    c,
    [
      [-21, 11],
      [-15, 12],
      [-10, 11],
    ],
    "#d6e5d2",
    1.2,
  );
  line(
    c,
    [
      [1, 12],
      [7, 13],
      [13, 12],
    ],
    "#d6e5d2",
    1.2,
  );
}

function drawFish(c) {
  for (const [x, y, scale] of [
    [-8, -8, 1],
    [8, -2, 0.8],
    [-3, 4, 0.6],
  ]) {
    c.save();
    c.translate(x, y);
    c.scale(scale, scale);
    shape(
      c,
      [
        [-8, 0],
        [-3, -4],
        [5, -3],
        [9, 0],
        [5, 3],
        [-3, 4],
      ],
      "#bac1a5",
    );
    shape(
      c,
      [
        [8, 0],
        [13, -4],
        [13, 4],
      ],
      "#829d96",
    );
    c.fillStyle = INK;
    c.fillRect(-5, -1, 1.4, 1.4);
    c.restore();
  }
}

function drawWreck(c) {
  shape(
    c,
    [
      [-17, 0],
      [-7, 3],
      [4, 2],
      [16, -1],
      [12, 6],
      [-8, 8],
    ],
    "#78543b",
  );
  line(
    c,
    [
      [-6, 4],
      [-10, -17],
    ],
    INK,
    1.8,
  );
  line(
    c,
    [
      [-10, -17],
      [-5, -11],
    ],
    INK,
    1,
  );
  shape(
    c,
    [
      [-9, -14],
      [-7, -8],
      [1, -7],
    ],
    "#d5c09a",
  );
  line(
    c,
    [
      [4, 2],
      [9, -5],
      [14, -8],
    ],
    INK,
    1.4,
  );
  line(
    c,
    [
      [-14, 11],
      [-7, 11],
      [-2, 10],
    ],
    "#d6e5d2",
    1.2,
  );
}

function drawSettlement(c) {
  shape(
    c,
    [
      [-12, -5],
      [-3, -13],
      [7, -5],
    ],
    "#7d5340",
  );
  shape(
    c,
    [
      [-11, -5],
      [6, -5],
      [6, 6],
      [-11, 6],
    ],
    "#d4bd95",
  );
  shape(
    c,
    [
      [-3, 0],
      [1, 0],
      [1, 6],
      [-3, 6],
    ],
    "#514135",
    null,
  );
  shape(
    c,
    [
      [10, -2],
      [18, -2],
      [18, 8],
      [10, 8],
    ],
    "#a88b66",
  );
  line(
    c,
    [
      [9, -4],
      [19, -4],
    ],
    INK,
    1.5,
  );
  line(
    c,
    [
      [13, 8],
      [13, 12],
    ],
    INK,
    1.2,
  );
  line(
    c,
    [
      [17, 8],
      [17, 12],
    ],
    INK,
    1.2,
  );
}

function drawGarden(c) {
  for (const [x, height] of [
    [-11, 13],
    [-4, 20],
    [4, 17],
    [12, 15],
  ]) {
    line(
      c,
      [
        [x, 6],
        [x, 6 - height],
      ],
      "#436c56",
      1.5,
    );
    shape(
      c,
      [
        [x, -3],
        [x - 5, -8],
        [x - 7, -5],
        [x - 3, 0],
      ],
      "#76916c",
    );
    shape(
      c,
      [
        [x, -7],
        [x + 4, -12],
        [x + 6, -9],
        [x + 2, -4],
      ],
      "#a8b681",
    );
  }
  shape(
    c,
    [
      [-4, -15],
      [-1, -18],
      [2, -15],
      [-1, -12],
    ],
    "#d2a26f",
  );
}

function drawBeacon(c) {
  shape(
    c,
    [
      [-9, 5],
      [-6, -8],
      [5, -8],
      [9, 5],
    ],
    STONE,
  );
  shape(
    c,
    [
      [-7, -9],
      [-5, -13],
      [4, -13],
      [6, -9],
    ],
    "#5f6c68",
  );
  shape(
    c,
    [
      [-3, -15],
      [0, -22],
      [4, -15],
      [1, -12],
    ],
    "#edb85c",
  );
  line(
    c,
    [
      [-9, -17],
      [-15, -19],
    ],
    "#edc77d",
    1.3,
  );
  line(
    c,
    [
      [8, -17],
      [14, -19],
    ],
    "#edc77d",
    1.3,
  );
  line(
    c,
    [
      [-11, 6],
      [11, 6],
    ],
    INK,
    1.2,
  );
}

export function drawDiscoverySite(
  c,
  site,
  x,
  y,
  size,
  active = false,
  secret = false,
) {
  c.save();
  c.translate(x, y);
  c.scale(size / 48, size / 48);
  c.shadowColor = active ? "rgba(252, 222, 150, .9)" : "rgba(25, 29, 24, .55)";
  c.shadowBlur = active ? 13 : 3;
  c.shadowOffsetY = 2;
  drawCoast(c);
  c.shadowBlur = 0;
  c.shadowOffsetY = 0;
  switch (site.type) {
    case "Uncharted anchorage":
      drawAnchor(c);
      break;
    case "Hidden resource deposit":
      drawCliffs(c);
      line(
        c,
        [
          [-5, -7],
          [1, -5],
          [4, -2],
          [9, 0],
        ],
        "#b8d5d4",
        2,
      );
      break;
    case "Ruins":
      drawObservatory(c);
      break;
    case "Smuggler cove":
      drawLanding(c, "#984d3d");
      break;
    case "Reef shortcut":
      drawReef(c);
      break;
    case "Seasonal fishing ground":
      drawFish(c);
      break;
    case "Salvage site":
      drawWreck(c);
      break;
    case "Emerging settlement":
      drawSettlement(c);
      break;
    case "Rare ecosystem":
      drawGarden(c);
      break;
    default:
      drawBeacon(c);
  }
  // Discovery marks are rust colored, distinct from the survey pennants.
  shape(
    c,
    [
      [-23, 12],
      [-17, 12],
      [-17, 18],
      [-23, 18],
    ],
    secret ? "#765845" : "#bb7449",
    INK,
    0.8,
  );
  c.restore();
}
