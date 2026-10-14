import { causticPoint } from "./sea-optics.js";

// Interfering wave fronts make an irregular light field. All longitude waves
// complete an integer number of periods, so the pattern crosses the world seam.
function lightField(x, y, time, worldWidth, frequencies, point) {
  const warped = causticPoint(x, y, time, worldWidth, point);
  const longitude =
    ((((warped.x % worldWidth) + worldWidth) % worldWidth) / worldWidth) *
    Math.PI *
    2;
  return (
    Math.sin(longitude * frequencies[0] + warped.y * 0.049 + time * 0.37) *
      0.56 +
    Math.sin(longitude * frequencies[1] - warped.y * 0.067 - time * 0.29) *
      0.31 +
    Math.cos(longitude * frequencies[2] + warped.y * 0.031 - time * 0.19) *
      0.24 +
    Math.sin(longitude * frequencies[3] + warped.y * 0.083 + time * 0.23) *
      0.13 -
    0.16
  );
}

// Trace smooth contours rather than drawing the sampling grid. Some portions
// dissolve in the slowly moving light envelope, leaving broken, unequal ribbons.
export function causticContours(bounds, time, worldWidth, detail = 1) {
  if (
    worldWidth <= 0 ||
    bounds.right <= bounds.left ||
    bounds.bottom <= bounds.top
  )
    return [];
  const columns = Math.max(
    2,
    Math.ceil(worldWidth / (detail >= 0.9 ? 16 : 24)),
  );
  const spacing = worldWidth / columns;
  const first = Math.floor(bounds.left / spacing),
    last = Math.ceil(bounds.right / spacing);
  const top = Math.floor(bounds.top / spacing),
    bottom = Math.ceil(bounds.bottom / spacing);
  const stride = last - first + 1;
  const samples = new Float64Array(stride * (bottom - top + 1));
  const vertices = new Array(samples.length * 2),
    junctions = [],
    edges = [];
  const sampleIndex = (column, row) => (row - top) * stride + column - first;
  const frequencies = [137, 91, 213, 57].map((wavelength) =>
    Math.max(1, Math.round(worldWidth / wavelength)),
  );
  const point = {};
  for (let row = top; row <= bottom; row++) {
    for (let column = first; column <= last; column++) {
      samples[sampleIndex(column, row)] = lightField(
        column * spacing,
        row * spacing,
        time,
        worldWidth,
        frequencies,
        point,
      );
    }
  }
  const vertex = (column, row, horizontal) => {
    const index = sampleIndex(column, row);
    const key = index * 2 + (horizontal ? 0 : 1);
    if (!vertices[key]) {
      const a = samples[index],
        b = samples[index + (horizontal ? 1 : stride)];
      const t = a / (a - b);
      vertices[key] = {
        x: (column + (horizontal ? t : 0)) * spacing,
        y: (row + (horizontal ? 0 : t)) * spacing,
        links: [],
      };
      junctions.push(vertices[key]);
    }
    return vertices[key];
  };
  const pointForSide = (side, column, row) =>
    vertex(
      column + (side === 1 ? 1 : 0),
      row + (side === 2 ? 1 : 0),
      side % 2 === 0,
    );
  const connect = (a, b) => {
    const edge = { a, b, visited: false };
    a.links.push(edge);
    b.links.push(edge);
    edges.push(edge);
  };
  for (let column = first; column < last; column++) {
    for (let row = top; row < bottom; row++) {
      const longitude =
        ((((column % columns) + columns) % columns) / columns) * Math.PI * 2;
      const shimmer =
        Math.sin(longitude * 11 + row * spacing * 0.019 + time * 0.17) +
        Math.cos(longitude * 17 - row * spacing * 0.026 - time * 0.13) * 0.55;
      if (shimmer < -0.65) continue;
      const index = sampleIndex(column, row);
      const values = [
        samples[index],
        samples[index + 1],
        samples[index + stride + 1],
        samples[index + stride],
      ];
      const crossings = [];
      for (let side = 0; side < 4; side++) {
        const above = values[side] >= 0;
        const nextAbove = values[(side + 1) % 4] >= 0;
        if (above === nextAbove) continue;
        crossings.push(side);
      }
      if (!crossings.length) continue;
      if (crossings.length === 2)
        connect(
          pointForSide(crossings[0], column, row),
          pointForSide(crossings[1], column, row),
        );
      else {
        // Resolve saddles using the central field value, avoiding X-shaped joins.
        const center = values.reduce((sum, value) => sum + value, 0) / 4;
        const centerAbove = center >= 0,
          cornerAbove = values[0] >= 0;
        const pairs =
          centerAbove === cornerAbove
            ? [
                [0, 1],
                [2, 3],
              ]
            : [
                [0, 3],
                [1, 2],
              ];
        for (const [a, b] of pairs)
          connect(pointForSide(a, column, row), pointForSide(b, column, row));
      }
    }
  }
  const paths = [];
  const trace = (start) => {
    const path = [];
    let current = start;
    while (current) {
      path.push({ x: current.x, y: current.y });
      const edge = current.links.find((link) => !link.visited);
      if (!edge) break;
      edge.visited = true;
      current = edge.a === current ? edge.b : edge.a;
      if (current === start) {
        path.push({ x: current.x, y: current.y });
        break;
      }
    }
    // Tiny intersections flicker like isolated dashes. Keep only flowing arcs.
    if (path.length >= 3) paths.push(path);
  };
  for (const point of junctions) if (point.links.length === 1) trace(point);
  for (const edge of edges) if (!edge.visited) trace(edge.a);
  return paths;
}
