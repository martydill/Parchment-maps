import { MAP_TILT_COS } from "./core/projection.js";
import { seaLightSources } from "./core/sea-optics.js";

// Sun reflections move slowly, but screen blending every individual stamp
// through coastline clips is costly. Blend their padded image once instead.
export function createSeaLightRendering(drawBands) {
  let layer;
  let context;
  let cached;
  const padding = 64;
  const scale = 0.5;
  return {
    draw(
      c,
      { camera, vw, vh, time, lighting, windAngle, roughness = 0, detail = 1 },
    ) {
      const sources = seaLightSources(lighting);
      if (sources.every(({ strength }) => strength < 0.003)) return;
      const lightKey = sources
        .map(
          ({ strength, x, warm }) =>
            `${Math.round(strength * 1000)}:${x.toFixed(3)}:${warm}`,
        )
        .join(":");
      layer ||= document.createElement("canvas");
      context ||= layer.getContext("2d");
      const width = Math.ceil((vw + padding * 2) * scale);
      const height = Math.ceil((vh + padding * 2) * scale);
      const z = camera.zoom;
      const alpha = c.globalAlpha;
      if (
        !cached ||
        layer.width !== width ||
        layer.height !== height ||
        cached.zoom !== z ||
        cached.alpha !== alpha ||
        Math.abs(cached.windAngle - windAngle) > 0.01 ||
        cached.lightKey !== lightKey ||
        cached.roughness !== roughness ||
        cached.detail !== detail ||
        time < cached.time ||
        time - cached.time >= 1000 / 30 ||
        Math.abs(camera.x - cached.x) * z > 0.5 ||
        Math.abs(camera.y - cached.y) * z * MAP_TILT_COS > 0.5
      ) {
        if (layer.width !== width || layer.height !== height) {
          layer.width = width;
          layer.height = height;
        }
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, width, height);
        context.globalAlpha = alpha;
        context.setTransform(
          z * scale,
          0,
          0,
          z * MAP_TILT_COS * scale,
          width / 2 - camera.x * z * scale,
          height / 2 - camera.y * z * MAP_TILT_COS * scale,
        );
        drawBands(
          context,
          camera,
          time / 1000,
          lighting,
          windAngle,
          width / (2 * z * scale),
          height / (2 * z * MAP_TILT_COS * scale),
          { vw, vh, roughness, detail },
        );
        cached = {
          ...camera,
          time,
          windAngle,
          lightKey,
          roughness,
          detail,
          alpha,
        };
      }
      c.save();
      c.globalCompositeOperation = "screen";
      c.globalAlpha = 1;
      c.drawImage(
        layer,
        cached.x - width / (2 * z * scale),
        cached.y - height / (2 * z * MAP_TILT_COS * scale),
        width / (z * scale),
        height / (z * MAP_TILT_COS * scale),
      );
      c.restore();
    },
  };
}
