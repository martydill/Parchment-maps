export const MAP_OPENING_DURATION = 2400;
const TIMELINE_DURATION = 3000;

const clamp = (value) => Math.max(0, Math.min(1, value));
const smooth = (value) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

// The weighted roll and camera move overlap. Material wear fades only during
// the final handoff, so zooming early does not wash out the old parchment.
// Everything is derived from elapsed time so dropped frames cannot hold up play.
export function mapOpeningFrame(elapsed, reducedMotion = false) {
  const time =
    Math.max(0, elapsed) * (TIMELINE_DURATION / MAP_OPENING_DURATION);
  const unroll = smooth((time - 150) / 1850);
  const approach = smooth((time - 550) / (TIMELINE_DURATION - 550));
  const handoff = smooth((time - 2100) / (TIMELINE_DURATION - 2100));
  const settle = Math.sin(unroll * Math.PI * 3) * (1 - unroll) * 0.008;
  const complete = reducedMotion || time >= TIMELINE_DURATION;
  if (complete)
    return {
      complete: true,
      unroll: 1,
      approach: 1,
      handoff: 1,
      scale: 1,
      tilt: 0,
      rotation: 0,
      lift: 0,
      curl: 0,
      captionOpacity: 0,
    };

  return {
    complete: false,
    unroll,
    approach,
    handoff,
    scale: 0.78 + approach * 0.22,
    tilt: (0.12 + settle) * (1 - approach),
    rotation: (-0.025 + unroll * 0.012) * (1 - approach),
    lift: (Math.sin(unroll * Math.PI) * 10 + settle * 180) * (1 - approach),
    curl: (1 - handoff) * (0.06 - unroll * 0.036),
    captionOpacity: smooth(time / 400) * (1 - smooth((time - 1050) / 450)),
  };
}
