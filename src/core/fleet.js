import { clamp } from "./math.js";
import {
  SHIP_CLASSES,
  calculateShipStats,
  createShipUpgradeState,
  normalizeShipUpgradeState,
} from "./upgrades.js";
import {
  applyComponentDamage,
  componentEfficiency,
  createOperationsState,
  normalizeOperationsState,
  processWages,
  repairOperations,
  resolveHostileEncounter,
} from "./operations.js";
import { crewWeeklyWage } from "./crew.js";
import { SPECIALIST_ROSTER, specialistPower } from "./specialists.js";
import { orientRoute, pathLength, pointAlongPath } from "./routes.js";
import { buyPrice, sellPrice, economyCondition } from "./economy.js";
import { createCargoLot } from "./cargo.js";
import { generateFleetShipName, RESERVED_SHIP_NAMES } from "../names.js";

// Tunables (deterministic; covered by tests). More are added in later phases.
export const FLEET_COMMISSION_FITTING_FEE = 50;
export const FLEET_DECOMMISSION_REFUND_FRACTION = 0.4;
export const FLEET_CAPTAIN_SPEED_POWER = 0.12;
export const FLEET_CAPTAIN_REWARD_POWER = 0.08;
export const FLEET_BASE_SPEED = 22;
export const FLEET_REFERENCE_SPEED = 175;
export const FLEET_MAX_BUY = 12;
export const FLEET_BUY_RESERVE = 5;
export const FLEET_MIN_BUY = 2;
export const FLEET_BIG_DELIVERY = 60;
export const FLEET_ROUTE_SUGGEST_LIMIT = 6;
export const FLEET_TRIANGLE_SUGGEST_LIMIT = 4;
export const FLEET_STORM_CHANCE = 0.18;
export const FLEET_PIRATE_RISK = 0.5;
export const FLEET_REPAIR_CONDITION = 45;
export const FLEET_REPAIR_DAYS = 2;
export const FLEET_REPAIR_COST_PER_POINT = 2;
export const FLEET_LAYUP_WAGE_MULTIPLIER = 0.5;
export const FLEET_PROVISION_COST = 3;
export const FLEET_PIRATE_CARGO_LOSS_FRACTION = 0.5;
export const FLEET_SIGNIFICANT_DAMAGE = 4;
export const FLEET_PALETTE = Object.freeze([
  "#7a9e7e",
  "#6f8aa6",
  "#b08968",
  "#9b6a7d",
  "#6a8c8a",
]);

const FLEET_STATUSES = new Set(["sailing", "laidUp", "repairing"]);

export function createFleetState() {
  return { ships: [], templates: [], captainAssignments: {}, nextId: 1 };
}

export function normalizeFleetState(value) {
  const fresh = createFleetState();
  if (!value || typeof value !== "object") return fresh;

  const ships = Array.isArray(value.ships) ? value.ships : [];
  fresh.ships = ships.map(normalizeFleetShip).filter(Boolean);

  const maxShipId = Math.max(
    0,
    ...fresh.ships.map((ship) => parseShipIdNumber(ship.id)),
  );
  fresh.nextId = Math.max(
    1,
    Math.floor(Number(value.nextId) || 0),
    maxShipId + 1,
  );

  fresh.captainAssignments = normalizeCaptainAssignments(
    value.captainAssignments,
    fresh.ships,
  );
  fresh.templates = Array.isArray(value.templates) ? value.templates : [];
  return fresh;
}

export function normalizeFleetShip(raw) {
  if (!raw || typeof raw !== "object") return null;
  const classId = SHIP_CLASSES[raw.classId] ? raw.classId : "cutter";
  const shipUpgrades = normalizeShipUpgradeState(raw.shipUpgrades);
  shipUpgrades.activeClass = classId;
  if (!shipUpgrades.ownedClasses.includes(classId))
    shipUpgrades.ownedClasses.push(classId);

  const operations = normalizeOperationsState(raw.operations);
  const stats = calculateShipStats(shipUpgrades);
  const route = normalizeFleetRoute(raw.route);

  return {
    id: normalizeShipId(raw.id),
    name: typeof raw.name === "string" && raw.name ? raw.name : "Fleet vessel",
    classId,
    shipUpgrades,
    operations,
    cargoLots: Array.isArray(raw.cargoLots) ? raw.cargoLots : [],
    holdMax: Math.max(1, Math.floor(stats.holdMax)),
    captain: typeof raw.captain === "string" ? raw.captain : null,
    route,
    distance: Math.max(0, Number(raw.distance) || 0),
    x: Number(raw.x) || 0,
    y: Number(raw.y) || 0,
    angle: Number(raw.angle) || 0,
    speed: Math.max(0, Number(raw.speed) || 0),
    origin: route
      ? route.legs[route.legIndex].a
      : typeof raw.origin === "string"
        ? raw.origin
        : null,
    destination: route
      ? route.legs[route.legIndex].b
      : typeof raw.destination === "string"
        ? raw.destination
        : null,
    cargoKey: typeof raw.cargoKey === "string" ? raw.cargoKey : null,
    cargoUnits: Math.max(0, Math.floor(Number(raw.cargoUnits) || 0)),
    legCount: Math.max(0, Math.floor(Number(raw.legCount) || 0)),
    color:
      typeof raw.color === "string" && raw.color ? raw.color : FLEET_PALETTE[0],
    totalRevenue: Math.max(0, Math.floor(Number(raw.totalRevenue) || 0)),
    totalCosts: Math.max(0, Math.floor(Number(raw.totalCosts) || 0)),
    deliveries: Math.max(0, Math.floor(Number(raw.deliveries) || 0)),
    lastEventDay: Math.max(0, Math.floor(Number(raw.lastEventDay) || 0)),
    homePort: typeof raw.homePort === "string" ? raw.homePort : null,
    status: route ? normalizeStatus(raw.status) : "laidUp",
    repairDaysLeft: Math.max(0, Math.floor(Number(raw.repairDaysLeft) || 0)),
  };
}

export function normalizeStatus(value) {
  return FLEET_STATUSES.has(value) ? value : "laidUp";
}

// A route is the source of truth for a sailing vessel, so it must survive a
// save/reload. Legs already carry absolute (unwrap-aware) coordinates that are
// stable for a given map, so we preserve them when well-formed and drop the
// route (laying the vessel up) only when the structure is corrupt.
function normalizeFleetRoute(raw) {
  if (!raw || typeof raw !== "object") return null;
  const ports = Array.isArray(raw.ports)
    ? raw.ports.filter((port) => typeof port === "string" && port)
    : [];
  if (ports.length < 2) return null;
  const legs = Array.isArray(raw.legs) ? raw.legs : [];
  if (legs.length < ports.length) return null;
  const cleanLegs = [];
  for (const leg of legs) {
    const cleaned = normalizeFleetLeg(leg);
    if (!cleaned) return null;
    cleanLegs.push(cleaned);
  }
  const legIndex = clamp(
    Math.floor(Number(raw.legIndex) || 0),
    0,
    cleanLegs.length - 1,
  );
  return { ports, legs: cleanLegs, legIndex };
}

function normalizeFleetLeg(raw) {
  if (!raw || typeof raw !== "object") return null;
  const a = typeof raw.a === "string" ? raw.a : null;
  const b = typeof raw.b === "string" ? raw.b : null;
  if (!a || !b) return null;
  if (!Array.isArray(raw.points) || raw.points.length === 0) return null;
  const points = [];
  for (const point of raw.points) {
    if (!Array.isArray(point) || point.length < 2) return null;
    const x = Number(point[0]);
    const y = Number(point[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    points.push([x, y]);
  }
  const routeLength = Number(raw.routeLength);
  return {
    a,
    b,
    points,
    routeLength:
      Number.isFinite(routeLength) && routeLength > 0
        ? routeLength
        : pathLength(points),
  };
}

export function parseShipIdNumber(id) {
  const match = /^F(\d+)$/.exec(String(id || ""));
  return match ? Number(match[1]) : 0;
}

function normalizeShipId(rawId) {
  const fallback = `F${Math.max(1, parseShipIdNumber(rawId))}`;
  return typeof rawId === "string" && rawId ? rawId : fallback;
}

function normalizeCaptainAssignments(value, ships) {
  const result = {};
  if (!value || typeof value !== "object") return result;
  const shipIds = new Set(ships.map((ship) => ship.id));
  for (const [specialistId, shipId] of Object.entries(value)) {
    if (shipIds.has(shipId)) result[specialistId] = shipId;
  }
  return result;
}

function ensureFleetState(game) {
  const current = game?.fleet;
  if (
    !current ||
    typeof current !== "object" ||
    !Array.isArray(current.ships) ||
    typeof current.nextId !== "number"
  ) {
    game.fleet = normalizeFleetState(current);
  }
  return game.fleet;
}

function buildFleetShip({ id, classId, name, color }) {
  const shipClass = SHIP_CLASSES[classId];
  const shipUpgrades = createShipUpgradeState();
  shipUpgrades.activeClass = shipClass.id;
  if (!shipUpgrades.ownedClasses.includes(shipClass.id))
    shipUpgrades.ownedClasses.push(shipClass.id);

  const stats = calculateShipStats(shipUpgrades);
  return {
    id,
    name,
    classId: shipClass.id,
    shipUpgrades,
    operations: createOperationsState(),
    cargoLots: [],
    holdMax: Math.max(1, Math.floor(stats.holdMax)),
    captain: null,
    route: null,
    distance: 0,
    x: 0,
    y: 0,
    angle: 0,
    speed: 0,
    origin: null,
    destination: null,
    cargoKey: null,
    cargoUnits: 0,
    legCount: 0,
    color,
    totalRevenue: 0,
    totalCosts: 0,
    deliveries: 0,
    lastEventDay: 0,
    homePort: null,
    status: "laidUp",
    repairDaysLeft: 0,
  };
}

export function commissionFleetShip(game, classId, name, options = {}) {
  const shipClass = SHIP_CLASSES[classId];
  if (!shipClass) return { ok: false, reason: "Unknown ship class." };

  const state = ensureFleetState(game);
  const cost = shipClass.cost + FLEET_COMMISSION_FITTING_FEE;
  if (Number(game.coins) < cost)
    return { ok: false, reason: "Not enough crowns." };

  game.coins -= cost;
  const id = `F${state.nextId}`;
  state.nextId += 1;
  const color = FLEET_PALETTE[state.ships.length % FLEET_PALETTE.length];
  // Each vessel gets a distinct registry name rather than its bare hull class,
  // avoiding names already sailing under a rival or the player's own flagship.
  const seed = Number.isFinite(options.seed)
    ? Math.trunc(options.seed)
    : Math.floor(Math.random() * 1_000_000);
  const shipName =
    name ||
    generateFleetShipName(seed, [
      ...RESERVED_SHIP_NAMES,
      ...state.ships.map((vessel) => vessel.name),
    ]);
  const ship = buildFleetShip({
    id,
    classId: shipClass.id,
    name: shipName,
    color,
  });
  // A vessel commissioned mid-game must not be back-charged wages for the weeks
  // before it was launched: align its first wage day to one week from today.
  const today = Math.max(0, Math.floor(Number(game.day) || 0));
  ship.operations.wagesDueDay = today + 7;
  state.ships.push(ship);
  return { ok: true, ship, cost };
}

export function decommissionFleetShip(game, shipId) {
  const state = ensureFleetState(game);
  const index = state.ships.findIndex((ship) => ship.id === shipId);
  if (index === -1) return { ok: false, reason: "No such fleet vessel." };

  const ship = state.ships[index];
  const shipClass = SHIP_CLASSES[ship.classId] ?? SHIP_CLASSES.cutter;
  const refund = Math.round(
    shipClass.cost * FLEET_DECOMMISSION_REFUND_FRACTION,
  );
  game.coins += refund;
  state.ships.splice(index, 1);

  for (const [specialistId, assignedShipId] of Object.entries(
    state.captainAssignments,
  )) {
    if (assignedShipId === shipId)
      delete state.captainAssignments[specialistId];
  }

  return { ok: true, refund };
}

export function assignCaptain(game, shipId, specialistId) {
  const state = ensureFleetState(game);
  const ship = state.ships.find((entry) => entry.id === shipId);
  if (!ship) return { ok: false, reason: "No such fleet vessel." };
  if (
    specialistId !== null &&
    !SPECIALIST_ROSTER.some((officer) => officer.id === specialistId)
  )
    return { ok: false, reason: "Unknown officer." };

  for (const [officerId, assignedShipId] of Object.entries(
    state.captainAssignments,
  )) {
    if (assignedShipId === shipId) delete state.captainAssignments[officerId];
  }

  if (specialistId === null) {
    ship.captain = null;
    return { ok: true };
  }

  const previousShipId = state.captainAssignments[specialistId];
  if (previousShipId && previousShipId !== shipId) {
    const previous = state.ships.find((entry) => entry.id === previousShipId);
    if (previous) previous.captain = null;
  }
  state.captainAssignments[specialistId] = shipId;
  ship.captain = specialistId;
  return { ok: true };
}

export function fleetShipStats(ship, specialistState) {
  const base = calculateShipStats(ship?.shipUpgrades);
  const captain = ship?.captain;
  const isNavigator = captain === "navigator";
  const power =
    isNavigator && specialistState
      ? specialistPower(specialistState, captain)
      : 0;
  return { ...base, speedMultiplier: 1 + power * FLEET_CAPTAIN_SPEED_POWER };
}

// --- Route model (multi-stop, closed-loop, wrapping-world safe) -----------------

export function assignRoute(game, shipId, routeSpec, ctx) {
  const state = ensureFleetState(game);
  const ship = state.ships.find((entry) => entry.id === shipId);
  if (!ship) return { ok: false, reason: "No such fleet vessel." };

  const resolved = resolveRoutePorts(routeSpec, state, ctx);
  if (!resolved.ok) return resolved;

  const built = buildRouteLegs(resolved.ports, ctx);
  if (!built.ok) return built;

  ship.route = built.route;
  ship.status = "sailing";
  ship.distance = 0;
  ship.legCount = 0;
  ship.homePort = resolved.ports[0];
  const firstLeg = built.route.legs[0];
  ship.origin = firstLeg.a;
  ship.destination = firstLeg.b;
  return { ok: true, route: built.route };
}

export function clearFleetRoute(game, shipId) {
  const state = ensureFleetState(game);
  const ship = state.ships.find((entry) => entry.id === shipId);
  if (!ship) return { ok: false, reason: "No such fleet vessel." };
  ship.route = null;
  ship.status = "laidUp";
  ship.distance = 0;
  ship.origin = ship.homePort;
  ship.destination = null;
  ship.cargoKey = null;
  ship.cargoUnits = 0;
  ship.cargoLots = [];
  return { ok: true };
}

export function createRouteTemplate(name, ports) {
  return {
    id: `tpl-${slugify(name)}`,
    name: String(name || "Custom route"),
    ports: Array.isArray(ports) ? [...ports] : [],
  };
}

export function suggestRouteTemplates(ctx) {
  const routes = Array.isArray(ctx?.routes) ? ctx.routes : [];
  const triangles = findTriangles(routes)
    .slice(0, FLEET_TRIANGLE_SUGGEST_LIMIT)
    .map((ports, index) => ({
      id: `tpl-triangle-${index}`,
      name: `Triangle · ${ports.join(" → ")}`,
      ports,
    }));
  const shuttles = [...routes]
    .sort((left, right) => compareLaneLabel(left, right))
    .slice(0, FLEET_ROUTE_SUGGEST_LIMIT)
    .map((route, index) => ({
      id: `tpl-shuttle-${index}`,
      name: `Shuttle · ${route.a} ↔ ${route.b}`,
      ports: [route.a, route.b],
    }));
  return [...triangles, ...shuttles];
}

function resolveRoutePorts(routeSpec, state, ctx) {
  if (typeof routeSpec === "string") {
    const saved = Array.isArray(state?.templates) ? state.templates : [];
    const template =
      saved.find((entry) => entry.id === routeSpec) ||
      suggestRouteTemplates(ctx).find((entry) => entry.id === routeSpec);
    if (!template) return { ok: false, reason: "Unknown route template." };
    return { ok: true, ports: [...template.ports] };
  }
  if (Array.isArray(routeSpec)) return { ok: true, ports: [...routeSpec] };
  if (routeSpec && Array.isArray(routeSpec.ports))
    return { ok: true, ports: [...routeSpec.ports] };
  return { ok: false, reason: "Provide a template id or a list of ports." };
}

function buildRouteLegs(ports, ctx) {
  if (!Array.isArray(ports) || ports.length < 2)
    return { ok: false, reason: "A route needs at least two ports." };

  const legs = [];
  for (let index = 0; index < ports.length; index += 1) {
    const origin = ports[index];
    const destination = ports[(index + 1) % ports.length];
    const lane = findRouteBetween(ctx?.routes, origin, destination);
    if (!lane)
      return {
        ok: false,
        reason: `No known sea lane between ${origin} and ${destination}.`,
      };
    const points = orientRoute(
      lane,
      origin,
      destination,
      ctx?.portX ? ctx.portX(origin) : undefined,
      ctx?.worldWidth,
    );
    legs.push({
      a: origin,
      b: destination,
      points,
      routeLength: pathLength(points),
    });
  }

  return { ok: true, route: { ports: [...ports], legs, legIndex: 0 } };
}

function findRouteBetween(routes, a, b) {
  if (!Array.isArray(routes)) return null;
  return (
    routes.find(
      (route) =>
        (route.a === a && route.b === b) || (route.a === b && route.b === a),
    ) || null
  );
}

function findTriangles(routes) {
  const adjacency = new Map();
  for (const route of routes) {
    if (!route || route.a === route.b) continue;
    for (const [a, b] of [
      [route.a, route.b],
      [route.b, route.a],
    ]) {
      if (!adjacency.has(a)) adjacency.set(a, new Set());
      adjacency.get(a).add(b);
    }
  }
  const nodes = [...adjacency.keys()].sort();
  const triangles = [];
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      for (let k = j + 1; k < nodes.length; k += 1) {
        const [a, b, c] = [nodes[i], nodes[j], nodes[k]];
        if (
          adjacency.get(a).has(b) &&
          adjacency.get(b).has(c) &&
          adjacency.get(a).has(c)
        )
          triangles.push([a, b, c]);
      }
    }
  }
  return triangles;
}

function compareLaneLabel(left, right) {
  return String(`${left.a}|${left.b}`).localeCompare(
    String(`${right.a}|${right.b}`),
  );
}

function slugify(value) {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "route";
}

// --- Movement, arrival trading, and render shapes ------------------------------

export function fleetMovementSpeed(ship, ctx) {
  const stats = fleetShipStats(ship, ctx?.specialistState);
  const classRatio =
    Math.max(0.4, Number(stats.maxSpeed) || FLEET_REFERENCE_SPEED) /
    FLEET_REFERENCE_SPEED;
  const efficiency = componentEfficiency(ship?.operations?.condition);
  return FLEET_BASE_SPEED * classRatio * stats.speedMultiplier * efficiency;
}

export function updateFleetShip(ship, dt, ctx) {
  if (!ship || ship.status !== "sailing" || !ship.route)
    return { arrived: false };
  const route = ship.route;
  const leg = route.legs[route.legIndex];
  if (!leg) return { arrived: false };

  const speed = fleetMovementSpeed(ship, ctx);
  ship.speed = speed;
  ship.distance += speed * dt;
  const arrived = ship.distance >= leg.routeLength;
  const position = pointAlongPath(
    leg.points,
    Math.min(ship.distance, leg.routeLength),
  );
  ship.x = position.x;
  ship.y = position.y;
  ship.angle = position.angle;
  return { arrived, leg };
}

export function loadDepartureCargo(game, ship, ctx) {
  if (!ship || !ship.route || ship.status !== "sailing")
    return { ok: false, reason: "Vessel is not under way." };

  const cargoKey = chooseFleetCargo(ship.origin, ship.destination, ctx);
  const originState = ctx.economyState(ship.origin, cargoKey);
  const available = Math.max(
    0,
    Math.floor(originState.stock - FLEET_BUY_RESERVE),
  );
  const room = Math.max(0, ship.holdMax - ship.cargoLots.length);
  const units = Math.min(available, room, FLEET_MAX_BUY);

  ship.cargoKey = cargoKey;
  if (units < FLEET_MIN_BUY) {
    ship.cargoUnits = 0;
    return { ok: true, cargoKey, units: 0, cost: 0 };
  }

  const price = buyPrice(ctx.pricingOptions(ship.origin, cargoKey));
  const cost = units * price;
  const good = ctx.good(cargoKey);
  game.coins = Math.max(0, (Number(game.coins) || 0) - cost);
  originState.stock = clamp(originState.stock - units, 0, 70);
  ship.cargoLots = Array.from({ length: units }, (_value, index) =>
    createCargoLot({
      key: cargoKey,
      cost: price,
      origin: ship.origin,
      day: ctx.day,
      sequence: index,
      good,
    }),
  );
  ship.cargoUnits = units;
  ship.totalCosts += cost;
  return { ok: true, cargoKey, units, cost };
}

export function resolveFleetArrival(game, ship, ctx) {
  const events = [];
  if (!ship || !ship.route) return events;

  if (ship.cargoUnits > 0 && ship.cargoKey) {
    const cargoKey = ship.cargoKey;
    const soldUnits = ship.cargoUnits;
    const destState = ctx.economyState(ship.destination, cargoKey);
    const rewardMultiplier = captainRewardMultiplier(game, ship);
    const proceeds = Math.max(
      0,
      Math.round(
        soldUnits *
          sellPrice(ctx.pricingOptions(ship.destination, cargoKey)) *
          rewardMultiplier,
      ),
    );
    destState.stock = clamp(destState.stock + soldUnits, 0, 70);
    game.coins = (Number(game.coins) || 0) + proceeds;
    ship.totalRevenue += proceeds;
    ship.cargoLots = [];
    ship.cargoUnits = 0;
    ship.deliveries += 1;
    bumpFleetLegacy(game, { revenue: proceeds, deliveries: 1 });
    if (ctx.recordCompetition)
      ctx.recordCompetition(ship.destination, cargoKey, ctx.day);

    const condition = economyCondition(destState);
    events.push({
      type: "delivery",
      ship,
      port: ship.destination,
      key: cargoKey,
      units: soldUnits,
      proceeds,
      condition,
      significant: condition === "Shortage" || proceeds >= FLEET_BIG_DELIVERY,
    });
  }

  // Provisions for the passage just completed (a light running cost). Floor
  // (not round) so a purser captain's reduction is not eaten entirely by
  // rounding at this small base cost.
  const provisionCost = Math.floor(
    FLEET_PROVISION_COST * captainProvisionMultiplier(game, ship),
  );
  if (provisionCost > 0) {
    game.coins = Math.max(0, (Number(game.coins) || 0) - provisionCost);
    ship.totalCosts += provisionCost;
  }

  advanceRouteLeg(ship);
  loadDepartureCargo(game, ship, ctx);

  // The peril of the next passage: storm and pirate encounters.
  resolveFleetHazard(game, ship, ctx, events);
  return events;
}

// --- Costs, risk, and per-day upkeep ------------------------------------------

export function fleetRoll(seed) {
  const value = Math.sin(Number(seed || 0) * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

export function fleetOutcomeSeed(ship, ctx) {
  return (
    parseShipIdNumber(ship?.id) * 97 +
    (ship?.legCount || 0) * 1000 +
    Number(ctx?.day || 0)
  );
}

export function captainVoyageModifiers(game, ship) {
  const captain = ship?.captain;
  if (!captain)
    return {
      damageMultiplier: 1,
      provisionMultiplier: 1,
      moraleLossMultiplier: 1,
      combatBonus: 0,
    };
  const power = specialistPower(game?.specialists, captain);
  return {
    damageMultiplier: captain === "boatswain" ? 1 - power * 0.18 : 1,
    provisionMultiplier: captain === "purser" ? 1 - power * 0.1 : 1,
    moraleLossMultiplier: captain === "surgeon" ? 1 - power * 0.2 : 1,
    combatBonus: captain === "gunner" ? power * 0.7 : 0,
  };
}

function captainProvisionMultiplier(game, ship) {
  return captainVoyageModifiers(game, ship).provisionMultiplier;
}

export function resolveFleetHazard(game, ship, ctx, events = []) {
  if (ctx?.hazardsEnabled === false) return events;
  if (!ship || ship.status === "repairing") return events;

  const modifiers = captainVoyageModifiers(game, ship);
  const stats = fleetShipStats(ship, ctx?.specialistState);
  const seed = fleetOutcomeSeed(ship, ctx);

  const stormExposure =
    FLEET_STORM_CHANCE / Math.max(0.5, Number(stats.stormResistance) || 1);
  if (fleetRoll(seed) < stormExposure) {
    const baseDamage = 2 + Math.floor(fleetRoll(seed + 1) * 5);
    const damage = Math.max(
      0,
      Math.round(baseDamage * modifiers.damageMultiplier),
    );
    const damaged = applyComponentDamage(ship.operations, {
      hull: damage,
      rigging: Math.floor(damage * 0.7),
    });
    ship.operations = damaged.operations;
    events.push({
      type: "storm",
      ship,
      damage,
      significant: damage >= FLEET_SIGNIFICANT_DAMAGE,
    });
    if (ship.operations.condition < FLEET_REPAIR_CONDITION) {
      ship.status = "repairing";
      ship.repairDaysLeft = FLEET_REPAIR_DAYS;
      ship.distance = 0;
    }
    return events;
  }

  const defense = (Number(stats.defense) || 0) + modifiers.combatBonus;
  const encounter = resolveHostileEncounter({
    distance: 600,
    risk: FLEET_PIRATE_RISK,
    defense,
    seed: seed + 2,
  });
  if (!encounter.encountered) return events;

  const damaged = applyComponentDamage(
    ship.operations,
    encounter.componentDamage,
  );
  ship.operations = damaged.operations;
  if (encounter.repelled) {
    const progress = game.legacyProgress || (game.legacyProgress = {});
    progress.piratesRepelled = Math.floor(
      (Number(progress.piratesRepelled) || 0) + 1,
    );
    events.push({ type: "pirate", ship, repelled: true, significant: true });
  } else {
    const lostCargo = Math.ceil(
      ship.cargoUnits * FLEET_PIRATE_CARGO_LOSS_FRACTION,
    );
    ship.cargoUnits = Math.max(0, ship.cargoUnits - lostCargo);
    ship.cargoLots = ship.cargoLots.slice(0, ship.cargoUnits);
    game.coins = Math.max(0, (Number(game.coins) || 0) - encounter.coinsLost);
    ship.operations.morale = clamp(
      ship.operations.morale +
        encounter.moraleChange * modifiers.moraleLossMultiplier,
      0,
      100,
    );
    events.push({
      type: "pirate",
      ship,
      repelled: false,
      coinsLost: encounter.coinsLost,
      cargoLost: lostCargo,
      significant: true,
    });
  }
  return events;
}

export function runFleetDay(game) {
  const fleet = game?.fleet;
  if (!fleet || !Array.isArray(fleet.ships) || fleet.ships.length === 0) return;
  for (const ship of fleet.ships) {
    if (ship.status === "repairing") {
      ship.repairDaysLeft = Math.max(0, ship.repairDaysLeft - 1);
      if (ship.repairDaysLeft === 0) {
        const damage = Math.max(0, 100 - ship.operations.condition);
        const cost = Math.round(damage * FLEET_REPAIR_COST_PER_POINT);
        game.coins = Math.max(0, (Number(game.coins) || 0) - cost);
        const repaired = repairOperations(ship.operations, 10 ** 9);
        ship.operations = repaired.operations;
        ship.status = ship.route ? "sailing" : "laidUp";
      }
      continue;
    }

    const baseWage = crewWeeklyWage(ship.operations.crew);
    const wage =
      ship.status === "sailing"
        ? baseWage
        : Math.max(1, Math.round(baseWage * FLEET_LAYUP_WAGE_MULTIPLIER));
    const wages = processWages(ship.operations, game.day, game.coins, wage);
    ship.operations = wages.operations;
    game.coins = wages.coins;
  }
}

function advanceRouteLeg(ship) {
  const route = ship.route;
  route.legIndex = (route.legIndex + 1) % route.legs.length;
  const leg = route.legs[route.legIndex];
  ship.origin = leg.a;
  ship.destination = leg.b;
  ship.distance = 0;
  ship.legCount += 1;
}

function chooseFleetCargo(origin, destination, ctx) {
  let best = null;
  let bestScore = -Infinity;
  const keys = ctx.goodsKeys();
  for (const key of keys) {
    const source = ctx.economyState(origin, key);
    const dest = ctx.economyState(destination, key);
    const score = source.stock / source.target - dest.stock / dest.target;
    if (score > bestScore) {
      bestScore = score;
      best = key;
    }
  }
  return best || keys[0] || "spice";
}

function captainRewardMultiplier(game, ship) {
  if (ship?.captain !== "factor") return 1;
  return (
    1 +
    specialistPower(game?.specialists, "factor") * FLEET_CAPTAIN_REWARD_POWER
  );
}

function bumpFleetLegacy(game, { revenue = 0, deliveries = 0 }) {
  const progress = game.legacyProgress || (game.legacyProgress = {});
  progress.fleetRevenue = Math.floor(
    (Number(progress.fleetRevenue) || 0) + revenue,
  );
  progress.fleetDeliveries = Math.floor(
    (Number(progress.fleetDeliveries) || 0) + deliveries,
  );
}

export function fleetRenderObject(ship) {
  if (!ship) return null;
  return {
    x: Number(ship.x) || 0,
    y: Number(ship.y) || 0,
    angle: Number(ship.angle) || 0,
    vesselClass: ship.classId,
    idNum: parseShipIdNumber(ship.id),
    color: ship.color,
    name: ship.name,
  };
}

export function fleetRoutePaths(game) {
  const state = ensureFleetState(game);
  const seen = new Set();
  const paths = [];
  for (const ship of state.ships) {
    if (!ship.route) continue;
    for (const leg of ship.route.legs) {
      const key = `${leg.a}|${leg.b}`;
      if (seen.has(key)) continue;
      seen.add(key);
      paths.push({ a: leg.a, b: leg.b, points: leg.points });
    }
  }
  return paths;
}
