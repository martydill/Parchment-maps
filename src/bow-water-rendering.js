import { damageNoise } from "./core/ship-damage.js";
import { MAP_TILT_TAN } from "./core/projection.js";
import { createAlphaPalette } from "./style-palette.js";

const troughStyle = createAlphaPalette("35,88,86", 0, 0.16, 128);
const washStyle = createAlphaPalette("158,206,197", 0, 0.2, 128);
const foamStyle = createAlphaPalette("255,247,213", 0, 0.6, 128);
const crestStyle = createAlphaPalette("233,248,239", 0, 0.7, 128);
const sprayStyle = createAlphaPalette("255,245,216", 0, 0.65, 128);

// Fixed emission phases avoid random flicker and persistent per-frame
// particle state. Each side has its own spacing and breakup pattern.
const shoulders = [-1, 1].map((side) => ({
  side,
  particles: Array.from({ length: 48 }, (_, index) => ({
    phase: damageNoise(index + side * 71, 11),
    cross: damageNoise(index + side * 71, 23) - 0.5,
    size: damageNoise(index + side * 71, 37),
    stretch: damageNoise(index + side * 71, 47),
  })),
}));

function oval(c, x, y, rx, ry, angle = 0) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
  c.fill();
}

// Local water-plane coordinates: the bow faces -Y. Water spreads around the
// entry, then leaves the hull in a widening shoulder, rather than a solid arc.
function shoulderPoint(beam, length, age, strength, side) {
  return [
    side *
      (beam * (0.095 + (1 - Math.exp(-age * 5)) * 1.18) +
        age * age * beam * (0.3 + strength * 0.8)),
    length * (-0.52 + age * 0.88),
  ];
}

export function drawBowWater(c, profile, motion, windX, windY, seed = 0) {
  const strength = motion.wake;
  if (strength < 0.02) return;
  const { beam, length } = profile;
  const time = motion.reducedMotion ? 0 : (motion.time ?? 0);
  const flow = time * (0.38 + strength * 0.48);

  for (const { side, particles } of shoulders) {
    // A low-contrast pressure trough gives the translucent aerated water depth.
    // Broad overlapping patches have no continuous outlined edge.
    for (let index = 0; index < 9; index++) {
      const age = (index + 0.5) / 10;
      const [x, y] = shoulderPoint(beam, length, age, strength, side);
      const width = beam * (0.07 + age * 0.14) * (0.5 + strength);
      c.fillStyle = troughStyle(strength * (1 - age) * 0.1);
      oval(c, x + side * width * 0.8, y + 0.9, width * 1.6, length * 0.09);
      c.fillStyle = washStyle(strength * (1 - age) * 0.13);
      oval(c, x, y, width * 1.3, length * 0.075, -side * 0.35);
    }

    // Foam is born at the bow, travels aft, spreads, and dissolves. Different
    // lifetimes and cross-stream offsets break up the silhouette naturally.
    for (const particle of particles) {
      const age = (particle.phase + flow + seed * 0.137) % 1;
      const fade =
        Math.sin(Math.PI * Math.min(0.85, age * 1.7)) * (1 - age) ** 1.3;
      const [px, py] = shoulderPoint(beam, length, age, strength, side);
      const width = beam * (0.05 + age * 0.23) * (0.5 + strength);
      const x = px + particle.cross * width * 2;
      const y = py + particle.cross * length * 0.035;
      const radius =
        (0.22 + particle.size * 0.38 + age * 0.23) * (0.55 + strength * 0.65);

      c.fillStyle = foamStyle(strength * fade * (0.3 + particle.size * 0.3));
      oval(
        c,
        x,
        y,
        radius * 1.3,
        radius * (1.6 + particle.stretch),
        -side * 0.4,
      );
      // Small bright cells over a softer body read as bubbles and torn foam.
      c.fillStyle = crestStyle(strength * fade * (0.38 + particle.size * 0.3));
      oval(
        c,
        x - side * radius * 0.3,
        y - radius * 0.4,
        radius * 0.45,
        radius * 0.7,
      );
      oval(
        c,
        x + side * radius * 0.65,
        y + radius * 0.6,
        radius * 0.3,
        radius * 0.42,
      );
    }

    // Detached pressure ripples expand outside the churn, with broken crests
    // and a smooth fade at both ends of their life. Never outline the shoulder.
    for (let index = 0; index < 4; index++) {
      const age = (flow * 0.6 + index / 4 + (side + 1) * 0.073) % 1;
      const fade = Math.sin(Math.PI * age) ** 2;
      const x = side * beam * (0.9 + age * (0.55 + strength * 0.7));
      const y = length * (-0.3 + age * 0.55);
      c.strokeStyle = washStyle(strength * fade * 0.18);
      c.lineWidth = 0.45 + strength * 0.3;
      c.beginPath();
      c.moveTo(x, y - length * 0.045);
      c.quadraticCurveTo(x + side * 0.7, y, x + side * 0.5, y + length * 0.045);
      c.stroke();
    }

    // Short ballistic droplets rise from the entry, then settle back onto the
    // surface. Their size, height, and wind drift all build with ship speed.
    for (let index = 0; index < 9; index++) {
      const particle = particles[index];
      const age = (particle.phase + flow * 1.7 + seed * 0.137) % 1;
      const fade = Math.sin(Math.PI * age) * (1 - age);
      const spread = 0.13 + age * 0.28;
      const [px, py] = shoulderPoint(beam, length, spread, strength, side);
      const lift =
        Math.sin(Math.PI * age) *
        (1.2 + strength * 3.8) *
        (0.55 + motion.spray * 0.45);
      const drift = (0.15 + age * age * 3) * motion.spray * strength;
      const radius = (0.2 + particle.size * 0.38) * (0.5 + strength * 0.7);
      c.fillStyle = sprayStyle(strength * fade * 0.65);
      oval(
        c,
        px + side * age * strength * 2.5 + windX * drift,
        py - lift * MAP_TILT_TAN + windY * drift,
        radius,
        radius * (1.2 + age * 0.4),
        -side * 0.4,
      );
    }
  }
}
