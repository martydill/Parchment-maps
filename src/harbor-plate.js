import { harborProfile } from "./core/harbors.js";
import { drawHarborBoats, drawPortActivity } from "./port-miniatures.js";

const captions = {
  quays: "Merchant houses & the old exchange",
  citadel: "The citadel & fortified anchorage",
  lighthouse: "The beacon & mariners’ quarter",
  foundry: "Foundries & the working waterfront",
  terraces: "The upper city & waterfront bazaar",
  windmills: "Windmills & the grain wharves",
  canals: "Canal houses & the bridge district",
  fishing: "Net lofts & the fishing station",
  marsh: "Reed houses & the timber walkways",
  tropical: "Palm gardens & the spice market",
  monastery: "The abbey & pilgrims’ landing",
};

function noise(index, seed) {
  const value = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function compass(c, x, y, radius) {
  c.save();
  c.translate(x, y);
  c.strokeStyle = "#937d59";
  c.fillStyle = "#937d59";
  c.lineWidth = 0.7;
  c.globalAlpha = 0.45;
  c.beginPath();
  c.arc(0, 0, radius * 0.72, 0, Math.PI * 2);
  c.stroke();
  for (let ray = 0; ray < 8; ray++) {
    const angle = (ray * Math.PI) / 4 - Math.PI / 2;
    const length = radius * (ray % 2 ? 0.62 : 1);
    c.beginPath();
    c.moveTo(Math.cos(angle) * length, Math.sin(angle) * length);
    c.lineTo(
      Math.cos(angle + 0.7) * radius * 0.17,
      Math.sin(angle + 0.7) * radius * 0.17,
    );
    c.lineTo(0, 0);
    c.closePath();
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(Math.cos(angle) * length, Math.sin(angle) * length);
    c.lineTo(
      Math.cos(angle - 0.7) * radius * 0.17,
      Math.sin(angle - 0.7) * radius * 0.17,
    );
    c.lineTo(0, 0);
    c.closePath();
    c.stroke();
  }
  c.font = `${radius * 0.28}px Georgia`;
  c.textAlign = "center";
  c.fillText("N", 0, -radius * 1.18);
  c.restore();
}

// City and atlas panels share the chart's cached architecture; the surrounding
// ink contours and dry watercolor make it read as an illustrated atlas plate.
export function drawHarborPlate(
  surface,
  port,
  { art, evolution = {}, time = 0, windAngle = 0 },
) {
  const c = surface.getContext("2d");
  const width = surface.width,
    height = surface.height;
  const seed = [...port.name].reduce(
    (sum, letter) => sum + letter.charCodeAt(0),
    0,
  );
  const profile = harborProfile(port.name);
  c.clearRect(0, 0, width, height);
  c.save();
  const paper = c.createLinearGradient(0, 0, width, height);
  paper.addColorStop(0, "#f3e7c9");
  paper.addColorStop(0.5, "#eaddbb");
  paper.addColorStop(1, "#e5d5b0");
  c.fillStyle = paper;
  c.fillRect(0, 0, width, height);
  // Paper flecks remain fixed to the page while flags and workers animate.
  for (let mark = 0; mark < 1800; mark++) {
    const x = noise(mark, seed) * width,
      y = noise(mark + 1900, seed) * height;
    c.fillStyle = mark % 3 ? "rgba(94,70,38,.035)" : "rgba(255,249,222,.25)";
    c.fillRect(x, y, 0.5 + noise(mark, 5) * 2, 0.5 + noise(mark, 9));
  }
  for (let ridge = 0; ridge < 3; ridge++) {
    c.beginPath();
    c.moveTo(0, height * 0.63);
    for (let x = 0; x <= width + 16; x += 16) {
      const y =
        height * (0.51 + ridge * 0.042) +
        Math.sin((x / width) * 9 + seed + ridge * 0.6) * height * 0.045 +
        Math.sin((x / width) * 23 + ridge) * height * 0.012;
      c.lineTo(x, y);
    }
    c.lineTo(width, height * 0.75);
    c.lineTo(0, height * 0.75);
    c.closePath();
    c.fillStyle = [
      "rgba(143,153,119,.10)",
      "rgba(143,153,119,.13)",
      "rgba(143,153,119,.17)",
    ][ridge];
    c.fill();
    c.strokeStyle = "rgba(114,112,80,.18)";
    c.lineWidth = 0.8;
    c.stroke();
  }
  const coastY = height * 0.69;
  const sea = c.createLinearGradient(0, coastY - 24, 0, height);
  sea.addColorStop(0, "rgba(113,152,143,0)");
  sea.addColorStop(0.18, "rgba(113,152,143,.24)");
  sea.addColorStop(1, "rgba(113,152,143,.08)");
  c.fillStyle = sea;
  c.beginPath();
  c.moveTo(0, coastY);
  c.bezierCurveTo(
    width * 0.25,
    coastY - height * 0.03,
    width * 0.3,
    height * 0.84,
    width * 0.5,
    coastY + height * 0.06,
  );
  c.bezierCurveTo(
    width * 0.75,
    coastY,
    width * 0.8,
    coastY - height * 0.06,
    width,
    coastY - height * 0.015,
  );
  c.lineTo(width, height);
  c.lineTo(0, height);
  c.closePath();
  c.fill();
  c.save();
  c.clip();
  for (let row = 0; row < 20; row++) {
    for (let col = 0; col < 18; col++) {
      const random = noise(row * 20 + col, seed);
      const x = ((col + random * 0.5) * width) / 18;
      const y = coastY + row * height * 0.015 + random * 5;
      c.strokeStyle =
        row % 3 ? "rgba(78,112,105,.22)" : "rgba(255,248,216,.65)";
      c.lineWidth = row % 3 ? 0.65 : 1.1;
      c.beginPath();
      c.moveTo(x, y);
      c.bezierCurveTo(x + 8, y - 1.5, x + 14, y + 1.5, x + 22 + random * 16, y);
      c.stroke();
    }
  }
  c.restore();
  const scale = Math.min(width / 205, height / 175);
  c.save();
  c.translate(width * 0.5, height * 0.57);
  c.scale(scale, scale);
  art.draw(c, port.name, evolution);
  drawPortActivity(c, port.name, time, 2, windAngle, undefined, evolution);
  c.restore();
  for (const [x, y, outward, boatScale] of [
    [0.19, 0.78, 1, 1],
    [0.77, 0.76, -1, 0.8],
  ]) {
    c.save();
    c.translate(width * x, height * y);
    c.scale(scale * boatScale * 0.65, scale * boatScale * 0.65);
    drawHarborBoats(
      c,
      port.name,
      time,
      2,
      windAngle,
      outward,
      0,
      undefined,
      evolution,
    );
    c.restore();
  }
  compass(c, width * 0.1, height * 0.26, height * 0.057);
  c.strokeStyle = "rgba(116,91,53,.32)";
  c.lineWidth = 0.8;
  c.strokeRect(18, 18, width - 36, height - 36);
  for (const [x, y, signX, signY] of [
    [25, 25, 1, 1],
    [width - 25, 25, -1, 1],
    [25, height - 25, 1, -1],
    [width - 25, height - 25, -1, -1],
  ]) {
    c.beginPath();
    c.moveTo(x, y + signY * 24);
    c.lineTo(x, y);
    c.lineTo(x + signX * 24, y);
    c.stroke();
  }
  c.textAlign = "center";
  c.fillStyle = "#846d4d";
  c.font = `italic ${height * 0.019}px Georgia`;
  c.fillText(
    captions[profile?.kind] ?? "The old town & merchant anchorage",
    width / 2,
    height * 0.925,
  );
  c.restore();
}
