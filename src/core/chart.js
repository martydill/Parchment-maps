export function chartedCityIndicators(cities, isDiscovered, world) {
  return cities
    .filter((city) => isDiscovered(city))
    .map((city) => ({
      city,
      left: `${(city.x / world.w) * 100}%`,
      top: `${(city.y / world.h) * 100}%`,
    }));
}
