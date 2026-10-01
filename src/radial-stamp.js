// Bake the circular falloff and its elliptical clipping together. Stretching
// a circular gradient to an ellipse would change the original light profile.
export function createRadialStamp({
  stops,
  innerRadius = 0,
  aspectRatio = 1,
  size = 128,
  canvas = document.createElement("canvas"),
}) {
  canvas.width = canvas.height = size;
  const c = canvas.getContext("2d");
  const radius = size / 2;
  const gradient = c.createRadialGradient(
    radius,
    radius,
    radius * innerRadius,
    radius,
    radius,
    radius,
  );
  for (const [position, color] of stops) gradient.addColorStop(position, color);
  c.fillStyle = gradient;
  c.beginPath();
  c.ellipse(radius, radius, radius, radius * aspectRatio, 0, 0, Math.PI * 2);
  c.fill();
  return canvas;
}
