// Read a queried pixel only once between changes to the painted mask. Keeping
// this lazy avoids both per-frame GPU readbacks and copying the entire atlas.
export function createExplorationSampler(mask, context) {
  const samples = new Map();
  let width = mask.width;
  let height = mask.height;

  function invalidate() {
    samples.clear();
    width = mask.width;
    height = mask.height;
  }

  return {
    invalidate,
    isExplored(x, y) {
      if (mask.width !== width || mask.height !== height) invalidate();
      const key = y * width + x;
      if (!samples.has(key))
        samples.set(key, context.getImageData(x, y, 1, 1).data[3] > 14);
      return samples.get(key);
    },
  };
}
