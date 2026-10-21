import { MAP_TILT_COS } from "./core/projection.js";
import { nearestWrapped } from "./core/math.js";
import { createRenderCadence } from "./core/render-quality.js?v=1";
import { seasonAtDay } from "./core/seasons.js";

// Ocean ripples move by fractions of a pixel between display frames. Keep a
// padded world-anchored image at 30 Hz while the camera and vessels run at 60 Hz.
export function createSeaSurfaceRendering(drawSurface, worldWidth = 0) {
  let layer;
  let context;
  let anchor;
  const padding = 64;
  const cadence = createRenderCadence(1000 / 30, padding);
  return {
    draw(c, options) {
      const {
        camera,
        vw,
        vh,
        lighting,
        roughness,
        windAngle,
        detail = 1,
        surfaceScale = 1,
      } = options;
      const time = options.reducedMotion ? 0 : options.time;
      const z = camera.zoom;
      // The distant chart already has static water ink. Bound live decoration
      // around the vessel so showing more of the world does not add more work.
      const radius = (options.focus?.radius ?? 480) + 520;
      const viewWidth = Math.ceil(
        Math.min(vw, options.focus ? radius * 2 * z : vw) + padding * 2,
      );
      const viewHeight = Math.ceil(
        Math.min(vh, options.focus ? radius * 2 * z * MAP_TILT_COS : vh) +
          padding * 2,
      );
      const width = Math.ceil(viewWidth * surfaceScale);
      const height = Math.ceil(viewHeight * surfaceScale);
      const center = options.focus
        ? {
            ...camera,
            x: worldWidth
              ? nearestWrapped(options.focus.x, camera.x, worldWidth)
              : options.focus.x,
            y: options.focus.y,
          }
        : camera;
      const key = [
        z,
        detail,
        surfaceScale,
        seasonAtDay(options.day).key,
        c.globalAlpha,
        options.focus?.radius,
        Math.round(roughness * 100),
        Math.round(windAngle * 100),
        Math.round((lighting?.daylight ?? 1) * 100),
        Math.round((lighting?.storm ?? 0) * 100),
        // Storm-arc swell and bird presence change the surface ink without
        // touching roughness, so they belong in the cache key.
        Math.round((options.arc?.swell ?? 0) * 50),
        Math.round((options.arc?.birds ?? 1) * 20),
      ].join(":");
      if (
        cadence.shouldRender(time, {
          x: center.x * z,
          y: center.y * z * MAP_TILT_COS,
          width: viewWidth,
          height: viewHeight,
          key,
        })
      ) {
        layer ||= document.createElement("canvas");
        context ||= layer.getContext("2d");
        if (layer.width !== width || layer.height !== height) {
          layer.width = width;
          layer.height = height;
        }
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, width, height);
        context.globalAlpha = c.globalAlpha;
        context.globalCompositeOperation = "source-over";
        context.setTransform(
          z * surfaceScale,
          0,
          0,
          z * MAP_TILT_COS * surfaceScale,
          width / 2 - center.x * z * surfaceScale,
          height / 2 - center.y * z * MAP_TILT_COS * surfaceScale,
        );
        drawSurface(context, {
          ...options,
          camera: center,
          vw: width / surfaceScale,
          vh: height / surfaceScale,
        });
        const alpha = context.globalAlpha;
        context.globalAlpha = 1;
        context.globalCompositeOperation = "destination-in";
        // Feather only the bounded edges, keeping full detail near the ship.
        for (const [extent, horizontal] of [
          [width, true],
          [height, false],
        ]) {
          if (extent >= ((horizontal ? vw : vh) + padding * 2) * surfaceScale)
            continue;
          const fade = context.createLinearGradient(
            0,
            0,
            horizontal ? extent : 0,
            horizontal ? 0 : extent,
          );
          fade.addColorStop(0, "rgba(0,0,0,0)");
          fade.addColorStop((padding * surfaceScale) / extent, "#000");
          fade.addColorStop(1 - (padding * surfaceScale) / extent, "#000");
          fade.addColorStop(1, "rgba(0,0,0,0)");
          context.setTransform(1, 0, 0, 1, 0, 0);
          context.fillStyle = fade;
          context.fillRect(0, 0, width, height);
        }
        context.globalAlpha = alpha;
        context.globalCompositeOperation = "source-over";
        anchor = { ...center };
      }
      c.save();
      c.globalAlpha = 1;
      c.drawImage(
        layer,
        anchor.x - width / (2 * z * surfaceScale),
        anchor.y - height / (2 * z * MAP_TILT_COS * surfaceScale),
        width / (z * surfaceScale),
        height / (z * MAP_TILT_COS * surfaceScale),
      );
      c.restore();
    },
  };
}
