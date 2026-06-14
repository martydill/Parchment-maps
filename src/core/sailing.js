import { clamp } from "./math.js";

export function readSailingInput(keys, input, currentAngle) {
  let dx = input.x;
  let dy = input.y;
  let power = input.power;
  let keyboardX = 0;
  let keyboardY = 0;

  if (keys.has("arrowleft") || keys.has("a")) keyboardX--;
  if (keys.has("arrowright") || keys.has("d")) keyboardX++;
  if (keys.has("arrowup") || keys.has("w")) keyboardY--;
  if (keys.has("arrowdown") || keys.has("s")) keyboardY++;

  const keyboardActive = keyboardX !== 0 || keyboardY !== 0;
  if (keyboardActive) {
    const length = Math.hypot(keyboardX, keyboardY);
    dx = keyboardX / length;
    dy = keyboardY / length;
    power = 1;
  }

  if (power < 0.14) {
    return {
      active: false,
      desiredAngle: currentAngle,
      power: 0,
      keyboardActive,
    };
  }
  return {
    active: true,
    desiredAngle: Math.atan2(dy, dx),
    power: Math.min(1, power),
    keyboardActive,
  };
}

export function edgeInwardVector(y, worldHeight, recoveryZone) {
  let inwardY = 0;
  let strength = 0;
  if (y < recoveryZone) {
    const topStrength = (recoveryZone - y) / recoveryZone;
    inwardY += topStrength;
    strength = Math.max(strength, topStrength);
  }
  if (y > worldHeight - recoveryZone) {
    const bottomStrength = (y - (worldHeight - recoveryZone)) / recoveryZone;
    inwardY -= bottomStrength;
    strength = Math.max(strength, bottomStrength);
  }
  return {
    x: 0,
    y: inwardY ? Math.sign(inwardY) : 0,
    strength: clamp(strength, 0, 1),
  };
}

export function limitOutwardWind(
  windX,
  windY,
  y,
  worldHeight,
  mapMargin,
  recoveryZone,
) {
  const top = clamp((y - mapMargin) / (recoveryZone - mapMargin), 0, 1);
  const bottom = clamp(
    (worldHeight - mapMargin - y) / (recoveryZone - mapMargin),
    0,
    1,
  );
  if (windY < 0) windY *= top;
  if (windY > 0) windY *= bottom;
  return { x: windX, y: windY };
}
