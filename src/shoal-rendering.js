// Static watercolor plates are shared by the sailing view and the chart.
// Transparent pigment leaves the chart's paper grain and wave marks visible.
const plates = new Map();

function randomSource(seed) {
  let value = seed | 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) | 0;
    return (value >>> 0) / 4294967296;
  };
}

function createPlate(x, y, rx, ry) {
  const random = randomSource(Math.round(x * 7 + y * 13));
  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = Math.ceil(rx * 2 * scale);
  canvas.height = Math.ceil(ry * 2 * scale);
  const c = canvas.getContext("2d");
  c.scale(scale, scale);
  c.translate(rx, ry);

  c.save();
  c.scale(rx, ry);
  const wash = c.createRadialGradient(0, 0, 0, 0, 0, 1);
  wash.addColorStop(0, "rgba(217,203,151,.22)");
  wash.addColorStop(0.58, "rgba(203,198,151,.17)");
  wash.addColorStop(0.85, "rgba(134,170,148,.08)");
  wash.addColorStop(1, "rgba(134,170,148,0)");
  c.fillStyle = wash;
  c.fillRect(-1, -1, 2, 2);
  c.restore();

  // A meandering spine forks into tapered sand tongues. Curves and pigment
  // vary by location, rather than repeating the same striped island silhouette.
  const phase = random() * Math.PI * 2;
  const spine = (t) => [
    (t * 1.74 - 0.87) * rx,
    (Math.sin(t * 5.4 + phase) * 0.27 + (0.5 - t) * 0.48) * ry,
  ];
  const ridges = [];
  const trunk = Array.from({ length: 35 }, (_, i) => spine(i / 34));
  ridges.push({ points: trunk, width: ry * 0.2 });
  for (let branch = 0; branch < 8; branch++) {
    const t = 0.13 + branch * 0.1 + random() * 0.04;
    const [startX, startY] = spine(t);
    const side = branch % 2 ? 1 : -1;
    const endX = startX + rx * (random() * 0.42 - 0.13);
    const endY = side * ry * (0.38 + random() * 0.44);
    const bend = (random() - 0.5) * rx * 0.3;
    const points = Array.from({ length: 18 }, (_, i) => {
      const u = i / 17;
      return [
        startX + (endX - startX) * u + Math.sin(u * Math.PI) * bend,
        startY + (endY - startY) * (u * u * (3 - 2 * u)),
      ];
    });
    ridges.push({ points, width: ry * (0.075 + random() * 0.09) });
  }

  function ribbon(points, width) {
    c.beginPath();
    for (const side of [1, -1]) {
      for (let step = 0; step < points.length; step++) {
        const i = side === 1 ? step : points.length - 1 - step;
        const [px, py] = points[i];
        const previous = points[Math.max(0, i - 1)];
        const next = points[Math.min(points.length - 1, i + 1)];
        const angle = Math.atan2(next[1] - previous[1], next[0] - previous[0]);
        const taper = Math.pow(
          Math.sin((i / (points.length - 1)) * Math.PI),
          0.6,
        );
        const breadth =
          width * taper * (0.92 + Math.sin(i * 1.7 + phase) * 0.08);
        const vx = px - Math.sin(angle) * breadth * side;
        const vy = py + Math.cos(angle) * breadth * side;
        if (side === 1 && step === 0) c.moveTo(vx, vy);
        else c.lineTo(vx, vy);
      }
    }
    c.closePath();
    c.fill();
  }

  // Successive translucent washes feather the pigment without a coastline.
  for (const [spread, color] of [
    [1.65, "rgba(204,194,143,.10)"],
    [1.25, "rgba(221,205,151,.16)"],
    [0.86, "rgba(230,211,156,.24)"],
  ]) {
    c.fillStyle = color;
    for (const { points, width } of ridges) ribbon(points, width * spread);
  }

  // Sparse ink grains and paper flecks, finer and quieter than exposed rocks.
  for (let grain = 0; grain < 650; grain++) {
    const px = (random() * 2 - 1) * rx;
    const py = (random() * 2 - 1) * ry;
    const radius = Math.hypot(px / rx, py / ry);
    if (radius > 0.92 || random() > (1 - radius) * 1.3) continue;
    c.fillStyle =
      grain % 4 === 0 ? "rgba(246,231,184,.26)" : "rgba(65,103,91,.23)";
    c.beginPath();
    c.ellipse(
      px,
      py,
      0.25 + random() * 0.45,
      0.2 + random() * 0.3,
      0,
      0,
      Math.PI * 2,
    );
    c.fill();
  }

  // Short curved engraving follows each sand tongue; no full-width bands.
  c.lineCap = "round";
  for (const { points, width } of ridges) {
    for (let i = 3; i < points.length - 3; i += 2) {
      if (random() < 0.22) continue;
      const [px, py] = points[i];
      const next = points[i + 1];
      const angle = Math.atan2(next[1] - py, next[0] - px);
      const length = width * (0.35 + random() * 0.48);
      c.save();
      c.translate(px, py);
      c.rotate(angle);
      c.lineWidth = 0.45;
      c.strokeStyle = i % 3 ? "rgba(245,229,183,.38)" : "rgba(114,125,91,.18)";
      c.beginPath();
      c.moveTo(-0.6, -length);
      c.quadraticCurveTo(1.6, 0, -0.6, length * 0.7);
      c.stroke();
      c.restore();
    }
  }

  // A soft elliptical mask keeps every mark inside the navigable hazard.
  c.globalCompositeOperation = "destination-in";
  c.save();
  c.scale(rx, ry);
  const feather = c.createRadialGradient(0, 0, 0, 0, 0, 1);
  feather.addColorStop(0, "#fff");
  feather.addColorStop(0.68, "#fff");
  feather.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = feather;
  c.fillRect(-1, -1, 2, 2);
  c.restore();
  return canvas;
}

export function drawParchmentShoal(c, x, y, rx, ry) {
  const key = `${x}:${y}:${rx}:${ry}`;
  if (!plates.has(key)) plates.set(key, createPlate(x, y, rx, ry));
  c.drawImage(plates.get(key), x - rx, y - ry, rx * 2, ry * 2);
}
