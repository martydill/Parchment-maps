import { tidelineRingPoints } from "./core/chart-decor.js";
import {
  advanceChartSpray,
  chartSprayAppearance,
  createChartSpray,
} from "./core/chart-spray.js";

export function createChartSprayRendering() {
  const beads = createChartSpray();
  return {
    update(seconds, arc) {
      advanceChartSpray(
        beads,
        seconds,
        arc.stage === "tempest" && arc.grade === 4,
      );
    },
    draw(c, { vw, vh, particleScale = 1 }) {
      c.save();
      const alpha = c.globalAlpha;
      for (const bead of beads.slice(
        0,
        Math.ceil(beads.length * particleScale),
      )) {
        const { wet, mark, radiusScale } = chartSprayAppearance(bead.age);
        if (wet + mark <= 0) continue;
        const x = bead.x * vw,
          y = bead.y * vh;
        const radius = bead.radius * radiusScale;
        c.beginPath();
        tidelineRingPoints(
          x,
          y,
          bead.radius * 1.12,
          7,
          0.075,
          bead.index,
        ).forEach(([px, py], index) => {
          if (index) c.lineTo(px, py);
          else c.moveTo(px, py);
        });
        c.globalAlpha = alpha * mark * 0.19;
        c.strokeStyle = "#735334";
        c.lineWidth = 0.8;
        c.stroke();
        if (!wet) continue;
        c.globalAlpha = alpha * wet;
        c.fillStyle = "rgba(34,60,63,.17)";
        c.beginPath();
        c.ellipse(
          x + 1.8,
          y + 2.5,
          radius * 1.12,
          radius * 0.87,
          0,
          0,
          Math.PI * 2,
        );
        c.fill();
        c.fillStyle = "rgba(191,226,227,.22)";
        c.beginPath();
        c.ellipse(x, y, radius, radius * 0.83, 0, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = "rgba(227,247,244,.7)";
        c.lineWidth = 1.1;
        c.beginPath();
        c.ellipse(
          x - radius * 0.14,
          y - radius * 0.18,
          radius * 0.62,
          radius * 0.46,
          -0.3,
          Math.PI,
          Math.PI * 1.65,
        );
        c.stroke();
      }
      c.restore();
    },
  };
}
