import test from "node:test";
import assert from "node:assert/strict";

import { chartedCityIndicators } from "../src/core/chart.js";

test("charted city indicators include only discovered cities at map percentages", () => {
  const cities = [
    { name: "Westhaven", x: 0, y: 250 },
    { name: "Eastwatch", x: 1000, y: 500 },
    { name: "Hidden Cay", x: 500, y: 100 },
  ];

  const indicators = chartedCityIndicators(
    cities,
    (city) => city.name !== "Hidden Cay",
    { w: 1000, h: 500 },
  );

  assert.deepEqual(indicators, [
    { city: cities[0], left: "0%", top: "50%" },
    { city: cities[1], left: "100%", top: "100%" },
  ]);
});

test("charted city indicators can return an empty chart", () => {
  assert.deepEqual(
    chartedCityIndicators([{ name: "Unknown", x: 10, y: 20 }], () => false, {
      w: 100,
      h: 100,
    }),
    [],
  );
});
