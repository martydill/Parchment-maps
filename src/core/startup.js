export function beginAtHomePort({ camera, homePort, ports, ship }) {
  const home = ports.find((port) => port.home);
  if (!home) throw new Error("Cannot begin a voyage without a home port");

  ship.x = homePort.spawnX;
  ship.y = homePort.spawnY;
  ship.angle = homePort.departureAngle;
  ship.speed = 0;
  ship.anchored = true;
  ship.trail = [];
  camera.x = ship.x;
  camera.y = ship.y;

  return home;
}

export function recoverNavigablePosition({
  fallback,
  isBlocked,
  position,
  searchRadius = 160,
  step = 16,
  samples = 24,
  wrapX = (x) => x,
}) {
  if (!isBlocked(position.x, position.y)) return position;

  for (let radius = step; radius <= searchRadius; radius += step) {
    for (let sample = 0; sample < samples; sample++) {
      const angle = (sample / samples) * Math.PI * 2;
      const candidate = {
        x: wrapX(position.x + Math.cos(angle) * radius),
        y: position.y + Math.sin(angle) * radius,
      };
      if (!isBlocked(candidate.x, candidate.y)) return candidate;
    }
  }

  return { ...fallback };
}

export function bindBeginButton(button, begin) {
  if (!button) throw new Error("Cannot bind the missing Begin button");
  button.addEventListener("click", begin);
}
