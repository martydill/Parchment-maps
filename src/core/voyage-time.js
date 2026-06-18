export const SAILING_SECONDS_PER_DAY = 12;
export const BASELINE_WORLD_SPEED = 175;
export const ESTIMATED_CRUISE_SPEED_FACTOR = 0.5;

export function estimateVoyageDays(
  distance,
  {
    maxSpeed = BASELINE_WORLD_SPEED,
    daysMultiplier = 1,
    speedMultiplier = 1,
    cruiseSpeedFactor = ESTIMATED_CRUISE_SPEED_FACTOR,
  } = {},
) {
  const effectiveSpeed =
    Math.max(1, Number(maxSpeed) || BASELINE_WORLD_SPEED) *
    Math.max(0.1, Number(speedMultiplier) || 1) *
    Math.max(0.1, Number(cruiseSpeedFactor) || ESTIMATED_CRUISE_SPEED_FACTOR);
  const realSeconds = Math.max(0, Number(distance) || 0) / effectiveSpeed;
  return Math.max(
    1,
    Math.ceil(
      (realSeconds / SAILING_SECONDS_PER_DAY) *
        Math.max(0.1, Number(daysMultiplier) || 1),
    ),
  );
}
