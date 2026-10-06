const TAU = Math.PI * 2;

function numericSeed(seed) {
  let value = 2166136261;
  for (const character of String(seed)) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function phase(seed, channel) {
  const value = Math.imul(seed ^ (channel * 0x9e3779b9), 0x85ebca6b);
  return ((value >>> 0) / 4294967296) * TAU;
}

function unitValue(seed, channel) {
  const value = Math.imul(seed ^ (channel * 0x9e3779b9), 0x85ebca6b);
  return (value >>> 0) / 4294967296;
}

function wrapLongitude(x, width) {
  return ((x % width) + width) % width;
}

function wrappedDelta(target, origin, width) {
  let delta = wrapLongitude(target, width) - wrapLongitude(origin, width);
  if (delta > width / 2) delta -= width;
  if (delta < -width / 2) delta += width;
  return delta;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createDistinctMapSeed(previousSeed, randomValues) {
  const values = randomValues || new Uint32Array(2);
  if (!randomValues && globalThis.crypto?.getRandomValues)
    globalThis.crypto.getRandomValues(values);
  const entropy = Array.from(values, (value) => Number(value) >>> 0)
    .map((value) => value.toString(36))
    .join("-");
  const fallback = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const candidate = entropy && !/^0(?:-0)*$/.test(entropy) ? entropy : fallback;
  return candidate === String(previousSeed) ? `${candidate}-new` : candidate;
}

export function createMapTransform(
  seed,
  {
    sourceWidth = 6400,
    sourceHeight = 2400,
    width = 4800,
    height = 3200,
    margin = 90,
  } = {},
) {
  const value = numericSeed(seed);
  const usableHeight = height - margin * 2;
  const scaleX = width / sourceWidth;
  const scaleY = usableHeight / sourceHeight;
  const phases = Array.from({ length: 6 }, (_, index) =>
    phase(value, index + 1),
  );

  function point(x, y) {
    const nx = x / sourceWidth;
    const ny = y / sourceHeight;
    const longitude = nx * TAU;
    const latitude = ny * Math.PI;
    const polarFade = Math.sin(latitude);
    const xWarp =
      (Math.sin(longitude + phases[0]) * 190 +
        Math.sin(longitude * 2 - latitude * 1.4 + phases[1]) * 125 +
        Math.sin(longitude * 4 + latitude * 2.1 + phases[2]) * 58) *
      polarFade;
    const yWarp =
      (Math.sin(longitude * 2 + phases[3]) * 155 +
        Math.sin(longitude * 3 - latitude * 2 + phases[4]) * 95 +
        Math.sin(longitude + latitude * 4 + phases[5]) * 54) *
      polarFade;
    const projectedX = x * scaleX + xWarp;
    return {
      x: wrapLongitude(projectedX, width),
      y: Math.max(
        margin,
        Math.min(height - margin, margin + y * scaleY + yWarp),
      ),
    };
  }

  const regionParameters = new Map();
  function regionOffset(x, y, regionKey, center) {
    if (!regionParameters.has(regionKey)) {
      const regionSeed = numericSeed(`${seed}:${regionKey}`);
      regionParameters.set(regionKey, {
        angle: (unitValue(regionSeed, 1) - 0.5) * 1.5,
        stretchX: 0.72 + unitValue(regionSeed, 2) * 0.6,
        stretchY: 0.72 + unitValue(regionSeed, 3) * 0.6,
        phaseX: phase(regionSeed, 4),
        phaseY: phase(regionSeed, 5),
      });
    }
    const shape = regionParameters.get(regionKey);
    const scale = Math.sqrt(scaleX * scaleY);
    let dx = (x - center.x) * scale * shape.stretchX;
    let dy = (y - center.y) * scale * shape.stretchY;
    // Compose smooth shears instead of independent radial spikes. Each shear
    // is invertible, preserving coves and peninsulas without folding the coast.
    dx += (Math.sin(dy / 170 + shape.phaseX) - Math.sin(shape.phaseX)) * 65;
    dy += (Math.sin(dx / 210 + shape.phaseY) - Math.sin(shape.phaseY)) * 55;
    return {
      x: dx * Math.cos(shape.angle) - dy * Math.sin(shape.angle),
      y: dx * Math.sin(shape.angle) + dy * Math.cos(shape.angle),
    };
  }

  function regionPoint(x, y, regionKey, center) {
    const regionSeed = numericSeed(`${seed}:${regionKey}`);
    const projectedCenter = point(center.x, center.y);
    const offset = regionOffset(x, y, regionKey, center);
    return {
      x: wrapLongitude(
        projectedCenter.x + (unitValue(regionSeed, 6) - 0.5) * 400 + offset.x,
        width,
      ),
      y: clamp(
        projectedCenter.y + (unitValue(regionSeed, 7) - 0.5) * 300 + offset.y,
        margin,
        height - margin,
      ),
    };
  }

  return {
    seed: String(seed),
    sourceWidth,
    sourceHeight,
    width,
    height,
    scaleX,
    scaleY,
    point,
    regionPoint,
    regionOffset,
    horizontalLength(length) {
      return length * scaleX;
    },
    verticalLength(length) {
      return length * scaleY;
    },
    averageLength(length) {
      return length * Math.sqrt(scaleX * scaleY);
    },
  };
}

export function transformPointRecord(record, transform) {
  const mapped = transform.point(record.x, record.y);
  record.x = mapped.x;
  record.y = mapped.y;
  return record;
}

export function transformTuple(tuple, transform, scaleSize = true) {
  const mapped = transform.point(tuple[0], tuple[1]);
  tuple[0] = mapped.x;
  tuple[1] = mapped.y;
  if (scaleSize && typeof tuple[2] === "number")
    tuple[2] = transform.averageLength(tuple[2]);
  return tuple;
}

export function transformPath(path, transform) {
  for (const point of path) {
    const mapped = transform.point(point[0], point[1]);
    point[0] = mapped.x;
    point[1] = mapped.y;
  }
  return path;
}

export function separateWrappedPoints(
  records,
  {
    width,
    height = Infinity,
    minDistance = 120,
    margin = 0,
    iterations = 8,
    locked = () => false,
  } = {},
) {
  if (!Number.isFinite(width) || width <= 0 || minDistance <= 0) return records;

  for (let pass = 0; pass < iterations; pass++) {
    let moved = false;

    for (let aIndex = 0; aIndex < records.length; aIndex++) {
      for (let bIndex = aIndex + 1; bIndex < records.length; bIndex++) {
        const a = records[aIndex];
        const b = records[bIndex];
        const dx = wrappedDelta(b.x, a.x, width);
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);
        if (distance >= minDistance) continue;

        const aLocked = locked(a, aIndex);
        const bLocked = locked(b, bIndex);
        if (aLocked && bLocked) continue;

        const overlap = minDistance - distance;
        const unitX = distance > 0 ? dx / distance : 1;
        const unitY = distance > 0 ? dy / distance : 0;
        const aShare = aLocked ? 0 : bLocked ? 1 : 0.5;
        const bShare = bLocked ? 0 : aLocked ? 1 : 0.5;

        if (!aLocked) {
          a.x = wrapLongitude(a.x - unitX * overlap * aShare, width);
          a.y = clamp(a.y - unitY * overlap * aShare, margin, height - margin);
        }
        if (!bLocked) {
          b.x = wrapLongitude(b.x + unitX * overlap * bShare, width);
          b.y = clamp(b.y + unitY * overlap * bShare, margin, height - margin);
        }
        moved = true;
      }
    }

    if (!moved) break;
  }

  return records;
}

export function moveUnreachablePointsToOpenWater(
  records,
  {
    isOpen,
    width,
    maxReach = 70,
    searchRadius = 420,
    step = 24,
    samples = 32,
    locked = () => false,
  } = {},
) {
  if (
    typeof isOpen !== "function" ||
    !Number.isFinite(width) ||
    width <= 0 ||
    maxReach < 0 ||
    searchRadius <= 0 ||
    step <= 0 ||
    samples <= 0
  )
    return records;

  const hasOpenWaterWithinReach = (record) => {
    if (isOpen(record.x, record.y)) return true;
    for (let radius = step; radius <= maxReach; radius += step) {
      for (let index = 0; index < samples; index++) {
        const angle = (index / samples) * TAU;
        const x = wrapLongitude(record.x + Math.cos(angle) * radius, width);
        const y = record.y + Math.sin(angle) * radius;
        if (isOpen(x, y)) return true;
      }
    }
    return false;
  };

  for (let recordIndex = 0; recordIndex < records.length; recordIndex++) {
    const record = records[recordIndex];
    if (locked(record, recordIndex) || hasOpenWaterWithinReach(record))
      continue;

    let nearest = null;
    for (let radius = maxReach + step; radius <= searchRadius; radius += step) {
      for (let index = 0; index < samples; index++) {
        const angle = (index / samples) * TAU;
        const x = wrapLongitude(record.x + Math.cos(angle) * radius, width);
        const y = record.y + Math.sin(angle) * radius;
        if (!isOpen(x, y)) continue;
        const distance = Math.hypot(
          wrappedDelta(x, record.x, width),
          y - record.y,
        );
        if (!nearest || distance < nearest.distance)
          nearest = { x, y, distance };
      }
      if (nearest) break;
    }

    if (nearest) {
      record.x = nearest.x;
      record.y = nearest.y;
    }
  }

  return records;
}
