// Read a queried pixel only once between changes to the painted mask. Keeping
// this lazy avoids both per-frame GPU readbacks and copying the entire atlas.
export function createExplorationSampler(mask, context) {
  const samples = new Map();
  let width = mask.width;
  let height = mask.height;
  let snapshot = null;

  function invalidate() {
    samples.clear();
    snapshot = null;
    width = mask.width;
    height = mask.height;
  }

  return {
    invalidate,
    snapshot() {
      if (mask.width !== width || mask.height !== height) invalidate();
      if (snapshot === null) snapshot = mask.toDataURL("image/png");
      return snapshot;
    },
    isExplored(x, y) {
      if (mask.width !== width || mask.height !== height) invalidate();
      const key = y * width + x;
      if (!samples.has(key))
        samples.set(key, context.getImageData(x, y, 1, 1).data[3] > 14);
      return samples.get(key);
    },
  };
}
