export function drawCourseLine(
  c,
  points,
  { sx = 1, sy = 1, zoom = 1, offsets = [0] } = {},
) {
  if (points.length < 2) return;
  c.save();
  c.strokeStyle = "rgba(100, 159, 148, .58)";
  c.lineWidth = 1.5 / zoom;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.setLineDash([6 / zoom, 6 / zoom]);
  c.beginPath();
  for (const offset of offsets) {
    points.forEach(([x, y], index) => {
      if (index === 0) c.moveTo((x + offset) * sx, y * sy);
      else c.lineTo((x + offset) * sx, y * sy);
    });
  }
  c.stroke();
  c.restore();
}
