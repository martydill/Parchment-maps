import { clamp, wrappedDelta } from "./math.js";

// A few named seas carry luminous plankton that ignites disturbed water once
// night falls. Everything here is deterministic presentation sampling: no
// simulation state, no random numbers, and a zero time freezes the shimmer
// for reduced motion.

// One shared teal keeps the wake ribbon and the hull eddy on the same
// organism, and sits between the parchment sea inks they glow over.
export const BIOLUMINESCENT_RGB = "104,236,205";

// Newest region wins. Longitudes wrap, so a sea straddling the first
// meridian lights wake points on either side of the seam. The glow holds a
// full-strength plateau across the inner two-thirds of a sea and spends its
// fade on the rim third, so sailing through glows instead of flickering.
const PLATEAU = 0.65;

export function bioluminescentSeaAt(position, seas, worldWidth) {
  let nearest = null;
  for (const [index, sea] of (seas || []).entries()) {
    const dx = wrappedDelta(sea.x, position.x, worldWidth);
    const dy = sea.y - position.y;
    const exposure = 1 - Math.hypot(dx / sea.rx, dy / sea.ry);
    if (exposure > 0 && (!nearest || exposure > nearest.exposure))
      nearest = {
        index,
        name: sea.name,
        exposure: clamp(exposure / PLATEAU, 0, 1),
      };
  }
  return nearest;
}

// The glow gathers through dusk, holds through deep clear night, and
// storm-churned water scatters the organisms before they can settle.
export function bioluminescentNightGain(lighting) {
  const night = clamp(Number(lighting?.night) || 0, 0, 1);
  const storm = clamp(Number(lighting?.storm) || 0, 0, 1);
  const dusk = clamp((night - 0.34) / 0.46, 0, 1);
  return dusk * dusk * (3 - 2 * dusk) * (1 - storm * 0.75);
}

// Final 0..1 glow strength for a hull at this position and hour.
export function vesselBioluminescence(position, seas, worldWidth, lighting) {
  const sea = bioluminescentSeaAt(position, seas, worldWidth);
  return sea ? bioluminescentNightGain(lighting) * sea.exposure : 0;
}

// Two slow interfering pulses per speck; the phase spreads colonies out of
// step so the wake glitters instead of pulsing as one.
export function bioluminescentTwinkle(time, phase) {
  const pulse =
    Math.sin(time * 1.6 + phase) * 0.7 +
    Math.sin(time * 2.9 + phase * 2.7) * 0.3;
  return clamp(pulse, 0, 1);
}
