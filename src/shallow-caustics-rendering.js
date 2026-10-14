import { MAP_TILT_COS } from "./core/projection.js";
import { nearestWrapped } from "./core/math.js";
import { shallowLightStrength } from "./core/sea-optics.js";
import { causticContours } from "./core/caustics.js";
import { createRenderCadence } from "./core/render-quality.js";
import { createRadialStamp } from "./radial-stamp.js";

// Bounded light and depth plates meet in one composite. The depth mask stays
// cached while the light animates; shoals use their actual chart silhouettes.
export function createShallowCausticsRendering({
  WORLD,
  visibleCoasts,
  clipWater,
}) {
  const cadence = createRenderCadence(1000 / 30, 48);
  const maskCadence = createRenderCadence(Infinity, 48);
  let layer, composite, depthLayer, mask, lace, web, feather, anchor;
  let maskRevision = 0;
  const shapeIds = new WeakMap();
  let nextShapeId = 0;
  function shapeId(shape) {
    if (!shapeIds.has(shape)) shapeIds.set(shape, ++nextShapeId);
    return shapeIds.get(shape);
  }
  const scale = 0.75;
  const padding = 64;
  return {
    draw(c, options) {
      const { camera, vw, vh, lighting, shoals = [], detail = 1 } = options;
      const strength = shallowLightStrength(lighting);
      if (strength < 0.015) return;
      const time = options.reducedMotion ? 0 : options.time;
      const z = camera.zoom;
      const radius = (options.focus?.radius ?? 480) + 160;
      const width = Math.ceil(
        (Math.min(vw, options.focus ? radius * 2 * z : vw) + padding * 2) *
          scale,
      );
      const height = Math.ceil(
        (Math.min(vh, options.focus ? radius * 2 * z * MAP_TILT_COS : vh) +
          padding * 2) *
          scale,
      );
      const center = options.focus
        ? {
            ...camera,
            x: nearestWrapped(options.focus.x, camera.x, WORLD.w),
            y: options.focus.y,
          }
        : camera;
      const halfW = width / (2 * z * scale);
      const halfH = height / (2 * z * MAP_TILT_COS * scale);
      const coasts = visibleCoasts(center, width / scale, height / scale);
      if (
        !coasts.length &&
        !shoals.some(
          ({ sx, sy, rx, ry }) =>
            Math.abs(nearestWrapped(sx, center.x, WORLD.w) - center.x) <=
              halfW + rx && Math.abs(sy - center.y) <= halfH + ry,
        )
      )
        return;
      const maskKey = `${z}:${coasts.map((coast) => `${coast.index}:${coast.offset}`).join(";")}:${shoals.map((shoal) => `${shoal.sx},${shoal.sy},${shoal.rx},${shoal.ry},${shapeId(shoal.shelf)}`).join(";")}`;
      const maskChanged = maskCadence.shouldRender(0, {
        x: center.x * z,
        y: center.y * z * MAP_TILT_COS,
        width,
        height,
        key: maskKey,
      });
      if (maskChanged) {
        anchor = { ...center };
        maskRevision++;
        layer ||= document.createElement("canvas");
        depthLayer ||= document.createElement("canvas");
        lace ||= document.createElement("canvas");
        composite ||= layer.getContext("2d");
        mask ||= depthLayer.getContext("2d");
        web ||= lace.getContext("2d");
        feather ||= createRadialStamp({
          stops: [
            [0, "#fff"],
            [0.6, "rgba(255,255,255,0.8)"],
            [1, "rgba(255,255,255,0)"],
          ],
        });
        for (const [canvas, context] of [
          [depthLayer, mask],
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
            width / 2 - anchor.x * z * scale,
            height / 2 - anchor.y * z * MAP_TILT_COS * scale,
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
          const base = nearestWrapped(sx, anchor.x, WORLD.w);
          for (const x of [base - WORLD.w, base, base + WORLD.w]) {
            if (
              Math.abs(x - anchor.x) > halfW + rx ||
              Math.abs(sy - anchor.y) > halfH + ry
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
        // The static depth mask is reused for every light frame and feathered
        // at bounded edges; neither island clipping nor coastal strokes animate.
        mask.setTransform(1, 0, 0, 1, 0, 0);
        mask.globalCompositeOperation = "destination-in";
        for (const [extent, horizontal] of [
          [width, true],
          [height, false],
        ]) {
          if (extent >= (horizontal ? vw : vh) * scale + padding * 2 * scale)
            continue;
          const fade = mask.createLinearGradient(
            0,
            0,
            horizontal ? extent : 0,
            horizontal ? 0 : extent,
          );
          fade.addColorStop(0, "rgba(0,0,0,0)");
          fade.addColorStop((padding * scale) / extent, "#000");
          fade.addColorStop(1 - (padding * scale) / extent, "#000");
          fade.addColorStop(1, "rgba(0,0,0,0)");
          mask.fillStyle = fade;
          mask.fillRect(0, 0, width, height);
        }
        mask.globalCompositeOperation = "source-over";
      }
      const key = `${z}:${detail}:${maskRevision}:${(lighting?.daylight ?? 1) < 0.3}`;
      if (
        cadence.shouldRender(time, {
          x: anchor.x * z,
          y: anchor.y * z * MAP_TILT_COS,
          width,
          height,
          key,
        })
      ) {
        web.setTransform(1, 0, 0, 1, 0, 0);
        web.clearRect(0, 0, width, height);
        web.setTransform(
          z * scale,
          0,
          0,
          z * MAP_TILT_COS * scale,
          width / 2 - anchor.x * z * scale,
          height / 2 - anchor.y * z * MAP_TILT_COS * scale,
        );
        const ribbons = causticContours(
          {
            left: anchor.x - halfW,
            right: anchor.x + halfW,
            top: anchor.y - halfH,
            bottom: anchor.y + halfH,
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
        if (layer.width !== width || layer.height !== height) {
          layer.width = width;
          layer.height = height;
        }
        composite.setTransform(1, 0, 0, 1, 0, 0);
        composite.globalCompositeOperation = "copy";
        composite.drawImage(depthLayer, 0, 0);
        composite.globalCompositeOperation = "source-in";
        composite.drawImage(lace, 0, 0);
        composite.globalCompositeOperation = "source-over";
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
