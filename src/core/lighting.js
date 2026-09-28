// Map space is lit from the northwest and above. Keep this direction shared
// by the cached terrain and ports and the moving ship models.
export const LIGHT_DIRECTION = Object.freeze({ x: -0.55, y: -0.45, z: 0.7 });

function smoothstep(start, end, value) {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

export function sceneLighting(dayProgress = 0, roughness = 0) {
  const progress = Math.max(0, Math.min(1, Number(dayProgress) || 0));
  const seas = Math.max(0, Number(roughness) || 0);
  const dusk =
    smoothstep(0.58, 0.82, progress) * (1 - smoothstep(0.88, 1, progress));
  const storm = smoothstep(0.2, 0.48, seas);
  return { dusk, storm, strength: 1 - dusk * 0.17 - storm * 0.34 };
}
