import { cloudShadowSamples } from "./core/sunlight.js";
import { MAP_TILT_COS } from "./core/projection.js";

// One soft, irregular cloud footprint serves every patch. Its gradients are
// baked once; frames only cull, move, and blend the texture over land and sea.
export function createCloudShadowRendering(world) {
  let stamp;
  function texture() {
    if (stamp) return stamp;
    stamp = document.createElement("canvas");
    stamp.width = stamp.height = 256;
    const c = stamp.getContext("2d");
    for (const [x, y, radius] of [
      [92, 124, 82],
      [149, 133, 91],
      [134, 81, 63],
      [181, 114, 58],
      [75, 156, 52],
    ]) {
      const wash = c.createRadialGradient(x, y, 0, x, y, radius);
      wash.addColorStop(0, "rgba(45,61,89,.65)");
      wash.addColorStop(0.45, "rgba(45,61,89,.4)");
      wash.addColorStop(1, "rgba(45,61,89,0)");
      c.fillStyle = wash;
      c.fillRect(0, 0, 256, 256);
    }
    return stamp;
  }
  return {
    draw(c, { camera, vw, vh, ...options }) {
      const samples = cloudShadowSamples({ world, ...options });
      const halfW = vw / (2 * camera.zoom);
      const halfH = vh / (2 * camera.zoom * MAP_TILT_COS);
      c.save();
      const alpha = c.globalAlpha;
      c.globalCompositeOperation = "multiply";
      for (const sample of samples) {
        if (sample.alpha < 0.002) continue;
        const ry = sample.radius * sample.aspect;
        const first = Math.ceil(
          (camera.x - halfW - sample.radius - sample.x) / world.w,
        );
        const last = Math.floor(
          (camera.x + halfW + sample.radius - sample.x) / world.w,
        );
        // Periodic latitude avoids disappearing patches at the chart boundary.
        const top = Math.ceil((camera.y - halfH - ry - sample.y) / world.h);
        const bottom = Math.floor((camera.y + halfH + ry - sample.y) / world.h);
        c.globalAlpha = alpha * sample.alpha;
        for (let copy = first; copy <= last; copy++)
          for (let row = top; row <= bottom; row++)
            c.drawImage(
              texture(),
              sample.x + copy * world.w - sample.radius,
              sample.y + row * world.h - ry,
              sample.radius * 2,
              ry * 2,
            );
      }
      c.restore();
    },
  };
}
