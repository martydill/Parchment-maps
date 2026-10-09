// Illustration geometry lives in unwrapped island coordinates, just like the
// geographic terrain. None of this detail changes navigation or saved state.
export function terrainDetailLevels(zoom, detail = 1) {
  const smooth = (start, end) => {
    const t = Math.max(0, Math.min(1, (zoom - start) / (end - start)));
    return t * t * (3 - 2 * t);
  };
  const quality = Math.max(0, Math.min(1, detail));
  return {
    sculpting: smooth(0.72, 1.16) * quality,
    engraving: smooth(1.02, 1.48) * quality * quality,
  };
}

export function createTerrainDetailReveal() {
  let previousTime = null;
  let levels = { sculpting: 0, engraving: 0 };
  return {
    update(zoom, detail, time, reducedMotion = false) {
      const target = terrainDetailLevels(zoom, detail);
      const blend =
        previousTime === null || reducedMotion
          ? 1
          : 1 - Math.exp(-Math.max(0, time - previousTime) / 110);
      previousTime = time;
      levels = {
        sculpting:
          levels.sculpting + (target.sculpting - levels.sculpting) * blend,
        engraving:
          levels.engraving + (target.engraving - levels.engraving) * blend,
      };
      return levels;
    },
  };
}

export function sculptedRidgeLayers({ a, b, width }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  return [0.6, 0.25, -0.15].map((offset, index) => {
    const height = width * (0.6 + index * 0.3);
    const spine = [0, 0.22, 0.48, 0.73, 1].map((t, step) => ({
      x: a.x + dx * t + nx * width * offset,
      y: a.y + dy * t + ny * width * offset - height * (step % 2 ? 0.65 : 1),
    }));
    const foot = [...spine].reverse().map((point, step) => ({
      x: point.x - nx * width * 0.5,
      y: point.y + height + width * (0.45 + (step % 2) * 0.12),
    }));
    return { spine, foot, height };
  });
}

export function cliffFacePlans(poly, depth) {
  if (poly.length < 3 || depth <= 0) return [];
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const facing = Math.sign(area) || 1;
  const faces = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    if (dx * facing >= 0) continue;
    const length = Math.hypot(dx, dy);
    faces.push({
      a: { x: a[0], y: a[1] },
      b: { x: b[0], y: b[1] },
      depth,
      normal: [(dy * facing) / length, (-dx * facing) / length, 0],
      fissures: Array.from({ length: Math.floor(length / 7) }, (_, step) => {
        const t = (step + 0.5) / (Math.floor(length / 7) + 1);
        return {
          x: a[0] + dx * t,
          y: a[1] + dy * t,
          variant: (step * 0.618) % 1,
        };
      }),
    });
  }
  return faces;
}
