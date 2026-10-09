import { harborSkyline } from "./core/harbor-composition.js";
import { getHarborLayout } from "./harbor-layouts.js";

const skylines = new Map();

// Quiet silhouettes establish identity behind the detailed working quay.
// They remain still; the eye is drawn to the foreground's two activity sites.
export function drawHarborSkyline(c, name, width, height, palette, lighting) {
  if (!skylines.has(name))
    skylines.set(name, harborSkyline(getHarborLayout(name)));
  c.save();
  const baseline = height * 0.635;
  for (const building of skylines.get(name)) {
    const x = width * building.x;
    const w = width * building.width * 0.7;
    const h = height * building.height;
    const y = baseline - h;
    c.fillStyle = palette.ridge;
    c.globalAlpha = building.signature ? 0.56 : 0.3;
    if (building.type !== "ribs") c.fillRect(x - w / 2, y, w, h);
    c.beginPath();
    switch (building.type) {
      case "dome":
      case "furnace":
        c.ellipse(x, y, w / 2, h * 0.22, 0, Math.PI, Math.PI * 2);
        break;
      case "keep":
      case "turret":
        for (let tooth = 0; tooth < 4; tooth++)
          c.fillRect(
            x - w / 2 + (tooth * w) / 4,
            y - h * 0.07,
            w / 7,
            h * 0.08,
          );
        break;
      case "lighthouse":
        c.fillRect(x - w * 0.7, y + h * 0.12, w * 1.4, h * 0.05);
        c.moveTo(x - w * 0.6, y);
        c.lineTo(x, y - h * 0.12);
        c.lineTo(x + w * 0.6, y);
        break;
      case "windmill":
        c.save();
        c.translate(x, y + h * 0.2);
        c.rotate(0.4);
        for (let sail = 0; sail < 4; sail++) {
          c.rotate(Math.PI / 2);
          c.fillRect(-w * 0.1, -h * 0.35, w * 0.22, h * 0.35);
        }
        c.restore();
        break;
      case "ribs":
        c.strokeStyle = palette.ridge;
        c.lineWidth = Math.max(1, height / 150);
        for (let rib = 0; rib < 5; rib++) {
          c.beginPath();
          c.ellipse(
            x + (rib - 2) * w * 0.25,
            baseline,
            w * 0.3,
            h * 0.6,
            0,
            Math.PI,
            Math.PI * 2,
          );
          c.stroke();
        }
        break;
      case "flat":
      case "chimney":
        break;
      default:
        c.moveTo(x - w * 0.6, y);
        c.lineTo(x, y - h * (building.type === "spire" ? 0.3 : 0.16));
        c.lineTo(x + w * 0.6, y);
    }
    if (building.type === "ribs") continue;
    c.fill();
    c.fillStyle = "#ffd08b";
    c.globalAlpha = lighting.night * (building.signature ? 0.65 : 0.25);
    c.fillRect(x - w * 0.08, y + h * 0.28, w * 0.16, h * 0.12);
  }
  c.restore();
}
