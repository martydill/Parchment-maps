import { MAP_TILT_COS } from "./core/projection.js";

// The banks only translate: keep a padded screen-sized image and move it until
// the viewport reaches its edge. This also follows the camera while sailing.
export function createMistRendering(worldWidth, stamp) {
  const layer = document.createElement("canvas");
  const context = layer.getContext("2d");
  const padding = 128;
  let cachedX = NaN;
  let cachedY = NaN;
  let cachedZoom = NaN;

  return {
    draw(c, { camera, vw, vh, time }) {
      const z = camera.zoom;
      const centerX = camera.x - time * 0.003;
      const centerY = camera.y;
      const width = vw + padding * 2;
      const height = vh + padding * 2;
      if (
        layer.width !== width ||
        layer.height !== height ||
        cachedZoom !== z ||
        Math.abs(centerX - cachedX) * z > padding ||
        Math.abs(centerY - cachedY) * z * MAP_TILT_COS > padding
      ) {
        layer.width = width;
        layer.height = height;
        cachedX = centerX;
        cachedY = centerY;
        cachedZoom = z;
        context.setTransform(
          z,
          0,
          0,
          z * MAP_TILT_COS,
          width / 2 - centerX * z,
          height / 2 - centerY * z * MAP_TILT_COS,
        );
        const halfW = width / (2 * z);
        const halfH = height / (2 * z * MAP_TILT_COS);
        const columns = Math.ceil(worldWidth / 240);
        const spacing = worldWidth / columns;
        const left = Math.floor((centerX - halfW - 325) / spacing);
        const right = Math.ceil((centerX + halfW + 325) / spacing);
        const top = Math.floor((centerY - halfH - 140) / 160);
        const bottom = Math.ceil((centerY + halfH + 140) / 160);
        for (let row = top; row <= bottom; row++) {
          for (let column = left; column <= right; column++) {
            const phase =
              (((column % columns) + columns) % columns) * 2.4 + row * 1.7;
            const x = column * spacing + Math.sin(row * 4.1) * 65;
            const y = row * 160 + Math.sin(phase) * 45;
            if (
              Math.abs(x - centerX) > halfW + 260 ||
              Math.abs(y - centerY) > halfH + 95
            )
              continue;
            context.globalAlpha = 0.38 + Math.sin(phase) * 0.15;
            context.drawImage(stamp, x - 260, y - 95, 520, 190);
          }
        }
      }
      c.drawImage(
        layer,
        (cachedX - centerX) * z - padding,
        (cachedY - centerY) * z * MAP_TILT_COS - padding,
      );
    },
  };
}
