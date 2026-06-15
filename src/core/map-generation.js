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
      x: Math.max(0, Math.min(width, projectedX)),
      y: Math.max(
        margin,
        Math.min(height - margin, margin + y * scaleY + yWarp),
      ),
    };
  }

  function regionPoint(x, y, regionKey, center) {
    const regionSeed = numericSeed(`${seed}:${regionKey}`);
    const projectedCenter = point(center.x, center.y);
    const dx = (x - center.x) * scaleX;
    const dy = (y - center.y) * scaleY;
    const angle = (unitValue(regionSeed, 1) - 0.5) * 1.5;
    const stretchX = 0.55 + unitValue(regionSeed, 2);
    const stretchY = 0.55 + unitValue(regionSeed, 3) * 1.1;
    const rotationX =
      dx * stretchX * Math.cos(angle) - dy * stretchY * Math.sin(angle);
    const rotationY =
      dx * stretchX * Math.sin(angle) + dy * stretchY * Math.cos(angle);
    const sourceDirection = Math.atan2(dy, dx);
    const direction = Math.atan2(rotationY, rotationX);
    const distance = Math.hypot(rotationX, rotationY);
    const coastline =
      1 +
      Math.sin(sourceDirection * 3 + phase(regionSeed, 4)) * 0.2 +
      Math.sin(sourceDirection * 7 + phase(regionSeed, 5)) * 0.1;
    const translationX = (unitValue(regionSeed, 6) - 0.5) * 400;
    const translationY = (unitValue(regionSeed, 7) - 0.5) * 300;

    return {
      x: Math.max(
        0,
        Math.min(
          width,
          projectedCenter.x +
            translationX +
            Math.cos(direction) * distance * coastline,
        ),
      ),
      y: Math.max(
        margin,
        Math.min(
          height - margin,
          projectedCenter.y +
            translationY +
            Math.sin(direction) * distance * coastline,
        ),
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
