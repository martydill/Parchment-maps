import { findSeaPath, smoothSeaPath } from "./navfield.js";
import { pathLength, unwrapPath } from "./routes.js";

// Use the same coastal clearance for passage estimates and the merchant pilot.
// One cell leaves room for the hull without closing navigable narrow straits.
export function createPassagePlanner(
  field,
  { margin = 58, clearance = 1 } = {},
) {
  const grid = new Uint8Array(field.grid.length);
  for (let row = 0; row < field.rows; row++) {
    for (let col = 0; col < field.cols; col++) {
      const y = (row + 0.5) * field.cellSize;
      let blocked = y < margin || y > field.height - margin;
      for (let dr = -clearance; dr <= clearance && !blocked; dr++) {
        const r = row + dr;
        if (r < 0 || r >= field.rows) continue;
        for (let dc = -clearance; dc <= clearance; dc++) {
          const c = (col + dc + field.cols) % field.cols;
          if (field.grid[r * field.cols + c]) {
            blocked = true;
            break;
          }
        }
      }
      grid[row * field.cols + col] = Number(blocked);
    }
  }
  const safe = { ...field, grid };
  const search = { maxNodes: grid.length, snapRing: 12 };
  return {
    field: safe,
    plan(origin, destination) {
      const path = findSeaPath(
        safe,
        origin.x,
        origin.y,
        destination.x,
        destination.y,
        search,
      );
      if (!path) return null;
      const points = smoothSeaPath(safe, path);
      const approachFrom = points.at(-1);
      // Finish the coastal approach in actual open water, where the wider
      // clearance corridor can end outside docking range.
      const approach = findSeaPath(
        field,
        ...approachFrom,
        destination.x,
        destination.y,
        search,
      );
      if (approach) points.push(...smoothSeaPath(field, approach).slice(1));
      const distance = pathLength(
        unwrapPath(
          [[origin.x, origin.y], ...points, [destination.x, destination.y]],
          origin.x,
          field.width,
        ),
      );
      return { points, approachFrom, distance };
    },
  };
}
