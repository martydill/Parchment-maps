import { createRenderCadence } from "./core/render-quality.js";
import { lightingHierarchy } from "./core/lighting.js";
import { MAP_TILT_COS } from "./core/projection.js";

// Downsampling pools fine ink into broad pigment shapes. Only the distant
// scene is replaced; the transparent center preserves the original coast.
export function createDepthRendering() {
  const layer = document.createElement("canvas");
  const wash = layer.getContext("2d");
  const cadence = createRenderCadence();
  let focus = null;
  function paint(c, { width, height, ship, zoom, lighting, maskScale = 0.5 }) {
    const scale = Math.min(0.3, maskScale);
    const w = Math.ceil(width * scale);
    const h = Math.ceil(height * scale);
    if (layer.width !== w || layer.height !== h) {
      layer.width = w;
      layer.height = h;
    }
    const profile = lightingHierarchy(zoom, lighting);
    wash.setTransform(1, 0, 0, 1, 0, 0);
    wash.clearRect(0, 0, w, h);
    wash.imageSmoothingEnabled = true;
    wash.imageSmoothingQuality = "high";
    wash.filter = "blur(1px)";
    wash.drawImage(c.canvas, 0, 0, w, h);
    wash.filter = "none";
    // Cool the pigment continuously through twilight, avoiding a palette
    // switch as daylight gives way to the moonlit scene.
    wash.fillStyle = `rgb(${Math.round(198 - lighting.night * 85)},${Math.round(201 - lighting.night * 62)},${Math.round(177 - lighting.night * 25)})`;
    wash.globalAlpha = profile.pigmentOpacity;
    wash.fillRect(0, 0, w, h);
    wash.globalAlpha = 1;
    wash.save();
    wash.setTransform(
      scale,
      0,
      0,
      scale * MAP_TILT_COS,
      ship.x * scale,
      ship.y * scale,
    );
    wash.globalCompositeOperation = "destination-out";
    const focus = wash.createRadialGradient(
      0,
      0,
      profile.sharpRadius,
      0,
      0,
      profile.washRadius,
    );
    focus.addColorStop(0, "rgba(0,0,0,1)");
    focus.addColorStop(0.35, "rgba(0,0,0,0.86)");
    focus.addColorStop(0.72, "rgba(0,0,0,0.3)");
    focus.addColorStop(1, "rgba(0,0,0,0)");
    wash.fillStyle = focus;
    wash.fillRect(
      -profile.washRadius,
      -profile.washRadius,
      profile.washRadius * 2,
      profile.washRadius * 2,
    );
    wash.restore();
  }
  return {
    draw(c, options) {
      const {
        width,
        height,
        ship,
        zoom,
        lighting,
        maskScale = 0.5,
        time,
        camera = { x: 0, y: 0 },
      } = options;
      // Copying the scene forces queued canvas work to finish. The distant
      // wash can update at 30 Hz while nearby scenery and controls stay live.
      // Limit drift to two screen pixels and refresh immediately on a jump,
      // resize, zoom, light change, or larger ship movement within the view.
      if (
        !focus ||
        Math.abs(ship.x - focus.x) > 2 ||
        Math.abs(ship.y - focus.y) > 2
      )
        cadence.reset();
      if (
        cadence.shouldRender(time, {
          width,
          height,
          x: camera.x * zoom,
          y: camera.y * zoom * MAP_TILT_COS,
          key: `${zoom}:${maskScale}:${lighting.night}:${lighting.storm}`,
        })
      ) {
        paint(c, options);
        focus = { x: ship.x, y: ship.y };
      }
      const profile = lightingHierarchy(zoom, lighting);
      c.save();
      c.globalAlpha = profile.washOpacity;
      c.imageSmoothingEnabled = true;
      // This image is already blurred. Bilinear upscaling preserves its soft
      // pigment while avoiding a costly full-viewport high-quality filter.
      c.imageSmoothingQuality = "low";
      c.drawImage(layer, 0, 0, width, height);
      c.restore();
    },
  };
}
