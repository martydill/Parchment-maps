// Build once at renderer initialization; lookups only round and index, so they
// never allocate a color string. Include both opacity endpoints.
export function createAlphaPalette(rgb, minAlpha, maxAlpha, buckets = 20) {
  const last = buckets - 1;
  const scale = last / (maxAlpha - minAlpha);
  const styles = Array.from(
    { length: buckets },
    (_, index) =>
      `rgba(${rgb},${minAlpha + (index / last) * (maxAlpha - minAlpha)})`,
  );
  return (alpha) =>
    styles[Math.max(0, Math.min(last, Math.round((alpha - minAlpha) * scale)))];
}
