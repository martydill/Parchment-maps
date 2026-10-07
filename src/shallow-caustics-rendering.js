import { MAP_TILT_COS } from "./core/projection.js";
import { nearestWrapped } from "./core/math.js";
import { causticPoint, shallowLightStrength } from "./core/sea-optics.js";
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

        // An even number of flat-top hexagon columns closes the wrapping grid.
        const columns = Math.max(
          2,
          Math.ceil(WORLD.w / (detail >= 0.9 ? 36 : 54) / 2) * 2,
        );
        const spacing = WORLD.w / columns;
        const radius = spacing / 1.5;
        const rowHeight = Math.sqrt(3) * radius;
        const first = Math.floor((camera.x - halfW - radius * 2) / spacing);
        const last = Math.ceil((camera.x + halfW + radius * 2) / spacing);
        const top = Math.floor((camera.y - halfH - rowHeight) / rowHeight);
        const bottom = Math.ceil((camera.y + halfH + rowHeight) / rowHeight);
        const t = time / 1000;
        web.beginPath();
        for (let column = first; column <= last; column++) {
          const stagger = ((column % 2) + 2) % 2;
          for (let row = top; row <= bottom; row++) {
            const x = column * spacing;
            const y = (row + stagger * 0.5) * rowHeight;
            // Three edges per cell: each junction is shared, never overdrawn.
            let previous;
            for (let corner = 0; corner <= 3; corner++) {
              const angle = (corner * Math.PI) / 3;
              const point = causticPoint(
                x + Math.cos(angle) * radius,
                y + Math.sin(angle) * radius,
                t,
                WORLD.w,
              );
              if (corner === 0) web.moveTo(point.x, point.y);
              else {
                const before = ((corner - 1) * Math.PI) / 3;
                const middle = causticPoint(
                  x + ((Math.cos(before) + Math.cos(angle)) * radius) / 2,
                  y + ((Math.sin(before) + Math.sin(angle)) * radius) / 2,
                  t,
                  WORLD.w,
                );
                web.quadraticCurveTo(
                  middle.x * 2 - (previous.x + point.x) / 2,
                  middle.y * 2 - (previous.y + point.y) / 2,
                  point.x,
                  point.y,
                );
              }
              previous = point;
            }
          }
        }
        web.lineJoin = "round";
        web.lineCap = "round";
        const moonlit = (lighting?.daylight ?? 1) < 0.3;
        web.strokeStyle = moonlit
          ? "rgba(170,218,255,0.22)"
          : "rgba(211,255,214,0.22)";
        web.lineWidth = 5 / Math.sqrt(z);
        web.stroke();
        web.strokeStyle = moonlit
          ? "rgba(225,244,255,0.86)"
          : "rgba(250,255,218,0.9)";
        web.lineWidth = 1.25 / Math.sqrt(z);
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
