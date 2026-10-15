import { riverWidthAt } from "./core/rivers.js";
import { mixSeasonColor } from "./core/seasons.js";

function ribbon(c, points, tributary, inset = 0) {
  const banks = points.map((point, index) => {
    const a = points[Math.max(0, index - 1)];
    const b = points[Math.min(points.length - 1, index + 1)];
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const half = Math.max(
      0.2,
      riverWidthAt(index / (points.length - 1), tributary) / 2 + inset,
    );
    return {
      left: {
        x: point.x - ((b.y - a.y) / length) * half,
        y: point.y + ((b.x - a.x) / length) * half,
      },
      right: {
        x: point.x + ((b.y - a.y) / length) * half,
        y: point.y - ((b.x - a.x) / length) * half,
      },
    };
  });
  c.beginPath();
  c.moveTo(banks[0].left.x, banks[0].left.y);
  for (const bank of banks.slice(1)) c.lineTo(bank.left.x, bank.left.y);
  for (const bank of [...banks].reverse()) c.lineTo(bank.right.x, bank.right.y);
  c.closePath();
  c.fill();
}

export function drawRiverChannels(c, details, season) {
  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";
  // Branches go underneath their receiving river so junctions have no seam.
  for (const tributary of [true, false]) {
    for (const channel of details.channels) {
      if (channel.tributary !== tributary) continue;
      c.fillStyle = "rgba(73,99,70,.18)";
      ribbon(c, channel.points, tributary, 2.5);
      c.fillStyle = "#4b6559";
      ribbon(c, channel.points, tributary, 0.65);
      c.fillStyle = mixSeasonColor("#719f9c", "#e1f0f2", season?.snow ?? 0);
      ribbon(c, channel.points, tributary);
      c.fillStyle = season?.snow > 0 ? "#f3f7f5" : "rgba(196,224,206,.55)";
      ribbon(c, channel.points, tributary, -0.9);
    }
  }
  c.restore();
}

function wash(c, x, y, rx, ry, angle, opacity) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.scale(rx, ry);
  const pigment = c.createRadialGradient(0, 0, 0, 0, 0, 1);
  pigment.addColorStop(0, `rgba(188,151,81,${opacity})`);
  pigment.addColorStop(0.4, `rgba(193,160,96,${opacity * 0.72})`);
  pigment.addColorStop(0.75, `rgba(203,177,119,${opacity * 0.25})`);
  pigment.addColorStop(1, "rgba(203,177,119,0)");
  c.fillStyle = pigment;
  c.fillRect(-1, -1, 2, 2);
  c.restore();
}

// Baked before the islands: sediment feathers into the sea, and every land
// surface and raised coastal face naturally occludes the wash.
export function drawRiverSediment(c, details, coastDepth) {
  for (const mouth of details.mouths) {
    const { direction: d, plumeLength: length } = mouth;
    const angle = Math.atan2(d.y, d.x);
    for (let lobe = 0; lobe < 4; lobe++) {
      const along = length * (0.1 + lobe * 0.2);
      const drift = Math.sin(lobe * 1.9) * length * 0.08;
      wash(
        c,
        mouth.x + d.x * along - d.y * drift,
        mouth.y + d.y * along + d.x * drift + (d.y > 0 ? coastDepth : 0),
        length * (0.34 + lobe * 0.055),
        mouth.width * (0.8 + lobe * 0.65),
        angle,
        0.25 - lobe * 0.035,
      );
    }
  }
}

export function drawRiverMouths(c, details, coastDepth) {
  c.save();
  c.lineJoin = "round";
  for (const mouth of details.mouths) {
    const { direction: d, width: w } = mouth;
    // A short tidal throat crosses the raised coastline into the sea plane.
    // On back-facing shores the land surface hides the vertical drop.
    const drop = d.y > 0 ? coastDepth : 0;
    c.beginPath();
    c.moveTo(
      mouth.x - d.x * 6 - d.y * w * 0.4,
      mouth.y - d.y * 6 + d.x * w * 0.4,
    );
    c.lineTo(
      mouth.x + d.x * 7 - d.y * w * 0.62,
      mouth.y + d.y * 7 + d.x * w * 0.62 + drop,
    );
    c.quadraticCurveTo(
      mouth.x + d.x * 11,
      mouth.y + d.y * 11 + drop,
      mouth.x + d.x * 7 + d.y * w * 0.62,
      mouth.y + d.y * 7 - d.x * w * 0.62 + drop,
    );
    c.lineTo(
      mouth.x - d.x * 6 + d.y * w * 0.4,
      mouth.y - d.y * 6 - d.x * w * 0.4,
    );
    c.closePath();
    c.fillStyle = "rgba(105,151,144,.8)";
    c.fill();
    c.strokeStyle = "rgba(220,225,177,.55)";
    c.lineWidth = 0.6;
    for (const side of [-1, 1]) {
      c.beginPath();
      c.moveTo(
        mouth.x - d.y * w * 0.45 * side,
        mouth.y + d.x * w * 0.45 * side,
      );
      c.lineTo(
        mouth.x + d.x * 6 - d.y * w * 0.7 * side,
        mouth.y + d.y * 6 + d.x * w * 0.7 * side + drop,
      );
      c.stroke();
    }
  }
  c.restore();
}

export function drawRiverSettlements(c, details, season) {
  c.save();
  c.lineJoin = "round";
  for (const bridge of details.bridges) {
    c.save();
    c.translate(bridge.x, bridge.y);
    c.rotate(bridge.angle);
    const half = bridge.span / 2;
    c.fillStyle = "rgba(45,47,33,.28)";
    c.fillRect(-half, -1, bridge.span, 6);
    c.fillStyle = "#bba67b";
    c.fillRect(-half, -3, bridge.span, 5);
    c.strokeStyle = "#695638";
    c.lineWidth = 0.8;
    c.strokeRect(-half, -3, bridge.span, 5);
    for (let x = -half + 2; x < half; x += 2.5) {
      c.beginPath();
      c.moveTo(x, -3);
      c.lineTo(x, 2);
      c.stroke();
    }
    c.strokeStyle = "#e2d3a3";
    c.beginPath();
    c.moveTo(-half, -4);
    c.quadraticCurveTo(0, -6, half, -4);
    c.stroke();
    c.restore();
  }
  for (const house of [...details.settlements].sort((a, b) => a.y - b.y)) {
    const { x, y, size: s } = house;
    c.fillStyle = "rgba(48,48,30,.22)";
    c.beginPath();
    c.ellipse(x + 2, y + 1.5, s * 1.5, s * 0.65, -0.3, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#d8c79c";
    c.fillRect(x - s, y - s * 1.4, s * 2, s * 1.5);
    c.fillStyle = "#9d906e";
    c.fillRect(x + s * 0.35, y - s * 1.4, s * 0.65, s * 1.5);
    c.beginPath();
    c.moveTo(x - s * 1.3, y - s * 1.3);
    c.lineTo(x, y - s * 2.5);
    c.lineTo(x + s * 1.3, y - s * 1.3);
    c.closePath();
    c.fillStyle = mixSeasonColor(
      house.variant === 1 ? "#746d51" : "#9c6849",
      "#e8eee3",
      season?.snow ?? 0,
    );
    c.fill();
    c.strokeStyle = "rgba(64,50,31,.7)";
    c.lineWidth = 0.6;
    c.stroke();
    c.fillStyle = "#5c5036";
    c.fillRect(x - s * 0.3, y - s * 0.8, s * 0.5, s * 0.9);
  }
  c.restore();
}
