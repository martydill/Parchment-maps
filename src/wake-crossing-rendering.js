import { nearestWrapped } from "./core/math.js";
import { sampleWakeCrossing } from "./core/wake-crossings.js";
import { MAP_TILT_COS } from "./core/projection.js";
import {
  bioluminescentNightGain,
  bioluminescentSeaAt,
  BIOLUMINESCENT_RGB,
} from "./core/bioluminescence.js";
import { createAlphaPalette } from "./style-palette.js";

const foam = createAlphaPalette("253,247,220", 0, 0.72, 128);
const silver = createAlphaPalette("186,222,222", 0, 0.55, 128);
const trough = createAlphaPalette("23,80,86", 0, 0.16, 64);
const glow = createAlphaPalette(BIOLUMINESCENT_RGB, 0, 0.65, 96);
const TAU = Math.PI * 2;
const grain = (seed, index) => {
  const value = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453;
  return value - Math.floor(value);
};

// Short, asymmetric crest fragments keep crossings part of the sea surface,
// rather than reading as perfect impact rings. No blur or particle textures.
export function createWakeCrossingRendering({
  WORLD,
  visibleCoasts,
  clipWater,
}) {
  return function drawWakeCrossings(
    c,
    crossings,
    time,
    camera,
    vw,
    vh,
    environment = {},
  ) {
    const halfW = vw / (2 * camera.zoom) + 85;
    const halfH = vh / (2 * camera.zoom * MAP_TILT_COS) + 85;
    const detail = environment.detail ?? 1;
    for (const event of crossings) {
      const x = nearestWrapped(event.x, camera.x, WORLD.w);
      if (
        Math.abs(x - camera.x) > halfW ||
        Math.abs(event.y - camera.y) > halfH
      )
        continue;
      const sample = sampleWakeCrossing(event, time, environment.reducedMotion);
      if (sample.alpha < 0.003) continue;
      c.save();
      clipWater(c, visibleCoasts(camera, vw, vh), {
        left: x - 82,
        right: x + 82,
        top: event.y - 82,
        bottom: event.y + 82,
      });
      c.translate(x, event.y);
      c.rotate(event.angle);
      c.lineCap = "round";
      const night = environment.lighting?.night ?? 0;
      const sea = bioluminescentSeaAt(
        event,
        environment.bioluminescentSeas ?? [],
        WORLD.w,
      );
      const luminous =
        bioluminescentNightGain(environment.lighting) * (sea?.exposure ?? 0);
      const roughness = environment.roughness ?? 0;
      const rings = detail < 0.65 ? 2 : 3;
      for (let ring = 0; ring < rings; ring++) {
        const radius = sample.radius * (0.52 + ring * 0.26);
        const pieces = 5 + ring;
        for (let piece = 0; piece < pieces; piece++) {
          const noise = grain(event.seed, ring * 11 + piece);
          const start = (piece / pieces) * TAU + noise * 0.32 + ring * 0.73;
          const span = (0.26 + noise * 0.39) * (1 - sample.breakup * 0.65);
          const rx = radius * (0.87 + noise * 0.22);
          const ry = radius * (0.67 + event.energy * 0.25);
          const drift = sample.breakup * (noise - 0.5) * (8 + roughness * 7);
          const alpha =
            sample.alpha * (0.45 + noise * 0.5) * (1 - roughness * 0.3);
          c.beginPath();
          c.ellipse(
            drift,
            -drift * 0.5,
            rx,
            ry,
            ring * 0.18,
            start,
            start + span,
          );
          c.strokeStyle = trough(alpha * 0.2);
          c.lineWidth = (2.7 - sample.breakup) / camera.zoom;
          c.stroke();
          c.strokeStyle =
            night > 0.5 ? silver(alpha * 0.72) : foam(alpha * 0.72);
          c.lineWidth = (1.25 - sample.breakup * 0.6) / camera.zoom;
          c.stroke();
          if (luminous > 0.01) {
            c.globalCompositeOperation = "screen";
            c.strokeStyle = glow(alpha * luminous * 0.65);
            c.lineWidth = 2.2 / camera.zoom;
            c.stroke();
            c.globalCompositeOperation = "source-over";
          }
        }
      }
      // Small foam islands peel away from the crossing centre and evaporate
      // earlier than the long, delicate capillary ripples around them.
      const specks = detail < 0.65 ? 7 : 15;
      for (let i = 0; i < specks; i++) {
        const noise = grain(event.seed, i + 51);
        const angle = i * 2.399963 + noise;
        const radius = (3 + noise * 18) * (0.5 + sample.breakup * 2);
        c.fillStyle = foam(sample.foam * (0.25 + noise * 0.5));
        c.beginPath();
        c.ellipse(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius * 0.72,
          0.6 + noise * 1.25,
          0.4 + noise * 0.6,
          angle,
          0,
          TAU,
        );
        c.fill();
      }
      c.restore();
    }
  };
}
