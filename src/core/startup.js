export function beginAtHomePort({ camera, homePort, ports, ship }) {
  const home = ports.find((port) => port.home);
  if (!home) throw new Error("Cannot begin a voyage without a home port");

  ship.x = homePort.spawnX;
  ship.y = homePort.spawnY;
  ship.angle = homePort.departureAngle;
  ship.speed = 0;
  ship.anchored = true;
  ship.trail.length = 0;
  camera.x = ship.x;
  camera.y = ship.y;

  return home;
}

export function bindBeginButton(button, begin) {
  if (!button) throw new Error("Cannot bind the missing Begin button");
  button.addEventListener("click", begin);
}
