// Deterministic wrapped heightfield for the 3D chart diorama. Land rises in
// terraces and peaks from the sea plane; the sea stays at z = 0 where the
// painted chart is draped and animated. All randomness is hashed from the
// seed, so the same world data always produces the same relief.

function hashNoise(ix, iy, seed) {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263);
  h = Math.imul(h ^ (seed | 0), 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smoothstep(start, end, value) {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start || 1)));
  return t * t * (3 - 2 * t);
}

function valueNoise(x, y, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smoothstep(0, 1, x - ix);
  const fy = smoothstep(0, 1, y - iy);
  const a = hashNoise(ix, iy, seed);
  const b = hashNoise(ix + 1, iy, seed);
  const c = hashNoise(ix, iy + 1, seed);
  const d = hashNoise(ix + 1, iy + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

// Unwrap polygon x coordinates so edges never jump across the world seam.
function unwrapPolygon(poly, width) {
  const points = poly.map(([x, y]) => [x, y]);
  for (let i = 1; i < points.length; i++) {
    let delta = points[i][0] - points[i - 1][0];
    if (delta > width / 2) delta -= width;
    if (delta < -width / 2) delta += width;
    points[i][0] = points[i - 1][0] + delta;
  }
  return points;
}

function wrapX(x, width) {
  return ((x % width) + width) % width;
}

export const DEFAULT_TERRAIN_OPTIONS = Object.freeze({
  cliffHeight: 8,
  cliffCells: 2.2,
  plateauHeight: 22,
  plateauCells: 16,
  peakScale: 2.1,
  peakMax: 128,
  hillAmplitude: 11,
  hillFrequency: 0.012,
  terraceHeight: 9,
  terraceRadius: 46,
  edgeCells: 2.4,
  seed: 7,
});

// Build the field: heights and landness sampled on a lattice of the wrapping
// world. `lands` are coastline polygons, `peaks` are {x, y, size} mountains,
// and `ports` are {x, y} harbor sites that get a flat building terrace.
export function buildTerrainField({
  width,
  height,
  cell = 12,
  lands = [],
  peaks = [],
  ports = [],
  ...overrides
} = {}) {
  const options = { ...DEFAULT_TERRAIN_OPTIONS, ...overrides };
  if (!(width > 0) || !(height > 0)) {
    throw new Error("terrain field needs a positive world size");
  }
  const cols = Math.max(4, Math.round(width / cell));
  const rows = Math.max(4, Math.round(height / cell));
  const cellW = width / cols;
  const cellH = height / rows;
  const count = cols * rows;

  // 1. Rasterize the land mask with an even-odd scanline per land polygon.
  // Crossings stay in unwrapped coordinates so spans that cross the world
  // seam keep their pairing; each span is matched against every wrapped copy
  // of the grid columns.
  const mask = new Uint8Array(count);
  const unwrapped = lands
    .filter((land) => Array.isArray(land?.poly) && land.poly.length >= 3)
    .map((land) => unwrapPolygon(land.poly, width));
  for (let row = 0; row < rows; row++) {
    const y = (row + 0.5) * cellH;
    for (const poly of unwrapped) {
      const crossings = [];
      for (let i = 0; i < poly.length; i++) {
        const [ax, ay] = poly[i];
        const [bx, by] = poly[(i + 1) % poly.length];
        if ((ay <= y && by > y) || (by <= y && ay > y)) {
          const t = (y - ay) / (by - ay);
          crossings.push(ax + (bx - ax) * t);
        }
      }
      if (crossings.length < 2) continue;
      crossings.sort((a, b) => a - b);
      for (let c = 0; c + 1 < crossings.length; c += 2) {
        const spanStart = crossings[c];
        const spanEnd = crossings[c + 1];
        for (let col = 0; col < cols; col++) {
          const x = (col + 0.5) * cellW;
          for (const offset of [-width, 0, width]) {
            const shifted = x + offset;
            if (shifted >= spanStart && shifted <= spanEnd) {
              mask[row * cols + col] = 1;
              break;
            }
          }
        }
      }
    }
  }

  // 2. Wrapped BFS distance in cells from every land cell to the nearest sea
  // cell and vice versa, so coasts, terraces, and shallows all key off the
  // same shoreline.
  const distToSea = new Int32Array(count).fill(-1);
  const distToLand = new Int32Array(count).fill(-1);
  const queue = new Int32Array(count);
  const neighbors = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
  const runDistance = (isSeed, fill) => {
    let head = 0;
    let tail = 0;
    for (let i = 0; i < count; i++) {
      if (isSeed(i)) {
        fill[i] = 0;
        queue[tail++] = i;
      }
    }
    while (head < tail) {
      const index = queue[head++];
      const row = Math.floor(index / cols);
      const col = index % cols;
      const distance = fill[index] + 1;
      for (const [dx, dy] of neighbors) {
        const nextRow = row + dy;
        if (nextRow < 0 || nextRow >= rows) continue;
        const nextCol = (col + dx + cols) % cols;
        const nextIndex = nextRow * cols + nextCol;
        if (fill[nextIndex] !== -1) continue;
        fill[nextIndex] = distance;
        queue[tail++] = nextIndex;
      }
    }
  };
  runDistance((i) => !mask[i], distToSea);
  runDistance((i) => !!mask[i], distToLand);
  // A world without any land or without any sea would leave -1 sentinels.
  for (let i = 0; i < count; i++) {
    if (distToSea[i] === -1) distToSea[i] = options.plateauCells * 4;
    if (distToLand[i] === -1) distToLand[i] = options.plateauCells * 4;
  }

  // 3. Heights and landness per lattice point.
  const heights = new Float32Array(count);
  const landness = new Float32Array(count);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      const x = (col + 0.5) * cellW;
      const y = (row + 0.5) * cellH;
      const shore = distToSea[index];
      let h = 0;
      if (mask[index]) {
        h =
          options.cliffHeight * smoothstep(0.4, options.cliffCells, shore) +
          options.plateauHeight *
            smoothstep(options.cliffCells, options.plateauCells, shore);
        const noise =
          valueNoise(
            x * options.hillFrequency,
            y * options.hillFrequency,
            options.seed,
          ) - 0.5;
        const second =
          valueNoise(
            x * options.hillFrequency * 2.7,
            y * options.hillFrequency * 2.7,
            options.seed + 31,
          ) - 0.5;
        h += (noise + second * 0.5) * 2 * options.hillAmplitude;
        for (const peak of peaks) {
          const dx = Math.min(
            Math.abs(x - peak.x),
            width - Math.abs(x - peak.x),
          );
          const dy = y - peak.y;
          const sigma = Math.max(6, (peak.size || 20) * 1.9);
          const amplitude = Math.min(
            options.peakMax,
            Math.max(24, (peak.size || 20) * options.peakScale),
          );
          h += amplitude * Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
        }
      }
      heights[index] = Math.max(0, h);
      landness[index] = Math.max(
        0,
        Math.min(
          1,
          0.5 + (shore - distToLand[index]) / (2 * options.edgeCells + 0.0001),
        ),
      );
    }
  }

  // 4. Flatten a harbor terrace around every port so 3D quays and buildings
  // sit on level ground.
  for (const port of ports) {
    if (!Number.isFinite(port?.x) || !Number.isFinite(port?.y)) continue;
    const terraceCells = Math.max(2, Math.round(options.terraceRadius / cellW));
    const portCol = Math.floor(wrapX(port.x, width) / cellW);
    const portRow = Math.max(0, Math.min(rows - 1, Math.floor(port.y / cellH)));
    const centerIndex = portRow * cols + portCol;
    if (!mask[centerIndex]) continue;
    const target = Math.max(options.terraceHeight, heights[centerIndex] * 0.85);
    for (let dy = -terraceCells; dy <= terraceCells; dy++) {
      const row = portRow + dy;
      if (row < 0 || row >= rows) continue;
      for (let dx = -terraceCells; dx <= terraceCells; dx++) {
        const distance = Math.hypot(dx, dy);
        if (distance > terraceCells) continue;
        const col = (portCol + dx + cols) % cols;
        const index = row * cols + col;
        if (!mask[index]) continue;
        const blend =
          1 - smoothstep(terraceCells * 0.45, terraceCells, distance);
        heights[index] = heights[index] * (1 - blend) + target * blend;
      }
    }
  }

  return {
    width,
    height,
    cols,
    rows,
    cellW,
    cellH,
    heights,
    landness,
    // Wrapped cell distances: from land to open water (shore) and from sea
    // to the nearest coast (inland). Detail passes key coastal halos, depth
    // washes, and snow lines off these instead of re-scanning polygons.
    shore: distToLand,
    inland: distToSea,
    options,
  };
}

// Bilinear wrapped sampler for a field channel. Y clamps at the map's rigid
// northern and southern borders.
export function sampleFieldChannel(field, channel, x, y) {
  const { width, cols, rows } = field;
  const data = field[channel];
  const fx = wrapX(x, width) / field.cellW - 0.5;
  const fy = Math.max(0, Math.min(rows - 1, y / field.cellH - 0.5));
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const col0 = ((ix % cols) + cols) % cols;
  const col1 = (col0 + 1) % cols;
  const row0 = Math.max(0, Math.min(rows - 1, iy));
  const row1 = Math.max(0, Math.min(rows - 1, iy + 1));
  const a = data[row0 * cols + col0];
  const b = data[row0 * cols + col1];
  const c = data[row1 * cols + col0];
  const d = data[row1 * cols + col1];
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}

export function sampleTerrainHeight(field, x, y) {
  return sampleFieldChannel(field, "heights", x, y);
}

export function sampleTerrainLandness(field, x, y) {
  return sampleFieldChannel(field, "landness", x, y);
}

// Interleave the lattice into a triangle mesh for the GPU. Vertex layout per
// float: x, y, z, u, v, landness, normal x, normal y. The seam column is duplicated with u = 1 so
// the texture wraps without a visible tear, and a skirt drops the slab's
// paper edge at the rigid north and south borders.
export function buildTerrainMesh(field, { skirtDepth = 34 } = {}) {
  const { height, cols, rows, heights, landness } = field;
  const stride = 8;
  const gridVerts = (cols + 1) * rows;
  const skirtCols = 4 * (cols + 1);
  const positions = new Float32Array((gridVerts + skirtCols) * stride);
  // Smooth surface normals from central differences of the height lattice.
  // Interpolated per-fragment, they shade rolling relief without the flat
  // triangle facets that screen-space derivatives produce at grazing views.
  const normalXY = (col, row) => {
    const west = heights[row * cols + ((col - 1 + cols) % cols)];
    const east = heights[row * cols + ((col + 1) % cols)];
    const south = heights[Math.min(rows - 1, row + 1) * cols + col];
    const north = heights[Math.max(0, row - 1) * cols + col];
    const dhx = (east - west) / (2 * field.cellW);
    const dhz = (south - north) / (2 * field.cellH);
    // GL space mirrors chart y, so the chart-space gradient flips with it.
    let nx = -dhx;
    let ny = dhz;
    const length = Math.hypot(nx, ny, 1);
    return [nx / length, ny / length];
  };
  let out = 0;
  for (let row = 0; row < rows; row++) {
    const y = row * field.cellH;
    const v = Math.min(1, y / height);
    for (let col = 0; col <= cols; col++) {
      const source = col % cols;
      const index = row * cols + source;
      const x = col * field.cellW;
      const u = col / cols;
      const z = heights[index];
      const [nx, ny] = normalXY(source, row);
      positions[out++] = x;
      positions[out++] = -y;
      positions[out++] = z;
      positions[out++] = u;
      positions[out++] = v;
      positions[out++] = landness[index];
      positions[out++] = nx;
      positions[out++] = ny;
    }
  }
  // Skirt: front and back walls hanging from the northern and southern rims.
  for (const edgeRow of [0, rows - 1]) {
    const y = edgeRow * field.cellH;
    const v = Math.min(1, y / height);
    for (let col = 0; col <= cols; col++) {
      const source = col % cols;
      const index = edgeRow * cols + source;
      const x = col * field.cellW;
      const [nx, ny] = normalXY(source, edgeRow);
      for (const drop of [0, -skirtDepth]) {
        positions[out++] = x;
        positions[out++] = -y;
        positions[out++] = drop;
        positions[out++] = col / cols;
        positions[out++] = v;
        positions[out++] = landness[index];
        positions[out++] = nx;
        positions[out++] = ny;
      }
    }
  }
  const quads = cols * (rows - 1);
  const skirtQuads = 2 * cols;
  const indices = new Uint32Array((quads + skirtQuads) * 6);
  let i = 0;
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols; col++) {
      const a = row * (cols + 1) + col;
      const b = a + 1;
      const c = a + cols + 1;
      const d = c + 1;
      indices[i++] = a;
      indices[i++] = c;
      indices[i++] = b;
      indices[i++] = b;
      indices[i++] = c;
      indices[i++] = d;
    }
  }
  const skirtBase = gridVerts;
  for (const offset of [0, cols + 1]) {
    for (let col = 0; col < cols; col++) {
      const top = skirtBase + offset + col * 2;
      const a = top;
      const b = top + 1;
      const c = top + 2;
      const d = top + 3;
      indices[i++] = a;
      indices[i++] = c;
      indices[i++] = b;
      indices[i++] = b;
      indices[i++] = c;
      indices[i++] = d;
    }
  }
  return {
    positions,
    indices,
    vertexCount: gridVerts + skirtCols,
  };
}
