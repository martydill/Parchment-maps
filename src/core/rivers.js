import { pointInPolygon } from "./geometry.js";

// Match the chart's quadratic river curves so branches, bridges, and banks
// share actual positions on the water, including on unwrapped islands.
export function sampleRiverPath(points) {
  if (points.length < 2) return [...points];
  const samples = [points[0]];
  let start = points[0];
  for (let i = 1; i < points.length - 1; i++) {
    const control = points[i];
    const end = {
      x: (control.x + points[i + 1].x) / 2,
      y: (control.y + points[i + 1].y) / 2,
    };
    for (let step = 1; step <= 8; step++) {
      const t = step / 8;
      samples.push({
        x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t * t * end.x,
        y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t * t * end.y,
      });
    }
    start = end;
  }
  samples.push(points.at(-1));
  return samples;
}

export function riverWidthAt(progress, tributary = false) {
  const t = Math.max(0, Math.min(1, progress));
  if (tributary) return 0.65 + t * 1.35;
  return 1.25 + t ** 1.4 * 4.5 + Math.max(0, (t - 0.8) / 0.2) ** 2 * 5;
}

function upstreamBank(points, distance) {
  let bank;
  for (let i = points.length - 1; i > 0; i--) {
    const a = points[i - 1],
      b = points[i];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length === 0) continue;
    const dx = (b.x - a.x) / length,
      dy = (b.y - a.y) / length;
    bank = { ...a, dx, dy };
    if (distance <= length)
      return { x: b.x - dx * distance, y: b.y - dy * distance, dx, dy };
    distance -= length;
  }
  return bank;
}

export function planRiverDetails(poly, rivers, tributaries, clearings = []) {
  const details = { channels: [], mouths: [], bridges: [], settlements: [] };
  const room = (point, radius) =>
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].every(([dx, dy]) =>
      pointInPolygon(point.x + dx * radius, point.y + dy * radius, poly),
    ) &&
    clearings.every(
      (zone) =>
        ((point.x - zone.x) / (zone.rx + radius)) ** 2 +
          ((point.y - zone.y) / (zone.ry + radius)) ** 2 >
        1,
    );
  for (const [tributary, paths] of [
    [false, rivers],
    [true, tributaries],
  ]) {
    for (const path of paths) {
      const points = sampleRiverPath(path);
      if (points.length < 2) continue;
      details.channels.push({ points, tributary });
      if (tributary) continue;
      const source = points[0],
        mouth = points.at(-1);
      const length = Math.hypot(mouth.x - source.x, mouth.y - source.y);
      if (length < 30) continue;
      const direction = {
        x: (mouth.x - source.x) / length,
        y: (mouth.y - source.y) / length,
      };
      details.mouths.push({
        ...mouth,
        direction,
        width: riverWidthAt(1),
        plumeLength: Math.min(85, Math.max(38, length * 0.5)),
      });

      const index = Math.floor((points.length - 1) * 0.62);
      const center = points[index],
        next = points[index + 1];
      const angle =
        Math.atan2(next.y - center.y, next.x - center.x) + Math.PI / 2;
      const span = riverWidthAt(index / (points.length - 1)) + 9;
      if (room(center, span * 0.6))
        details.bridges.push({ ...center, angle, span });

      // Compact hamlets sit on both banks above the tidal inlet. Their
      // footprints stay inland and leave existing harbor/name clearings free.
      for (let house = 0; house < 8; house++) {
        const side = house % 2 ? 1 : -1;
        const inland = 13 + Math.floor(house / 2) * 8;
        const across = side * (11 + (house % 3) * 3);
        const bank = upstreamBank(points, inland);
        const point = {
          x: bank.x - bank.dy * across,
          y: bank.y + bank.dx * across,
        };
        const size = 3 + (house % 3) * 0.5;
        if (room(point, size + 3))
          details.settlements.push({ ...point, size, variant: house % 3 });
      }
    }
  }
  return details;
}
