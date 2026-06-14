import assert from "node:assert/strict";
import test from "node:test";

import {
  ageCargo,
  cargoLotDescription,
  cargoValueMultiplier,
  createCargoLot,
  normalizeCargoLots,
  resolveVoyageCargo,
  syncCargoCounts,
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
  const originalGroupBy = Object.groupBy;
  delete Object.groupBy;
  try {
    const game = {
      day: 2,
      cargo: { iron: 2 },
      cargoCost: { iron: [10, 12] },
      cargoLots: [{ key: "iron", cost: 10, origin: "Oldport" }],
    };
    normalizeCargoLots(game, { iron: { base: 9 } }, "Oldport");
    assert.equal(game.cargoLots.length, 2);
    assert.deepEqual(game.cargoCost.iron, [10, 12]);
    assert.match(
      cargoLotDescription(game.cargoLots[1]),
      /Common · from Oldport/,
    );
  } finally {
    Object.groupBy = originalGroupBy;
  }
});

test("deterministic cargo generation covers special qualities and legal states", () => {
  const lots = Array.from({ length: 5000 }, (_, sequence) =>
    createCargoLot({
      key: "spice",
      cost: 28,
      origin: "Glasswater",
      day: 7,
      sequence,
      good: { faction: "Pearl Senate", perishRate: 0.04 },
    }),
  );

  assert.deepEqual(
    new Set(lots.map((lot) => lot.quality)),
    new Set(["poor", "common", "fine", "masterwork"]),
  );
  assert.ok(lots.some((lot) => lot.legalStatus === "counterfeit"));
  assert.ok(lots.some((lot) => lot.legalStatus === "embargoed"));
  assert.ok(lots.some((lot) => lot.factionOwner === "Pearl Senate"));
  assert.ok(lots.some((lot) => lot.fragility > 0));
  assert.ok(lots.some((lot) => lot.fragility === 0));
  assert.ok(lots.every((lot) => lot.perishRate === 0.04));

  const independent = Array.from({ length: 1000 }, (_, sequence) =>
    createCargoLot({
      key: "ore",
      cost: 11,
      origin: "Rimegate",
      day: 8,
      sequence,
    }),
  ).find((lot) => lot.factionOwner);
  assert.equal(independent.factionOwner, "Independent Factors");
});

test("normalization preserves existing lots and fills all legacy defaults", () => {
  const existing = {
    id: "existing",
    key: "iron",
    cost: 20,
    origin: "Khaz Vhar",
  };
  const game = {
    day: 5,
    cargo: { iron: 2, herbs: 1, grain: -4 },
    cargoCost: { iron: [20], herbs: [] },
    cargoLots: [existing],
  };

  normalizeCargoLots(
    game,
    {
      iron: { base: 18 },
      herbs: { base: 16, perishRate: 0.05 },
      grain: { base: 9 },
    },
    undefined,
  );

  assert.equal(game.cargoLots[0], existing);
  assert.equal(game.cargoLots[1].cost, 18);
  assert.equal(game.cargoLots[2].cost, 16);
  assert.equal(game.cargoLots[2].origin, "Unknown");
  assert.equal(game.cargoLots[2].perishRate, 0.05);
  assert.deepEqual(game.cargo, { iron: 2, herbs: 1, grain: 0 });
  assert.deepEqual(game.cargoCost, { iron: [20, 18], herbs: [16], grain: [] });

  const emptyLegacyGame = {
    day: 1,
    cargo: {},
    cargoCost: {},
    cargoLots: null,
  };
  normalizeCargoLots(emptyLegacyGame, { silk: { base: 34 } });
  assert.deepEqual(emptyLegacyGame.cargoLots, []);
  assert.equal(emptyLegacyGame.cargo.silk, 0);
});

test("normalization supports runtimes with Object.groupBy", () => {
  const originalGroupBy = Object.groupBy;
  let called = false;
  Object.groupBy = (items, callback) => {
    called = true;
    return items.reduce((groups, item) => {
      (groups[callback(item)] ||= []).push(item);
      return groups;
    }, {});
  };

  try {
    const game = {
      day: 1,
      cargo: { silk: 1 },
      cargoCost: { silk: [34] },
      cargoLots: [{ key: "silk", cost: 34 }],
    };
    normalizeCargoLots(game, { silk: { base: 34 } });
    assert.equal(called, true);
    assert.equal(game.cargoLots.length, 1);
  } finally {
    if (originalGroupBy) Object.groupBy = originalGroupBy;
    else delete Object.groupBy;
  }
});

test("cargo counts synchronize empty and populated goods", () => {
  const game = {
    cargoLots: [
      { key: "iron", cost: 18 },
      { key: "iron", cost: 21 },
    ],
    cargo: {},
    cargoCost: {},
  };
  syncCargoCounts(game, { iron: {}, silk: {} });
  assert.deepEqual(game.cargo, { iron: 2, silk: 0 });
  assert.deepEqual(game.cargoCost, { iron: [18, 21], silk: [] });
});

test("cargo valuation covers quality, provenance, legality, and spoilage", () => {
  const base = {
    quality: "unknown",
    age: 0,
    origin: "Goldhaven",
    legalStatus: "legal",
  };
  assert.equal(cargoValueMultiplier(base, "Rimegate"), 1);
  assert.equal(cargoValueMultiplier(base, "Goldhaven"), 0.94);
  assert.equal(
    cargoValueMultiplier({ ...base, legalStatus: "embargoed" }, "Rimegate"),
    1.38,
  );
  assert.equal(
    cargoValueMultiplier({ ...base, legalStatus: "counterfeit" }, "Rimegate"),
    0.82,
  );
  assert.equal(
    cargoValueMultiplier(base, "Lethariel", {
      premiumPorts: ["Lethariel"],
    }),
    1.22,
  );
  assert.equal(
    cargoValueMultiplier({ ...base, age: 100 }, "Rimegate", {
      perishRate: 0.1,
    }),
    0.25,
  );
});

test("aging clamps missing and negative cargo ages", () => {
  const lots = [{}, { age: 2 }];
  ageCargo(lots, -5);
  assert.deepEqual(lots, [{ age: 0 }, { age: 0 }]);
});

test("voyage resolution distinguishes losses, confiscations, and safe cargo", () => {
  const counterfeit = {
    id: "counterfeit",
    fragility: 0,
    legalStatus: "counterfeit",
  };
  const embargoed = {
    id: "embargoed-safe",
    fragility: 0,
    legalStatus: "embargoed",
  };
  const legal = { id: "legal", fragility: 0, legalStatus: "legal" };
  const result = resolveVoyageCargo([counterfeit, embargoed, legal], {
    distance: 10,
    inspectionRisk: 10,
    seed: 3,
  });

  assert.deepEqual(result.confiscated, [counterfeit, embargoed]);
  assert.deepEqual(result.counterfeits, [counterfeit]);
  assert.deepEqual(result.remaining, [legal]);
  assert.deepEqual(result.lost, []);

  const noInspection = resolveVoyageCargo([embargoed], {
    distance: 10,
    inspectionRisk: -10,
    seed: 3,
  });
  assert.deepEqual(noInspection.remaining, [embargoed]);
});

test("cargo descriptions include every optional detail and fallback label", () => {
  assert.equal(
    cargoLotDescription({
      quality: "unknown",
      origin: "Mistmere",
      age: 4,
      fragility: 0.4,
      legalStatus: "embargoed",
      factionOwner: "Mirror Knives",
    }),
    "Common · from Mistmere · 4d old · fragile · Embargoed · Mirror Knives cargo",
  );
  assert.match(
    cargoLotDescription({
      quality: "masterwork",
      origin: "Lethariel",
      age: 0,
      fragility: 0.7,
      legalStatus: "legal",
      factionOwner: null,
    }),
    /^Masterwork · from Lethariel · very fragile$/,
  );
});
