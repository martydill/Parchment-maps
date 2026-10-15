import {
  createObstacleFlow,
  createObstacleFoam,
} from "./core/obstacle-foam.js";
import { nearestWrapped, clamp } from "./core/math.js";
import { createAlphaPalette } from "./style-palette.js";

const foamInk = createAlphaPalette("250,247,221", 0, 0.65, 48);
const waterInk = createAlphaPalette("30,90,91", 0, 0.14, 24);

export function createObstacleFoamRendering({ WORLD, coasts, currents }) {
  let simulation;
  let masks = [];
  function setHarbors(harbors) {
    const obstacles = coasts.flatMap(({ poly, depth, shoreline }) => [
      {
        poly,
        depth,
        kind: shoreline.every((s) => s.kind === "marsh") ? "marsh" : "rock",
      },
      { poly, kind: "solid" },
    ]);
    simulation = createObstacleFoam(
      createObstacleFlow([...obstacles, ...harbors], WORLD.w, currents),
      WORLD.w,
    );
    masks = harbors.map(({ poly }) => {
      const mask = new Path2D();
      mask.rect(-WORLD.w, -WORLD.h, WORLD.w * 3, WORLD.h * 3);
      poly.forEach(([x, y], index) =>
        index ? mask.lineTo(x, y) : mask.moveTo(x, y),
      );
      mask.closePath();
      return { mask, x: poly[0][0], y: poly[0][1] };
    });
  }
  setHarbors([]);
  return {
    setHarbors,
    draw(
      c,
      { camera, time, roughness, windAngle, detail, view, reducedMotion },
    ) {
      const particles = simulation.update(reducedMotion ? 0 : time, {
        view,
        roughness,
        windAngle,
        detail,
      });
      c.save();
      for (const { mask, x, y } of masks) {
        const offset = nearestWrapped(x, camera.x, WORLD.w) - x;
        if (
          x + offset < view.left - 100 ||
          x + offset > view.right + 100 ||
          y < view.top - 100 ||
          y > view.bottom + 100
        )
          continue;
        c.translate(offset, 0);
        c.clip(mask, "evenodd");
        c.translate(-offset, 0);
      }
      c.lineCap = "round";
      c.lineJoin = "round";
      // A quiet blue trough seats the luminous broken filaments in the water.
      // Both passes follow retained world-space history, including old gusts.
      for (const underpaint of [true, false]) {
        c.lineWidth = underpaint ? 2.4 : clamp(0.65 / camera.zoom, 0.5, 1.15);
        for (const p of particles) {
          if (p.trail.length < 2) continue;
          const fade = Math.min(1, p.age / 0.6) * (1 - p.age / p.life) ** 1.4;
          c.strokeStyle = underpaint
            ? waterInk(fade * 0.12)
            : foamInk(fade * (0.35 + p.grain * 0.3));
          const offset = nearestWrapped(p.x, camera.x, WORLD.w) - p.x;
          c.beginPath();
          for (let i = 0; i < p.trail.length; i++) {
            const point = p.trail[i];
            // Broken tails keep the effect organic instead of drawing contours.
            if (i === 0 || (!underpaint && i === 3 && p.grain > 0.45))
              c.moveTo(point.x + offset, point.y);
            else c.lineTo(point.x + offset, point.y);
          }
          c.lineTo(p.x + offset, p.y);
          c.stroke();
        }
      }
      c.restore();
    },
  };
}
