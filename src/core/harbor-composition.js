// Distant architecture follows the same footprints as the chart miniature.
// Heights and positions are normalized so a harbor keeps its silhouette in
// both a narrow banner and a full arrival painting.
export function harborSkyline(layout) {
  if (!layout) return [];
  const angle = layout.angle - 0.34;
  const project = (u, v) => u * Math.cos(angle) - v * Math.sin(angle);
  const buildings = layout.houses.map(([u, v, w, d, h, , z = 5, roof]) => ({
    x: project(u, v),
    width: Math.hypot(w, d) * 0.7,
    height: h + z,
    type: roof === "flat" ? "flat" : "roof",
    signature: false,
  }));
  layout.landmarks.forEach((mark, index) => {
    buildings.push({
      x: project(mark.u, mark.v),
      width: mark.w ?? (mark.type === "ribs" ? 30 : (mark.r ?? 7) * 2),
      height:
        ((mark.h ?? (mark.type === "ribs" ? 20 : 126)) + (mark.z ?? 5)) *
        (mark.scale ?? 1),
      type: mark.type,
      signature: index === layout.composition.signature,
    });
  });
  const left = Math.min(...buildings.map((item) => item.x - item.width / 2));
  const right = Math.max(...buildings.map((item) => item.x + item.width / 2));
  return buildings.map((item) => ({
    ...item,
    x: 0.1 + ((item.x - left) / (right - left)) * 0.8,
    width: (item.width / (right - left)) * 0.8,
    height: item.height / 420,
  }));
}

// Keep dockworkers on the promenade section nearest the active waterfront,
// rather than distributing movement over every district of the town.
export function harborFocalWalk(layout) {
  const { focus, site } = layout.composition;
  const [u, v] =
    focus === "awning"
      ? layout.awnings[site]
      : focus === "crane"
        ? layout.cranes[site]
        : layout.docks[site];
  let closest = 0;
  let distance = Infinity;
  for (let index = 0; index < layout.walk.length - 1; index++) {
    const first = layout.walk[index];
    const second = layout.walk[index + 1];
    const candidate = Math.hypot(
      (first[0] + second[0]) / 2 - u,
      (first[1] + second[1]) / 2 - v,
    );
    if (candidate < distance) {
      closest = index;
      distance = candidate;
    }
  }
  return layout.walk.slice(closest, closest + 2);
}
