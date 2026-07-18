// Land-avoiding navigation for NPC sea lanes.
//
// Rival merchants and the player's fleet follow fixed polylines ("sea lanes").
// Several of those lanes cut straight across islands. This module bakes a
// land-avoiding detour into a lane's waypoints by rasterizing the world's land
// polygons into a grid once, then running a small A* per lane segment that
// crosses land. Everything here is pure and deterministic; DOM/Canvas live in
// app.js. The grid is cylindrical in x (the world wraps horizontally), so a
// lane that crosses the east/west seam still routes the short way around.

import { wrap, wrappedDelta } from "./math.js";

const EPS = 0.00001;
const SQRT2 = Math.SQRT2;

// [dCol, dRow, isDiagonal]
const DIRECTIONS = [
  [1, 0, false],
  [-1, 0, false],
  [0, 1, false],
  [0, -1, false],
  [1, 1, true],
  [1, -1, true],
  [-1, 1, true],
  [-1, -1, true],
];

// Rasterize every land polygon into a blocked-cell grid. The grid wraps in x,
// so polygons that straddle the world seam are filled at x-offsets -W, 0, +W
// (bbox-culled), matching pointInWrappedPolygon. No dilation: navigating on raw
// land means channels can never close, so an already-working lane never
// regresses, and a path's centre line never enters land.
export function buildSeaField(lands, { width, height, cellSize = 10 }) {
  const cols = Math.max(1, Math.ceil(width / cellSize));
  const rows = Math.max(1, Math.ceil(height / cellSize));
  const grid = new Uint8Array(cols * rows);
  const field = { grid, cols, rows, cellSize, width, height };
  const offsets = [-width, 0, width];
  for (const land of lands) {
    const poly = land && land.poly;
    if (!Array.isArray(poly) || poly.length < 3) continue;
    let minX = Infinity;
    let maxX = -Infinity;
    for (const point of poly) {
      if (point[0] < minX) minX = point[0];
      if (point[0] > maxX) maxX = point[0];
    }
    for (const offset of offsets) {
      if (maxX + offset < 0 || minX + offset >= width) continue;
      rasterizePolygon(field, poly, offset);
    }
  }
  return field;
}

function rasterizePolygon(field, poly, offset) {
  const { cols, rows, cellSize, grid } = field;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of poly) {
    if (point[1] < minY) minY = point[1];
    if (point[1] > maxY) maxY = point[1];
  }
  let r0 = Math.floor(minY / cellSize);
  let r1 = Math.floor(maxY / cellSize);
  if (r0 < 0) r0 = 0;
  if (r1 >= rows) r1 = rows - 1;
  const last = poly[poly.length - 1];
  for (let r = r0; r <= r1; r += 1) {
    const y = (r + 0.5) * cellSize;
    const crossings = [];
    let px = last[0];
    let py = last[1];
    for (let i = 0; i < poly.length; i += 1) {
      const cx = poly[i][0];
      const cy = poly[i][1];
      if (py > y !== cy > y) {
        crossings.push(((cx - px) * (y - py)) / (cy - py + EPS) + px + offset);
      }
      px = cx;
      py = cy;
    }
    if (crossings.length < 2) continue;
    crossings.sort((a, b) => a - b);
    const base = r * cols;
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      let c0 = Math.floor(crossings[k] / cellSize);
      let c1 = Math.floor(crossings[k + 1] / cellSize);
      if (c0 < 0) c0 = 0;
      if (c1 >= cols) c1 = cols - 1;
      for (let c = c0; c <= c1; c += 1) grid[base + c] = 1;
    }
  }
}

function wrapCol(field, col) {
  const { cols } = field;
  return ((col % cols) + cols) % cols;
}

function cellCenterWorld(field, col, row) {
  const c = wrapCol(field, col);
  return [
    c * field.cellSize + field.cellSize / 2,
    row * field.cellSize + field.cellSize / 2,
  ];
}

function isCellBlocked(field, col, row) {
  if (row < 0 || row >= field.rows) return true;
  return field.grid[row * field.cols + wrapCol(field, col)] === 1;
}

// True when no land cell lies under (or, with padding, near) the segment. The
// segment is walked in the wrapped-x direction at half-cell spacing so a thin
// spur between samples can't slip through.
export function segmentClear(field, ax, ay, bx, by, { padding = 0 } = {}) {
  const dx = wrappedDelta(bx, ax, field.width);
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-9) return cellOpenAt(field, ax, ay, padding);
  const step = field.cellSize / 2;
  const count = Math.max(1, Math.ceil(dist / step));
  for (let i = 0; i <= count; i += 1) {
    const t = i / count;
    if (!cellOpenAt(field, ax + dx * t, ay + dy * t, padding)) return false;
  }
  return true;
}

function cellOpenAt(field, x, y, padding) {
  const { cols, rows, grid } = field;
  const col = Math.floor(wrap(x, field.width) / field.cellSize);
  const row = Math.floor(y / field.cellSize);
  if (row < 0 || row >= rows) return false;
  for (let dr = -padding; dr <= padding; dr += 1) {
    const rr = row + dr;
    if (rr < 0 || rr >= rows) continue;
    for (let dc = -padding; dc <= padding; dc += 1) {
      const cc = wrapCol(field, col + dc);
      if (grid[rr * cols + cc]) return false;
    }
  }
  return true;
}

function snapToOpenCell(field, x, y, towardX, towardY, ring) {
  const startCol = Math.floor(wrap(x, field.width) / field.cellSize);
  const startRow = Math.floor(y / field.cellSize);
  const gx = wrappedDelta(towardX, x, field.width);
  const gy = towardY - y;
  const glen = Math.hypot(gx, gy) || 1;
  const ux = gx / glen;
  const uy = gy / glen;
  for (let radius = 0; radius <= ring; radius += 1) {
    let best = null;
    let bestScore = -Infinity;
    for (let dr = -radius; dr <= radius; dr += 1) {
      for (let dc = -radius; dc <= radius; dc += 1) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
        const col = startCol + dc;
        const row = startRow + dr;
        if (isCellBlocked(field, col, row)) continue;
        const [wx, wy] = cellCenterWorld(field, col, row);
        const vx = wrappedDelta(wx, x, field.width);
        const vy = wy - y;
        const vlen = Math.hypot(vx, vy) || 1;
        const score = (vx * ux + vy * uy) / vlen;
        if (score > bestScore) {
          bestScore = score;
          best = { col, row };
        }
      }
    }
    if (best) return best;
  }
  return null;
}

function heuristic(field, aCol, aRow, gCol, gRow) {
  const dc = Math.abs(wrappedDelta(gCol, aCol, field.cols));
  const dr = Math.abs(gRow - aRow);
  const min = Math.min(dc, dr);
  return dc + dr - min + min * SQRT2;
}

function createHeap() {
  const keys = [];
  const pris = [];
  let size = 0;
  return {
    push(key, pri) {
      keys[size] = key;
      pris[size] = pri;
      size += 1;
      let i = size - 1;
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (pris[parent] <= pris[i]) break;
        const tp = pris[parent];
        pris[parent] = pris[i];
        pris[i] = tp;
        const tk = keys[parent];
        keys[parent] = keys[i];
        keys[i] = tk;
        i = parent;
      }
    },
    pop() {
      if (size === 0) return -1;
      const topKey = keys[0];
      size -= 1;
      keys[0] = keys[size];
      pris[0] = pris[size];
      let i = 0;
      while (true) {
        const left = 2 * i + 1;
        const right = 2 * i + 2;
        let smallest = i;
        if (left < size && pris[left] < pris[smallest]) smallest = left;
        if (right < size && pris[right] < pris[smallest]) smallest = right;
        if (smallest === i) break;
        const tp = pris[smallest];
        pris[smallest] = pris[i];
        pris[i] = tp;
        const tk = keys[smallest];
        keys[smallest] = keys[i];
        keys[i] = tk;
        i = smallest;
      }
      return topKey;
    },
  };
}

// A* over the land grid from (ax,ay) to (bx,by). Returns a list of [x,y]
// waypoints in world coordinates (each in [0,width)) or null if no route is
// found within maxNodes. Start/goal are snapped toward the other endpoint so a
// coastal port can still begin and end. The search wraps in x.
export function findSeaPath(
  field,
  ax,
  ay,
  bx,
  by,
  { maxNodes = 12000, snapRing = 6 } = {},
) {
  const start = snapToOpenCell(field, ax, ay, bx, by, snapRing);
  if (!start) return null;
  const goal = snapToOpenCell(field, bx, by, ax, ay, snapRing);
  if (!goal) return null;

  const { cols, rows } = field;
  const startKey = start.row * cols + wrapCol(field, start.col);
  const goalKey = goal.row * cols + wrapCol(field, goal.col);
  if (startKey === goalKey) return null;

  const heap = createHeap();
  const gScore = new Map();
  const cameFrom = new Map();
  const closed = new Set();
  gScore.set(startKey, 0);
  heap.push(
    startKey,
    heuristic(field, start.col, start.row, goal.col, goal.row),
  );

  let expanded = 0;
  let current;
  while ((current = heap.pop()) !== -1) {
    if (closed.has(current)) continue;
    closed.add(current);
    expanded += 1;
    if (expanded > maxNodes) return null;
    if (current === goalKey) {
      return reconstructPath(field, cameFrom, current, startKey);
    }
    const cRow = Math.floor(current / cols);
    const cCol = current - cRow * cols;
    const g = gScore.get(current);
    for (const [dc, dr, diagonal] of DIRECTIONS) {
      const nRow = cRow + dr;
      if (nRow < 0 || nRow >= rows) continue;
      const nCol = cCol + dc;
      if (isCellBlocked(field, nCol, nRow)) continue;
      if (diagonal) {
        if (isCellBlocked(field, cCol + dc, cRow)) continue;
        if (isCellBlocked(field, cCol, cRow + dr)) continue;
      }
      const nKey = nRow * cols + wrapCol(field, nCol);
      if (closed.has(nKey)) continue;
      const tentative = g + (diagonal ? SQRT2 : 1);
      if (tentative < (gScore.get(nKey) ?? Infinity)) {
        gScore.set(nKey, tentative);
        cameFrom.set(nKey, current);
        heap.push(
          nKey,
          tentative + heuristic(field, nCol, nRow, goal.col, goal.row),
        );
      }
    }
  }
  return null;
}

function reconstructPath(field, cameFrom, current, startKey) {
  const path = [];
  let key = current;
  while (key !== undefined) {
    const row = Math.floor(key / field.cols);
    const col = key - row * field.cols;
    path.push(cellCenterWorld(field, col, row));
    if (key === startKey) break;
    key = cameFrom.get(key);
  }
  path.reverse();
  return path;
}

// Greedy line-of-sight simplification: from each kept point, jump to the
// farthest later point whose direct segment is land-free. Never introduces a
// land-crossing segment.
export function smoothSeaPath(field, points) {
  if (points.length < 2) return points.map((point) => [point[0], point[1]]);
  const out = [points[0]];
  let i = 0;
  while (i < points.length - 1) {
    let j = points.length - 1;
    while (j > i + 1) {
      if (
        segmentClear(
          field,
          points[i][0],
          points[i][1],
          points[j][0],
          points[j][1],
        )
      )
        break;
      j -= 1;
    }
    out.push(points[j]);
    i = j;
  }
  return out;
}

function samePoint(field, a, b) {
  return (
    Math.abs(wrappedDelta(b[0], a[0], field.width)) < 0.5 &&
    Math.abs(b[1] - a[1]) < 0.5
  );
}

// Nearest open-water cell centre to (x, y) within `ring` cells (searching every
// direction), or null if none. Used to lift waypoints that the world transform
// dropped onto a coast back into the sea.
function nearestOpenCellWorld(field, x, y, ring) {
  const col = Math.floor(wrap(x, field.width) / field.cellSize);
  const row = Math.floor(y / field.cellSize);
  let best = null;
  let bestDist = Infinity;
  for (let dr = -ring; dr <= ring; dr += 1) {
    const r = row + dr;
    if (r < 0 || r >= field.rows) continue;
    for (let dc = -ring; dc <= ring; dc += 1) {
      if (isCellBlocked(field, col + dc, r)) continue;
      const [wx, wy] = cellCenterWorld(field, col + dc, r);
      const d = Math.hypot(wrappedDelta(wx, x, field.width), wy - y);
      if (d < bestDist) {
        bestDist = d;
        best = [wx, wy];
      }
    }
  }
  return best;
}

// Lift a waypoint that the world transform dropped onto land to the nearest
// open water within `ring` cells. Returns null when no water is in reach (the
// waypoint is deep inland); the caller drops such waypoints rather than
// forcing a route through them.
function snapWaypoint(field, point, ring) {
  if (cellOpenAt(field, point[0], point[1], 0)) return [point[0], point[1]];
  return nearestOpenCellWorld(field, point[0], point[1], ring);
}

// Bake a land-avoiding version of a lane's waypoints. Waypoints on land are
// lifted to the nearest open water; ones too far inland to snap are dropped so
// the route runs between their (sea-going) neighbours instead. Each consecutive
// pair is kept straight when already clear, otherwise re-routed via findSeaPath;
// a pair with no route falls back to its straight segment (never worse than
// authored). Output stays in [0,width) with consecutive points within width/2,
// so orientRoute/unwrapPath reconstruct it downstream.
export function routeLaneAroundLand(field, waypoints, { snapRing = 24 } = {}) {
  if (!Array.isArray(waypoints) || waypoints.length < 2) {
    return (waypoints || []).map((point) => [point[0], point[1]]);
  }
  const snapped = waypoints
    .map((point) => snapWaypoint(field, point, snapRing))
    .filter(Boolean);
  if (snapped.length < 2) {
    return waypoints.map((point) => [point[0], point[1]]);
  }
  const out = [];
  for (let i = 0; i < snapped.length - 1; i += 1) {
    const a = snapped[i];
    const b = snapped[i + 1];
    let leg;
    if (segmentClear(field, a[0], a[1], b[0], b[1])) {
      leg = [a, b];
    } else {
      const path = findSeaPath(field, a[0], a[1], b[0], b[1]);
      leg = path ? [a, ...smoothSeaPath(field, path), b] : [a, b];
    }
    for (const point of leg) {
      const copy = [point[0], point[1]];
      if (out.length && samePoint(field, out[out.length - 1], copy)) continue;
      out.push(copy);
    }
  }
  return out;
}
