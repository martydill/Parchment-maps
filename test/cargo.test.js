import assert from "node:assert/strict";
import test from "node:test";

import {
  ageCargo,
  cargoLotDescription,
  cargoValueMultiplier,
  createCargoLot,
  normalizeCargoLots,
  resolveVoyageCargo,
} from "../src/core/cargo.js";

test("cargo lots carry stable trade properties", () => {
  const lot = createCargoLot({
    key: "silk",
    cost: 20,
    origin: "Mistmere",
    day: 4,
    sequence: 2,
    good: { fragility: 0.2 },
  });
  assert.equal(lot.origin, "Mistmere");
  assert.equal(lot.age, 0);
  assert.ok(["poor", "common", "fine", "masterwork"].includes(lot.quality));
  assert.equal(
    createCargoLot({
      key: "silk",
      cost: 20,
      origin: "Mistmere",
      day: 4,
      sequence: 2,
    }).id,
    lot.id,
  );
});

test("perishable cargo ages and loses value while premium origins retain market appeal", () => {
  const medicine = {
    quality: "fine",
    age: 0,
    perishRate: 0.08,
    origin: "Goldhaven",
    legalStatus: "legal",
  };
  const fresh = cargoValueMultiplier(medicine, "Rimegate");
  ageCargo([medicine], 5);
  assert.equal(medicine.age, 5);
  assert.ok(cargoValueMultiplier(medicine, "Rimegate") < fresh);
  const silk = {
    quality: "fine",
    age: 0,
    origin: "Mistmere",
    legalStatus: "legal",
  };
  assert.ok(
    cargoValueMultiplier(silk, "Lethariel", { premiumPorts: ["Lethariel"] }) >
      1.4,
  );
});

test("rough voyages can break fragile cargo and customs can confiscate illegal lots", () => {
  const fragile = { id: "fragile", fragility: 1, legalStatus: "legal" };
  const embargoed = { id: "illegal", fragility: 0, legalStatus: "embargoed" };
  const result = resolveVoyageCargo([fragile, embargoed], {
    distance: 10000,
    roughness: 1,
    inspectionRisk: 10,
    seed: 3,
  });
  assert.equal(result.lost.length, 1);
  assert.equal(result.confiscated.length, 1);
});

test("legacy cargo is normalized into ordinary lots", () => {
  const game = { day: 2, cargo: { iron: 2 }, cargoCost: { iron: [10, 12] } };
  normalizeCargoLots(game, { iron: { base: 9 } }, "Oldport");
  assert.equal(game.cargoLots.length, 2);
  assert.deepEqual(game.cargoCost.iron, [10, 12]);
  assert.match(cargoLotDescription(game.cargoLots[0]), /Common · from Oldport/);
});
