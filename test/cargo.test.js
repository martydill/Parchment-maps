import { PORT_NAMES, LAND_NAMES, FACTION_NAMES } from "../src/names.js";
import assert from "node:assert/strict";
import test from "node:test";

import {
  ageCargo,
  bestCargoCompartment,
  cargoCompartmentCapacities,
  cargoCondition,
  cargoLotDescription,
  cargoValueMultiplier,
  compartmentUsage,
  createCargoLot,
  grantCargo,
  moveCargoLot,
  normalizeCargoCompartments,
  normalizeCargoLot,
  normalizeCargoLots,
  resolveVoyageCargo,
  syncCargoCounts,
} from "../src/core/cargo.js";

test("cargo lots carry stable trade properties", () => {
  const lot = createCargoLot({
    key: "silk",
    cost: 20,
    origin: LAND_NAMES.lunemire,
    day: 4,
    sequence: 2,
    good: { fragility: 0.2 },
  });
  assert.equal(lot.origin, LAND_NAMES.lunemire);
  assert.equal(lot.age, 0);
  assert.equal(lot.compartment, "main");
  assert.match(lot.provenance.producer, new RegExp(`^${LAND_NAMES.lunemire} `));
  assert.ok(["ordinary", "notable", "renowned"].includes(lot.provenance.grade));
  assert.ok(["poor", "common", "fine", "masterwork"].includes(lot.quality));
  assert.equal(
    createCargoLot({
      key: "silk",
      cost: 20,
      origin: LAND_NAMES.lunemire,
      day: 4,
      sequence: 2,
    }).id,
    lot.id,
  );
});

test("cargo compartments divide hold capacity and unlock concealed storage", () => {
  assert.deepEqual(cargoCompartmentCapacities(18), {
    main: 12,
    secured: 3,
    dry: 3,
    concealed: 0,
  });
  assert.deepEqual(cargoCompartmentCapacities(18, { concealedLocker: true }), {
    main: 10,
    secured: 3,
    dry: 3,
    concealed: 2,
  });
  assert.equal(
    Object.values(
      cargoCompartmentCapacities(13, { concealedLocker: true }),
    ).reduce((sum, capacity) => sum + capacity, 0),
    13,
  );
  assert.deepEqual(cargoCompartmentCapacities(-2), {
    main: 0,
    secured: 0,
    dry: 0,
    concealed: 0,
  });
  assert.deepEqual(cargoCompartmentCapacities(2.9), {
    main: 0,
    secured: 2,
    dry: 0,
    concealed: 0,
  });
  assert.deepEqual(cargoCompartmentCapacities(2, { concealedLocker: true }), {
    main: 0,
    secured: 2,
    dry: 0,
    concealed: 0,
  });
});

test("cargo can be moved only into known compartments with free capacity", () => {
  const lots = [
    { id: "a", compartment: "main" },
    { id: "b", compartment: "secured" },
  ];
  const capacities = { main: 1, secured: 1, dry: 1, concealed: 0 };
  assert.deepEqual(compartmentUsage(lots), {
    main: 1,
    secured: 1,
    dry: 0,
    concealed: 0,
  });
  assert.equal(
    compartmentUsage([{ compartment: "temporary-deck" }])["temporary-deck"],
    1,
  );
  assert.equal(moveCargoLot(lots, "a", "main", capacities).ok, true);
  assert.equal(moveCargoLot(lots, "a", "secured", capacities).ok, false);
  assert.equal(
    moveCargoLot(lots, "a", "concealed", {
      main: 1,
      secured: 1,
      dry: 1,
    }).ok,
    false,
  );
  assert.equal(moveCargoLot(lots, "missing", "dry", capacities).ok, false);
  assert.equal(moveCargoLot(lots, "a", "bilge", capacities).ok, false);
  assert.equal(moveCargoLot(lots, "a", "dry", capacities).ok, true);
  assert.equal(lots[0].compartment, "dry");
});

test("normalization repairs invalid and overfilled compartment assignments", () => {
  const lots = [
    { id: "a", compartment: "concealed" },
    { id: "b", compartment: "secured" },
    { id: "c", compartment: "secured" },
  ];
  normalizeCargoCompartments(lots, {
    main: 1,
    secured: 1,
    dry: 1,
    concealed: 0,
  });
  assert.deepEqual(
    lots.map((lot) => lot.compartment),
    ["main", "secured", "dry"],
  );
  const overflow = [{ id: "overflow", compartment: "unknown" }];
  normalizeCargoCompartments(overflow, {
    main: 0,
    secured: 0,
    dry: 0,
    concealed: 0,
  });
  assert.equal(overflow[0].compartment, "main");
});

test("automatic stowage prioritizes protection suited to each cargo lot", () => {
  const capacities = { main: 3, secured: 1, dry: 1, concealed: 1 };
  assert.equal(
    bestCargoCompartment(
      { legalStatus: "embargoed", fragility: 1, perishRate: 1 },
      capacities,
      [],
    ),
    "concealed",
  );
  assert.equal(
    bestCargoCompartment(
      { legalStatus: "legal", fragility: 0, perishRate: 0.1 },
      capacities,
      [],
    ),
    "dry",
  );
  assert.equal(
    bestCargoCompartment(
      { legalStatus: "legal", fragility: 1, perishRate: 0 },
      capacities,
      [],
    ),
    "secured",
  );
  assert.equal(
    bestCargoCompartment(
      { legalStatus: "legal", fragility: 0, perishRate: 0 },
      capacities,
      [],
    ),
    "main",
  );
  assert.equal(
    bestCargoCompartment(
      { legalStatus: "legal", fragility: 0, perishRate: 0 },
      { main: 0, secured: 0, dry: 0, concealed: 0 },
      [],
    ),
    "main",
  );
});

test("perishable cargo ages and loses value while premium origins retain market appeal", () => {
  const medicine = {
    quality: "fine",
    age: 0,
    perishRate: 0.08,
    origin: PORT_NAMES.orvessaQuay,
    legalStatus: "legal",
  };
  const fresh = cargoValueMultiplier(medicine, PORT_NAMES.narthkel);
  ageCargo([medicine], 5);
  assert.equal(medicine.age, 5);
  assert.ok(cargoValueMultiplier(medicine, PORT_NAMES.narthkel) < fresh);
  const silk = {
    quality: "fine",
    age: 0,
    origin: LAND_NAMES.lunemire,
    legalStatus: "legal",
  };
  assert.ok(
    cargoValueMultiplier(silk, PORT_NAMES.velquorin, {
      premiumPorts: [PORT_NAMES.velquorin],
    }) > 1.4,
  );
});

test("cargo condition communicates shelf life as lots age", () => {
  assert.deepEqual(cargoCondition({ age: 99, perishRate: 0 }), {
    id: "stable",
    label: "Shelf-stable",
    freshness: 1,
  });
  assert.equal(cargoCondition({ age: 1, perishRate: 0.1 }).id, "fresh");
  assert.equal(cargoCondition({ age: 2, perishRate: 0.1 }).id, "sound");
  assert.equal(cargoCondition({ age: 5, perishRate: 0.1 }).id, "stale");
  assert.equal(cargoCondition({ age: 8, perishRate: 0.1 }).id, "spoiled");
  assert.equal(cargoCondition({ age: "bad" }, { perishRate: 0.1 }).id, "fresh");
});

test("cargo normalization migrates quality, age, and provenance fields", () => {
  const lot = normalizeCargoLot(
    {
      cost: "12",
      origin: "",
      acquiredDay: -4,
      age: -2,
      quality: "mythic",
      provenance: { producer: "", grade: "invented" },
      legalStatus: "unknown",
      fragility: 8,
      factionOwner: "",
      perishRate: -1,
      compartment: "deck",
    },
    "fruit",
    { base: 9, perishRate: 0.08 },
    PORT_NAMES.orvessaQuay,
    6,
    3,
  );
  assert.deepEqual(lot, {
    id: "legacy-fruit-3",
    key: "fruit",
    cost: 12,
    origin: PORT_NAMES.orvessaQuay,
    acquiredDay: 6,
    age: 0,
    quality: "common",
    provenance: {
      producer: `${PORT_NAMES.orvessaQuay} Harbor Factors`,
      grade: "ordinary",
    },
    legalStatus: "legal",
    fragility: 1,
    factionOwner: null,
    perishRate: 0.08,
    compartment: "main",
  });

  const preserved = normalizeCargoLot(
    {
      id: "fine-lot",
      cost: null,
      origin: PORT_NAMES.narthkel,
      acquiredDay: 3,
      age: 2,
      quality: "fine",
      provenance: {
        producer: `${PORT_NAMES.narthkel} Forge`,
        grade: "renowned",
      },
      legalStatus: "embargoed",
      fragility: 0.4,
      factionOwner: "Guild",
      perishRate: 0.02,
      compartment: "dry",
    },
    "iron",
    { base: 18 },
  );
  assert.equal(preserved.id, "fine-lot");
  assert.equal(preserved.cost, 0);
  assert.equal(preserved.provenance.grade, "renowned");
  assert.equal(preserved.compartment, "dry");

  const empty = normalizeCargoLot(null, "iron", { base: 18 }, "Unknown", 0);
  assert.equal(empty.acquiredDay, 1);
  assert.equal(empty.cost, 18);
  assert.equal(empty.perishRate, 0);
  assert.equal(normalizeCargoLot(null, "unknown").cost, 0);
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
      /Common · Shelf-stable · Oldport Harbor Factors/,
    );
  } finally {
    Object.groupBy = originalGroupBy;
  }
});

test("legacy cargo normalization can assign lots to available compartments", () => {
  const game = {
    day: 2,
    cargo: { iron: 2 },
    cargoCost: { iron: [10, 12] },
    cargoLots: [
      { id: "a", key: "iron", cost: 10, compartment: "concealed" },
      { id: "b", key: "iron", cost: 12, compartment: "secured" },
    ],
  };
  normalizeCargoLots(game, { iron: { base: 9 } }, "Oldport", {
    main: 1,
    secured: 1,
    dry: 0,
    concealed: 0,
  });
  assert.deepEqual(
    game.cargoLots.map((lot) => lot.compartment),
    ["main", "secured"],
  );
});

test("deterministic cargo generation covers special qualities and legal states", () => {
  const lots = Array.from({ length: 5000 }, (_, sequence) =>
    createCargoLot({
      key: "spice",
      cost: 28,
      origin: PORT_NAMES.mirravel,
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
      origin: PORT_NAMES.narthkel,
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
    origin: PORT_NAMES.drazhOvek,
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

  const invalidKeyGame = {
    day: 1,
    cargo: { iron: 0 },
    cargoCost: { iron: [] },
    cargoLots: [{ key: "unknown", cost: 4 }, null],
  };
  normalizeCargoLots(invalidKeyGame, { iron: { base: 18 } });
  assert.deepEqual(invalidKeyGame.cargoLots, []);
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
    origin: PORT_NAMES.orvessaQuay,
    legalStatus: "legal",
  };
  assert.equal(cargoValueMultiplier(base, PORT_NAMES.narthkel), 1);
  assert.equal(
    cargoValueMultiplier(
      {
        ...base,
        quality: "fine",
        provenance: { grade: "renowned" },
      },
      PORT_NAMES.narthkel,
    ),
    1.24 * 1.18,
  );
  assert.equal(cargoValueMultiplier(base, PORT_NAMES.orvessaQuay), 0.94);
  assert.equal(
    cargoValueMultiplier(
      { ...base, legalStatus: "embargoed" },
      PORT_NAMES.narthkel,
    ),
    1.38,
  );
  assert.equal(
    cargoValueMultiplier(
      { ...base, legalStatus: "counterfeit" },
      PORT_NAMES.narthkel,
    ),
    0.82,
  );
  assert.equal(
    cargoValueMultiplier(base, PORT_NAMES.velquorin, {
      premiumPorts: [PORT_NAMES.velquorin],
    }),
    1.22,
  );
  assert.equal(
    cargoValueMultiplier({ ...base, age: 100 }, PORT_NAMES.narthkel, {
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

test("dry storage slows the effective age of perishable cargo", () => {
  const lots = [
    { age: 0, compartment: "main" },
    { age: 0, compartment: "dry" },
  ];
  ageCargo(lots, 4);
  assert.equal(lots[0].age, 4);
  assert.equal(lots[1].age, 1.8);
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

test("secured and concealed compartments reduce voyage cargo risks", () => {
  const fragile = {
    id: "fragile",
    fragility: 1,
    legalStatus: "legal",
  };
  const contraband = {
    id: "contraband",
    fragility: 0,
    legalStatus: "embargoed",
  };
  const voyage = {
    distance: 1800,
    roughness: 0.7,
    inspectionRisk: 2,
  };
  let securedSavedCargo = false;
  let concealmentAvoidedSeizure = false;
  for (let seed = 0; seed < 500; seed += 1) {
    const unprotected = resolveVoyageCargo(
      [
        { ...fragile, compartment: "main" },
        { ...contraband, compartment: "main" },
      ],
      { ...voyage, seed },
    );
    const protectedCargo = resolveVoyageCargo(
      [
        { ...fragile, compartment: "secured" },
        { ...contraband, compartment: "concealed" },
      ],
      { ...voyage, seed },
    );
    securedSavedCargo ||= Boolean(
      unprotected.lost.length && !protectedCargo.lost.length,
    );
    concealmentAvoidedSeizure ||= Boolean(
      unprotected.confiscated.length && !protectedCargo.confiscated.length,
    );
  }
  assert.equal(securedSavedCargo, true);
  assert.equal(concealmentAvoidedSeizure, true);
});

test("cargo descriptions include every optional detail and fallback label", () => {
  assert.equal(
    cargoLotDescription({
      quality: "unknown",
      origin: LAND_NAMES.lunemire,
      age: 4,
      fragility: 0.4,
      legalStatus: "embargoed",
      factionOwner: FACTION_NAMES.mirrorKnives,
    }),
    `${"Common · Shelf-stable · from "}${LAND_NAMES.lunemire} · 4d old · fragile · Embargoed · ${FACTION_NAMES.mirrorKnives} cargo`,
  );
  assert.match(
    cargoLotDescription({
      quality: "masterwork",
      origin: PORT_NAMES.velquorin,
      age: 0,
      fragility: 0.7,
      legalStatus: "legal",
      factionOwner: null,
    }),
    new RegExp(
      `^Masterwork · Shelf-stable · from ${PORT_NAMES.velquorin} · very fragile$`,
    ),
  );
  assert.match(
    cargoLotDescription({
      quality: "common",
      origin: PORT_NAMES.orvessaQuay,
      legalStatus: "legal",
      compartment: "dry",
    }),
    /Dry locker$/,
  );
  assert.match(
    cargoLotDescription({
      quality: "fine",
      origin: PORT_NAMES.orvessaQuay,
      age: 1,
      perishRate: 0.1,
      provenance: {
        producer: `${PORT_NAMES.orvessaQuay} Crown Exchange`,
        grade: "notable",
      },
      legalStatus: "legal",
      compartment: "main",
    }),
    new RegExp(
      `Fresh · ${PORT_NAMES.orvessaQuay} Crown Exchange · Notable provenance`,
    ),
  );
});

test("grantCargo loads recovered goods into the hold and syncs counts", () => {
  const goods = { ore: { name: "Iron Ore", base: 11 } };
  const game = { cargoLots: [], cargo: {}, cargoCost: {} };
  const capacities = cargoCompartmentCapacities(20);
  const result = grantCargo(game, "ore", 3, goods, capacities, {
    origin: "Moon-Iron Seam",
    day: 5,
  });
  assert.equal(result.granted, 3);
  assert.equal(result.requested, 3);
  assert.equal(game.cargoLots.length, 3);
  assert.equal(game.cargo.ore, 3);
  assert.equal(game.cargoCost.ore.length, 3);
  for (const lot of game.cargoLots) {
    assert.equal(lot.key, "ore");
    assert.equal(lot.origin, "Moon-Iron Seam");
  }
});

test("grantCargo clamps to remaining hold capacity", () => {
  const goods = { ore: { name: "Iron Ore", base: 11 } };
  const game = { cargoLots: [], cargo: {}, cargoCost: {} };
  const capacities = cargoCompartmentCapacities(4);
  assert.equal(grantCargo(game, "ore", 3, goods, capacities).granted, 3);
  const overflow = grantCargo(game, "ore", 3, goods, capacities);
  assert.equal(overflow.granted, 1);
  assert.equal(overflow.requested, 3);
  assert.equal(game.cargoLots.length, 4);
});

test("grantCargo grants nothing when the hold is full or the good is unknown", () => {
  const goods = { ore: { name: "Iron Ore", base: 11 } };
  const fullGame = { cargoLots: [], cargo: {}, cargoCost: {} };
  const tightCapacities = cargoCompartmentCapacities(2);
  grantCargo(fullGame, "ore", 2, goods, tightCapacities);
  assert.equal(
    grantCargo(fullGame, "ore", 1, goods, tightCapacities).granted,
    0,
  );
  assert.equal(fullGame.cargoLots.length, 2);

  const emptyGame = { cargoLots: [], cargo: {}, cargoCost: {} };
  const rejected = grantCargo(
    emptyGame,
    "unobtainium",
    2,
    goods,
    cargoCompartmentCapacities(20),
  );
  assert.equal(rejected.granted, 0);
  assert.ok(rejected.reason);
  assert.equal(emptyGame.cargoLots.length, 0);
});
