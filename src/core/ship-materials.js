// Cut evenly spaced cloth seams through a bowed triangle in model space.
// Adjacent triangles share the same seam stations, including torn sail cells.
export function sailStitchLines(vertices) {
  const left = Math.min(...vertices.map(([x]) => x));
  const right = Math.max(...vertices.map(([x]) => x));
  const lines = [];
  for (let across = Math.ceil(left / 3) * 3; across < right; across += 3) {
    const points = [];
    for (let index = 0; index < vertices.length; index++) {
      const a = vertices[index];
      const b = vertices[(index + 1) % vertices.length];
      if (
        (a[0] <= across && b[0] > across) ||
        (b[0] <= across && a[0] > across)
      ) {
        const ratio = (across - a[0]) / (b[0] - a[0]);
        points.push(a.map((value, axis) => value + (b[axis] - value) * ratio));
      }
    }
    if (
      points.length === 2 &&
      Math.hypot(...points[0].map((value, axis) => value - points[1][axis])) >
        0.001
    )
      lines.push(points);
  }
  return lines;
}
