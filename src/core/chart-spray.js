import { clamp } from "./math.js";

export const SPRAY_DRY_SECONDS = 18;
export const SPRAY_MARK_SECONDS = 110;

// Fixed slots keep chart wear bounded, even after a long tempest. Coordinates
// are fractions of the frame, so resizing never moves beads into the chart body.
export function createChartSpray(count = 40) {
  return Array.from({ length: count }, (_, index) => {
    const side = index % 4;
    const along = ((index * 0.61803398875) % 1) * 0.92 + 0.04;
    const inset = 0.012 + ((index * 0.41421356237) % 1) * 0.085;
    return {
      x: side === 0 ? inset : side === 1 ? 1 - inset : along,
      y: side === 2 ? inset : side === 3 ? 1 - inset : along,
      radius: 2.5 + ((index * 0.754877666) % 1) * 7,
      age: SPRAY_MARK_SECONDS,
      next: index * 0.19,
      index,
    };
  });
}

export function advanceChartSpray(beads, seconds, tempest) {
  const dt = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  for (const bead of beads) {
    bead.age = Math.min(SPRAY_MARK_SECONDS, bead.age + dt);
    if (!tempest) {
      bead.next = Math.min(bead.next, 0.8);
      continue;
    }
    bead.next -= dt;
    if (bead.next <= 0) {
      bead.age = 0;
      bead.next = 6 + (bead.index % 7) * 0.7;
    }
  }
  return beads;
}

export function chartSprayAppearance(age) {
  const wet = clamp(1 - age / SPRAY_DRY_SECONDS, 0, 1);
  return {
    wet,
    mark: (1 - wet) * clamp(1 - age / SPRAY_MARK_SECONDS, 0, 1),
    radiusScale: 0.65 + wet * 0.35,
  };
}
