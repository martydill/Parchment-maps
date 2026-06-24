import assert from "node:assert/strict";
import test from "node:test";

import {
  assignCaptain,
  assignRoute,
  captainVoyageModifiers,
  clearFleetRoute,
  commissionFleetShip,
  createFleetState,
  createRouteTemplate,
  decommissionFleetShip,
  fleetMovementSpeed,
  fleetOutcomeSeed,
  fleetRenderObject,
  fleetRoll,
  fleetRoutePaths,
  fleetShipStats,
  loadDepartureCargo,
  normalizeFleetShip,
  normalizeFleetState,
  normalizeStatus,
  parseShipIdNumber,
  resolveFleetArrival,
  resolveFleetHazard,
  runFleetDay,
  suggestRouteTemplates,
  updateFleetShip,
  FLEET_BASE_SPEED,
  FLEET_COMMISSION_FITTING_FEE,
  FLEET_DECOMMISSION_REFUND_FRACTION,
  FLEET_MIN_BUY,
  FLEET_PALETTE,
  FLEET_PROVISION_COST,
} from "../src/core/fleet.js";
import { createSpecialistState } from "../src/core/specialists.js";
import { SHIP_CLASSES } from "../src/core/upgrades.js";
import { pointAlongPath } from "../src/core/routes.js";
import { generateFleetShipName, RESERVED_SHIP_NAMES } from "../src/names.js";

function makeCtx() {
  const portX = { A: 100, B: 300, C: 500, D: 950, E: 50 };
  return {
    worldWidth: 1000,
    portX: (name) => (name in portX ? portX[name] : 0),
    routes: [
      {
        a: "A",
        b: "B",
        points: [
          [100, 0],
          [300, 0],
        ],
      },
      {
        a: "B",
        b: "C",
        points: [
          [300, 0],
          [500, 0],
        ],
      },
      {
        a: "A",
        b: "C",
        points: [
          [100, 0],
          [500, 0],
        ],
      },
      {
        a: "D",
        b: "E",
        points: [
          [950, 0],
          [50, 0],
        ],
      },
    ],
  };
}

function makeGame(coins = 1000, fleet) {
  return { coins, fleet };
}

test("fleet state defaults to an empty fleet", () => {
  const state = createFleetState();
  assert.deepEqual(state.ships, []);
  assert.deepEqual(state.templates, []);
  assert.deepEqual(state.captainAssignments, {});
  assert.equal(state.nextId, 1);
});

test("normalizeFleetState returns a fresh state for non-object input", () => {
  for (const invalid of [undefined, null, "fleet", 42]) {
    const normalized = normalizeFleetState(invalid);
    assert.deepEqual(normalized, createFleetState());
  }
});

test("normalizeFleetState coerces bad collections and derives nextId", () => {
  const normalized = normalizeFleetState({ ships: "nope", nextId: 5 });
  assert.deepEqual(normalized.ships, []);
  assert.equal(normalized.nextId, 5);
  assert.deepEqual(normalized.templates, []);

  const withShips = normalizeFleetState({
    ships: [
      { id: "F7", classId: "sloop" },
      { id: "F3", classId: "cutter" },
    ],
  });
  assert.equal(withShips.ships.length, 2);
  assert.equal(withShips.nextId, 8); // max ship id (7) + 1
});

test("normalizeFleetShip drops non-objects and repairs fields", () => {
  assert.equal(normalizeFleetShip(null), null);
  assert.equal(normalizeFleetShip("x"), null);

  const repaired = normalizeFleetShip({
    id: "F2",
    classId: "warship", // unknown -> cutter
    operations: { provisions: 999, morale: -5 },
    distance: -10,
    color: "",
    status: "sinking",
    captain: 7,
    origin: 12,
    cargoKey: null,
    name: "",
  });
  assert.equal(repaired.classId, "cutter");
  assert.equal(repaired.name, "Fleet vessel");
  assert.equal(repaired.color, FLEET_PALETTE[0]);
  assert.equal(repaired.status, "laidUp");
  assert.equal(repaired.captain, null);
  assert.equal(repaired.origin, null);
  assert.equal(repaired.cargoKey, null);
  assert.equal(repaired.distance, 0);
  assert.ok(repaired.holdMax >= 1);
  assert.equal(repaired.operations.provisions, 30); // operations normalize clamps

  const preserved = normalizeFleetShip({
    id: "F9",
    classId: "carrack",
    name: "The Amber Heron",
    color: "#ffffff",
    status: "sailing",
    captain: "navigator",
    origin: "Orvessa Quay",
    cargoKey: "spice",
    cargoUnits: 4,
    legCount: 2,
    totalRevenue: 120,
  });
  assert.equal(preserved.classId, "carrack");
  assert.equal(preserved.name, "The Amber Heron");
  assert.equal(preserved.color, "#ffffff");
  // No route on the saved vessel -> corrected to laid up (cannot sail nowhere).
  assert.equal(preserved.status, "laidUp");
  assert.equal(preserved.captain, "navigator");
  assert.equal(preserved.origin, "Orvessa Quay");
  assert.equal(preserved.cargoUnits, 4);
  assert.equal(preserved.totalRevenue, 120);
});

test("normalizeFleetShip assigns a fallback id when missing", () => {
  const noId = normalizeFleetShip({ classId: "cutter" });
  assert.equal(noId.id, "F1");
});

test("normalizeStatus only accepts known fleet statuses", () => {
  assert.equal(normalizeStatus("sailing"), "sailing");
  assert.equal(normalizeStatus("repairing"), "repairing");
  assert.equal(normalizeStatus("laidUp"), "laidUp");
  assert.equal(normalizeStatus("underwater"), "laidUp");
  assert.equal(normalizeStatus(undefined), "laidUp");
});

test("parseShipIdNumber reads the numeric suffix or returns zero", () => {
  assert.equal(parseShipIdNumber("F7"), 7);
  assert.equal(parseShipIdNumber("F1"), 1);
  assert.equal(parseShipIdNumber("nope"), 0);
  assert.equal(parseShipIdNumber(undefined), 0);
});

test("normalizeFleetShip preserves a valid route and sailing status across reload", () => {
  const game = makeGame();
  const { ship } = commissionFleetShip(game, "cutter");
  assignRoute(game, ship.id, ["A", "B"], makeCtx());
  ship.distance = 42;
  const reloaded = normalizeFleetShip(JSON.parse(JSON.stringify(ship)));
  assert.notEqual(reloaded.route, null);
  assert.equal(reloaded.route.ports.length, 2);
  assert.equal(reloaded.route.legs.length, 2);
  assert.equal(reloaded.route.legs[0].routeLength, 200); // A(100) -> B(300)
  assert.equal(reloaded.status, "sailing");
  assert.equal(reloaded.origin, "A");
  assert.equal(reloaded.destination, "B");
  assert.equal(reloaded.distance, 42);
});

test("normalizeFleetShip drops malformed routes and lays the vessel up", () => {
  // Too few ports.
  assert.equal(
    normalizeFleetShip({ id: "F1", classId: "cutter", route: { ports: ["A"] } })
      .route,
    null,
  );
  // Too few legs for the port count.
  assert.equal(
    normalizeFleetShip({
      id: "F2",
      classId: "cutter",
      route: { ports: ["A", "B"], legs: [] },
    }).route,
    null,
  );
  // A route object that is not actually an object.
  assert.equal(
    normalizeFleetShip({ id: "F3", classId: "cutter", route: "nope" }).route,
    null,
  );
});

test("normalizeFleetShip drops a route when any leg is malformed", () => {
  const goodLeg = {
    a: "A",
    b: "B",
    points: [
      [0, 0],
      [100, 0],
    ],
    routeLength: 100,
  };
  const badLegs = [
    null,
    {
      b: "B",
      points: [
        [0, 0],
        [100, 0],
      ],
    },
    {
      a: "A",
      points: [
        [0, 0],
        [100, 0],
      ],
    },
    {
      a: 7,
      b: "B",
      points: [
        [0, 0],
        [100, 0],
      ],
    },
    { a: "A", b: "B" },
    { a: "A", b: "B", points: [] },
    { a: "A", b: "B", points: [5] },
    { a: "A", b: "B", points: [[5]] },
    { a: "A", b: "B", points: [["x", 0]] },
    { a: "A", b: "B", points: [[0, Infinity]] },
  ];
  for (const bad of badLegs) {
    const reloaded = normalizeFleetShip({
      id: "F1",
      classId: "cutter",
      status: "sailing",
      route: { ports: ["A", "B"], legs: [bad, goodLeg] },
    });
    assert.equal(reloaded.route, null, `bad leg ${JSON.stringify(bad)}`);
    assert.equal(reloaded.status, "laidUp");
  }
});

test("normalizeFleetShip recomputes a missing routeLength and clamps legIndex", () => {
  const reloaded = normalizeFleetShip({
    id: "F5",
    classId: "cutter",
    route: {
      ports: ["A", "B"],
      legs: [
        {
          a: "A",
          b: "B",
          points: [
            [0, 0],
            [100, 0],
          ],
        },
        {
          a: "B",
          b: "A",
          points: [
            [100, 0],
            [0, 0],
          ],
        },
      ],
      legIndex: 99,
    },
  });
  assert.equal(reloaded.route.legs[0].routeLength, 100);
  assert.equal(reloaded.route.legIndex, 1); // clamped
  assert.equal(reloaded.origin, "B");
  assert.equal(reloaded.destination, "A");
});

test("normalizeFleetState round-trips an active route through JSON", () => {
  const game = makeGame();
  const { ship } = commissionFleetShip(game, "cutter");
  assignRoute(game, ship.id, ["A", "B", "C"], makeCtx());
  const reloaded = normalizeFleetState(JSON.parse(JSON.stringify(game.fleet)));
  assert.equal(reloaded.ships.length, 1);
  assert.notEqual(reloaded.ships[0].route, null);
  assert.equal(reloaded.ships[0].route.legs.length, 3);
  assert.equal(reloaded.ships[0].status, "sailing");
});

test("normalizeFleetState filters captain assignments to existing ships", () => {
  const normalized = normalizeFleetState({
    ships: [{ id: "F2", classId: "sloop" }],
    captainAssignments: "nope",
  });
  assert.deepEqual(normalized.captainAssignments, {});

  const withAssignments = normalizeFleetState({
    ships: [{ id: "F2", classId: "sloop" }],
    captainAssignments: { navigator: "F2", purser: "F9", boatswain: null },
  });
  assert.deepEqual(withAssignments.captainAssignments, { navigator: "F2" });
});

test("normalizeFleetState round-trips through JSON", () => {
  const game = makeGame();
  commissionFleetShip(game, "sloop");
  commissionFleetShip(game, "carrack");
  const reloaded = normalizeFleetState(JSON.parse(JSON.stringify(game.fleet)));
  assert.equal(reloaded.ships.length, 2);
  assert.equal(reloaded.ships[0].classId, "sloop");
  assert.equal(reloaded.ships[1].classId, "carrack");
});

test("commissionFleetShip deducts cost, adds a laid-up vessel, and tracks ids", () => {
  const game = makeGame(2000);
  const result = commissionFleetShip(game, "sloop");
  assert.equal(result.ok, true);
  assert.equal(
    result.cost,
    SHIP_CLASSES.sloop.cost + FLEET_COMMISSION_FITTING_FEE,
  );
  assert.equal(game.coins, 2000 - result.cost);
  assert.equal(game.fleet.ships.length, 1);
  const ship = result.ship;
  assert.equal(ship.id, "F1");
  assert.equal(ship.classId, "sloop");
  assert.equal(ship.status, "laidUp");
  assert.equal(ship.captain, null);
  assert.equal(ship.route, null);
  assert.equal(ship.color, FLEET_PALETTE[0]);
  assert.ok(ship.holdMax >= 1);
  assert.equal(game.fleet.nextId, 2);

  const second = commissionFleetShip(game, "carrack", "The Atlas");
  assert.equal(second.ok, true);
  assert.equal(second.ship.id, "F2");
  assert.equal(second.ship.name, "The Atlas");
  assert.equal(second.ship.color, FLEET_PALETTE[1]);
});

test("commissioned vessels are not back-charged wages for past weeks", () => {
  const game = makeGame(10_000);
  game.day = 50;
  game.specialists = createSpecialistState();
  const { ship } = commissionFleetShip(game, "cutter");
  // First wage day is one week out, not back at the start of the game.
  assert.ok(ship.operations.wagesDueDay > 50);
  const before = game.coins;
  runFleetDay(game); // day 50, no wages due yet -> no deduction
  assert.equal(game.coins, before);
});

test("commissionFleetShip rejects unknown classes and unaffordable vessels", () => {
  const game = makeGame(10_000);
  assert.equal(commissionFleetShip(game, "yacht").ok, false);

  const cost = SHIP_CLASSES.brig.cost + FLEET_COMMISSION_FITTING_FEE;
  const broke = makeGame(cost - 1);
  assert.equal(commissionFleetShip(broke, "brig").ok, false);
  assert.equal(broke.coins, cost - 1);
  assert.equal(broke.fleet.ships.length, 0);

  const exact = makeGame(cost);
  assert.equal(commissionFleetShip(exact, "brig").ok, true);
  assert.equal(exact.coins, 0);
});

test("commissionFleetShip cycles through the palette", () => {
  const game = makeGame(100_000);
  const ids = [];
  for (let index = 0; index < FLEET_PALETTE.length + 1; index += 1) {
    const result = commissionFleetShip(game, "cutter");
    ids.push(result.ship.color);
  }
  assert.equal(ids[0], FLEET_PALETTE[0]);
  assert.equal(ids[FLEET_PALETTE.length], FLEET_PALETTE[0]);
});

test("decommissionFleetShip refunds a fraction and removes the vessel", () => {
  const game = makeGame();
  const { ship } = commissionFleetShip(game, "sloop");
  const coinsBefore = game.coins;

  const result = decommissionFleetShip(game, ship.id);
  assert.equal(result.ok, true);
  assert.equal(
    result.refund,
    Math.round(SHIP_CLASSES.sloop.cost * FLEET_DECOMMISSION_REFUND_FRACTION),
  );
  assert.equal(game.coins, coinsBefore + result.refund);
  assert.equal(game.fleet.ships.length, 0);
});

test("decommissionFleetShip releases the captain assignment", () => {
  const game = makeGame();
  const { ship } = commissionFleetShip(game, "carrack");
  game.fleet.captainAssignments.navigator = ship.id;
  decommissionFleetShip(game, ship.id);
  assert.deepEqual(game.fleet.captainAssignments, {});
});

test("decommissionFleetShip rejects unknown ids", () => {
  const game = makeGame();
  commissionFleetShip(game, "cutter");
  assert.equal(decommissionFleetShip(game, "F99").ok, false);
  assert.equal(game.fleet.ships.length, 1);
});

test("assignCaptain assigns, reassigns, and releases officers", () => {
  const game = makeGame();
  const { ship: first } = commissionFleetShip(game, "cutter");
  const { ship: second } = commissionFleetShip(game, "cutter");

  assert.equal(assignCaptain(game, "F99", "navigator").ok, false);
  assert.equal(assignCaptain(game, first.id, "ghost").ok, false);

  assert.equal(assignCaptain(game, first.id, "navigator").ok, true);
  assert.equal(first.captain, "navigator");
  assert.equal(game.fleet.captainAssignments.navigator, first.id);

  assert.equal(assignCaptain(game, second.id, "purser").ok, true);
  assert.equal(second.captain, "purser");

  // Reassigning the navigator to the second ship releases it from the first.
  assert.equal(assignCaptain(game, second.id, "navigator").ok, true);
  assert.equal(second.captain, "navigator");
  assert.equal(first.captain, null);
  assert.equal(game.fleet.captainAssignments.navigator, second.id);

  assert.equal(assignCaptain(game, second.id, null).ok, true);
  assert.equal(second.captain, null);
  assert.ok(!game.fleet.captainAssignments.navigator);
});

test("commissioned fleet vessels receive a generated registry name", () => {
  const game = makeGame(5000);
  const first = commissionFleetShip(game, "cutter", undefined, { seed: 11 });
  const second = commissionFleetShip(game, "cutter", undefined, { seed: 12 });
  assert.ok(first.ok && second.ok);

  // Mirrors the pure generator seeded the same way against the reserved roster.
  assert.equal(
    first.ship.name,
    generateFleetShipName(11, [...RESERVED_SHIP_NAMES]),
  );
  // Not the bare class name, not a reserved/rival name, and distinct per vessel.
  assert.notEqual(first.ship.name, SHIP_CLASSES.cutter.name);
  assert.ok(!RESERVED_SHIP_NAMES.includes(first.ship.name));
  assert.notEqual(first.ship.name, second.ship.name);

  // An explicit name override still wins over the generated one.
  const named = commissionFleetShip(game, "cutter", "The Atlas");
  assert.equal(named.ship.name, "The Atlas");
});

test("fleetShipStats reports base stats and the navigator's speed bonus", () => {
  const specialistState = createSpecialistState();
  const { ship } = commissionFleetShip(makeGame(), "sloop");

  assert.equal(fleetShipStats(null).speedMultiplier, 1);

  const baseline = fleetShipStats(ship);
  assert.equal(baseline.speedMultiplier, 1);
  assert.ok(baseline.maxSpeed > 0);

  ship.captain = "purser";
  assert.equal(fleetShipStats(ship, specialistState).speedMultiplier, 1);

  ship.captain = "navigator";
  const withCaptain = fleetShipStats(ship, specialistState);
  assert.ok(withCaptain.speedMultiplier > 1);
  // navigator loyalty defaults to 60 -> power 0.8 -> 1 + 0.8 * 0.12
  assert.equal(withCaptain.speedMultiplier, 1 + 0.8 * 0.12);

  // captain set but no specialist state -> no bonus
  assert.equal(fleetShipStats(ship).speedMultiplier, 1);
});

test("suggestRouteTemplates derives triangles and shuttles from the lane graph", () => {
  assert.deepEqual(suggestRouteTemplates(), []);
  assert.deepEqual(suggestRouteTemplates({}), []);

  const templates = suggestRouteTemplates(makeCtx());
  const triangle = templates.find((entry) => entry.id === "tpl-triangle-0");
  assert.deepEqual(triangle.ports, ["A", "B", "C"]);

  const shuttleIds = templates
    .filter((entry) => entry.id.startsWith("tpl-shuttle"))
    .map((entry) => entry.ports);
  assert.deepEqual(shuttleIds, [
    ["A", "B"],
    ["A", "C"],
    ["B", "C"],
    ["D", "E"],
  ]);
});

test("createRouteTemplate slugs names and copies ports", () => {
  const template = createRouteTemplate("Spice Run!", ["A", "B"]);
  assert.equal(template.id, "tpl-spice-run");
  assert.equal(template.name, "Spice Run!");
  assert.deepEqual(template.ports, ["A", "B"]);

  assert.equal(createRouteTemplate("", ["A"]).id, "tpl-route");
});

test("assignRoute builds a closed multi-stop loop and starts the vessel sailing", () => {
  const game = makeGame();
  const { ship } = commissionFleetShip(game, "cutter");
  const ctx = makeCtx();

  const shuttle = assignRoute(game, ship.id, ["A", "B"], ctx);
  assert.equal(shuttle.ok, true);
  assert.equal(shuttle.route.legs.length, 2); // A->B and the closing B->A
  assert.deepEqual(
    shuttle.route.legs.map((leg) => [leg.a, leg.b]),
    [
      ["A", "B"],
      ["B", "A"],
    ],
  );
  assert.equal(ship.status, "sailing");
  assert.equal(ship.origin, "A");
  assert.equal(ship.destination, "B");
  assert.equal(ship.homePort, "A");
  assert.equal(ship.distance, 0);

  const loop = assignRoute(game, ship.id, ["A", "B", "C"], ctx);
  assert.equal(loop.route.legs.length, 3);
  assert.deepEqual(
    loop.route.legs.map((leg) => [leg.a, leg.b]),
    [
      ["A", "B"],
      ["B", "C"],
      ["C", "A"],
    ],
  );
});

test("assignRoute resolves template ids, arrays, and port objects", () => {
  const game = makeGame();
  const { ship } = commissionFleetShip(game, "cutter");
  const ctx = makeCtx();

  assert.equal(assignRoute(game, ship.id, "tpl-shuttle-0", ctx).ok, true);
  assert.equal(assignRoute(game, ship.id, ["A", "C"], ctx).ok, true);
  assert.equal(assignRoute(game, ship.id, { ports: ["B", "C"] }, ctx).ok, true);

  game.fleet.templates = [createRouteTemplate("Saved", ["A", "B"])];
  assert.equal(assignRoute(game, ship.id, "tpl-saved", ctx).ok, true);
});

test("assignRoute rejects bad specs, unknown templates, and missing lanes", () => {
  const game = makeGame();
  const { ship } = commissionFleetShip(game, "cutter");
  const ctx = makeCtx();

  assert.equal(assignRoute(game, ship.id, { nonsense: 1 }, ctx).ok, false);
  assert.equal(assignRoute(game, ship.id, "tpl-does-not-exist", ctx).ok, false);
  assert.equal(assignRoute(game, ship.id, ["A"], ctx).ok, false);
  assert.equal(assignRoute(game, ship.id, ["A", "D"], ctx).ok, false); // no A-D lane
  assert.equal(assignRoute(game, "F99", ["A", "B"], ctx).ok, false);
});

test("fleet routes unwrap cleanly across the world seam", () => {
  const game = makeGame();
  const { ship } = commissionFleetShip(game, "cutter");
  const ctx = makeCtx();
  const { route } = assignRoute(game, ship.id, ["D", "E"], ctx);

  const outward = route.legs[0]; // D(950) -> E(50)
  assert.equal(outward.routeLength, 100); // not 900: no teleport across the seam
  const traveled = pointAlongPath(outward.points, 50);
  assert.ok(traveled.x > 950 && traveled.x <= 1050);

  const closing = route.legs[1]; // E(50) -> D(950)
  assert.equal(closing.routeLength, 100);
});

test("clearFleetRoute lays a vessel up and forgets its route", () => {
  const game = makeGame();
  const { ship } = commissionFleetShip(game, "cutter");
  assignRoute(game, ship.id, ["A", "B"], makeCtx());

  assert.equal(clearFleetRoute(game, "F99").ok, false);
  const result = clearFleetRoute(game, ship.id);
  assert.equal(result.ok, true);
  assert.equal(ship.route, null);
  assert.equal(ship.status, "laidUp");
  assert.equal(ship.destination, null);
  assert.equal(ship.cargoUnits, 0);
});

test("clearFleetRoute empties a loaded hold as well as the route", () => {
  const ctx = makeEconomyCtx({ stock: 30 });
  const game = makeGame(5000);
  game.specialists = createSpecialistState();
  const { ship } = commissionFleetShip(game, "cutter");
  assignRoute(game, ship.id, ["A", "B"], ctx);
  loadDepartureCargo(game, ship, ctx);
  assert.ok(ship.cargoLots.length > 0);
  assert.equal(clearFleetRoute(game, ship.id).ok, true);
  assert.equal(ship.cargoLots.length, 0);
  assert.equal(ship.cargoUnits, 0);
  assert.equal(ship.cargoKey, null);
});

// --- Movement, arrival trading, render shapes ----------------------------------

function makeEconomyCtx({ stock = 30, hazards = false } = {}) {
  const goods = {
    spice: { key: "spice", name: "Spice", base: 20, target: 26 },
    iron: { key: "iron", name: "Iron", base: 12, target: 26 },
  };
  const states = {};
  const economyState = (port, key) => {
    const id = `${port}|${key}`;
    if (!states[id])
      states[id] = {
        stock,
        target: goods[key]?.target ?? 26,
        production: 1,
        consumption: 1,
      };
    return states[id];
  };
  const competitionLog = [];
  return {
    day: 5,
    hazardsEnabled: hazards,
    worldWidth: 1000,
    portX: (name) => ({ A: 100, B: 300, C: 500 })[name] ?? 0,
    routes: [
      {
        a: "A",
        b: "B",
        points: [
          [100, 0],
          [300, 0],
        ],
      },
      {
        a: "B",
        b: "C",
        points: [
          [300, 0],
          [500, 0],
        ],
      },
      {
        a: "A",
        b: "C",
        points: [
          [100, 0],
          [500, 0],
        ],
      },
    ],
    economyState,
    pricingOptions: (port, key) => ({
      state: economyState(port, key),
      good: goods[key] || { key, base: 10, target: 26 },
      bias: 1,
      day: 5,
      portName: port,
      eventMultiplier: 1,
      lawMultiplier: 1,
    }),
    good: (key) => goods[key] || { key, base: 10, target: 26, name: key },
    goodsKeys: () => Object.keys(goods),
    competitionLog,
    recordCompetition: (port, key, day) =>
      competitionLog.push({ port, key, day }),
  };
}

test("fleetMovementSpeed scales with class, captain, and condition", () => {
  const ctx = { specialistState: createSpecialistState() };
  const game = makeGame();
  const cutter = commissionFleetShip(game, "cutter").ship;
  const sloop = commissionFleetShip(game, "sloop").ship;
  const carrack = commissionFleetShip(game, "carrack").ship;

  const baseline = fleetMovementSpeed(cutter, ctx);
  assert.ok(Math.abs(baseline - FLEET_BASE_SPEED) < 0.01);
  assert.ok(fleetMovementSpeed(sloop, ctx) > baseline);
  assert.ok(fleetMovementSpeed(carrack, ctx) < baseline);

  cutter.captain = "navigator";
  assert.ok(fleetMovementSpeed(cutter, ctx) > baseline);

  cutter.captain = null;
  cutter.operations.condition = 50;
  assert.ok(fleetMovementSpeed(cutter, ctx) < baseline);
});

test("updateFleetShip moves sailing vessels and signals arrival", () => {
  const ctx = { specialistState: createSpecialistState() };
  const game = makeGame();
  const { ship } = commissionFleetShip(game, "cutter");
  assignRoute(game, ship.id, ["A", "B"], {
    ...makeEconomyCtx(),
    specialistState: ctx.specialistState,
  });

  // laid-up vessel: no movement
  const idle = commissionFleetShip(game, "cutter").ship;
  assert.deepEqual(updateFleetShip(idle, 0.1, ctx), { arrived: false });

  // sailing vessel with a malformed (empty) route: guarded
  const ghost = commissionFleetShip(game, "cutter").ship;
  ghost.status = "sailing";
  ghost.route = { ports: ["A"], legs: [], legIndex: 0 };
  assert.deepEqual(updateFleetShip(ghost, 0.1, ctx), { arrived: false });

  const startX = ship.x;
  const step = updateFleetShip(ship, 0.5, ctx);
  assert.equal(step.arrived, false);
  assert.ok(ship.speed > 0);
  assert.ok(ship.x > startX);

  const arrival = updateFleetShip(ship, 1000, ctx);
  assert.equal(arrival.arrived, true);
  assert.ok(arrival.leg);
});

test("loadDepartureCargo buys against the live market and the hold", () => {
  const ctx = makeEconomyCtx({ stock: 30 });
  const game = makeGame(5000);
  game.specialists = createSpecialistState();
  const { ship } = commissionFleetShip(game, "carrack");
  assignRoute(game, ship.id, ["A", "B"], ctx);
  const coinsBefore = game.coins;

  const result = loadDepartureCargo(game, ship, ctx);
  assert.equal(result.ok, true);
  assert.ok(result.units >= FLEET_MIN_BUY);
  assert.equal(ship.cargoLots.length, result.units);
  assert.equal(ship.cargoUnits, result.units);
  assert.ok(game.coins < coinsBefore);
  assert.ok(ship.totalCosts > 0);
  assert.ok(ctx.economyState("A", result.cargoKey).stock < 30);

  // laid-up vessel cannot load
  const idle = commissionFleetShip(game, "cutter").ship;
  assert.equal(loadDepartureCargo(game, idle, ctx).ok, false);

  // depleted market -> no purchase
  const hungry = commissionFleetShip(game, "cutter").ship;
  assignRoute(game, hungry.id, ["A", "B"], ctx);
  ctx.economyState("A", "spice").stock = 2;
  ctx.economyState("A", "iron").stock = 2;
  const empty = loadDepartureCargo(game, hungry, ctx);
  assert.equal(empty.units, 0);
  assert.equal(hungry.cargoLots.length, 0);
});

test("fleet cargo choice follows the stock-gap between ports", () => {
  const ctx = makeEconomyCtx({ stock: 30 });
  ctx.economyState("A", "spice").stock = 40;
  ctx.economyState("B", "spice").stock = 8;
  ctx.economyState("A", "iron").stock = 10;
  ctx.economyState("B", "iron").stock = 30;

  const game = makeGame(5000);
  game.specialists = createSpecialistState();
  const { ship } = commissionFleetShip(game, "cutter");
  assignRoute(game, ship.id, ["A", "B"], ctx);
  assert.equal(loadDepartureCargo(game, ship, ctx).cargoKey, "spice");
});

test("resolveFleetArrival sells, books revenue, advances the leg, and reloads", () => {
  const ctx = makeEconomyCtx({ stock: 30 });
  const game = makeGame(5000);
  game.specialists = createSpecialistState();
  const { ship } = commissionFleetShip(game, "carrack");
  assignRoute(game, ship.id, ["A", "B", "C"], ctx);
  loadDepartureCargo(game, ship, ctx);

  const loadedKey = ship.cargoKey;
  const loadedUnits = ship.cargoUnits;
  const revenueBefore = ship.totalRevenue;

  const events = resolveFleetArrival(game, ship, ctx);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "delivery");
  assert.equal(events[0].units, loadedUnits);
  assert.ok(events[0].proceeds > 0);
  assert.ok(ship.totalRevenue > revenueBefore);
  assert.equal(ship.deliveries, 1);
  assert.ok(game.legacyProgress.fleetRevenue > 0);
  assert.equal(game.legacyProgress.fleetDeliveries, 1);
  assert.deepEqual(ctx.competitionLog[0], {
    port: "B",
    key: loadedKey,
    day: 5,
  });

  // leg advanced and reloaded for the next passage
  assert.equal(ship.origin, "B");
  assert.equal(ship.destination, "C");
  assert.ok(ship.cargoUnits > 0);
});

test("resolveFleetArrival unloads cargo into the destination market", () => {
  const ctx = makeEconomyCtx({ stock: 30 });
  const game = makeGame(5000);
  game.specialists = createSpecialistState();
  const { ship } = commissionFleetShip(game, "carrack");
  assignRoute(game, ship.id, ["A", "B"], ctx);
  loadDepartureCargo(game, ship, ctx);
  const soldKey = ship.cargoKey;
  const soldUnits = ship.cargoUnits;

  // Drive the next leg (B->A) to buy IRON instead of the sold good, so the
  // sale's stock bump at B is not bought straight back.
  ctx.economyState("A", "iron").stock = 0;
  const before = ctx.economyState("B", soldKey).stock;
  resolveFleetArrival(game, ship, ctx);
  assert.equal(ctx.economyState("B", soldKey).stock, before + soldUnits);
  assert.equal(ship.cargoKey, "iron");
});

test("resolveFleetArrival advances empty vessels without selling", () => {
  const ctx = makeEconomyCtx({ stock: 30 });
  const game = makeGame(5000);
  game.specialists = createSpecialistState();
  const { ship } = commissionFleetShip(game, "cutter");
  assignRoute(game, ship.id, ["A", "B", "C"], ctx);

  const events = resolveFleetArrival(game, ship, ctx);
  assert.equal(events.length, 0);
  assert.equal(ship.origin, "B");
  assert.ok(ship.cargoUnits > 0);
});

test("resolveFleetArrival is a no-op for a vessel with no route", () => {
  const ctx = makeEconomyCtx();
  const game = makeGame(5000);
  game.specialists = createSpecialistState();
  const { ship } = commissionFleetShip(game, "cutter");
  // Freshly commissioned: no route, no cargo.
  const before = game.coins;
  const events = resolveFleetArrival(game, ship, ctx);
  assert.deepEqual(events, []);
  assert.equal(game.coins, before);
  assert.equal(ship.deliveries, 0);
});

test("a factor captain increases sale proceeds", () => {
  const baselineCtx = makeEconomyCtx({ stock: 30 });
  const baseline = makeGame(5000);
  baseline.specialists = createSpecialistState();
  const baseShip = commissionFleetShip(baseline, "carrack").ship;
  assignRoute(baseline, baseShip.id, ["A", "B"], baselineCtx);
  loadDepartureCargo(baseline, baseShip, baselineCtx);
  const baseProceeds = resolveFleetArrival(baseline, baseShip, baselineCtx)[0]
    .proceeds;

  const ctx = makeEconomyCtx({ stock: 30 });
  const captained = makeGame(5000);
  captained.specialists = createSpecialistState();
  const capShip = commissionFleetShip(captained, "carrack").ship;
  capShip.captain = "factor";
  assignRoute(captained, capShip.id, ["A", "B"], ctx);
  loadDepartureCargo(captained, capShip, ctx);
  const capProceeds = resolveFleetArrival(captained, capShip, ctx)[0].proceeds;

  assert.ok(capProceeds > baseProceeds);
});

test("fleetRenderObject exposes the shape drawMerchantShip expects", () => {
  assert.equal(fleetRenderObject(null), null);
  const game = makeGame();
  const { ship } = commissionFleetShip(game, "sloop");
  ship.x = 120;
  ship.y = 40;
  ship.angle = 1.2;
  const render = fleetRenderObject(ship);
  assert.equal(render.vesselClass, "sloop");
  assert.equal(render.x, 120);
  assert.equal(render.y, 40);
  assert.equal(render.angle, 1.2);
  assert.equal(render.idNum, 1);
  assert.equal(render.color, ship.color);
  assert.equal(render.name, ship.name);
});

test("fleetRoutePaths dedupes active route legs across the fleet", () => {
  const game = makeGame();
  assert.deepEqual(fleetRoutePaths(game), []);

  const ctx = makeEconomyCtx();
  const { ship } = commissionFleetShip(game, "cutter");
  assignRoute(game, ship.id, ["A", "B", "C"], ctx);
  assert.equal(fleetRoutePaths(game).length, 3);

  const { ship: ship2 } = commissionFleetShip(game, "cutter");
  assignRoute(game, ship2.id, ["A", "B", "C"], ctx);
  assert.equal(fleetRoutePaths(game).length, 3); // same legs deduped

  commissionFleetShip(game, "cutter"); // laid-up vessel contributes nothing
  assert.equal(fleetRoutePaths(game).length, 3);
});

// --- Costs, risk, and per-day upkeep ------------------------------------------

function freshShip(game, classId) {
  return commissionFleetShip(game, classId).ship;
}

function searchHazard(makeShip, want, { stock = 30 } = {}) {
  const ctx = makeEconomyCtx({ stock, hazards: true });
  const specialistState = ctx.specialistState || createSpecialistState();
  ctx.specialistState = specialistState;
  for (let day = 1; day < 6000; day += 1) {
    for (let leg = 0; leg < 8; leg += 1) {
      const game = { specialists: specialistState, legacyProgress: {} };
      const ship = makeShip(game);
      ship.legCount = leg;
      ctx.day = day;
      const events = resolveFleetHazard(game, ship, ctx, []);
      let label = "clean";
      if (events.length) {
        label =
          events[0].type === "storm"
            ? ship.status === "repairing"
              ? "storm-repair"
              : "storm"
            : events[0].repelled
              ? "pirate-repelled"
              : "pirate-lost";
      }
      if (label === want) return { day, leg };
    }
  }
  throw new Error(`no seed found for ${want}`);
}

test("resolveFleetHazard skips when hazards are disabled or the ship is repairing", () => {
  const ctx = makeEconomyCtx({ hazards: false });
  const game = makeGame();
  const ship = freshShip(game, "cutter");
  assert.equal(resolveFleetHazard(game, ship, ctx, []).length, 0);

  const hazardCtx = makeEconomyCtx({ hazards: true });
  ship.status = "repairing";
  assert.equal(resolveFleetHazard(game, ship, hazardCtx, []).length, 0);
});

test("fleetRoll and fleetOutcomeSeed are deterministic", () => {
  const ctx = { day: 9 };
  const game = makeGame();
  const ship = freshShip(game, "cutter");
  ship.legCount = 3;
  assert.equal(fleetRoll(7), fleetRoll(7));
  assert.ok(fleetRoll(7) >= 0 && fleetRoll(7) < 1);
  assert.equal(fleetOutcomeSeed(ship, ctx), fleetOutcomeSeed(ship, ctx));
});

test("storms damage fleet vessels and may knock them into repair", () => {
  const specialistState = createSpecialistState();
  const ctx = makeEconomyCtx({ hazards: true });
  ctx.specialistState = specialistState;

  const stormy = searchHazard((game) => {
    const ship = freshShip(game, "cutter");
    return ship;
  }, "storm");
  const game1 = { specialists: specialistState, legacyProgress: {} };
  const ship1 = freshShip(game1, "cutter");
  ship1.legCount = stormy.leg;
  ctx.day = stormy.day;
  const events = resolveFleetHazard(game1, ship1, ctx, []);
  assert.equal(events[0].type, "storm");
  assert.ok(events[0].damage >= 0);
  assert.notEqual(ship1.status, "repairing"); // fresh hull weathers it

  // A battered hull goes into repair after the same kind of strike.
  const game2 = { specialists: specialistState, legacyProgress: {} };
  const ship2 = freshShip(game2, "cutter");
  for (const component of Object.keys(ship2.operations.components))
    ship2.operations.components[component] = 40;
  ship2.operations.condition = 40;
  ship2.legCount = stormy.leg;
  resolveFleetHazard(game2, ship2, ctx, []);
  assert.equal(ship2.status, "repairing");
  assert.ok(ship2.repairDaysLeft > 0);
});

test("pirates either are repelled or take cargo and coin", () => {
  const specialistState = createSpecialistState();
  const ctx = makeEconomyCtx({ hazards: true });
  ctx.specialistState = specialistState;

  const lost = searchHazard((game) => freshShip(game, "cutter"), "pirate-lost");
  const game1 = {
    specialists: specialistState,
    legacyProgress: {},
    coins: 500,
  };
  const ship1 = freshShip(game1, "cutter");
  ship1.cargoUnits = 8;
  ship1.cargoLots = new Array(8);
  ship1.legCount = lost.leg;
  ctx.day = lost.day;
  const lostEvents = resolveFleetHazard(game1, ship1, ctx, []);
  assert.equal(lostEvents[0].type, "pirate");
  assert.equal(lostEvents[0].repelled, false);
  assert.ok(lostEvents[0].cargoLost > 0);
  assert.ok(ship1.cargoUnits < 8);
  assert.ok(game1.coins < 500);

  const repelled = searchHazard(
    (game) => freshShip(game, "brig"),
    "pirate-repelled",
  );
  const game2 = {
    specialists: specialistState,
    legacyProgress: {},
    coins: 500,
  };
  const ship2 = freshShip(game2, "brig");
  ship2.legCount = repelled.leg;
  ctx.day = repelled.day;
  resolveFleetHazard(game2, ship2, ctx, []);
  assert.equal(game2.legacyProgress.piratesRepelled, 1);
});

test("a clean passage raises no hazard events", () => {
  const ctx = makeEconomyCtx({ hazards: true });
  ctx.specialistState = createSpecialistState();
  const clean = searchHazard((game) => freshShip(game, "cutter"), "clean");
  const game = {
    specialists: ctx.specialistState,
    legacyProgress: {},
    coins: 100,
  };
  const ship = freshShip(game, "cutter");
  ship.legCount = clean.leg;
  ctx.day = clean.day;
  assert.equal(resolveFleetHazard(game, ship, ctx, []).length, 0);
});

test("captain voyage modifiers apply only to the assigned specialist", () => {
  const game = { specialists: createSpecialistState() };
  const defaults = captainVoyageModifiers(game, { captain: null });
  assert.equal(defaults.damageMultiplier, 1);
  assert.equal(defaults.provisionMultiplier, 1);
  assert.equal(defaults.moraleLossMultiplier, 1);
  assert.equal(defaults.combatBonus, 0);

  const boatswain = captainVoyageModifiers(game, { captain: "boatswain" });
  assert.ok(boatswain.damageMultiplier < 1);
  const purser = captainVoyageModifiers(game, { captain: "purser" });
  assert.ok(purser.provisionMultiplier < 1);
  const surgeon = captainVoyageModifiers(game, { captain: "surgeon" });
  assert.ok(surgeon.moraleLossMultiplier < 1);
  const gunner = captainVoyageModifiers(game, { captain: "gunner" });
  assert.ok(gunner.combatBonus > 0);

  // Unrelated captains grant no voyage modifier.
  const navigator = captainVoyageModifiers(game, { captain: "navigator" });
  assert.equal(navigator.damageMultiplier, 1);
  assert.equal(navigator.combatBonus, 0);
});

test("a boatswain captain reduces storm damage on the same seed", () => {
  const specialistState = createSpecialistState();
  const ctx = makeEconomyCtx({ hazards: true });
  ctx.specialistState = specialistState;
  // Each probe uses a fresh game so the ship is always id F1 -> reproducible seed.
  let seed = null;
  for (let day = 1; !seed && day < 6000; day += 1) {
    for (let leg = 0; !seed && leg < 8; leg += 1) {
      const probeGame = { specialists: specialistState, legacyProgress: {} };
      const probe = freshShip(probeGame, "cutter");
      probe.legCount = leg;
      ctx.day = day;
      const events = resolveFleetHazard(probeGame, probe, ctx, []);
      if (events.length && events[0].type === "storm" && events[0].damage >= 5)
        seed = { day, leg, damage: events[0].damage };
    }
  }
  assert.ok(seed, "found a high-damage storm seed");

  const game = { specialists: specialistState, legacyProgress: {} };
  const sturdy = freshShip(game, "cutter"); // id F1 -> same seed
  sturdy.captain = "boatswain";
  sturdy.legCount = seed.leg;
  ctx.day = seed.day;
  const events = resolveFleetHazard(game, sturdy, ctx, []);
  assert.equal(events[0].type, "storm");
  assert.ok(events[0].damage < seed.damage);
});

test("a surgeon captain softens the morale loss from a pirate raid", () => {
  const specialistState = createSpecialistState();
  const ctx = makeEconomyCtx({ hazards: true });
  ctx.specialistState = specialistState;
  const lost = searchHazard((game) => freshShip(game, "cutter"), "pirate-lost");

  // Baseline raid, no captain (id F1 -> same seed).
  const game1 = {
    specialists: specialistState,
    legacyProgress: {},
    coins: 500,
  };
  const ship1 = freshShip(game1, "cutter");
  ship1.cargoUnits = 8;
  ship1.cargoLots = new Array(8);
  ship1.legCount = lost.leg;
  ctx.day = lost.day;
  resolveFleetHazard(game1, ship1, ctx, []);

  // Same seed, surgeon captain -> identical encounter, lesser morale hit.
  const game2 = {
    specialists: specialistState,
    legacyProgress: {},
    coins: 500,
  };
  const ship2 = freshShip(game2, "cutter");
  ship2.captain = "surgeon";
  ship2.cargoUnits = 8;
  ship2.cargoLots = new Array(8);
  ship2.legCount = lost.leg;
  ctx.day = lost.day;
  resolveFleetHazard(game2, ship2, ctx, []);

  assert.ok(ship2.operations.morale > ship1.operations.morale);
});

test("arrivals charge a provision cost", () => {
  const ctx = makeEconomyCtx({ hazards: false });
  const game = makeGame(5000);
  game.specialists = createSpecialistState();
  const { ship } = commissionFleetShip(game, "cutter");
  assignRoute(game, ship.id, ["A", "B"], ctx);
  // Starve the next leg's origin so the reload does not buy anything.
  for (const key of ctx.goodsKeys()) ctx.economyState("B", key).stock = 0;
  resolveFleetArrival(game, ship, ctx); // no cargo to sell, no reload
  assert.equal(ship.totalCosts, FLEET_PROVISION_COST);
});

test("a purser captain trims the per-leg provision cost", () => {
  const ctx = makeEconomyCtx({ hazards: false });
  const game = makeGame(5000);
  game.specialists = createSpecialistState();
  const { ship } = commissionFleetShip(game, "cutter");
  ship.captain = "purser";
  assignRoute(game, ship.id, ["A", "B"], ctx);
  // Starve the next leg's origin so the reload buys nothing (isolate the cost).
  for (const key of ctx.goodsKeys()) ctx.economyState("B", key).stock = 0;
  resolveFleetArrival(game, ship, ctx);
  assert.ok(ship.totalCosts < FLEET_PROVISION_COST);
});

test("runFleetDay pays wages, handles repair, and discounts laid-up crews", () => {
  const game = makeGame(5000);
  game.specialists = createSpecialistState();
  game.fleet = { ships: [], templates: [], captainAssignments: {}, nextId: 1 };

  // Empty fleet is a no-op.
  assert.equal(runFleetDay(game), undefined);

  // Wage day: a sailing vessel draws full wages from the treasury.
  const sailor = freshShip(game, "cutter");
  sailor.status = "sailing";
  sailor.operations.wagesDueDay = 5;
  sailor.route = { legs: [{ a: "A", b: "B" }] };
  game.day = 5;
  const coinsBefore = game.coins;
  runFleetDay(game);
  assert.ok(game.coins < coinsBefore);
  assert.ok(sailor.operations.wagesDueDay > 5);

  // Laid-up vessel pays reduced wages.
  const idle = freshShip(game, "cutter");
  idle.status = "laidUp";
  idle.operations.wagesDueDay = 5;
  const idleCoins = game.coins;
  runFleetDay(game);
  assert.ok(game.coins < idleCoins);

  // Repairing vessel counts down, pays for the refit, then returns to service.
  const wounded = freshShip(game, "cutter");
  wounded.status = "repairing";
  wounded.repairDaysLeft = 1;
  wounded.operations.condition = 30;
  wounded.route = { legs: [{ a: "A", b: "B" }] };
  const repairCoins = game.coins;
  game.day = 6;
  runFleetDay(game);
  assert.equal(wounded.status, "sailing");
  assert.ok(wounded.operations.condition > 30);
  assert.ok(game.coins < repairCoins);
});

test("runFleetDay returns a repaired vessel with no route to laid-up, not sailing", () => {
  const game = makeGame(5000);
  game.specialists = createSpecialistState();
  game.fleet = { ships: [], templates: [], captainAssignments: {}, nextId: 1 };
  const drydocked = freshShip(game, "cutter");
  drydocked.status = "repairing";
  drydocked.repairDaysLeft = 1;
  drydocked.operations.condition = 40;
  drydocked.route = null; // no route to resume -> must not resume sailing
  game.day = 6;
  runFleetDay(game);
  assert.equal(drydocked.status, "laidUp");
  assert.ok(drydocked.operations.condition > 40);
});
