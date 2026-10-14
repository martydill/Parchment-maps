import { MAP_TILT_COS } from "./core/projection.js";
import { nearestWrapped } from "./core/math.js";
import { shallowLightStrength } from "./core/sea-optics.js";
import { causticContours } from "./core/caustics.js";
import { createRenderCadence } from "./core/render-quality.js";
import { createRadialStamp } from "./radial-stamp.js";

// Two bounded surfaces let the entire lace meet the depth mask in one blend.
// Coast strokes feather offshore; shoals use their actual chart silhouettes.
export function createShallowCausticsRendering({
  WORLD,
  visibleCoasts,
  clipWater,
}) {
  const cadence = createRenderCadence(1000 / 30, 48);
  let layer, mask, lace, web, feather, anchor;
  const scale = 0.75;
  const padding = 64;
  return {
    draw(c, options) {
      const { camera, vw, vh, lighting, shoals = [], detail = 1 } = options;
      const strength = shallowLightStrength(lighting);
      if (strength < 0.015) return;
      const time = options.reducedMotion ? 0 : options.time;
      const z = camera.zoom;
      const width = Math.ceil((vw + padding * 2) * scale);
      const height = Math.ceil((vh + padding * 2) * scale);
      const halfW = width / (2 * z * scale);
      const halfH = height / (2 * z * MAP_TILT_COS * scale);
      const coasts = visibleCoasts(camera, width / scale, height / scale);
      if (
        !coasts.length &&
        !shoals.some(
          ({ sx, sy, rx, ry }) =>
            Math.abs(nearestWrapped(sx, camera.x, WORLD.w) - camera.x) <=
              halfW + rx && Math.abs(sy - camera.y) <= halfH + ry,
        )
      )
        return;
      const key = `${z}:${detail}:${strength.toFixed(3)}:${c.globalAlpha}:${lighting?.daylight ?? 1}`;
      if (
        cadence.shouldRender(time, {
          x: camera.x * z,
          y: camera.y * z * MAP_TILT_COS,
          width,
          height,
          key,
        })
      ) {
        layer ||= document.createElement("canvas");
        lace ||= document.createElement("canvas");
        mask ||= layer.getContext("2d");
        web ||= lace.getContext("2d");
        feather ||= createRadialStamp({
          stops: [
            [0, "#fff"],
            [0.6, "rgba(255,255,255,0.8)"],
            [1, "rgba(255,255,255,0)"],
          ],
        });
        for (const [canvas, context] of [
          [layer, mask],
          [lace, web],
        ]) {
          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
          }
          context.setTransform(1, 0, 0, 1, 0, 0);
          context.globalCompositeOperation = "source-over";
          context.globalAlpha = 1;
          context.clearRect(0, 0, width, height);
          context.setTransform(
            z * scale,
            0,
            0,
            z * MAP_TILT_COS * scale,
            width / 2 - camera.x * z * scale,
            height / 2 - camera.y * z * MAP_TILT_COS * scale,
          );
        }
        mask.save();
        clipWater(mask, coasts);
        mask.lineJoin = "round";
        for (const { surf, offset } of coasts) {
          mask.save();
          mask.translate(offset, 0);
          for (const [width, alpha] of [
            [120, 0.1],
            [82, 0.22],
            [42, 0.5],
          ]) {
            mask.lineWidth = width;
            mask.strokeStyle = `rgba(255,255,255,${alpha})`;
            mask.stroke(surf);
          }
          mask.restore();
        }
        for (const { sx, sy, rx, ry, shelf } of shoals) {
          const base = nearestWrapped(sx, camera.x, WORLD.w);
          for (const x of [base - WORLD.w, base, base + WORLD.w]) {
            if (
              Math.abs(x - camera.x) > halfW + rx ||
              Math.abs(sy - camera.y) > halfH + ry
            )
              continue;
            mask.save();
            mask.translate(x, sy);
            mask.clip(shelf);
            mask.drawImage(feather, -rx, -ry, rx * 2, ry * 2);
            mask.restore();
          }
        }
        mask.restore();

        const ribbons = causticContours(
          {
            left: camera.x - halfW,
            right: camera.x + halfW,
            top: camera.y - halfH,
            bottom: camera.y + halfH,
          },
          time / 1000,
          WORLD.w,
          detail,
        );
        web.beginPath();
        for (const points of ribbons) {
          web.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length - 1; i++) {
            web.quadraticCurveTo(
              points[i].x,
              points[i].y,
              (points[i].x + points[i + 1].x) / 2,
              (points[i].y + points[i + 1].y) / 2,
            );
          }
          web.lineTo(points.at(-1).x, points.at(-1).y);
        }
        web.lineJoin = "round";
        web.lineCap = "round";
        const moonlit = (lighting?.daylight ?? 1) < 0.3;
        web.strokeStyle = moonlit
          ? "rgba(170,218,255,0.12)"
          : "rgba(211,255,214,0.12)";
        web.lineWidth = 4 / Math.sqrt(z);
        web.stroke();
        web.strokeStyle = moonlit
          ? "rgba(225,244,255,0.48)"
          : "rgba(250,255,218,0.5)";
        web.lineWidth = 1.24 / Math.sqrt(z);
        web.stroke();
        mask.setTransform(1, 0, 0, 1, 0, 0);
        mask.globalCompositeOperation = "source-in";
        mask.drawImage(lace, 0, 0);
        mask.globalCompositeOperation = "source-over";
        anchor = { ...camera };
      }
      c.save();
      c.globalCompositeOperation = "overlay";
      c.globalAlpha *= strength;
      c.drawImage(
        layer,
        anchor.x - width / (2 * z * scale),
        anchor.y - height / (2 * z * MAP_TILT_COS * scale),
        width / (z * scale),
        height / (z * MAP_TILT_COS * scale),
      );
      c.restore();
    },
  };
}
