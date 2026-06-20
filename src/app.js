import {
  clamp,
  nearestWrapped,
  normalizeAngle,
  wrap,
  wrappedDelta,
  wrappedDistance as calculateWrappedDistance,
} from "./core/math.js";
import {
  expandPolygon,
  pointInWrappedPolygon,
  polygonCentroid,
  raySegmentDistance,
} from "./core/geometry.js";
import {
  edgeInwardVector,
  limitOutwardWind,
  readSailingInput,
  recoverFromShallows,
  shipSpeedKnots,
} from "./core/sailing.js";
import {
  advanceEconomyState,
  buyPrice,
  createEconomyState,
  economyCondition as classifyEconomy,
  sellPrice,
} from "./core/economy.js";
import {
  orientRoute as buildOrientedRoute,
  pathLength,
  pointAlongPath,
  routesFrom as findRoutesFrom,
} from "./core/routes.js";
import {
  addNews as recordNews,
  cargoCount as countCargo,
  changeStanding as adjustStanding,
  createGameState,
} from "./core/state.js";
import {
  createSaveData,
  parseSave,
  serializeSave,
} from "./core/persistence.js";
import {
  estimateVoyageDays,
  SAILING_SECONDS_PER_DAY,
} from "./core/voyage-time.js";
import {
  beginAtHomePort,
  bindBeginButton,
  recoverNavigablePosition,
} from "./core/startup.js";
import {
  ageCargo,
  bestCargoCompartment,
  cargoCompartmentCapacities,
  CARGO_COMPARTMENTS,
  cargoCondition,
  cargoLotDescription,
  cargoValueMultiplier,
  createCargoLot,
  grantCargo,
  moveCargoLot,
  normalizeCargoCompartments,
  normalizeCargoLot,
  normalizeCargoLots,
  resolveVoyageCargo,
  syncCargoCounts,
} from "./core/cargo.js";
import {
  ageWarehouseCargo,
  depositCargo,
  leaseWarehouse,
  normalizeWarehouseState,
  warehouseAt,
  warehouseLeaseCost,
  withdrawCargo,
} from "./core/warehouses.js";
import {
  buyOrEquipUpgrade,
  buyOrSelectShipClass,
  calculateShipIdentity,
  calculateShipStats,
  normalizeShipUpgradeState,
  SHIP_CLASSES,
  SHIP_IDENTITIES,
  SHIP_UPGRADES,
  UPGRADE_SLOTS,
} from "./core/upgrades.js";
import {
  activeDiscoveryTrade,
  advanceDiscoveryConsequences,
  DISCOVERY_DISPOSITIONS,
  discoverySample,
  normalizeDiscoveryState,
  recordDiscovery,
  resolveDiscovery,
  seasonalSiteActive,
} from "./core/discoveries.js";
import {
  RUMOR_COST,
  createRumorLead,
  expireRumorLeads,
  normalizeRumorLeads,
  targetMatchesFaction,
} from "./core/rumors.js";
import {
  EXPLORATION_APPROACHES,
  normalizeExplorationState,
  resolveExpedition,
} from "./core/exploration.js";
import { chartedCityIndicators } from "./core/chart.js";
import {
  advanceCrises,
  applyCrisisAftermath,
  CRISIS_TEMPLATES,
  crisisAtPort,
  crisisEconomyModifiers,
  interveneInCrisis,
  normalizeCrisisState,
} from "./core/crises.js";
import {
  applyComponentDamage,
  adjustedIntelCost,
  buyProvisions,
  componentEfficiency,
  contractOutcome,
  estimateVoyageReadiness,
  factionPrivilege,
  fulfillObligationsAtPort,
  intelligenceFreshness,
  maybeCreateObligation,
  normalizeOperationsState,
  processObligations,
  processWages,
  repairOperations,
  repairShipComponent,
  resolveCombatAction,
  resolveHostileEncounter,
  resolveVoyageOperations,
  routePlanEffects,
  ROUTE_PLANS,
  SHIP_COMPONENTS,
  weatherRoughness,
} from "./core/operations.js";
import {
  advanceRegionalResources,
  availableMarketGoods,
  createRegionalState,
  dockingFee,
  investInIndustry,
  investmentCost,
  normalizeRegionalState,
  portEvolution,
  regionalSummary,
  runRegionalIndustries,
} from "./core/regional.js";
import {
  chooseFactionCharter,
  factionLore,
  contractConflict,
  factionRivals,
} from "./core/factions.js";
import {
  buyPermit,
  canTrade,
  cultivateOfficial,
  jurisdictionLaw,
  lawDetails,
  normalizeLegalState,
  resolveCustoms,
  tradeQuote,
} from "./core/jurisdictions.js";
import {
  contractCargoCount as countContractCargo,
  contractOffersForPort,
  createContractOffer,
} from "./core/contracts.js";
import {
  bestTradeOpportunity as findBestTradeOpportunity,
  intelActionLabel,
  intelEffectText,
  upcomingEvents as findUpcomingEvents,
} from "./core/intelligence.js";
import { currentObjective, voyageWarnings } from "./core/guidance.js";
import {
  completeLegacyCapstone,
  continueLegacySandbox,
  legacyChecklist,
  legacyReadyForCapstone,
  LEGACY_PATHS,
  normalizeLegacyState,
} from "./core/legacies.js";
import {
  clearCourse,
  compassDirection,
  courseBearing,
  normalizeNavigationState,
  plotCourse,
} from "./core/navigation.js";
import {
  adjustSpecialistLoyalty,
  normalizeSpecialistState,
  resolveSpecialistEvent,
  SPECIALIST_ROSTER,
  specialistCombatBonus,
  specialistExplorationBonus,
  specialistPower,
  specialistRewardMultiplier,
  specialistVoyageModifiers,
} from "./core/specialists.js";
import {
  CREW_ROLES,
  crewVoyageModifiers,
  crewWeeklyWage,
  normalizeCrewState,
  portRecruitmentPool,
  recruitCrew,
  resolveCrewIncident,
  takeShoreLeave,
} from "./core/crew.js";
import {
  aidRival,
  normalizeRivalState,
  recordPlayerCompetition,
  recordRivalDelivery,
  RIVAL_CAPTAINS,
  rivalForMerchant,
  rivalRelationshipLabel,
  tradeRivalIntelligence,
} from "./core/rivals.js";
import {
  currentAtPosition,
  markHazardEncounter,
  normalizeMaritimeHazardState,
  resolveShoalAction,
  resolveStormAction,
  shoalAtPosition,
  shouldTriggerStorm,
  stormCycle,
} from "./core/maritime-hazards.js";
import {
  discoverySites,
  explorationSites,
  forests,
  goods,
  HOME_PORT,
  lands,
  mountains,
  ports,
  productionChains,
  roughSeas,
  seaRegionLabels,
  weatherPatterns,
  worldCurrents,
  worldMonsters,
  worldShoals,
} from "./world-data.js";
import {
  createDistinctMapSeed,
  createMapTransform,
  moveUnreachablePointsToOpenWater,
  separateWrappedPoints,
} from "./core/map-generation.js";
import {
  createMapRendering,
  createRoughSeaParticles,
  drawMerchantShip,
  drawShip,
  drawWeatherEffects,
  wrappedCircleIntersectsViewport,
} from "./rendering.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const DPR = Math.min(2, window.devicePixelRatio || 1);
const MAP_SEED_KEY = "gilded-archipelago-map-seed";
const storedMapSeed = localStorage.getItem(MAP_SEED_KEY);
const mapSeed = storedMapSeed || createDistinctMapSeed("");
localStorage.setItem(MAP_SEED_KEY, mapSeed);
const mapTransform = createMapTransform(mapSeed);
const WORLD = { w: mapTransform.width, h: mapTransform.height };

function unwrapLandPolygon(poly) {
  if (!poly.length) return;
  let previousX = poly[0][0];
  for (let index = 1; index < poly.length; index++) {
    previousX += wrappedDelta(poly[index][0], previousX, WORLD.w);
    poly[index][0] = previousX;
  }
}

function transformWorldData() {
  const regions = lands
    .filter((land) => land.name)
    .map((land) => ({
      key: land.name,
      center: polygonCentroid(land.poly),
    }));
  const regionByName = new Map(regions.map((region) => [region.key, region]));
  const nearestRegion = (x, y) =>
    regions.reduce((nearest, region) => {
      const distance = Math.hypot(x - region.center.x, y - region.center.y);
      return !nearest || distance < nearest.distance
        ? { ...region, distance }
        : nearest;
    }, null);
  const mapPoint = (x, y, regionName) => {
    const region = regionByName.get(regionName) || nearestRegion(x, y);
    return mapTransform.regionPoint(x, y, region.key, region.center);
  };
  const mapRecord = (record, regionName) => {
    const mapped = mapPoint(record.x, record.y, regionName);
    record.x = mapped.x;
    record.y = mapped.y;
  };
  const mapTuple = (tuple, scaleSize = true) => {
    const mapped = mapPoint(tuple[0], tuple[1]);
    tuple[0] = mapped.x;
    tuple[1] = mapped.y;
    if (scaleSize && typeof tuple[2] === "number")
      tuple[2] = mapTransform.averageLength(tuple[2]);
  };

  for (const land of lands) {
    const center = polygonCentroid(land.poly);
    const region = land.name
      ? regionByName.get(land.name)
      : nearestRegion(center.x, center.y);
    for (const point of land.poly) {
      const mapped = mapTransform.regionPoint(
        point[0],
        point[1],
        region.key,
        region.center,
      );
      point[0] = mapped.x;
      point[1] = mapped.y;
    }
    unwrapLandPolygon(land.poly);
  }
  const openWaterAt = (x, y) =>
    !lands.some((land) => pointInWrappedPolygon(x, y, land.poly, WORLD.w));
  for (const port of ports) mapRecord(port, port.land);
  separateWrappedPoints(ports, {
    width: WORLD.w,
    height: WORLD.h,
    minDistance: 150,
    margin: 90,
    locked: (port) => port.home,
  });
  moveUnreachablePointsToOpenWater(ports, {
    isOpen: openWaterAt,
    width: WORLD.w,
    maxReach: 70,
    searchRadius: 460,
    locked: (port) => port.home,
  });
  for (const site of discoverySites) mapRecord(site);
  for (const site of explorationSites) mapRecord(site);
  for (const tuple of forests) mapTuple(tuple);
  for (const tuple of mountains) mapTuple(tuple);
  for (const tuple of worldShoals) {
    mapTuple(tuple, false);
    tuple[2] = mapTransform.horizontalLength(tuple[2]);
    tuple[3] = mapTransform.verticalLength(tuple[3]);
  }
  for (const tuple of worldCurrents) mapTuple(tuple, false);
  for (const tuple of worldMonsters) mapTuple(tuple, false);
  for (const tuple of seaRegionLabels) {
    const mapped = mapPoint(tuple[1], tuple[2]);
    tuple[1] = mapped.x;
    tuple[2] = mapped.y;
  }
  for (const sea of roughSeas) {
    mapRecord(sea);
    sea.rx = mapTransform.horizontalLength(sea.rx);
    sea.ry = mapTransform.verticalLength(sea.ry);
  }
  const spawn = mapPoint(HOME_PORT.spawnX, HOME_PORT.spawnY, "Avelorn");
  mapRecord(HOME_PORT, "Avelorn");
  HOME_PORT.spawnX = spawn.x;
  HOME_PORT.spawnY = spawn.y;

  return mapPoint;
}

const mapWorldPoint = transformWorldData();
const MIN_ZOOM = 0.7;
const MAX_ZOOM = 1.5;
const ZOOM_STEP = 1.12;
let vw = 0,
  vh = 0,
  fogWashGradient = null,
  vignetteGradient = null;
const camera = { x: 0, y: 0, zoom: 1 };
let viewportZoom = 1;
let userZoom = 1;
const keys = new Set();
let last = performance.now();
let gameStarted = false;
let nearPort = null;
let nearExplorationSite = null;
let nearDiscovery = null;
let currentPort = null;
let selectedTown = null;
let messageTimer = 0;
let edgeRecoveryActive = false;
let edgeMessageCooldown = 0;
let pendingCombat = null;
let pendingMaritimeHazard = null;
let suppressSaving = false;
const SAVE_KEY = "gilded-archipelago-save";

const game = createGameState();
game.mapSeed = mapSeed;
const ship = {
  x: HOME_PORT.spawnX,
  y: HOME_PORT.spawnY,
  angle: HOME_PORT.departureAngle,
  speed: 0,
  turnRate: 2.7,
  maxSpeed: 175,
  accel: 120,
  radius: 15,
  trail: [],
  anchored: true,
};

// Visibility uses the real-world geometric horizon from an observer near the
// top of the mast, then applies a lower weather limit when haze or fog closes in.
const visibility = {
  eyeHeightM: 12,
  worldUnitsPerKm: 20,
  horizonKm: 3.57 * Math.sqrt(12),
  radius: 0,
  polygon: [],
  rays: 192,
  lastX: Infinity,
  lastY: Infinity,
  lastRadius: -1,
  revealCooldown: 0,
};
function getInterpolatedWeather() {
  const weatherInterval = 1050;
  const progress =
    ((game.day - 1) * 620 + game.voyageDistance) / weatherInterval;
  const idx1 = Math.floor(progress) % weatherPatterns.length;
  const idx2 = (idx1 + 1) % weatherPatterns.length;
  const t = progress % 1;
  const smoothT = (1 - Math.cos(t * Math.PI)) / 2;

  const w1 = weatherPatterns[idx1];
  const w2 = weatherPatterns[idx2];

  return {
    name: t < 0.5 ? w1.name : w2.name,
    visibilityKm:
      w1.visibilityKm + (w2.visibilityKm - w1.visibilityKm) * smoothT,
    roughness: w1.roughness + (w2.roughness - w1.roughness) * smoothT,
  };
}
function setWeatherForDay(_day) {
  const weather = getInterpolatedWeather();
  game.weatherName = weather.name;
  game.weatherVisibilityKm = weather.visibilityKm;
  visibility.lastRadius = -1;
}
function currentVisibilityKm() {
  return Math.min(visibility.horizonKm, game.weatherVisibilityKm);
}
function currentWeather() {
  return getInterpolatedWeather();
}

function seamanshipBonus() {
  return specialistExplorationBonus(game.specialists) / 4;
}

function localCurrent(position = ship) {
  return currentAtPosition(position, worldCurrents, WORLD.w);
}
function applyShipUpgrades() {
  game.shipUpgrades = normalizeShipUpgradeState(game.shipUpgrades);
  document.getElementById("shipName").textContent =
    SHIP_CLASSES[game.shipUpgrades.activeClass].vesselName;
  const stats = operationalShipStats();
  game.holdMax = stats.holdMax;
  ship.maxSpeed = stats.maxSpeed;
  ship.accel = stats.accel;
  ship.turnRate = stats.turnRate;
  visibility.eyeHeightM = stats.visibilityHeightM;
  visibility.horizonKm = 3.57 * Math.sqrt(visibility.eyeHeightM);
  visibility.lastRadius = -1;
  return stats;
}

function operationalShipStats() {
  const stats = calculateShipStats(game.shipUpgrades);
  const components = game.operations.components;
  const rigging = componentEfficiency(components.rigging);
  const rudder = componentEfficiency(components.rudder);
  const hull = componentEfficiency(components.hull);
  stats.maxSpeed *= rigging;
  stats.accel *= Math.min(rigging, hull);
  stats.turnRate *= rudder;
  stats.stormResistance *= hull;
  stats.defense *= componentEfficiency(components.weapons);
  return stats;
}

function activeShipClass() {
  return SHIP_CLASSES[game.shipUpgrades.activeClass];
}

function cargoCapacities() {
  return cargoCompartmentCapacities(game.holdMax, {
    concealedLocker: game.shipUpgrades.equipped.cargo === "smugglers-lockers",
  });
}

const contractRoutes = {
  Goldhaven: ["Rimegate", "Mallowfen", "Khaz Vhar"],
  Rimegate: ["Goldhaven", "Lethariel", "Mallowfen"],
  Lethariel: ["Rimegate", "Glasswater", "Goldhaven"],
  Glasswater: ["Lethariel", "Kingfisher Quay", "Khaz Vhar"],
  "Khaz Vhar": ["Goldhaven", "Kingfisher Quay", "Drakefall"],
  Drakefall: ["Goldhaven", "Mallowfen", "Khaz Vhar"],
  Mallowfen: ["Goldhaven", "Drakefall", "Rimegate"],
  "Kingfisher Quay": ["Glasswater", "Khaz Vhar", "Goldhaven"],
};

Object.assign(contractRoutes, {
  Gloamharbor: ["Goldhaven", "Emberstrand", "Saint’s Anchorage"],
  Emberstrand: ["Gloamharbor", "Sunspire", "Saint’s Anchorage"],
  Sunspire: ["Emberstrand", "Nacre Bay", "Saint’s Anchorage"],
  "Nacre Bay": ["Sunspire", "Asterfall", "Kestrel Haven"],
  Asterfall: ["Nacre Bay", "Qasr Merid", "Kestrel Haven"],
  "Qasr Merid": ["Asterfall", "Skyreach", "Tempest Hold"],
  Skyreach: ["Qasr Merid", "Duskport", "Gloamharbor"],
  Duskport: ["Skyreach", "Dawnwatch", "Whalegrave"],
  Dawnwatch: ["Duskport", "Mallowfen", "Redharbor"],
  Redharbor: ["Saint’s Anchorage", "Pearlspire", "Dawnwatch"],
  Pearlspire: ["Redharbor", "Jadegate", "Kingfisher Quay"],
  Jadegate: ["Pearlspire", "Cloudrest", "Kestrel Haven"],
  Cloudrest: ["Jadegate", "Tempest Hold", "Kestrel Haven"],
  "Tempest Hold": ["Cloudrest", "Whalegrave", "Qasr Merid"],
  Whalegrave: ["Tempest Hold", "Duskport", "Cloudrest"],
  "Saint’s Anchorage": ["Emberstrand", "Sunspire", "Redharbor"],
  "Kestrel Haven": ["Nacre Bay", "Asterfall", "Jadegate"],
});
const contractCargoNames = [
  "sealed guild ledgers",
  "naval fittings",
  "healing tinctures",
  "court dispatches",
  "survey instruments",
  "temple reliquaries",
  "minted trade bars",
  "weatherproof sailcloth",
];
const worldEvents = {
  ironShortage: {
    id: "goldhaven-iron-shortage",
    active: false,
    title: "Goldhaven Iron Emergency",
    port: "Goldhaven",
    good: "iron",
    multiplier: 1.72,
    startDay: 0,
    description:
      "A collapse at the northern foundries has emptied the crown shipyards. Goldhaven is paying exceptional prices for dwarf-forged iron.",
  },
};

const eventTemplates = {
  loomStrike: {
    title: "Silver Loom Strike",
    port: "Lethariel",
    good: "silk",
    duration: 5,
    priceMultiplier: 1.48,
    productionDelta: -1.7,
    consumptionDelta: 0,
    stockDelta: -7,
    faction: "Silver Loom Consortium",
    factionShift: 6,
    routeName: "The Moonroad",
    routeRisk: "Severe delays",
    forecast:
      "Loom masters are quietly stockpiling silver thread. A coordinated stoppage is likely.",
    description:
      "The Silver Loom Consortium has halted the starweave houses. Silk production has collapsed and Moonroad cargo is delayed.",
  },
  spiceAuction: {
    title: "Great Pearl Senate Spice Auction",
    port: "Glasswater",
    good: "spice",
    duration: 4,
    priceMultiplier: 0.72,
    productionDelta: 1.4,
    consumptionDelta: 0,
    stockDelta: 15,
    faction: "Pearl Senate",
    factionShift: 5,
    routeName: "The Whispering Cut",
    routeRisk: "Crowded but safe",
    forecast:
      "Warehouse clerks report that three spice fleets will arrive together under Senate protection.",
    description:
      "Three moonspice fleets have reached Glasswater at once. Warehouses are overflowing and export prices have fallen.",
  },
  marchMobilization: {
    title: "Rimegate Mobilization",
    port: "Rimegate",
    good: "iron",
    duration: 6,
    priceMultiplier: 1.36,
    productionDelta: 0,
    consumptionDelta: 1.5,
    stockDelta: -8,
    faction: "Black Hammer Compact",
    factionShift: 7,
    routeName: "The Northern Packet",
    routeRisk: "Naval inspections",
    forecast:
      "The Seven Captains are buying weapons through intermediaries and calling veteran crews back to service.",
    description:
      "Rimegate has begun a naval mobilization. Armorers consume iron rapidly and every Northern Packet faces inspection.",
  },
  tunnelCollapse: {
    title: "Khaz Vhar Deep-Tunnel Collapse",
    port: "Khaz Vhar",
    good: "iron",
    duration: 6,
    priceMultiplier: 1.55,
    productionDelta: -1.9,
    consumptionDelta: 0,
    stockDelta: -11,
    faction: "Deep Delvers’ Union",
    factionShift: 8,
    routeName: "The Amber Run",
    routeRisk: "Unreliable supply",
    forecast:
      "Delvers whisper of groaning supports beneath the western galleries. Mine output may soon be interrupted.",
    description:
      "A deep gallery has collapsed beneath Khaz Vhar. Iron output is sharply reduced while the Delvers demand safety concessions.",
  },
  courtSeason: {
    title: "Kingfisher Court Season",
    port: "Kingfisher Quay",
    good: "silk",
    duration: 5,
    priceMultiplier: 1.38,
    productionDelta: 0,
    consumptionDelta: 1.35,
    stockDelta: -6,
    faction: "Velvet Circle",
    factionShift: 6,
    routeName: "Court Packet",
    routeRisk: "Low · Heavy traffic",
    forecast:
      "Court tailors are reserving berths and extending unusual amounts of credit for starweave silk.",
    description:
      "The ducal court season has opened. Fashion houses are consuming silk at extravagant rates and luxury berths are crowded.",
  },
  fenEmbargo: {
    title: "Mallowfen Customs Embargo",
    port: "Mallowfen",
    good: "spice",
    duration: 5,
    priceMultiplier: 1.42,
    productionDelta: 0,
    consumptionDelta: 1.1,
    stockDelta: -5,
    faction: "Reedboat Families",
    factionShift: 6,
    routeName: "Fenwater Run",
    routeRisk: "Customs seizures",
    forecast:
      "Reedboat elders are meeting behind closed doors over foreign warehouse leases and untaxed spice cargo.",
    description:
      "Mallowfen has imposed emergency customs restrictions. Moonspice is scarce and captains risk cargo seizures.",
  },
};

const merchantRoutePaths = [
  {
    a: "Goldhaven",
    b: "Rimegate",
    points: [
      [650, 485],
      [760, 430],
      [880, 385],
      [1000, 360],
    ],
  },
  {
    a: "Rimegate",
    b: "Lethariel",
    points: [
      [1000, 360],
      [1180, 405],
      [1360, 455],
      [1545, 470],
    ],
  },
  {
    a: "Lethariel",
    b: "Glasswater",
    points: [
      [1545, 470],
      [1710, 535],
      [1870, 650],
      [2000, 765],
    ],
  },
  {
    a: "Glasswater",
    b: "Kingfisher Quay",
    points: [
      [2000, 765],
      [2070, 875],
      [2035, 1000],
      [1950, 1105],
    ],
  },
  {
    a: "Kingfisher Quay",
    b: "Khaz Vhar",
    points: [
      [1950, 1105],
      [1800, 1175],
      [1615, 1225],
      [1450, 1185],
    ],
  },
  {
    a: "Khaz Vhar",
    b: "Goldhaven",
    points: [
      [1450, 1185],
      [1230, 1060],
      [1060, 825],
      [835, 620],
      [650, 485],
    ],
  },
  {
    a: "Goldhaven",
    b: "Mallowfen",
    points: [
      [650, 485],
      [545, 650],
      [430, 865],
      [360, 1140],
    ],
  },
  {
    a: "Mallowfen",
    b: "Drakefall",
    points: [
      [360, 1140],
      [505, 1220],
      [685, 1210],
      [830, 1135],
    ],
  },
  {
    a: "Drakefall",
    b: "Khaz Vhar",
    points: [
      [830, 1135],
      [1015, 1225],
      [1240, 1245],
      [1450, 1185],
    ],
  },
];

merchantRoutePaths.push(
  {
    a: "Goldhaven",
    b: "Gloamharbor",
    points: [
      [650, 485],
      [1200, 530],
      [1800, 600],
      [2380, 650],
    ],
  },
  {
    a: "Gloamharbor",
    b: "Emberstrand",
    points: [
      [2380, 650],
      [2620, 720],
      [2900, 750],
      [3130, 700],
    ],
  },
  {
    a: "Emberstrand",
    b: "Saint’s Anchorage",
    points: [
      [3130, 700],
      [3220, 900],
      [3180, 1080],
      [3050, 1210],
    ],
  },
  {
    a: "Saint’s Anchorage",
    b: "Redharbor",
    points: [
      [3050, 1210],
      [2840, 1380],
      [2630, 1560],
      [2470, 1760],
    ],
  },
  {
    a: "Saint’s Anchorage",
    b: "Sunspire",
    points: [
      [3050, 1210],
      [3260, 1120],
      [3470, 1010],
      [3660, 930],
    ],
  },
  {
    a: "Sunspire",
    b: "Nacre Bay",
    points: [
      [3660, 930],
      [3890, 850],
      [4160, 760],
      [4380, 720],
    ],
  },
  {
    a: "Nacre Bay",
    b: "Asterfall",
    points: [
      [4380, 720],
      [4500, 690],
      [4660, 690],
      [4800, 700],
    ],
  },
  {
    a: "Nacre Bay",
    b: "Kestrel Haven",
    points: [
      [4380, 720],
      [4480, 900],
      [4590, 1080],
      [4700, 1220],
    ],
  },
  {
    a: "Kestrel Haven",
    b: "Asterfall",
    points: [
      [4700, 1220],
      [4800, 1040],
      [4850, 850],
      [4800, 700],
    ],
  },
  {
    a: "Kestrel Haven",
    b: "Jadegate",
    points: [
      [4700, 1220],
      [4470, 1390],
      [4100, 1580],
      [3760, 1780],
    ],
  },
  {
    a: "Asterfall",
    b: "Qasr Merid",
    points: [
      [4800, 700],
      [5050, 650],
      [5300, 650],
      [5530, 700],
    ],
  },
  {
    a: "Qasr Merid",
    b: "Skyreach",
    points: [
      [5530, 700],
      [5790, 650],
      [6040, 680],
      [6240, 760],
    ],
  },
  {
    a: "Skyreach",
    b: "Duskport",
    points: [
      [6240, 760],
      [6320, 1000],
      [6310, 1320],
      [6280, 1600],
    ],
  },
  {
    a: "Duskport",
    b: "Dawnwatch",
    points: [
      [6280, 1600],
      [6360, 1650],
      [40, 1690],
      [80, 1730],
    ],
  },
  {
    a: "Dawnwatch",
    b: "Mallowfen",
    points: [
      [80, 1730],
      [150, 1510],
      [250, 1300],
      [360, 1140],
    ],
  },
  {
    a: "Redharbor",
    b: "Pearlspire",
    points: [
      [2470, 1760],
      [2750, 1680],
      [3090, 1630],
      [3410, 1660],
    ],
  },
  {
    a: "Pearlspire",
    b: "Jadegate",
    points: [
      [3410, 1660],
      [3520, 1700],
      [3650, 1750],
      [3760, 1780],
    ],
  },
  {
    a: "Jadegate",
    b: "Cloudrest",
    points: [
      [3760, 1780],
      [4020, 1680],
      [4360, 1560],
      [4640, 1510],
    ],
  },
  {
    a: "Cloudrest",
    b: "Tempest Hold",
    points: [
      [4640, 1510],
      [4780, 1530],
      [4910, 1590],
      [5020, 1640],
    ],
  },
  {
    a: "Tempest Hold",
    b: "Whalegrave",
    points: [
      [5020, 1640],
      [5300, 1740],
      [5610, 1870],
      [5920, 1940],
    ],
  },
  {
    a: "Whalegrave",
    b: "Duskport",
    points: [
      [5920, 1940],
      [6060, 1850],
      [6180, 1710],
      [6280, 1600],
    ],
  },
  {
    a: "Qasr Merid",
    b: "Tempest Hold",
    points: [
      [5530, 700],
      [5460, 980],
      [5300, 1300],
      [5020, 1640],
    ],
  },
  {
    a: "Glasswater",
    b: "Saint’s Anchorage",
    points: [
      [2000, 765],
      [2350, 900],
      [2720, 1080],
      [3050, 1210],
    ],
  },
  {
    a: "Kingfisher Quay",
    b: "Pearlspire",
    points: [
      [1950, 1105],
      [2300, 1300],
      [2850, 1510],
      [3410, 1660],
    ],
  },
  {
    a: "Kestrel Haven",
    b: "Cloudrest",
    points: [
      [4700, 1220],
      [4680, 1330],
      [4660, 1430],
      [4640, 1510],
    ],
  },
);

for (const route of merchantRoutePaths) {
  for (const point of route.points) {
    const mapped = mapWorldPoint(point[0], point[1]);
    point[0] = mapped.x;
    point[1] = mapped.y;
  }
}

const {
  exploredCtx,
  exploredMask,
  FOG_MASK_SCALE,
  fogCanvas,
  fogCtx,
  mapLayer,
  minimapFog,
  minimapFogCtx,
} = createMapRendering({ WORLD, game, merchantRoutePaths });

const merchantNames = [
  "Amber Heron",
  "Silver Wake",
  "Crown Petrel",
  "Moss Lantern",
  "Iron Minnow",
  "Velvet Gull",
  "Pearl Cormorant",
  "Ashen Star",
  "Reed Swan",
];
const merchantColors = [
  "#b24d34",
  "#496a72",
  "#7f5a8d",
  "#49714f",
  "#8b6a32",
  "#9b4e69",
  "#4f7894",
  "#6a5d52",
  "#8b8542",
];
const merchantVesselClasses = [
  "cutter",
  "sloop",
  "carrack",
  "barque",
  "brig",
  "dhow",
];
const merchantShips = [];
let selectedMerchant = null;

function getPortByName(name) {
  return ports.find((p) => p.name === name);
}
function wrapX(x) {
  return wrap(x, WORLD.w);
}
function nearestWrappedX(x, reference) {
  return nearestWrapped(x, reference, WORLD.w);
}
function wrappedDistance(x1, y1, x2, y2) {
  return calculateWrappedDistance(x1, y1, x2, y2, WORLD.w);
}
function worldCopiesNear(reference = camera.x) {
  const base = Math.floor(reference / WORLD.w) * WORLD.w;
  return [base - WORLD.w, base, base + WORLD.w];
}
const clampNumber = clamp;
function addNews(title, body) {
  recordNews(game, title, body);
}
function changeStanding(faction, amount) {
  return adjustStanding(game, faction, amount, clamp);
}
function guildStanding() {
  return game.factionStanding["Guild of Gilded Oars"] || 0;
}
function dominantFaction(port) {
  return port.factions.slice().sort((a, b) => b.influence - a.influence)[0];
}
function shiftFactionInfluence(port, factionName, amount) {
  const target = port.factions.find((f) => f.name === factionName);
  if (!target) return;
  const others = port.factions.filter((f) => f !== target);
  target.influence = clampNumber(target.influence + amount, 5, 70);
  const each = amount / Math.max(1, others.length);
  others.forEach((f) => (f.influence = clampNumber(f.influence - each, 5, 70)));
  const total = port.factions.reduce((s, f) => s + f.influence, 0);
  port.factions.forEach(
    (f) => (f.influence = Math.round((f.influence / total) * 100)),
  );
}
function initializeWorldSchedule() {
  const plan = [
    ["spiceAuction", 4],
    ["marchMobilization", 7],
    ["loomStrike", 10],
    ["courtSeason", 14],
    ["tunnelCollapse", 18],
    ["fenEmbargo", 22],
  ];
  game.scheduledEvents = plan.map(([templateId, startDay]) => ({
    id: "E" + game.worldEventSerial++,
    templateId,
    startDay,
    endDay: startDay + eventTemplates[templateId].duration - 1,
    known: false,
    started: false,
    ended: false,
  }));
}
function ensureFutureEvents() {
  const future = game.scheduledEvents.filter(
    (e) => !e.ended && e.startDay > game.day,
  );
  if (future.length >= 2) return;
  const keys = Object.keys(eventTemplates);
  const last = Math.max(
    game.day,
    ...game.scheduledEvents.map((e) => e.startDay),
  );
  for (let i = future.length; i < 3; i++) {
    const templateId = keys[(game.worldEventSerial + i) % keys.length];
    const startDay = last + 4 + i * 4;
    game.scheduledEvents.push({
      id: "E" + game.worldEventSerial++,
      templateId,
      startDay,
      endDay: startDay + eventTemplates[templateId].duration - 1,
      known: false,
      started: false,
      ended: false,
    });
  }
}
function activeEventsAt(portName) {
  return game.activeWorldEvents.filter(
    (e) => !e.ended && eventTemplates[e.templateId].port === portName,
  );
}
function eventForRoute(routeName) {
  return game.activeWorldEvents.find(
    (e) => !e.ended && eventTemplates[e.templateId].routeName === routeName,
  );
}
function processWorldEventsForDay() {
  for (const event of game.activeWorldEvents) {
    if (!event.ended && game.day > event.endDay) {
      event.ended = true;
      const t = eventTemplates[event.templateId];
      addNews(
        t.title + " ends",
        t.port +
          " markets are beginning to normalize, though the political consequences remain.",
      );
    }
  }
  game.activeWorldEvents = game.activeWorldEvents.filter((e) => !e.ended);
  for (const event of game.scheduledEvents) {
    if (event.started || event.startDay !== game.day) continue;
    event.started = true;
    const t = eventTemplates[event.templateId];
    const port = getPortByName(t.port);
    const state = economyState(port, t.good);
    state.stock = clampNumber(state.stock + t.stockDelta, 0, 70);
    shiftFactionInfluence(port, t.faction, t.factionShift);
    game.activeWorldEvents.push(event);
    addNews(
      t.title,
      t.description +
        " " +
        t.faction +
        " has gained influence in " +
        t.port +
        ".",
    );
    showMessage("BREAKING PORT NEWS · " + t.title + " in " + t.port, 4.5);
  }
  ensureFutureEvents();
}
function dynamicEventModifiers(port, key) {
  let price = 1,
    production = 0,
    consumption = 0;
  for (const e of activeEventsAt(port.name)) {
    const t = eventTemplates[e.templateId];
    if (t.good === key) {
      price *= t.priceMultiplier;
      production += t.productionDelta;
      consumption += t.consumptionDelta;
    }
  }
  const crisis = crisisEconomyModifiers(game.regionalCrises, port.name, key);
  price *= crisis.price;
  production += crisis.production;
  consumption += crisis.consumption;
  return { price, production, consumption };
}
function processRegionalCrisesForDay() {
  const result = advanceCrises(game.regionalCrises, game.day);
  game.regionalCrises = result.state;
  for (const transition of result.transitions) {
    const arc = game.regionalCrises.arcs[transition.id];
    const template = CRISIS_TEMPLATES[transition.id];
    if (transition.phase === "warning") {
      addNews(template.title + ": warning signs", template.warning);
      continue;
    }
    if (transition.phase === "active") {
      const stock = game.economy[template.port]?.[template.good];
      if (stock) stock.stock = clampNumber(stock.stock - 8, 0, 70);
      addNews(template.title, template.active);
      showMessage(`REGIONAL CRISIS · ${template.title} in ${template.port}`, 5);
      continue;
    }
    applyCrisisAftermath(
      game.regionalEconomy[template.port],
      template,
      transition.outcome,
    );
    addNews(template.title + ": lasting aftermath", template.ignored);
    arc.outcome = transition.outcome;
  }
}
function initializeEconomy() {
  configurePortIndustries();
  game.economy = createEconomyState(ports, goods);
  game.regionalEconomy = createRegionalState(
    regionalPortSpecifications(),
    productionChains,
  );
  // Deliberately strong regional identities make trade intelligence useful.
  game.economy["Rimegate"].iron.stock = 48;
  game.economy["Khaz Vhar"].iron.stock = 52;
  game.economy["Lethariel"].silk.stock = 49;
  game.economy["Glasswater"].spice.stock = 47;
  game.economy["Goldhaven"].iron.stock = 15;
  game.economy["Kingfisher Quay"].silk.stock = 9;
}
function prosperityInfrastructure(port) {
  if (port.prosperity.includes("Very high") || port.prosperity === "Booming")
    return 2;
  if (port.prosperity === "High") return 1;
  if (port.prosperity.includes("Poor")) return 0;
  return 1;
}
function regionalPortSpecifications() {
  return ports.map((port) => {
    const resourceText = port.resources.join(" ").toLowerCase();
    return {
      name: port.name,
      infrastructure: prosperityInfrastructure(port),
      labor: clampNumber(0.65 + port.population / 120000, 0.7, 1.35),
      population: port.population,
      extractiveGoods: Object.entries(goods)
        .filter(([, good]) =>
          good.terms.some((term) => resourceText.includes(term)),
        )
        .map(([key]) => key)
        .filter((key) => !goods[key].processed),
    };
  });
}
function portTradeText(port) {
  return [...port.resources, ...port.exports, ...port.imports]
    .join(" ")
    .toLowerCase();
}
function configurePortIndustries() {
  for (const port of ports) {
    const text = portTradeText(port);
    for (const [key, good] of Object.entries(goods)) {
      if (port.bias[key]) continue;
      const locallyNamed = good.terms.some((term) => text.includes(term));
      const imported = port.imports.some((item) =>
        good.terms.some((term) => item.toLowerCase().includes(term)),
      );
      port.bias[key] = imported ? 1.28 : locallyNamed ? 0.78 : 1.04;
    }
    port.industries = Object.fromEntries(
      productionChains.map((chain) => {
        const outputTerms = Object.keys(chain.outputs).flatMap(
          (key) => goods[key].terms,
        );
        const inputTerms = Object.keys(chain.inputs).flatMap(
          (key) => goods[key].terms,
        );
        const outputMatch = outputTerms.some((term) => text.includes(term));
        const inputMatch = inputTerms.some((term) => text.includes(term));
        return [chain.id, outputMatch ? 1.25 : inputMatch ? 0.7 : 0.18];
      }),
    );
  }
}
function initializeCargoState() {
  for (const key of Object.keys(goods)) {
    game.cargo[key] = 0;
    game.cargoCost[key] = [];
  }
  game.cargoLots = [];
}
initializeCargoState();
initializeEconomy();
initializeWorldSchedule();
function economyState(port, key) {
  return game.economy[port.name][key];
}
function economyCondition(port, key) {
  return classifyEconomy(economyState(port, key));
}
function eventPriceMultiplier(port, key) {
  const e = worldEvents.ironShortage;
  let multiplier =
    e.active && port.name === e.port && key === e.good ? e.multiplier : 1;
  multiplier *= dynamicEventModifiers(port, key).price;
  return multiplier;
}
function lawPriceMultiplier(port, key) {
  if (game.laws.amberConvoy && key === "iron" && port.name === "Goldhaven")
    return 0.82;
  if (game.laws.amberConvoy && key === "iron" && port.name === "Khaz Vhar")
    return 1.06;
  return 1;
}
function runEconomyDay() {
  for (const port of ports) {
    const regional = game.regionalEconomy[port.name];
    const resourceModifiers = advanceRegionalResources(
      regional,
      game.economy[port.name],
      productionChains,
    );
    for (const key of Object.keys(goods)) {
      const state = economyState(port, key),
        mods = dynamicEventModifiers(port, key);
      advanceEconomyState(state, {
        production: mods.production + (resourceModifiers[key]?.production || 0),
        consumption: mods.consumption,
      });
    }
    game.productionReports[port.name] = runRegionalIndustries(
      game.economy[port.name],
      productionChains,
      port.industries,
      regional,
    );
  }
  if (game.laws.amberConvoy) {
    const source = economyState(getPortByName("Khaz Vhar"), "iron");
    const dest = economyState(getPortByName("Goldhaven"), "iron");
    const moved = Math.min(2.6, Math.max(0, source.stock - 10));
    source.stock -= moved;
    dest.stock = clampNumber(dest.stock + moved, 0, 70);
  }
  for (const trade of activeDiscoveryTrade(game.discoveries)) {
    const site = discoverySites.find((entry) => entry.id === trade.discoveryId);
    if (site?.season && !seasonalSiteActive(site, game.day)) continue;
    const origin = getPortByName(trade.origin);
    const destination = getPortByName(trade.destination);
    if (
      !origin ||
      !destination ||
      !game.economy[destination.name]?.[trade.good]
    )
      continue;
    const source = game.economy[origin.name]?.[trade.good];
    const moved = source
      ? Math.min(trade.units, Math.max(0, source.stock - 5))
      : trade.units;
    if (source) source.stock -= moved;
    game.economy[destination.name][trade.good].stock = clampNumber(
      game.economy[destination.name][trade.good].stock + moved,
      0,
      70,
    );
  }
}
function maybeStartShortage() {
  const e = worldEvents.ironShortage;
  if (!e.active && !game.laws.amberConvoy && game.completedContracts >= 2) {
    e.active = true;
    e.startDay = game.day;
    const stock = economyState(getPortByName(e.port), e.good);
    stock.stock = Math.min(stock.stock, 3);
    addNews(
      e.title,
      e.description +
        " The Guild of Gilded Oars is seeking captains who can reopen the Amber Run.",
    );
    showMessage(
      "PORT NEWS: Goldhaven is suffering an iron shortage. The crown shipyards are paying a premium.",
      4.5,
    );
  }
}
function updateMilestoneCompletion() {
  if (
    !game.milestone.complete &&
    game.completedContracts >= 3 &&
    game.milestone.shortageExploited &&
    game.milestone.lawChanged
  ) {
    game.milestone.complete = true;
    game.coins += 250;
    addNews(
      "A Merchant Prince Rises",
      "Your contracts, market coup, and political victory have earned you a chartered seat among the great trading houses. Bonus: 250 crowns.",
    );
    showMessage(
      "MILESTONE COMPLETE · You are recognized as a Merchant Prince! +250 crowns",
      6,
    );
  }
}
function advanceDays(days) {
  days = Math.max(0, Math.floor(days));
  for (let i = 0; i < days; i++) {
    game.day++;
    ageCargo(game.cargoLots, 1);
    ageWarehouseCargo(game.warehouses, 1);
    const wages = processWages(game.operations, game.day, game.coins);
    game.operations = wages.operations;
    game.coins = wages.coins;
    if (wages.paid)
      addNews("Crew paid", `${wages.paid} crowns paid in weekly wages.`);
    if (wages.missed)
      addNews(
        "Wages missed",
        `${wages.missed} crowns entered arrears. Crew morale has fallen.`,
      );
    const crewEvent = resolveCrewIncident(game.operations.crew, {
      day: game.day,
      arrears: game.operations.wageArrears,
      coins: game.coins,
    });
    game.operations.crew = crewEvent.crew;
    if (crewEvent.incident) {
      game.coins -= crewEvent.incident.coinsLost;
      game.operations.morale = clampNumber(
        game.operations.morale + crewEvent.incident.morale,
        0,
        100,
      );
      addNews(crewEvent.incident.title, crewEvent.incident.body);
    }
    const specialistEvent = resolveSpecialistEvent(game.specialists, game.day);
    game.specialists = specialistEvent.state;
    if (specialistEvent.event) {
      game.coins = Math.max(0, game.coins + specialistEvent.event.coins);
      game.operations.morale = clampNumber(
        game.operations.morale + specialistEvent.event.morale,
        0,
        100,
      );
      addNews(specialistEvent.event.title, specialistEvent.event.body);
    }
    processWorldEventsForDay();
    processRegionalCrisesForDay();
    runEconomyDay();
    for (const route of advanceDiscoveryConsequences(
      game.discoveries,
      game.day,
    )) {
      const site = discoverySites.find(
        (entry) => entry.id === route.discoveryId,
      );
      addNews(
        site.name + " enters common use",
        "Merchants now work the route between " +
          route.origin +
          " and " +
          route.destination +
          ", changing the supply of " +
          goods[route.good].name +
          ".",
      );
    }
  }
  const obligations = processObligations(game.operations, game.day);
  game.operations = obligations.operations;
  for (const obligation of obligations.failed) {
    changeStanding(obligation.faction, -8);
    addNews(
      "Faction obligation broken",
      `You failed to call on ${obligation.faction} before Day ${obligation.dueDay}.`,
    );
  }
  if (days) {
    game.windAngle += 1.42 * days;
    game.windStrength = 0.1 + ((game.day * 41) % 10) / 100;
    const weather = getInterpolatedWeather();
    game.weatherName = weather.name;
    game.weatherVisibilityKm = weather.visibilityKm;
    visibility.lastRadius = -1;
  }
  const retained = [];
  for (const contract of game.activeContracts) {
    if (game.day > contract.deadline + 2) {
      game.failedContracts++;
      changeStanding(contract.faction, -3);
      addNews(
        "Contract failed",
        contract.title +
          " expired before reaching " +
          contract.destination +
          ".",
      );
    } else retained.push(contract);
  }
  game.activeContracts = retained;
  maybeStartShortage();
  updateMilestoneCompletion();
}
function normalizeVoyageTimeState() {
  if (game.departedFromPort === null) return resetVoyageTimeState();
  const totalProgress = Math.max(0, Number(game.voyageDayProgress) || 0);
  const wholeProgressDays = Math.floor(totalProgress);
  game.voyageDayProgress = totalProgress - wholeProgressDays;
  game.voyageDaysElapsed =
    wholeProgressDays +
    Math.max(0, Math.floor(Number(game.voyageDaysElapsed) || 0));
}
function resetVoyageTimeState() {
  game.voyageDayProgress = 0;
  game.voyageDaysElapsed = 0;
}
function settledVoyageDays() {
  return Math.max(
    1,
    game.voyageDaysElapsed + (game.voyageDayProgress > 0.0001 ? 1 : 0),
  );
}
function advanceUnderwayTime(dt) {
  if (game.departedFromPort === null || ship.anchored) return;
  game.voyageDayProgress += Math.max(0, dt) / SAILING_SECONDS_PER_DAY;
  const fullDays = Math.floor(game.voyageDayProgress);
  if (!fullDays) return;
  game.voyageDayProgress -= fullDays;
  game.voyageDaysElapsed += fullDays;
  advanceDays(fullDays);
}
function revealContractDestination(port) {
  exploredCtx.save();
  exploredCtx.fillStyle = "#fff";
  exploredCtx.shadowColor = "#fff";
  exploredCtx.shadowBlur = 5;
  exploredCtx.beginPath();
  exploredCtx.arc(
    port.x * FOG_MASK_SCALE,
    port.y * FOG_MASK_SCALE,
    54 * FOG_MASK_SCALE,
    0,
    Math.PI * 2,
  );
  exploredCtx.fill();
  exploredCtx.restore();
}
function makeContractOffer(origin, index) {
  const result = createContractOffer({
    origin,
    index,
    day: game.day,
    serial: game.contractSerial,
    destinations: contractRoutes[origin.name],
    cargoNames: contractCargoNames,
    getPort: getPortByName,
    distanceBetween: (destination, source) =>
      routeDistanceBetween(source.name, destination.name) ??
      wrappedDistance(destination.x, destination.y, source.x, source.y),
    estimateDays: (distance) =>
      estimateVoyageDays(distance, {
        maxSpeed: operationalShipStats().maxSpeed,
      }),
  });
  game.contractSerial = result.nextSerial;
  return result.offer;
}
function ensureContractOffers(port) {
  const cache = contractOffersForPort({
    cache: game.contractOffers[port.name],
    day: game.day,
    createOffer: (index) => makeContractOffer(port, index),
  });
  game.contractOffers[port.name] = cache;
  return cache.offers;
}
function contractCargoCount() {
  return countContractCargo(game.activeContracts);
}
function acceptContract(id) {
  if (!currentPort) return;
  const offers = ensureContractOffers(currentPort),
    index = offers.findIndex((c) => c.id === id);
  if (index < 0) return;
  const contract = offers[index];
  const conflict = contractConflict(
    contract,
    game.activeContracts,
    game.factionCharter,
  );
  if (conflict) return showMessage(conflict);
  if (game.activeContracts.length >= 3)
    return showMessage("You can manage at most three active commissions.");
  if (cargoCount() + contract.cargoUnits > game.holdMax)
    return showMessage("Not enough hold space for the sealed contract cargo.");
  contract.acceptedDay = game.day;
  contract.deadline = game.day + contract.estimatedDays + 3;
  game.activeContracts.push(contract);
  offers.splice(index, 1);
  revealContractDestination(getPortByName(contract.destination));
  addNews(
    "Contract accepted",
    contract.title +
      " for " +
      contract.reward +
      " crowns. Due by Day " +
      contract.deadline +
      ".",
  );
  showMessage(
    contract.title + " accepted. Destination added to your chart.",
    3,
  );
  renderPortSystems();
  updateHud();
}
function resolveContractsAtPort(port) {
  const remaining = [];
  const resolved = [];
  for (const contract of game.activeContracts) {
    if (contract.destination !== port.name) {
      remaining.push(contract);
    } else {
      resolved.push(contract);
    }
  }

  if (resolved.length === 0) return;

  let rewardTotal = 0;
  const influenceGains = {};

  for (const contract of resolved) {
    const standing = game.factionStanding[contract.faction] || 0;
    const outcome = contractOutcome(contract, game.day, standing);
    outcome.reward = Math.round(
      outcome.reward * specialistRewardMultiplier(game.specialists),
    );
    game.coins += outcome.reward;
    rewardTotal += outcome.reward;
    changeStanding(contract.faction, outcome.standing);
    if (outcome.standing !== 0) {
      influenceGains[contract.faction] =
        (influenceGains[contract.faction] || 0) + outcome.standing;
    }

    if (outcome.completed) {
      game.completedContracts++;
      if (
        contract.origin === "Goldhaven" &&
        contract.faction !== "Guild of Gilded Oars"
      ) {
        changeStanding("Guild of Gilded Oars", 4);
        influenceGains["Guild of Gilded Oars"] =
          (influenceGains["Guild of Gilded Oars"] || 0) + 4;
      }
      addNews(
        "Contract fulfilled",
        contract.title +
          " earned " +
          outcome.reward +
          " crowns and +" +
          contract.influence +
          " influence with " +
          contract.faction +
          ".",
      );
      const obligation = maybeCreateObligation(
        game.operations,
        contract.faction,
        game.factionStanding[contract.faction] || 0,
        game.day,
      );
      game.operations = obligation.operations;
      if (obligation.obligation)
        addNews(
          "Favor carries an obligation",
          `${contract.faction} now expects you to call at one of its ports by Day ${obligation.obligation.dueDay}.`,
        );
    } else {
      game.failedContracts++;
      addNews(
        outcome.grade + " delivery",
        contract.title +
          (outcome.reward
            ? " arrived late. You received " + outcome.reward + " crowns."
            : " was refused without payment."),
      );
    }
  }

  game.activeContracts = remaining;

  const influenceEntries = Object.entries(influenceGains);
  let influenceText = "";
  if (influenceEntries.length > 0) {
    influenceText =
      " Reputation: " +
      influenceEntries
        .map(([f, amt]) => (amt > 0 ? "+" + amt : amt) + " " + f)
        .join(", ");
  }

  if (resolved.length === 1) {
    showMessage(
      `${resolved[0].title} delivered. Earned ${rewardTotal} crowns.${influenceText}`,
      4.5,
    );
  } else {
    showMessage(
      `${resolved.length} contracts delivered. Earned ${rewardTotal} crowns.${influenceText}`,
      5,
    );
  }

  maybeStartShortage();
  updateMilestoneCompletion();
}
function routeRisk(route) {
  const event = eventForRoute(route.name);
  if (event) {
    const t = eventTemplates[event.templateId];
    return t.routeRisk + " · " + t.title;
  }
  return game.laws.amberConvoy && route.name === "The Amber Run"
    ? "Low · Crown convoy"
    : route.risk;
}
function hostileRiskBetween(originName, destinationName) {
  const route = merchantRoutePaths.find(
    (candidate) =>
      (candidate.a === originName && candidate.b === destinationName) ||
      (candidate.a === destinationName && candidate.b === originName),
  );
  const description = route
    ? routeRisk(
        getPortByName(originName).routes.find(
          (candidate) =>
            candidate.to.includes(destinationName) ||
            destinationName.includes(candidate.to),
        ) || { name: "", risk: "Moderate" },
      )
    : "Moderate";
  const normalized = description.toLowerCase();
  if (normalized.includes("low") || normalized.includes("safe")) return 0.1;
  if (
    normalized.includes("high") ||
    normalized.includes("severe") ||
    normalized.includes("pirate") ||
    normalized.includes("beast")
  )
    return 0.34;
  return 0.2;
}
function currentLawText(port) {
  if (port.name === "Goldhaven")
    return game.laws.amberConvoy
      ? "Royal Amber Convoy Charter — protected iron convoys now run between Goldhaven and Khaz Vhar."
      : "Private Shipping Ordinance — the Amber Run lacks a permanent escort and crown shipyards depend on irregular iron imports.";
  const ruler = dominantFaction(port);
  return (
    ruler.name +
    " currently holds the strongest bloc at " +
    ruler.influence +
    "% influence. Active crises can permanently shift this balance."
  );
}
function canPassConvoyLaw() {
  return (
    currentPort &&
    currentPort.name === "Goldhaven" &&
    game.completedContracts >= 3 &&
    game.milestone.shortageExploited &&
    guildStanding() >= 20 &&
    !game.laws.amberConvoy
  );
}
function passConvoyLaw() {
  if (!canPassConvoyLaw())
    return showMessage(
      "You have not yet secured enough contracts, proof of trade, and Guild influence.",
    );
  changeStanding("Guild of Gilded Oars", -20);
  game.laws.amberConvoy = true;
  game.milestone.lawChanged = true;
  worldEvents.ironShortage.active = false;
  const gold = economyState(getPortByName("Goldhaven"), "iron");
  gold.stock = clampNumber(gold.stock + 16, 0, 70);
  addNews(
    "Royal Amber Convoy Chartered",
    "Your petition passed. Crown escorts now carry iron from Khaz Vhar, lowering Goldhaven prices and reducing risk on the Amber Run.",
  );
  showMessage(
    "LAW CHANGED · The Royal Amber Convoy is now active. Regional iron trade has shifted.",
    5,
  );
  updateMilestoneCompletion();
  renderPortSystems();
  updateHud();
}

function orientRoute(route, origin, destination) {
  const originPort = getPortByName(origin);
  return buildOrientedRoute(route, origin, destination, originPort?.x, WORLD.w);
}
function routesFrom(portName) {
  return findRoutesFrom(merchantRoutePaths, portName);
}
function routeBetween(origin, destination) {
  return merchantRoutePaths.find(
    (route) =>
      (route.a === origin && route.b === destination) ||
      (route.a === destination && route.b === origin),
  );
}
function routeDistanceBetween(origin, destination) {
  const route = routeBetween(origin, destination);
  if (!route) return null;
  return pathLength(orientRoute(route, origin, destination));
}
function departurePortAtAnchor() {
  if (nearPort) return nearPort;
  let bestPort = null;
  let bestDistance = 180;
  for (const port of ports) {
    const distance = wrappedDistance(ship.x, ship.y, port.x, port.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestPort = port;
    }
  }
  return bestPort;
}
function chooseMerchantCargo(origin, destination) {
  let best = "spice",
    score = -Infinity;
  for (const key of Object.keys(goods)) {
    const source = economyState(origin, key),
      dest = economyState(destination, key);
    const s = source.stock / source.target - dest.stock / dest.target;
    if (s > score) {
      score = s;
      best = key;
    }
  }
  return best;
}
function chooseNextMerchantLeg(merchant) {
  const origin = getPortByName(merchant.destination);
  const choices = routesFrom(origin.name);
  const route = choices[(merchant.legCount + merchant.idNum) % choices.length];
  const destination = route.a === origin.name ? route.b : route.a;
  const dest = getPortByName(destination),
    cargoKey = chooseMerchantCargo(origin, dest),
    state = economyState(origin, cargoKey);
  const units = Math.max(2, Math.min(8, Math.floor(state.stock - 5)));
  state.stock = clampNumber(state.stock - units, 0, 70);
  merchant.origin = origin.name;
  merchant.destination = destination;
  merchant.cargoKey = cargoKey;
  merchant.cargoUnits = units;
  merchant.points = orientRoute(route, merchant.origin, merchant.destination);
  merchant.routeLength = pathLength(merchant.points);
  merchant.distance = 0;
  merchant.legCount++;
}
function deliverMerchantCargo(merchant) {
  const destination = getPortByName(merchant.destination),
    state = economyState(destination, merchant.cargoKey);
  state.stock = clampNumber(state.stock + merchant.cargoUnits, 0, 70);
  const rival = rivalForMerchant(merchant);
  if (rival)
    game.rivals = recordRivalDelivery(game.rivals, rival.id, {
      port: destination.name,
      goodKey: merchant.cargoKey,
      units: merchant.cargoUnits,
      day: game.day,
      unitValue: sellPriceFor(destination, merchant.cargoKey),
    });
  if (economyCondition(destination, merchant.cargoKey) === "Shortage")
    addNews(
      "Merchant relief arrives",
      merchant.name +
        " delivered " +
        merchant.cargoUnits +
        " units of " +
        goods[merchant.cargoKey].name +
        " to " +
        destination.name +
        ".",
    );
  chooseNextMerchantLeg(merchant);
}
function initializeMerchantShips() {
  merchantRoutePaths.forEach((route, i) => {
    const forward = i % 2 === 0,
      origin = forward ? route.a : route.b,
      destination = forward ? route.b : route.a,
      points = orientRoute(route, origin, destination),
      cargoKey = chooseMerchantCargo(
        getPortByName(origin),
        getPortByName(destination),
      );
    const state = economyState(getPortByName(origin), cargoKey),
      units = Math.max(3, Math.min(7, Math.floor(state.stock - 6)));
    state.stock = clampNumber(state.stock - units, 0, 70);
    merchantShips.push({
      id: "M" + (i + 1),
      idNum: i + 1,
      name:
        merchantNames[i % merchantNames.length] +
        (i >= merchantNames.length
          ? " " + (Math.floor(i / merchantNames.length) + 1)
          : ""),
      rivalId: RIVAL_CAPTAINS[i % RIVAL_CAPTAINS.length].id,
      color: merchantColors[i % merchantColors.length],
      vesselClass: merchantVesselClasses[i % merchantVesselClasses.length],
      origin,
      destination,
      points,
      routeLength: pathLength(points),
      distance: pathLength(points) * ((i * 0.137) % 0.82),
      speed: 20 + (i % 4) * 3,
      cargoKey,
      cargoUnits: units,
      legCount: i,
      trackedUntil: 0,
      x: points[0][0],
      y: points[0][1],
      angle: 0,
    });
  });
}
function updateMerchantShips(dt) {
  for (const merchant of merchantShips) {
    merchant.distance += merchant.speed * dt;
    if (merchant.distance >= merchant.routeLength) {
      deliverMerchantCargo(merchant);
    }
    const p = pointAlongPath(merchant.points, merchant.distance);
    merchant.x = p.x;
    merchant.y = p.y;
    merchant.angle = p.angle;
  }
}
function pointCurrentlyVisible(x, y) {
  const wx = nearestWrappedX(x, ship.x);
  if (Math.hypot(wx - ship.x, y - ship.y) > visibility.radius + 8) return false;
  let inside = false;
  const poly = visibility.polygon;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (
      a.y > y !== b.y > y &&
      wx < ((b.x - a.x) * (y - a.y)) / (b.y - a.y + 0.00001) + a.x
    )
      inside = !inside;
  }
  return inside;
}
function merchantVisible(merchant) {
  return (
    pointCurrentlyVisible(merchant.x, merchant.y) ||
    merchant.trackedUntil >= game.day
  );
}
function recordMerchantSighting(merchant) {
  const rival = rivalForMerchant(merchant);
  game.merchantSightings[merchant.id] = {
    name: merchant.name,
    rivalId: rival?.id,
    captain: rival?.captain,
    house: rival?.house,
    day: game.day,
    origin: merchant.origin,
    destination: merchant.destination,
    cargoKey: merchant.cargoKey,
    cargoUnits: merchant.cargoUnits,
  };
}
function nearestVisibleMerchant(x, y, radius) {
  let best = null,
    dBest = radius;
  for (const merchant of merchantShips) {
    if (!merchantVisible(merchant)) continue;
    const d = Math.hypot(x - nearestWrappedX(merchant.x, x), y - merchant.y);
    if (d < dBest) {
      dBest = d;
      best = merchant;
    }
  }
  return best;
}
function merchantEta(merchant) {
  return Math.max(
    1,
    Math.ceil(
      (merchant.routeLength - merchant.distance) /
        Math.max(1, merchant.speed) /
        12,
    ),
  );
}

function openVesselDetails(merchant) {
  if (!merchant) return;
  selectedMerchant = merchant;
  recordMerchantSighting(merchant);
  const rival = rivalForMerchant(merchant);
  const rivalState = rival ? game.rivals.captains[rival.id] : null;
  document.getElementById("vesselFlag").textContent = rival
    ? `${rival.house} · ${rival.faction}`
    : "Registered merchant · " +
      dominantFaction(getPortByName(merchant.origin)).name;
  document.getElementById("vesselName").textContent = merchant.name;
  document.getElementById("vesselDescription").textContent = rival
    ? `${rival.captain} commands this vessel for ${rival.house}. ${rival.description}`
    : "A working trader sailing the regional economy in real time. Its arrival will alter market stock at " +
      merchant.destination +
      ".";
  document.getElementById("vesselRoute").textContent =
    merchant.origin + " → " + merchant.destination;
  document.getElementById("vesselEta").textContent =
    "About " +
    merchantEta(merchant) +
    " watch" +
    (merchantEta(merchant) === 1 ? "" : "es");
  document.getElementById("vesselCargo").textContent =
    merchant.cargoUnits + " units of " + goods[merchant.cargoKey].name;
  document.getElementById("vesselEffect").textContent =
    "Adds stock in " + merchant.destination + ", usually easing prices there.";
  document.getElementById("vesselRival").textContent = rivalState
    ? `${rivalRelationshipLabel(rivalState.relationship)} · ${rivalState.relationship >= 0 ? "+" : ""}${rivalState.relationship}`
    : "Independent trader";
  document.getElementById("vesselHouse").textContent = rivalState
    ? `${rival.style} · reputation ${rivalState.reputation} · ${rivalState.deliveries} deliveries`
    : "No major house affiliation";
  const src = buyPriceFor(getPortByName(merchant.origin), merchant.cargoKey),
    dst = sellPriceFor(getPortByName(merchant.destination), merchant.cargoKey),
    margin = dst - src;
  document.getElementById("vesselAssessment").innerHTML =
    "<p><b>Observed executable spread:</b> buy for " +
    src +
    " crowns in " +
    merchant.origin +
    " and sell for " +
    dst +
    " in " +
    merchant.destination +
    " (" +
    (margin >= 0 ? "+" : "") +
    margin +
    ' per unit).</p><p class="small">Quotes include broker spreads and port duties. Merchant traffic is not decorative: cargo is removed when a vessel departs and added when it arrives.</p>';
  const actions = document.getElementById("vesselRivalActions");
  actions.innerHTML = "";
  if (rival) {
    const intelligence = document.createElement("button");
    intelligence.className = "parchment";
    intelligence.textContent = "Exchange sailing intelligence · 8 crowns";
    intelligence.disabled = game.coins < 8;
    intelligence.onclick = () => {
      const result = tradeRivalIntelligence(
        game.rivals,
        rival.id,
        game.day,
        game.coins,
      );
      if (!result.ok) return showMessage(result.reason);
      game.rivals = result.state;
      game.coins = result.coins;
      merchant.trackedUntil = Math.max(merchant.trackedUntil, game.day + 5);
      addNews(
        `Terms exchanged with ${rival.captain}`,
        `${rival.house} shared its current route and will remain marked on your chart through Day ${game.day + 5}.`,
      );
      showMessage("RIVAL INTELLIGENCE · Route tracking extended.", 4);
      openVesselDetails(merchant);
      updateHud();
    };
    const aid = document.createElement("button");
    aid.className = "parchment";
    aid.textContent = "Send spare provisions · 9 crowns";
    aid.disabled =
      game.coins < 9 ||
      (rivalState.lastAidDay > 0 && game.day - rivalState.lastAidDay < 7);
    aid.onclick = () => {
      const result = aidRival(game.rivals, rival.id, game.day, game.coins);
      if (!result.ok) return showMessage(result.reason);
      game.rivals = result.state;
      game.coins = result.coins;
      addNews(
        `${rival.house} accepts your aid`,
        `${rival.captain} received provisions at sea and now regards you more warmly.`,
      );
      showMessage("RIVAL AID · Relationship improved.", 4);
      openVesselDetails(merchant);
      updateHud();
    };
    actions.append(intelligence, aid);
  }
  document.getElementById("vesselPanel").style.display = "grid";
}
function closeVesselDetails() {
  document.getElementById("vesselPanel").style.display = "none";
  selectedMerchant = null;
}
function upcomingEvents(days = 9) {
  return findUpcomingEvents(game.scheduledEvents, game.day, days);
}
function bestTradeOpportunity() {
  return findBestTradeOpportunity(
    Object.keys(goods),
    ports,
    buyPriceFor,
    sellPriceFor,
  );
}
function makeIntelOffers(port) {
  const event =
    upcomingEvents(12).find(
      (e) => eventTemplates[e.templateId].port === port.name,
    ) || upcomingEvents(12)[0];
  const opportunity = bestTradeOpportunity();
  const connected = merchantShips.filter(
    (m) => m.origin === port.name || m.destination === port.name,
  );
  const merchant =
    connected[(game.day + port.name.length) % Math.max(1, connected.length)] ||
    merchantShips[(game.day + port.name.length) % merchantShips.length];
  const offers = [];
  if (event) {
    const t = eventTemplates[event.templateId];
    offers.push({
      id: "I" + game.intelSerial++,
      type: "forecast",
      title: "Political and market forecast",
      cost: 16,
      confidence: 88,
      eventId: event.id,
      affectedPort: t.port,
      startDay: event.startDay,
      expiresDay: event.endDay,
      body:
        t.forecast +
        " Expected near Day " +
        event.startDay +
        " in " +
        t.port +
        ".",
    });
  }
  const buyPort = getPortByName(opportunity.buy),
    sellPort = getPortByName(opportunity.sell),
    buyQuote = buyPriceFor(buyPort, opportunity.key),
    sellQuote = sellPriceFor(sellPort, opportunity.key);
  offers.push({
    id: "I" + game.intelSerial++,
    type: "market",
    title: "Factor’s price circular",
    cost: 10,
    confidence: 94,
    goodKey: opportunity.key,
    buyPort: opportunity.buy,
    sellPort: opportunity.sell,
    buyQuote,
    sellQuote,
    margin: sellQuote - buyQuote,
    expiresDay: game.day + 3,
    body:
      "Buy " +
      goods[opportunity.key].name +
      " in " +
      opportunity.buy +
      " for about " +
      buyQuote +
      " crowns and sell in " +
      opportunity.sell +
      " for about " +
      sellQuote +
      ". Estimated executable margin: " +
      (sellQuote - buyQuote) +
      " crowns per unit before prices move.",
  });
  offers.push({
    id: "I" + game.intelSerial++,
    type: "shipping",
    title: "Harbormaster’s sailing list",
    cost: 8,
    confidence: 96,
    merchantId: merchant.id,
    expiresDay: game.day + 5,
    body:
      merchant.name +
      " is carrying " +
      merchant.cargoUnits +
      " units of " +
      goods[merchant.cargoKey].name +
      " from " +
      merchant.origin +
      " to " +
      merchant.destination +
      ". The vessel will be tracked on your chart through Day " +
      (game.day + 5) +
      ".",
  });
  return offers;
}
function ensureIntelOffers(port) {
  let cache = game.intelOffers[port.name];
  if (!cache || game.day - cache.refreshedDay >= 3) {
    cache = { refreshedDay: game.day, offers: makeIntelOffers(port) };
    game.intelOffers[port.name] = cache;
  }
  return cache.offers;
}
function performIntelAction(report) {
  document.getElementById("reportPanel").style.display = "none";
  if (report.type === "forecast") {
    openTownDetails(getPortByName(report.affectedPort), false);
    return;
  }
  if (report.type === "market") {
    openTownDetails(getPortByName(report.sellPort), false);
    return;
  }
  if (report.type === "shipping") {
    const merchant = merchantShips.find((m) => m.id === report.merchantId);
    if (merchant) {
      openVesselDetails(merchant);
      return;
    }
  }
  renderLedger();
  activateSectionTabs(document.getElementById("ledgerPanel"), "milestone");
  document.getElementById("ledgerPanel").style.display = "grid";
}
function showIntelReport(report) {
  document.getElementById("reportTitle").textContent = report.title;
  document.getElementById("reportValidity").textContent =
    "Purchased Day " +
    report.boughtDay +
    " in " +
    report.origin +
    " · " +
    report.confidence +
    "% confidence · valid through Day " +
    report.expiresDay;
  document.getElementById("reportBody").textContent = report.body;
  document.getElementById("reportEffect").textContent = intelEffectText(report);
  const action = document.getElementById("reportAction");
  action.textContent = intelActionLabel(report);
  action.onclick = () => performIntelAction(report);
  document.getElementById("reportPanel").style.display = "grid";
}
function buyIntel(id) {
  if (!currentPort) return;
  const offers = ensureIntelOffers(currentPort),
    offer = offers.find((o) => o.id === id);
  if (!offer) return;
  const localStanding = Math.max(
    0,
    ...currentPort.factions.map(
      (faction) => game.factionStanding[faction.name] || 0,
    ),
  );
  const cost = adjustedIntelCost(offer.cost, localStanding);
  if (game.coins < cost)
    return showMessage("You cannot afford that intelligence report.");
  game.coins -= cost;
  offer.boughtDay = game.day;
  offer.origin = currentPort.name;
  const purchased = { ...offer };
  game.intelligence.unshift(purchased);
  offers.splice(offers.indexOf(offer), 1);
  if (offer.eventId) {
    const event = game.scheduledEvents.find((e) => e.id === offer.eventId);
    if (event) {
      event.known = true;
      const t = eventTemplates[event.templateId];
      revealContractDestination(getPortByName(t.port));
    }
  }
  if (offer.type === "market") {
    revealContractDestination(getPortByName(offer.buyPort));
    revealContractDestination(getPortByName(offer.sellPort));
  }
  if (offer.merchantId) {
    const merchant = merchantShips.find((m) => m.id === offer.merchantId);
    if (merchant) {
      merchant.trackedUntil = Math.max(merchant.trackedUntil, game.day + 5);
      recordMerchantSighting(merchant);
    }
  }
  addNews(
    "Intelligence purchased",
    offer.title +
      " acquired in " +
      currentPort.name +
      " for " +
      cost +
      " crowns.",
  );
  renderPortSystems();
  updateHud();
  showIntelReport(purchased);
}
function renderIntelOffice() {
  const root = document.getElementById("intelOffice");
  root.innerHTML = "";
  const offers = ensureIntelOffers(currentPort);
  if (!offers.length)
    root.innerHTML =
      '<p class="empty-note">Your informants have nothing new until their network refreshes.</p>';
  for (const offer of offers) {
    const localStanding = Math.max(
      0,
      ...currentPort.factions.map(
        (faction) => game.factionStanding[faction.name] || 0,
      ),
    );
    const cost = adjustedIntelCost(offer.cost, localStanding);
    const card = document.createElement("div");
    card.className = "intel-card";
    card.innerHTML =
      '<div class="intel-head"><h4>' +
      offer.title +
      '</h4><span class="contract-tag">' +
      cost +
      ' crowns</span></div><div class="intel-meta">Source confidence: ' +
      offer.confidence +
      "% · useful through Day " +
      offer.expiresDay +
      '</div><p class="small">The source will disclose the full report after payment.</p><div class="confidence"><span style="width:' +
      offer.confidence +
      '%"></span></div>';
    const b = document.createElement("button");
    b.className = "parchment";
    b.textContent = "Buy & Reveal Report";
    b.onclick = () => buyIntel(offer.id);
    card.append(b);
    root.append(card);
  }
  const purchased = game.intelligence.filter(
    (report) =>
      report.origin === currentPort.name && game.day <= report.expiresDay,
  );
  if (purchased.length) {
    const heading = document.createElement("h4");
    heading.className = "intel-purchased-heading";
    heading.textContent = "Purchased reports";
    root.append(heading);
    purchased.forEach((report) => {
      const card = document.createElement("div");
      card.className = "intel-card intel-known";
      card.innerHTML =
        '<div class="intel-head"><h4>' +
        report.title +
        '</h4><span class="contract-tag">Valid to Day ' +
        report.expiresDay +
        '</span></div><p class="small">' +
        report.body +
        '</p><div class="intel-result"><b>Active effect:</b> ' +
        intelEffectText(report) +
        "</div>";
      const b = document.createElement("button");
      b.className = "parchment";
      b.textContent = "View Full Report";
      b.onclick = () => showIntelReport(report);
      card.append(b);
      root.append(card);
    });
  }
}

initializeMerchantShips();

function onLand(x, y) {
  return lands.some((land) => pointInWrappedPolygon(x, y, land.poly, WORLD.w));
}

const roughSeaParticles = createRoughSeaParticles(roughSeas, onLand);
function buildVisibilityPolygon(force = false) {
  const radius = currentVisibilityKm() * visibility.worldUnitsPerKm;
  const moved = Math.hypot(
    ship.x - visibility.lastX,
    ship.y - visibility.lastY,
  );
  if (
    !force &&
    moved < 5 &&
    Math.abs(radius - visibility.lastRadius) < 0.5 &&
    visibility.polygon.length
  )
    return;
  visibility.radius = radius;
  visibility.polygon.length = 0;
  for (let i = 0; i < visibility.rays; i++) {
    const a = (i / visibility.rays) * Math.PI * 2;
    const dx = Math.cos(a),
      dy = Math.sin(a);
    let hit = radius;
    for (const land of lands) {
      const cent = polygonCentroid(land.poly);
      const nearestOffset = Math.round((ship.x - cent.x) / WORLD.w) * WORLD.w;
      for (const offset of [
        nearestOffset - WORLD.w,
        nearestOffset,
        nearestOffset + WORLD.w,
      ]) {
        const poly = land.poly;
        for (let j = 0; j < poly.length; j++) {
          const a0 = poly[j],
            b0 = poly[(j + 1) % poly.length];
          const d = raySegmentDistance(
            ship.x,
            ship.y,
            dx,
            dy,
            a0[0] + offset,
            a0[1],
            b0[0] + offset,
            b0[1],
            hit,
          );
          if (d !== null && d < hit) hit = d;
        }
      }
    }
    hit = Math.min(radius, hit + 5);
    visibility.polygon.push({ x: ship.x + dx * hit, y: ship.y + dy * hit });
  }
  visibility.lastX = ship.x;
  visibility.lastY = ship.y;
  visibility.lastRadius = radius;
}
function polygonPath(c, points, scaleX = 1, scaleY = scaleX, offsetX = 0) {
  c.beginPath();
  points.forEach((p, i) =>
    i
      ? c.lineTo((p.x + offsetX) * scaleX, p.y * scaleY)
      : c.moveTo((p.x + offsetX) * scaleX, p.y * scaleY),
  );
  c.closePath();
}
function revealCurrentView(force = false) {
  buildVisibilityPolygon(force);
  if (!visibility.polygon.length) return;
  const base = Math.floor(ship.x / WORLD.w) * WORLD.w;
  exploredCtx.save();
  exploredCtx.fillStyle = "#fff";
  exploredCtx.shadowColor = "#fff";
  exploredCtx.shadowBlur = 5;
  for (const extra of [-WORLD.w, 0, WORLD.w]) {
    polygonPath(
      exploredCtx,
      visibility.polygon,
      FOG_MASK_SCALE,
      FOG_MASK_SCALE,
      -base + extra,
    );
    exploredCtx.fill();
  }
  exploredCtx.restore();
}

function explorationLandForSite(site) {
  return (
    lands.find((land) => land.name && land.name === site.land) ||
    lands.find((land) =>
      pointInWrappedPolygon(site.x, site.y, land.poly, WORLD.w),
    ) ||
    lands.reduce((nearest, land) => {
      const center = polygonCentroid(land.poly);
      const distance = wrappedDistance(site.x, site.y, center.x, center.y);
      return !nearest || distance < nearest.distance
        ? { land, distance }
        : nearest;
    }, null)?.land
  );
}

function revealExplorationSurvey(site, surveyed) {
  const land = explorationLandForSite(site);
  exploredCtx.save();
  exploredCtx.fillStyle = "#fff";
  exploredCtx.shadowColor = "#fff";
  exploredCtx.shadowBlur = surveyed ? 9 : 5;
  const base = Math.floor(site.x / WORLD.w) * WORLD.w;
  if (land && surveyed) {
    for (const extra of [-WORLD.w, 0, WORLD.w]) {
      polygonPath(
        exploredCtx,
        expandPolygon(land.poly, 34).map(([x, y]) => ({ x, y })),
        FOG_MASK_SCALE,
        FOG_MASK_SCALE,
        -base + extra,
      );
      exploredCtx.fill();
    }
  }
  for (const extra of [-WORLD.w, 0, WORLD.w]) {
    exploredCtx.beginPath();
    exploredCtx.arc(
      (site.x - base + extra) * FOG_MASK_SCALE,
      site.y * FOG_MASK_SCALE,
      site.radius * (surveyed ? 3.2 : 1.7) * FOG_MASK_SCALE,
      0,
      Math.PI * 2,
    );
    exploredCtx.fill();
  }
  exploredCtx.restore();
}

function saveGameState() {
  if (!gameStarted || suppressSaving) return;
  try {
    const data = createSaveData({
      game,
      ship,
      merchants: merchantShips,
      worldEvents,
      exploredMap: exploredMask.toDataURL("image/png"),
      gameStarted,
      mapSeed,
    });
    localStorage.setItem(SAVE_KEY, serializeSave(data));
  } catch (error) {
    console.warn("Unable to save game state.", error);
  }
}

function restoreExploredMap(dataUrl) {
  if (!dataUrl) return;
  const image = new Image();
  image.addEventListener("load", () => {
    exploredCtx.clearRect(0, 0, exploredMask.width, exploredMask.height);
    exploredCtx.drawImage(image, 0, 0, exploredMask.width, exploredMask.height);
  });
  image.src = dataUrl;
}

function loadGameState() {
  let saved;
  try {
    saved = parseSave(localStorage.getItem(SAVE_KEY));
  } catch (error) {
    console.warn("Unable to load game state.", error);
    return false;
  }
  if (!saved) return false;

  Object.assign(game, saved.game);
  game.mapSeed = mapSeed;
  game.firstMeridianCrossed = Boolean(game.firstMeridianCrossed);
  normalizeVoyageTimeState();
  game.windStrength = clamp(
    Number.isFinite(game.windStrength) ? game.windStrength : 0.14,
    0.08,
    0.22,
  );
  game.discoveries = normalizeDiscoveryState(game.discoveries);
  game.discoveries.rumorLeads = normalizeRumorLeads(
    game.discoveries.rumorLeads,
  );
  game.exploration = normalizeExplorationState(game.exploration);
  game.regionalCrises = normalizeCrisisState(game.regionalCrises);
  game.operations = normalizeOperationsState(game.operations);
  game.operations.crew = normalizeCrewState(game.operations.crew);
  game.specialists = normalizeSpecialistState(game.specialists);
  game.rivals = normalizeRivalState(game.rivals);
  game.maritimeHazards = normalizeMaritimeHazardState(game.maritimeHazards);
  game.legacy = normalizeLegacyState(game.legacy);
  game.legacyProgress ||= { piratesRepelled: 0 };
  game.legacyProgress.piratesRepelled = Math.max(
    0,
    Math.floor(Number(game.legacyProgress.piratesRepelled) || 0),
  );
  game.navigation = normalizeNavigationState(
    game.navigation,
    ports.map((port) => port.name),
  );
  game.legal = normalizeLegalState(game.legal);
  game.warehouses = normalizeWarehouseState(game.warehouses);
  game.regionalEconomy = normalizeRegionalState(
    game.regionalEconomy,
    regionalPortSpecifications(),
    productionChains,
  );
  for (const key of Object.keys(goods)) {
    game.cargo[key] ??= 0;
    game.cargoCost[key] = Array.isArray(game.cargoCost[key])
      ? game.cargoCost[key]
      : [];
  }
  normalizeCargoLots(game, goods, "Legacy manifest", cargoCapacities());
  for (const [portName, warehouse] of Object.entries(game.warehouses))
    warehouse.lots = warehouse.lots
      .filter((lot) => goods[lot?.key])
      .map((lot, index) =>
        normalizeCargoLot(
          lot,
          lot.key,
          goods[lot.key],
          portName,
          game.day,
          index,
        ),
      );
  game.productionReports ||= {};
  const freshEconomy = createEconomyState(ports, goods);
  for (const port of ports) {
    game.economy[port.name] ||= {};
    for (const key of Object.keys(goods))
      game.economy[port.name][key] ||= freshEconomy[port.name][key];
  }
  const savedMapSeed = saved.mapSeed ?? saved.game.mapSeed;
  const savedShip = { ...saved.ship };
  if (!savedMapSeed) {
    const mapped = mapTransform.point(savedShip.x, savedShip.y);
    savedShip.x = mapped.x;
    savedShip.y = mapped.y;
    savedShip.trail = [];
  }
  Object.assign(ship, savedShip);
  ship.trail = Array.isArray(savedShip.trail) ? savedShip.trail : [];
  const restoredPosition = recoverNavigablePosition({
    position: ship,
    fallback: { x: HOME_PORT.spawnX, y: HOME_PORT.spawnY },
    isBlocked: onLand,
    wrapX,
  });
  const recoveredFromLand =
    restoredPosition.x !== ship.x || restoredPosition.y !== ship.y;
  ship.x = restoredPosition.x;
  ship.y = restoredPosition.y;
  if (recoveredFromLand) {
    ship.speed = 0;
    ship.anchored = true;
    ship.trail.length = 0;
  }
  applyShipUpgrades();
  merchantShips.length = 0;
  merchantShips.push(
    ...saved.merchants.map((merchant) => {
      const merchantIndex = Math.max(
        0,
        (Number(merchant.id?.slice(1)) || 1) - 1,
      );
      const rival =
        rivalForMerchant(merchant) ||
        RIVAL_CAPTAINS[merchantIndex % RIVAL_CAPTAINS.length];
      const restored = {
        ...merchant,
        rivalId: rival?.id,
        vesselClass:
          merchant.vesselClass ||
          merchantVesselClasses[merchantIndex % merchantVesselClasses.length],
      };
      if (savedMapSeed) return restored;
      const mapped = mapTransform.point(merchant.x, merchant.y);
      return { ...restored, x: mapped.x, y: mapped.y };
    }),
  );
  Object.assign(worldEvents, saved.worldEvents);
  gameStarted = saved.gameStarted;
  if (savedMapSeed) restoreExploredMap(saved.exploredMap);
  visibility.lastRadius = -1;
  camera.x = ship.x;
  camera.y = ship.y;
  return true;
}

function punchCurrentVisibility(
  c,
  worldToTargetX,
  worldToTargetY,
  canonical = false,
) {
  if (!visibility.polygon.length) return;
  const base = canonical ? Math.floor(ship.x / WORLD.w) * WORLD.w : 0;
  const offsets = canonical ? [-base - WORLD.w, -base, -base + WORLD.w] : [0];
  for (const offsetX of offsets) {
    c.save();
    polygonPath(c, visibility.polygon, worldToTargetX, worldToTargetY, offsetX);
    c.clip();
    const sx = (ship.x + offsetX) * worldToTargetX,
      sy = ship.y * worldToTargetY;
    const radius = visibility.radius * Math.min(worldToTargetX, worldToTargetY);
    const g = c.createRadialGradient(sx, sy, radius * 0.5, sx, sy, radius);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(0.68, "rgba(0,0,0,.98)");
    g.addColorStop(0.88, "rgba(0,0,0,.72)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.fillRect(sx - radius, sy - radius, radius * 2, radius * 2);
    c.restore();
  }
}

function isWorldCircleInViewport(x, y, radius, z = camera.zoom) {
  return wrappedCircleIntersectsViewport(
    x,
    y,
    radius,
    camera.x,
    camera.y,
    vw,
    vh,
    z,
    WORLD.w,
  );
}

function drawAnimatedRoughSeas(c, time, z) {
  c.save();
  c.lineCap = "round";
  for (let seaIndex = 0; seaIndex < roughSeas.length; seaIndex++) {
    const sea = roughSeas[seaIndex];
    if (!isWorldCircleInViewport(sea.x, sea.y, Math.max(sea.rx, sea.ry), z))
      continue;
    const nearestX = nearestWrappedX(sea.x, camera.x);

    for (const particle of roughSeaParticles[seaIndex]) {
      const phase = time * particle.speed + particle.phaseOffset;
      const x = nearestX + particle.baseX + Math.cos(phase) * particle.swell;
      const y =
        sea.y + particle.baseY + Math.sin(phase * 1.35) * particle.swell * 0.45;
      const crest = (Math.sin(phase) + 1) * 0.5;
      c.save();
      c.translate(x, y);
      c.rotate(particle.rotation);
      c.scale(particle.scale, particle.scale);
      c.strokeStyle = `rgba(249,232,184,${0.1 + crest * 0.2})`;
      c.lineWidth = (1.2 + crest) / z;
      c.beginPath();
      c.moveTo(-15, 3);
      c.quadraticCurveTo(-8, -7 - crest * 3, -1, 1);
      c.quadraticCurveTo(6, 9, 14, -2 - crest * 2);
      c.stroke();
      c.strokeStyle = `rgba(57,61,47,${0.12 + crest * 0.11})`;
      c.lineWidth = 1 / z;
      c.beginPath();
      c.moveTo(-10, 8);
      c.quadraticCurveTo(-3, 4, 4, 8);
      c.quadraticCurveTo(10, 12, 16, 7);
      c.stroke();
      c.restore();
    }
  }
  c.restore();
}

const mapButton = document.getElementById("mapButton");
const minimapWrap = document.getElementById("minimapWrap");
const minimap = document.getElementById("minimap");
const minimapCtx = minimap.getContext("2d");
const chartedCities = document.getElementById("chartedCities");
minimapCtx.drawImage(mapLayer, 0, 0, minimap.width, minimap.height);

function resize() {
  vw = innerWidth;
  vh = innerHeight;
  canvas.width = Math.floor(vw * DPR);
  canvas.height = Math.floor(vh * DPR);
  canvas.style.width = vw + "px";
  canvas.style.height = vh + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  fogCanvas.width = Math.floor(vw * DPR);
  fogCanvas.height = Math.floor(vh * DPR);
  fogCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
  viewportZoom = Math.max(0.72, Math.min(1.05, Math.min(vw / 720, vh / 650)));
  camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, viewportZoom * userZoom));
  fogWashGradient = fogCtx.createLinearGradient(0, 0, vw, vh);
  fogWashGradient.addColorStop(0, "rgba(25,22,18,.94)");
  fogWashGradient.addColorStop(0.55, "rgba(18,19,18,.92)");
  fogWashGradient.addColorStop(1, "rgba(31,24,17,.95)");
  vignetteGradient = ctx.createRadialGradient(
    vw / 2,
    vh / 2,
    Math.min(vw, vh) * 0.25,
    vw / 2,
    vh / 2,
    Math.max(vw, vh) * 0.72,
  );
  vignetteGradient.addColorStop(0, "rgba(0,0,0,0)");
  vignetteGradient.addColorStop(1, "rgba(32,20,10,.32)");
}
addEventListener("resize", resize);
resize();

const ui = {
  speed: document.getElementById("speedText"),
  wind: document.getElementById("windText"),
  visibility: document.getElementById("visibilityText"),
  coins: document.getElementById("coinText"),
  day: document.getElementById("dayText"),
  hold: document.getElementById("holdText"),
  dock: document.getElementById("dockButton"),
  town: document.getElementById("townButton"),
  explore: document.getElementById("exploreButton"),
  message: document.getElementById("message"),
  steeringStatus: document.getElementById("steeringStatus"),
  objective: document.getElementById("objectiveText"),
  course: document.getElementById("courseCard"),
  courseTitle: document.getElementById("courseTitle"),
  courseDetail: document.getElementById("courseDetail"),
  courseAction: document.getElementById("courseAction"),
  plottedCourse: document.getElementById("plottedCourse"),
  plottedCourseTitle: document.getElementById("plottedCourseTitle"),
  plottedCourseDetail: document.getElementById("plottedCourseDetail"),
  plottedCourseOpen: document.getElementById("plottedCourseOpen"),
  plottedCourseClear: document.getElementById("plottedCourseClear"),
};
const intro = document.getElementById("intro");
const beginButton = document.getElementById("beginButton");
const newMapButton = document.getElementById("newMapButton");
document.getElementById("introWorldSeed").textContent = mapSeed;
let restoredVoyageAwaitingStart = false;

function revealStartedGame({
  message = null,
  openChart = true,
  save = false,
} = {}) {
  intro.style.display = "none";
  ui.dock.style.display = nearPort ? "block" : "none";
  ui.town.style.display = nearPort ? "block" : "none";
  revealCurrentView(true);
  if (message) showMessage(message, 4.5);
  if (save) saveGameState();
  if (openChart) {
    window.setTimeout(() => {
      minimapWrap.style.display = "grid";
      renderChart();
    }, 0);
  }
}

function beginGame() {
  if (restoredVoyageAwaitingStart) {
    restoredVoyageAwaitingStart = false;
    revealStartedGame({
      message: "Voyage restored from this browser.",
      openChart: false,
    });
    return;
  }

  nearPort = beginAtHomePort({
    camera,
    homePort: HOME_PORT,
    ports,
    ship,
  });
  gameStarted = true;
  addNews(
    "The first commission",
    "The Guild of Gilded Oars has posted three introductory commissions at Goldhaven. Fulfill them to build influence.",
  );
  addNews(
    "Sails on the horizon",
    "Independent merchants now carry real cargo between the archipelago’s ports. Their arrivals will change local stock and prices.",
  );
  revealStartedGame({
    message:
      "Welcome home. Dock at Goldhaven for contracts and intelligence, or watch the sea for merchant traffic.",
    save: true,
  });
}

function prepareRestoredVoyageStartup() {
  restoredVoyageAwaitingStart = true;
  document.documentElement.classList.add("has-saved-voyage");
  nearPort =
    ports.find(
      (port) => wrappedDistance(ship.x, ship.y, port.x, port.y) < 95,
    ) || null;
  ui.dock.style.display = nearPort ? "block" : "none";
  ui.town.style.display = nearPort ? "block" : "none";
  revealCurrentView(true);
}

bindBeginButton(beginButton, beginGame);
newMapButton.addEventListener("click", () => {
  suppressSaving = true;
  gameStarted = false;
  localStorage.removeItem(SAVE_KEY);
  localStorage.setItem(MAP_SEED_KEY, createDistinctMapSeed(mapSeed));
  location.reload();
});

function cargoCount() {
  return countCargo(game, contractCargoCount());
}
function updateHud() {
  const stats = operationalShipStats();
  ui.speed.textContent =
    shipSpeedKnots(ship.speed, stats.waterlineLengthFt).toFixed(1) + " knots";
  const dirs = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
  const idx =
    Math.round(
      ((((game.windAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) /
        (Math.PI * 2)) *
        8,
    ) % 8;
  const currentInfo = localCurrent();
  ui.wind.textContent =
    "Wind " +
    dirs[idx] +
    " · " +
    Math.round(game.windStrength * 100) +
    " knots" +
    (currentInfo.label ? " · " + currentInfo.label : "");
  const km = currentVisibilityKm();
  ui.visibility.textContent =
    game.weatherName +
    " · " +
    (km < 10 ? km.toFixed(1) : Math.round(km)) +
    " km sight · longitude " +
    Math.round((wrapX(ship.x) / WORLD.w) * 360) +
    "°";
  ui.coins.textContent = game.coins + " crowns";
  ui.day.textContent = "Day " + game.day;
  ui.hold.textContent = cargoCount() + "/" + game.holdMax;
  ui.objective.textContent = game.milestone.complete
    ? "Merchant Prince · " + game.activeWorldEvents.length + " active crises"
    : game.completedContracts +
      "/3 contracts · shortage " +
      (game.milestone.shortageExploited
        ? "exploited"
        : worldEvents.ironShortage.active
          ? "active"
          : "pending") +
      " · Guild " +
      guildStanding() +
      "/20";
  const objective = currentObjective({
    game,
    currentPortName: currentPort?.name || null,
    nearPortName: nearPort?.name || null,
    homePortName: HOME_PORT.name,
  });
  ui.course.className = objective.urgency;
  ui.courseTitle.textContent = objective.title;
  ui.courseDetail.textContent = objective.detail;
  ui.courseAction.textContent =
    objective.action === "dock"
      ? "Dock now →"
      : objective.action === "trade"
        ? "Open contract board →"
        : objective.action === "vessel"
          ? "Prepare vessel →"
          : objective.action === "politics"
            ? "Open politics →"
            : objective.action === "ledger"
              ? "Open ledger →"
              : "Open chart →";
  let destination = getPortByName(game.navigation.destination);
  if (destination && nearPort?.name === destination.name) {
    clearCourse(game.navigation);
    showMessage(`Course complete · ${destination.name} reached.`);
    saveGameState();
    destination = null;
  }
  ui.plottedCourse.hidden = !destination;
  if (destination) {
    const bearing = courseBearing(ship, destination, WORLD.w);
    const direction = compassDirection(bearing.angle);
    ui.plottedCourseTitle.textContent = `${direction} · ${destination.name}`;
    ui.plottedCourseDetail.textContent =
      `${Math.round(bearing.distance)} leagues remaining · ` +
      `bearing ${Math.round(((bearing.angle * 180) / Math.PI + 360) % 360)}°`;
  }
  if (ship.anchored)
    ui.steeringStatus.textContent = "AT ANCHOR · DRAG THE WHEEL TO SAIL";
  else if (Math.abs(ship.speed) < 5)
    ui.steeringStatus.textContent = "DRAG TOWARD YOUR DESTINATION";
  else ui.steeringStatus.textContent = "SAILING · RELEASE TO COAST";
}

function followCurrentObjective() {
  const objective = currentObjective({
    game,
    currentPortName: currentPort?.name || null,
    nearPortName: nearPort?.name || null,
    homePortName: HOME_PORT.name,
  });
  if (objective.action === "dock") {
    openPort();
    return;
  }
  if (
    ["trade", "vessel", "politics"].includes(objective.action) &&
    currentPort
  ) {
    activateSectionTabs(document.getElementById("portPanel"), objective.action);
    document.getElementById("portPanel").style.display = "grid";
    return;
  }
  if (objective.action === "ledger") {
    renderLedger();
    activateSectionTabs(document.getElementById("ledgerPanel"), "milestone");
    document.getElementById("ledgerPanel").style.display = "grid";
    return;
  }
  minimapWrap.style.display = "grid";
  renderChart();
}

ui.course.addEventListener("click", followCurrentObjective);
ui.plottedCourseOpen.addEventListener("click", () => {
  minimapWrap.style.display = "grid";
  renderChart();
});
ui.plottedCourseClear.addEventListener("click", () => {
  const destination = game.navigation.destination;
  clearCourse(game.navigation);
  updateHud();
  saveGameState();
  showMessage(`Course for ${destination} cleared.`);
});

function showMessage(text, seconds = 2.2) {
  ui.message.textContent = text;
  ui.message.classList.add("show");
  messageTimer = seconds;
}

function formatPopulation(value) {
  return new Intl.NumberFormat("en").format(value);
}
function isWorldPointExplored(x, y) {
  const wx = wrapX(x);
  if (wrappedDistance(wx, y, ship.x, ship.y) <= visibility.radius + 18)
    return true;
  const px = Math.max(
    0,
    Math.min(exploredMask.width - 1, Math.floor(wx * FOG_MASK_SCALE)),
  );
  const py = Math.max(
    0,
    Math.min(exploredMask.height - 1, Math.floor(y * FOG_MASK_SCALE)),
  );
  return exploredCtx.getImageData(px, py, 1, 1).data[3] > 14;
}
function nearestKnownPort(x, y, radius) {
  let hit = null,
    best = radius;
  for (const port of ports) {
    const d = Math.hypot(x - nearestWrappedX(port.x, x), y - port.y);
    if (d < best && isWorldPointExplored(port.x, port.y)) {
      best = d;
      hit = port;
    }
  }
  return hit;
}
// Only discoveries the captain has already recorded appear on the chart, so the
// hit test restricts itself to found sites — undiscovered ones stay hidden.
function discoveryAtPoint(x, y, radius) {
  let hit = null,
    best = radius;
  for (const site of discoverySites) {
    if (!game.discoveries.found[site.id]) continue;
    const d = Math.hypot(x - nearestWrappedX(site.x, x), y - site.y);
    if (d < best) {
      best = d;
      hit = site;
    }
  }
  return hit;
}
function fillChips(elementId, items) {
  const root = document.getElementById(elementId);
  root.innerHTML = "";
  items.forEach((item) => {
    const chip = document.createElement("span");
    chip.className = "resource-chip";
    chip.textContent = item;
    root.append(chip);
  });
}
function marketAssessment(port, key) {
  const buy = buyPriceFor(port, key),
    sell = sellPriceFor(port, key),
    mid = (buy + sell) / 2,
    ratio = mid / goods[key].base;
  const label = ratio < 0.84 ? "Bargain" : ratio > 1.22 ? "Expensive" : "Fair";
  return { buy, sell, label };
}
function openTownDetails(port, _fromChart = false) {
  if (!port) return;
  selectedTown = port;
  document.getElementById("townRealm").textContent =
    port.realm + " · " + port.land;
  document.getElementById("townName").textContent =
    port.name + (port.home ? " · Home Port" : "");
  document.getElementById("townFlavor").textContent = port.flavor;
  document.getElementById("townPopulation").textContent = formatPopulation(
    port.population,
  );
  document.getElementById("townGovernment").textContent = port.government;
  document.getElementById("townProsperity").textContent = port.prosperity;
  document.getElementById("townSecurity").textContent = port.security;
  document.getElementById("townDominantFaction").textContent =
    dominantFaction(port).name + " (" + dominantFaction(port).influence + "%)";
  const factions = document.getElementById("townFactions");
  factions.innerHTML = "";
  port.factions.forEach((faction) => {
    const row = document.createElement("div");
    row.className = "faction-row";
    const head = document.createElement("div");
    head.className = "faction-head";
    const name = document.createElement("span");
    name.textContent = faction.name;
    const share = document.createElement("span");
    share.textContent =
      faction.influence +
      "% local · your standing " +
      (game.factionStanding[faction.name] || 0);
    head.append(name, share);
    const bar = document.createElement("div");
    bar.className = "faction-bar";
    const fill = document.createElement("span");
    fill.style.width = faction.influence + "%";
    bar.append(fill);
    const note = document.createElement("div");
    note.className = "faction-note";
    note.textContent = faction.note;
    const lore = factionLore(faction, port);
    const details = document.createElement("details");
    details.className = "faction-lore";
    const summary = document.createElement("summary");
    summary.textContent = "Backstory, history & motivations";
    for (const [heading, text] of [
      ["Backstory", lore.backstory],
      ["History", lore.history],
      ["Motivations", lore.motivations],
    ]) {
      const section = document.createElement("p");
      const label = document.createElement("b");
      label.textContent = `${heading}: `;
      section.append(label, document.createTextNode(text));
      details.append(section);
    }
    details.prepend(summary);
    row.append(head, bar, note, details);
    factions.append(row);
  });
  fillChips("townResources", port.resources);
  const commerce = document.getElementById("townCommerce");
  commerce.innerHTML = "";
  const exportsLine = document.createElement("p");
  exportsLine.innerHTML = "<b>Exports:</b> ";
  exportsLine.append(document.createTextNode(port.exports.join(", ") + "."));
  const importsLine = document.createElement("p");
  importsLine.innerHTML = "<b>Imports:</b> ";
  importsLine.append(document.createTextNode(port.imports.join(", ") + "."));
  commerce.append(exportsLine, importsLine);
  const routes = document.getElementById("townRoutes");
  routes.innerHTML = "";
  port.routes.forEach((route) => {
    const row = document.createElement("div");
    row.className = "route-row";
    const title = document.createElement("div");
    title.className = "route-title";
    const name = document.createElement("span");
    name.textContent = route.name + " → " + route.to;
    const risk = document.createElement("span");
    risk.className = "route-risk";
    risk.textContent = routeRisk(route);
    title.append(name, risk);
    const meta = document.createElement("div");
    meta.className = "route-meta";
    meta.textContent = route.days + " · Main cargo: " + route.cargo + ".";
    row.append(title, meta);
    routes.append(row);
  });
  const intel = document.getElementById("townMarketIntel");
  intel.innerHTML = "";
  Object.keys(goods).forEach((key) => {
    const assessment = marketAssessment(port, key);
    const cell = document.createElement("div");
    cell.className = "market-good";
    const good = document.createElement("b");
    good.textContent = goods[key].name;
    const price = document.createElement("span");
    price.textContent =
      "Buy " +
      assessment.buy +
      " · Sell " +
      assessment.sell +
      " · " +
      assessment.label +
      " · " +
      economyCondition(port, key);
    cell.append(good, price);
    intel.append(cell);
  });
  document.getElementById("townPlayerStanding").innerHTML =
    '<p class="small"><b>Your strongest local connection:</b> ' +
    port.factions
      .map((f) => ({ name: f.name, value: game.factionStanding[f.name] || 0 }))
      .sort((a, b) => b.value - a.value)[0].name +
    " (" +
    port.factions
      .map((f) => ({ name: f.name, value: game.factionStanding[f.name] || 0 }))
      .sort((a, b) => b.value - a.value)[0].value +
    ")</p>";
  document.getElementById("townLaw").textContent = currentLawText(port);
  const activeRoot = document.getElementById("townActiveEvents");
  activeRoot.innerHTML = "";
  const visibleEvents = activeEventsAt(port.name);
  const knownFuture = game.scheduledEvents.filter(
    (e) =>
      e.known && !e.started && eventTemplates[e.templateId].port === port.name,
  );
  visibleEvents.forEach((e) => {
    const t = eventTemplates[e.templateId],
      box = document.createElement("div");
    box.className = "event-banner event-live";
    box.innerHTML =
      "<b>" +
      t.title +
      " · Day " +
      e.startDay +
      "–" +
      e.endDay +
      "</b>" +
      t.description;
    activeRoot.append(box);
  });
  knownFuture.forEach((e) => {
    const t = eventTemplates[e.templateId],
      box = document.createElement("div");
    box.className = "intel-card event-forecast";
    box.innerHTML =
      "<b>CONFIDENTIAL FORECAST · Day " +
      e.startDay +
      '</b><p class="small">' +
      t.forecast +
      "</p>";
    activeRoot.append(box);
  });
  if (!visibleEvents.length && !knownFuture.length)
    activeRoot.innerHTML =
      '<p class="empty-note">No active crisis or verified forecast is recorded here.</p>';
  const dockButton = document.getElementById("townDockButton");
  dockButton.style.display = nearPort === port ? "block" : "none";
  const courseButton = document.getElementById("townCourseButton");
  const isCurrentCourse = game.navigation.destination === port.name;
  courseButton.textContent = isCurrentCourse
    ? "Clear Plotted Course"
    : `Set Course for ${port.name}`;
  courseButton.dataset.action = isCurrentCourse ? "clear" : "plot";
  // No point plotting a course to the port you're already docked at.
  courseButton.style.display = nearPort === port ? "none" : "block";
  // Each town dossier opens on the Politics tab (factions and current law),
  // with Commerce and Market one tap away.
  activateSectionTabs(document.getElementById("townPanel"), "politics");
  document.getElementById("townPanel").style.display = "grid";
}
function closeTownDetails() {
  document.getElementById("townPanel").style.display = "none";
  selectedTown = null;
}
function screenToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left - rect.width / 2) / camera.zoom + camera.x,
    y: (clientY - rect.top - rect.height / 2) / camera.zoom + camera.y,
  };
}

function renderFog() {
  if (!gameStarted) return;
  buildVisibilityPolygon();
  const f = fogCtx;
  f.setTransform(DPR, 0, 0, DPR, 0, 0);
  f.clearRect(0, 0, vw, vh);

  // Uncharted water is an opaque ink wash. Previously seen water remains as a
  // dim chart memory, while the current line of sight is cut out of the wash.
  f.fillStyle = fogWashGradient;
  f.fillRect(0, 0, vw, vh);

  // Slow translucent wisps make reduced visibility feel like ocean haze rather
  // than a hard game mask. They remain subtle enough not to obscure controls.
  const time = performance.now() * 0.000018;
  f.save();
  for (let i = 0; i < 11; i++) {
    const x = ((i * 211 + time * 7600) % (vw + 420)) - 210;
    const y = ((i * 127 + Math.sin(time * 42 + i) * 48) % (vh + 220)) - 110;
    const rx = 150 + (i % 4) * 38,
      squash = 0.24 + (i % 3) * 0.055;
    f.save();
    f.translate(x, y);
    f.rotate(((i % 5) - 2) * 0.08);
    f.scale(1, squash);
    const mist = f.createRadialGradient(0, 0, 0, 0, 0, rx);
    mist.addColorStop(0, "rgba(239,233,214,.065)");
    mist.addColorStop(0.52, "rgba(239,233,214,.025)");
    mist.addColorStop(1, "rgba(239,233,214,0)");
    f.fillStyle = mist;
    f.beginPath();
    f.arc(0, 0, rx, 0, Math.PI * 2);
    f.fill();
    f.restore();
  }
  f.restore();

  f.globalCompositeOperation = "destination-out";
  f.save();
  const z = camera.zoom;
  f.translate(vw / 2, vh / 2);
  f.scale(z, z);
  f.translate(-camera.x, -camera.y);
  f.globalAlpha = 0.48;
  for (const offset of worldCopiesNear(camera.x))
    f.drawImage(exploredMask, offset, 0, WORLD.w, WORLD.h);
  f.globalAlpha = 1;
  punchCurrentVisibility(f, 1, 1);
  f.restore();
  f.globalCompositeOperation = "source-over";

  // A pale, blurred boundary suggests the wall of mist at the visual horizon.
  f.save();
  f.translate(vw / 2, vh / 2);
  f.scale(camera.zoom, camera.zoom);
  f.translate(-camera.x, -camera.y);
  polygonPath(f, visibility.polygon);
  f.strokeStyle = "rgba(235,229,208,.13)";
  f.lineWidth = 13 / camera.zoom;
  f.shadowColor = "rgba(235,229,208,.28)";
  f.shadowBlur = 18 / camera.zoom;
  f.stroke();
  f.restore();

  ctx.drawImage(fogCanvas, 0, 0, vw, vh);
}

function drawDynamicTradeWorld(c, z, time) {
  c.save();
  const courseDestination = getPortByName(game.navigation.destination);
  if (courseDestination) {
    const bearing = courseBearing(ship, courseDestination, WORLD.w);
    c.strokeStyle = "rgba(102, 200, 181, .9)";
    c.lineWidth = 3 / z;
    c.setLineDash([12 / z, 8 / z]);
    c.beginPath();
    c.moveTo(ship.x, ship.y);
    c.lineTo(bearing.destinationX, courseDestination.y);
    c.stroke();
    c.setLineDash([]);
  }
  for (const site of explorationSites) {
    if (!isWorldCircleInViewport(site.x, site.y, site.radius * 3.2, z))
      continue;
    const progress = game.exploration.sites[site.id];
    const visible = pointCurrentlyVisible(site.x, site.y);
    if (!progress && !visible && !isWorldPointExplored(site.x, site.y))
      continue;
    const x = nearestWrappedX(site.x, camera.x);
    const pulse = visible && site === nearExplorationSite ? 1.15 : 1;
    c.save();
    c.translate(x, site.y);
    c.strokeStyle =
      progress?.status === "surveyed"
        ? "rgba(123, 205, 160, .95)"
        : "rgba(244, 218, 157, .86)";
    c.fillStyle = progress ? "rgba(52, 72, 46, .84)" : "rgba(62, 45, 25, .78)";
    c.lineWidth = 2 / z;
    c.setLineDash(progress?.status === "surveyed" ? [] : [5 / z, 4 / z]);
    c.beginPath();
    c.arc(0, 0, (16 * pulse) / z, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = "#fff0c0";
    c.font = 15 / z + "px Georgia";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("✦", 0, -1 / z);
    if ((visible || progress) && progress?.status !== "surveyed") {
      c.fillStyle = "rgba(47,29,15,.82)";
      c.font = `${progress ? "700 " : ""}${12 / z}px Georgia`;
      c.fillText("shore survey", 0, -25 / z);
    }
    c.restore();
  }
  if (nearDiscovery) {
    const x = nearestWrappedX(nearDiscovery.x, camera.x);
    c.save();
    c.translate(x, nearDiscovery.y);
    c.fillStyle = "rgba(46, 64, 60, .82)";
    c.strokeStyle = "rgba(244, 218, 157, .95)";
    c.lineWidth = 2 / z;
    c.setLineDash([5 / z, 4 / z]);
    c.beginPath();
    c.arc(0, 0, (16 * 1.15) / z, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = "#fff0c0";
    c.font = 14 / z + "px Georgia";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(nearDiscovery.icon, 0, 0);
    c.restore();
  }
  for (const site of discoverySites) {
    const record = game.discoveries.found[site.id];
    if (!record) continue;
    if (!isWorldCircleInViewport(site.x, site.y, 24, z)) continue;
    const x = nearestWrappedX(site.x, camera.x);
    c.save();
    c.translate(x, site.y);
    c.fillStyle =
      record.disposition === "secret"
        ? "rgba(65,45,25,.92)"
        : "rgba(159,91,38,.95)";
    c.strokeStyle = "rgba(244,218,157,.9)";
    c.lineWidth = 2 / z;
    c.beginPath();
    c.arc(0, 0, 14 / z, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = "#fff0c0";
    c.font = 13 / z + "px Georgia";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(site.icon, 0, 0);
    c.restore();
  }
  if (game.laws.amberConvoy) {
    const off = Math.round((camera.x - 650) / WORLD.w) * WORLD.w;
    c.save();
    c.translate(off, 0);
    c.strokeStyle = "rgba(190,132,45,.92)";
    c.lineWidth = 5 / z;
    c.setLineDash([18 / z, 10 / z]);
    c.lineDashOffset = -(time * 0.025) % (28 / z);
    c.beginPath();
    c.moveTo(650, 485);
    c.bezierCurveTo(850, 570, 1070, 780, 1190, 1050);
    c.lineTo(1450, 1185);
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = "rgba(61,38,18,.9)";
    c.font = "700 16px Georgia";
    c.textAlign = "center";
    c.fillText("ROYAL AMBER CONVOY", 1110, 940);
    c.restore();
  }
  for (const contract of game.activeContracts) {
    const p = getPortByName(contract.destination);
    if (!p) continue;
    const x = nearestWrappedX(p.x, camera.x);
    if (!isWorldCircleInViewport(p.x, p.y, 34, z)) continue;
    const pulse = 25 + Math.sin(time / 220) * 5;
    c.strokeStyle = "rgba(215,159,55,.95)";
    c.lineWidth = 4 / z;
    c.beginPath();
    c.arc(x, p.y, pulse, 0, Math.PI * 2);
    c.stroke();
  }
  for (const event of game.scheduledEvents) {
    if (!event.known || event.started) continue;
    const t = eventTemplates[event.templateId],
      p = getPortByName(t.port);
    if (!isWorldCircleInViewport(p.x, p.y, 37, z)) continue;
    const x = nearestWrappedX(p.x, camera.x);
    c.strokeStyle = "rgba(139,78,45,.9)";
    c.lineWidth = 3 / z;
    c.setLineDash([7 / z, 7 / z]);
    c.beginPath();
    c.arc(x, p.y, 34 + Math.sin(time / 300) * 3, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
  }
  for (const merchant of merchantShips) {
    if (!merchantVisible(merchant)) continue;
    const x = nearestWrappedX(merchant.x, camera.x);
    if (!isWorldCircleInViewport(merchant.x, merchant.y, 60, z)) continue;
    drawMerchantShip(c, merchant, z, x);
    if (pointCurrentlyVisible(merchant.x, merchant.y)) {
      recordMerchantSighting(merchant);
      c.fillStyle = "rgba(47,29,15,.8)";
      c.font = 11 / z + "px Georgia";
      c.textAlign = "center";
      c.fillText(merchant.name, x, merchant.y - 19 / z);
    }
  }
  c.restore();
}
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, vw, vh);
  const z = camera.zoom;
  const time = performance.now();
  ctx.save();
  ctx.translate(vw / 2, vh / 2);
  ctx.scale(z, z);
  ctx.translate(-camera.x, -camera.y);
  for (const offset of worldCopiesNear(camera.x))
    ctx.drawImage(mapLayer, offset, 0);
  drawAnimatedRoughSeas(ctx, time, z);
  drawDynamicTradeWorld(ctx, z, time);
  // wake
  if (ship.trail.length > 1) {
    ctx.strokeStyle = "rgba(245,236,201,.55)";
    ctx.lineWidth = 2 / z;
    ctx.beginPath();
    ship.trail.forEach((p, i) =>
      i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
    );
    ctx.stroke();
  }
  // wind streaks
  ctx.strokeStyle = "rgba(244,231,190,.28)";
  ctx.lineWidth = 1.5 / z;
  const windLeft = camera.x - vw / (2 * z) - 60,
    windSpan = vw / z + 120;
  for (let i = 0; i < 14; i++) {
    const x = windLeft + ((i * 173 + time * 0.025) % windSpan),
      y = (i * 197 + Math.floor(camera.y)) % WORLD.h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(
      x + Math.cos(game.windAngle) * 30,
      y + Math.sin(game.windAngle) * 30,
    );
    ctx.stroke();
  }
  ctx.restore();
  renderFog();

  // The ship and immediate docking cue remain readable above the fog layer.
  ctx.save();
  ctx.translate(vw / 2, vh / 2);
  ctx.scale(z, z);
  ctx.translate(-camera.x, -camera.y);
  drawShip(
    ctx,
    ship.x,
    ship.y,
    ship.angle,
    game.windAngle,
    game.windStrength,
    game.shipUpgrades.activeClass,
    z,
  );
  if (nearPort) {
    const px = nearestWrappedX(nearPort.x, ship.x);
    ctx.strokeStyle = "rgba(173,54,39,.85)";
    ctx.lineWidth = 3 / z;
    ctx.beginPath();
    ctx.arc(px, nearPort.y, 42 + Math.sin(time / 220) * 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  if (edgeRecoveryActive) {
    ctx.save();
    ctx.strokeStyle = "rgba(225,176,86,.55)";
    ctx.lineWidth = 7;
    ctx.shadowColor = "rgba(225,176,86,.5)";
    ctx.shadowBlur = 14;
    ctx.strokeRect(5, 5, vw - 10, vh - 10);
    ctx.restore();
  }
  // Atmospheric weather — clouds, fog, rain, and storms are drawn over the
  // ship so they read as something the vessel is sailing through.
  {
    const weather = currentWeather();
    drawWeatherEffects(ctx, {
      name: weather.name,
      roughness: weather.roughness,
      visibilityKm: weather.visibilityKm,
      windAngle: game.windAngle,
      windStrength: game.windStrength,
      vw,
      vh,
      time,
    });
  }

  // vignette
  ctx.fillStyle = vignetteGradient;
  ctx.fillRect(0, 0, vw, vh);
}

const input = { x: 0, y: 0, power: 0 };

function readInput() {
  const result = readSailingInput(keys, input, ship.angle);
  return result;
}
const MAP_MARGIN = 58;
const EDGE_RECOVERY_ZONE = 155;
function update(dt) {
  if (
    !gameStarted ||
    currentPort ||
    selectedTown ||
    selectedMerchant ||
    pendingMaritimeHazard
  )
    return;
  updateMerchantShips(dt);
  edgeMessageCooldown = Math.max(0, edgeMessageCooldown - dt);
  const inp = readInput();
  const edge = edgeInwardVector(ship.y, WORLD.h, EDGE_RECOVERY_ZONE);
  edgeRecoveryActive = edge.strength > 0.56;
  if (ship.anchored) {
    ship.speed = 0;
    if (inp.active) {
      const departurePort = departurePortAtAnchor();
      if (game.departedFromPort === null && departurePort) {
        game.departedFromPort = departurePort.name;
        resetVoyageTimeState();
      }
      ship.anchored = false;
      showMessage(
        "Casting off — keep dragging toward where you want to sail.",
        2.8,
      );
    }
  }
  if (inp.active) {
    const diff = normalizeAngle(inp.desiredAngle - ship.angle);
    const edgeTurnBoost = edge.strength > 0.35 ? 1 + edge.strength * 2.8 : 1;
    const maxTurn =
      ship.turnRate *
      edgeTurnBoost *
      dt *
      (1.2 - Math.min(0.45, (ship.speed / ship.maxSpeed) * 0.45));
    ship.angle += Math.max(-maxTurn, Math.min(maxTurn, diff));
    const alignment = Math.max(0, Math.cos(diff));
    const thrustFactor =
      alignment < 0.15 ? 0 : 0.12 + 0.88 * alignment * alignment;
    ship.speed += ship.accel * inp.power * thrustFactor * dt;
  } else if (edge.strength > 0.72 && !ship.anchored) {
    const inwardAngle = Math.atan2(edge.y, edge.x);
    const diff = normalizeAngle(inwardAngle - ship.angle);
    const maxTurn = ship.turnRate * 2.2 * dt;
    ship.angle += Math.max(-maxTurn, Math.min(maxTurn, diff));
  }
  ship.speed *= Math.pow(inp.active ? 0.992 : 0.978, dt * 60);
  ship.speed = Math.max(0, Math.min(ship.maxSpeed, ship.speed));
  const windPush = ship.anchored
    ? 0
    : game.windStrength * 18 * calculateShipStats(game.shipUpgrades).windDrift;
  const safeWind = limitOutwardWind(
    Math.cos(game.windAngle) * windPush,
    Math.sin(game.windAngle) * windPush,
    ship.y,
    WORLD.h,
    MAP_MARGIN,
    EDGE_RECOVERY_ZONE,
  );
  const recoveryPush =
    !inp.active && edge.strength > 0.55 ? 30 * edge.strength : 0;
  const current = ship.anchored ? { x: 0, y: 0 } : localCurrent();
  const currentPush = 34;
  let nx =
    ship.x +
    (Math.cos(ship.angle) * ship.speed +
      safeWind.x +
      current.x * currentPush +
      edge.x * recoveryPush) *
      dt;
  let ny =
    ship.y +
    (Math.sin(ship.angle) * ship.speed +
      safeWind.y +
      current.y * currentPush +
      edge.y * recoveryPush) *
      dt;
  const hitBoundary = ny < MAP_MARGIN || ny > WORLD.h - MAP_MARGIN;
  const hitLand = !hitBoundary && onLand(nx, ny);
  if (hitBoundary) {
    const inward = edgeInwardVector(
      nx,
      clamp(ny, MAP_MARGIN, WORLD.h - MAP_MARGIN),
    );
    const requestedAngle = inp.active
      ? inp.desiredAngle
      : Math.atan2(inward.y, inward.x);
    const requestedDot =
      Math.cos(requestedAngle) * inward.x + Math.sin(requestedAngle) * inward.y;
    const recoveryAngle =
      requestedDot > 0.12 ? requestedAngle : Math.atan2(inward.y, inward.x);
    const diff = normalizeAngle(recoveryAngle - ship.angle);
    const maxTurn = ship.turnRate * 4 * dt;
    ship.angle += Math.max(-maxTurn, Math.min(maxTurn, diff));
    ship.speed = Math.min(14, ship.speed * 0.18);
    ship.x = ship.x + inward.x * 24 * dt;
    ship.y = clamp(
      ship.y + inward.y * 24 * dt,
      MAP_MARGIN,
      WORLD.h - MAP_MARGIN,
    );
    edgeRecoveryActive = true;
    if (edgeMessageCooldown <= 0) {
      showMessage(
        "The chart ends here. Point the wheel back toward open water — the crew is pushing the bow inward.",
        2.5,
      );
      edgeMessageCooldown = 2.8;
    }
  } else if (hitLand) {
    // Back the bow off the shallows. A hard stop here pins the ship against
    // the coast — wind drift keeps biasing the next proposed step back onto
    // land — so recover the way the chart-edge branch does: point the bow at
    // the nearest open water off the seaward normal and march the hull to a
    // position with clear water ahead, which wind can't immediately undo.
    const recovered = recoverFromShallows({
      x: ship.x,
      y: ship.y,
      blockedX: nx,
      blockedY: ny,
      isOpen: (px, py) => !onLand(px, py),
    });
    const diff = normalizeAngle(recovered.heading - ship.angle);
    const maxTurn = ship.turnRate * 4 * dt;
    ship.angle += Math.max(-maxTurn, Math.min(maxTurn, diff));
    ship.speed = Math.min(14, ship.speed * 0.18);
    ship.x = recovered.x;
    ship.y = clamp(recovered.y, MAP_MARGIN, WORLD.h - MAP_MARGIN);
    if (edgeMessageCooldown <= 0) {
      showMessage(
        "Shallows ahead — the crew is dragging the bow toward open water.",
        1.8,
      );
      edgeMessageCooldown = 2;
    }
  } else {
    const oldCycle = Math.floor(ship.x / WORLD.w),
      newCycle = Math.floor(nx / WORLD.w);
    const d = Math.hypot(nx - ship.x, ny - ship.y);
    game.voyageDistance += d;
    if (d > 0.1) advanceUnderwayTime(dt);
    ship.x = nx;
    ship.y = ny;

    // Wind and weather change continuously with distance and time
    game.windAngle += 0.01 * dt + 0.8 * (d / 620);
    const windPhase =
      (game.day * 620 + game.voyageDistance) / 250 + performance.now() / 15000;
    game.windStrength = 0.08 + (Math.sin(windPhase) + 1) * 0.07;

    const weather = getInterpolatedWeather();
    game.weatherName = weather.name;
    game.weatherVisibilityKm = weather.visibilityKm;

    const shoal = shoalAtPosition(ship, worldShoals, WORLD.w);
    if (
      shoal &&
      ship.speed > 24 &&
      game.voyageDistance - game.maritimeHazards.lastShoalDistance > 180
    ) {
      game.maritimeHazards = markHazardEncounter(game.maritimeHazards, {
        type: "shoal",
        cycle: stormCycle(game.day, game.voyageDistance),
        voyageDistance: game.voyageDistance,
      });
      openMaritimeHazard("shoal", {
        name: shoal.name,
        exposure: shoal.exposure,
        speed: ship.speed,
      });
    } else if (
      shouldTriggerStorm(game.maritimeHazards, {
        day: game.day,
        voyageDistance: game.voyageDistance,
        roughness: weather.roughness,
      })
    ) {
      const cycle = stormCycle(game.day, game.voyageDistance);
      game.maritimeHazards = markHazardEncounter(game.maritimeHazards, {
        type: "storm",
        cycle,
        voyageDistance: game.voyageDistance,
        day: game.day,
      });
      openMaritimeHazard("storm", {
        name: weather.name,
        roughness: weather.roughness,
      });
    }

    if (oldCycle !== newCycle && !game.firstMeridianCrossed) {
      game.firstMeridianCrossed = true;
      showMessage(
        "FIRST MERIDIAN CROSSED · the world continues around the globe.",
        3.8,
      );
    }
  }
  camera.x += (ship.x - camera.x) * Math.min(1, dt * 4.5);
  camera.y += (ship.y - camera.y) * Math.min(1, dt * 4.5);
  visibility.revealCooldown -= dt;
  if (visibility.revealCooldown <= 0) {
    revealCurrentView();
    visibility.revealCooldown = 0.12;
  }
  ship.trail.unshift({
    x: ship.x - Math.cos(ship.angle) * 20,
    y: ship.y - Math.sin(ship.angle) * 20,
  });
  if (ship.trail.length > 28) ship.trail.pop();
  checkRumorLeads();
  nearPort = null;
  let best = 78;
  for (const p of ports) {
    const d = wrappedDistance(ship.x, ship.y, p.x, p.y);
    if (d < best) {
      best = d;
      nearPort = p;
    }
  }
  ui.dock.style.display = nearPort ? "block" : "none";
  ui.town.style.display = nearPort ? "block" : "none";
  nearExplorationSite = null;
  if (!nearPort && ship.speed < 8) {
    let nearestSiteDistance = Infinity;
    for (const site of explorationSites) {
      if (game.exploration.sites[site.id]) continue;
      const distance = wrappedDistance(ship.x, ship.y, site.x, site.y);
      if (distance <= site.radius && distance < nearestSiteDistance) {
        nearestSiteDistance = distance;
        nearExplorationSite = site;
      }
    }
  }
  ui.explore.style.display = nearExplorationSite ? "block" : "none";
  nearDiscovery = null;
  if (!nearPort && !nearExplorationSite) {
    let nearestDiscoveryDistance = Infinity;
    // A clear day (or a taller mast) lets you spot a find from farther off,
    // while fog forces you close. Current sight range sets the detection
    // radius, floored at the site's own radius so one you're atop is always
    // investigable regardless of weather.
    const sight = Math.max(visibility.radius, 0);
    for (const site of discoverySites) {
      if (site.requiresExpedition) continue;
      if (game.discoveries.found[site.id]) continue;
      const distance = wrappedDistance(ship.x, ship.y, site.x, site.y);
      if (
        distance <= Math.max(site.radius, sight) &&
        distance < nearestDiscoveryDistance
      ) {
        nearestDiscoveryDistance = distance;
        nearDiscovery = site;
      }
    }
  }
  if (messageTimer > 0) {
    messageTimer -= dt;
    if (messageTimer <= 0) ui.message.classList.remove("show");
  }
  updateHud();
}
function loop(now) {
  const dt = Math.min(0.04, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function changeZoom(direction) {
  const targetZoom = Math.max(
    MIN_ZOOM,
    Math.min(
      MAX_ZOOM,
      camera.zoom * (direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP),
    ),
  );
  userZoom = targetZoom / viewportZoom;
  camera.zoom = targetZoom;
}

addEventListener("keydown", (e) => {
  const zoomIn = e.key === "+" || e.key === "=" || e.code === "NumpadAdd";
  const zoomOut = e.key === "-" || e.key === "_" || e.code === "NumpadSubtract";
  if (zoomIn || zoomOut) {
    changeZoom(zoomIn ? 1 : -1);
    e.preventDefault();
    return;
  }
  keys.add(e.key.toLowerCase());
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key))
    e.preventDefault();
});
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

canvas.addEventListener(
  "wheel",
  (e) => {
    changeZoom(e.deltaY < 0 ? 1 : -1);
    e.preventDefault();
  },
  { passive: false },
);

// touch joystick
const joy = document.getElementById("joystick"),
  stick = document.getElementById("stick");
let joyPointer = null;
function moveJoy(e) {
  const r = joy.getBoundingClientRect();
  let dx = e.clientX - (r.left + r.width / 2),
    dy = e.clientY - (r.top + r.height / 2);
  const max = 42,
    rawLen = Math.hypot(dx, dy),
    len = rawLen || 1;
  if (len > max) {
    dx = (dx / len) * max;
    dy = (dy / len) * max;
  }
  stick.style.transform = `translate(${dx}px,${dy}px)`;
  input.x = dx / max;
  input.y = dy / max;
  input.power = Math.min(1, rawLen / max);
}
joy.addEventListener("pointerdown", (e) => {
  joyPointer = e.pointerId;
  joy.setPointerCapture(e.pointerId);
  moveJoy(e);
});
joy.addEventListener("pointermove", (e) => {
  if (e.pointerId === joyPointer) moveJoy(e);
});
function endJoy(e) {
  if (e.pointerId === joyPointer) {
    joyPointer = null;
    input.x = 0;
    input.y = 0;
    input.power = 0;
    stick.style.transform = "translate(0,0)";
  }
}
joy.addEventListener("pointerup", endJoy);
joy.addEventListener("pointercancel", endJoy);

let canvasTapStart = null;
canvas.addEventListener("pointerdown", (e) => {
  if (!gameStarted || selectedTown || currentPort) return;
  canvasTapStart = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener("pointerup", (e) => {
  if (!canvasTapStart || !gameStarted || selectedTown || currentPort) {
    canvasTapStart = null;
    return;
  }
  const moved = Math.hypot(
    e.clientX - canvasTapStart.x,
    e.clientY - canvasTapStart.y,
  );
  canvasTapStart = null;
  if (moved > 12) return;
  const world = screenToWorld(e.clientX, e.clientY);
  const merchant = nearestVisibleMerchant(
    world.x,
    world.y,
    Math.max(34, 26 / camera.zoom),
  );
  if (merchant) {
    openVesselDetails(merchant);
    return;
  }
  if (nearDiscovery) {
    const dx = nearestWrappedX(nearDiscovery.x, world.x) - world.x;
    if (
      Math.hypot(dx, nearDiscovery.y - world.y) < Math.max(30, 18 / camera.zoom)
    ) {
      claimDiscovery(nearDiscovery);
      return;
    }
  }
  const discovery = discoveryAtPoint(
    world.x,
    world.y,
    Math.max(30, 18 / camera.zoom),
  );
  if (discovery) {
    openDiscoveryDetails(discovery);
    return;
  }
  const port = nearestKnownPort(
    world.x,
    world.y,
    Math.max(45, 34 / camera.zoom),
  );
  if (port) openTownDetails(port, false);
});
canvas.addEventListener("pointermove", (e) => {
  if (
    matchMedia("(pointer:fine)").matches &&
    gameStarted &&
    !selectedTown &&
    !currentPort
  ) {
    const world = screenToWorld(e.clientX, e.clientY);
    canvas.style.cursor =
      nearestVisibleMerchant(
        world.x,
        world.y,
        Math.max(34, 26 / camera.zoom),
      ) ||
      discoveryAtPoint(world.x, world.y, Math.max(30, 18 / camera.zoom)) ||
      nearestKnownPort(world.x, world.y, Math.max(45, 34 / camera.zoom))
        ? "pointer"
        : "default";
  }
});

function pricingOptions(port, key) {
  return {
    state: economyState(port, key),
    good: { ...goods[key], key },
    bias: port.bias[key],
    day: game.day,
    portName: port.name,
    eventMultiplier: eventPriceMultiplier(port, key),
    lawMultiplier: lawPriceMultiplier(port, key),
  };
}
function buyPriceFor(port, key) {
  return buyPrice(pricingOptions(port, key));
}
function sellPriceFor(port, key) {
  return sellPrice(pricingOptions(port, key));
}
function legalStatusAt(port, key) {
  return jurisdictionLaw(port.name, key, {
    crises: crisisAtPort(game.regionalCrises, port.name),
    dominantFaction: dominantFaction(port).name,
  });
}
function renderMilestone(root) {
  root.innerHTML = "";
  const steps = [
    {
      done: game.completedContracts >= 3,
      title: "Complete three contracts",
      detail: game.completedContracts + "/3 fulfilled on time",
    },
    {
      done: game.milestone.shortageExploited,
      title: "Exploit Goldhaven’s iron shortage",
      detail: game.milestone.shortageExploited
        ? Math.round(game.milestone.shortageProfit) +
          " crowns of shortage profit"
        : worldEvents.ironShortage.active
          ? "Buy cheap iron in Rimegate or Khaz Vhar, then sell it in Goldhaven · " +
            Math.round(game.milestone.shortageProfit) +
            "/50 profit"
          : "Complete two contracts to trigger a regional market event",
    },
    {
      done: guildStanding() >= 20 || game.laws.amberConvoy,
      title: "Build Guild influence",
      detail: game.laws.amberConvoy
        ? "Influence spent to pass the charter"
        : guildStanding() + "/20 with the Guild of Gilded Oars",
    },
    {
      done: game.milestone.lawChanged,
      title: "Change regional trade law",
      detail: game.milestone.lawChanged
        ? "Royal Amber Convoy is active"
        : "Petition available in Goldhaven when prior steps are complete",
    },
  ];
  steps.forEach((step, i) => {
    const d = document.createElement("div");
    const unlocked = i === 0 || steps.slice(0, i).every((x) => x.done);
    d.className =
      "milestone-step " +
      (step.done ? "done" : unlocked ? "pending" : "locked");
    d.innerHTML =
      "<b>" +
      (step.done ? "✓ " : "") +
      step.title +
      '</b><div class="small">' +
      step.detail +
      "</div>";
    root.append(d);
  });
  if (game.milestone.complete) {
    const done = document.createElement("div");
    done.className = "event-banner";
    done.innerHTML =
      "<b>Merchant Prince recognized</b>Your chartered seat grants a 250-crown completion bonus.";
    root.append(done);
  }
}

function renderLegacies(root) {
  if (!root) return;
  root.innerHTML = "";
  if (!game.milestone.complete) {
    root.innerHTML =
      '<p class="empty-note">Reach Merchant Prince to choose a lasting legacy.</p>';
    return;
  }
  if (!game.legacy.selected) {
    const intro = document.createElement("p");
    intro.className = "small";
    intro.textContent =
      "Choose one long-term identity. The choice is permanent for this save and unlocks a checklist, final crisis, ending summary, and sandbox continuation.";
    root.append(intro);
    const grid = document.createElement("div");
    grid.className = "legacy-grid";
    for (const path of Object.values(LEGACY_PATHS)) {
      const card = document.createElement("div");
      card.className = "legacy-card";
      card.innerHTML = `<b>${path.name}</b><span>${path.description}</span><span class="small">Final crisis: ${path.crisisTitle}</span>`;
      const button = document.createElement("button");
      button.className = "parchment";
      button.textContent = `Pursue ${path.name}`;
      button.onclick = () => {
        game.legacy.selected = path.id;
        addNews("Legacy chosen", `You will pursue the ${path.name} legacy.`);
        renderLegacies(root);
        saveGameState();
      };
      card.append(button);
      grid.append(card);
    }
    root.append(grid);
    return;
  }
  const path = LEGACY_PATHS[game.legacy.selected];
  const heading = document.createElement("div");
  heading.className = "event-banner";
  heading.innerHTML = `<b>${path.name}</b>${path.description}`;
  root.append(heading);
  for (const item of legacyChecklist(game)) {
    const row = document.createElement("div");
    row.className = "milestone-step " + (item.done ? "done" : "pending");
    row.innerHTML = `<b>${item.done ? "✓ " : ""}${item.title}</b><div class="small">${item.detail}</div>`;
    root.append(row);
  }
  const crisis = document.createElement("div");
  crisis.className = "legacy-crisis";
  crisis.innerHTML = `<b>${path.crisisTitle}</b><span>${path.crisis}</span>`;
  const ready = legacyReadyForCapstone(game);
  if (!game.legacy.capstoneComplete) {
    const button = document.createElement("button");
    button.className = "parchment";
    button.textContent = ready
      ? "Complete capstone voyage"
      : "Checklist incomplete";
    button.disabled = !ready;
    button.onclick = () => {
      const result = completeLegacyCapstone(game);
      if (!result.ok) return showMessage(result.reason);
      addNews(`${result.path.name} legacy fulfilled`, result.path.ending);
      showMessage(`${result.path.name.toUpperCase()} · Legacy fulfilled`, 6);
      renderLegacies(root);
      saveGameState();
    };
    crisis.append(button);
  }
  root.append(crisis);
  if (game.legacy.capstoneComplete) {
    const ending = document.createElement("div");
    ending.className = "event-banner legacy-ending";
    ending.innerHTML = `<b>Ending: ${path.name}</b>${path.ending}`;
    const sandbox = document.createElement("button");
    sandbox.className = "parchment";
    sandbox.textContent = game.legacy.sandbox
      ? "Sandbox mode active"
      : "Continue in sandbox mode";
    sandbox.disabled = game.legacy.sandbox;
    sandbox.onclick = () => {
      continueLegacySandbox(game);
      showMessage("Sandbox mode active · Continue trading freely.", 5);
      renderLegacies(root);
      saveGameState();
    };
    ending.append(sandbox);
    root.append(ending);
  }
}

function renderContractList(root, contracts, active = false) {
  root.innerHTML = "";
  if (!contracts.length) {
    root.innerHTML =
      '<p class="empty-note">' +
      (active
        ? "No active contracts. Visit a port contract board."
        : "No commissions remain on this board until it refreshes.") +
      "</p>";
    return;
  }
  contracts.forEach((contract) => {
    const card = document.createElement("div");
    card.className = "contract-card" + (active ? " active" : "");
    const head = document.createElement("div");
    head.className = "contract-head";
    head.innerHTML =
      "<b>" +
      contract.title +
      '</b><span class="contract-tag">' +
      contract.cargoUnits +
      " hold</span>";
    const desc = document.createElement("div");
    desc.className = "small";
    desc.textContent =
      contract.cargoName + " · Sponsored by " + contract.faction;
    const meta = document.createElement("div");
    meta.className = "contract-meta";
    if (active)
      meta.innerHTML =
        "<span>Due Day " +
        contract.deadline +
        "</span><span>" +
        (contract.deadline - game.day) +
        " days remain</span><span>" +
        contract.reward +
        " crowns · +" +
        contract.influence +
        " influence</span>";
    else
      meta.innerHTML =
        "<span>Est. " +
        contract.estimatedDays +
        " days</span><span>" +
        contract.reward +
        " crowns</span><span>+" +
        contract.influence +
        " influence</span>";
    card.append(head, desc, meta);
    if (!active) {
      const conflict = contractConflict(
        contract,
        game.activeContracts,
        game.factionCharter,
      );
      const button = document.createElement("button");
      button.className = "parchment";
      button.textContent = conflict
        ? "Conflicting Allegiance"
        : "Accept Commission";
      button.disabled = Boolean(conflict);
      if (conflict) button.title = conflict;
      button.onclick = () => acceptContract(contract.id);
      card.append(button);
    }
    root.append(card);
  });
}
function renderPortEvent() {
  const root = document.getElementById("portEvent");
  root.innerHTML = "";
  const e = worldEvents.ironShortage;
  if (currentPort)
    for (const arc of crisisAtPort(
      game.regionalCrises,
      currentPort.name,
    ).reverse()) {
      const box = document.createElement("div");
      box.className =
        "event-banner " + (arc.phase === "active" ? "event-live" : "");
      const heading =
        arc.phase === "warning"
          ? "WARNING"
          : arc.phase === "active"
            ? `CRISIS · through Day ${arc.endDay}`
            : arc.outcome === "resolved"
              ? "RECOVERY"
              : "LASTING AFTERMATH";
      const body =
        arc.phase === "warning"
          ? arc.template.warning
          : arc.phase === "active"
            ? arc.template.active
            : arc.outcome === "resolved"
              ? arc.template.intervention.result
              : arc.template.ignored;
      box.innerHTML = `<b>${arc.template.title} · ${heading}</b>${body}`;
      if (arc.phase === "active") {
        const action = document.createElement("button");
        action.className = "parchment crisis-action";
        action.textContent = arc.template.intervention.label;
        action.disabled = game.coins < arc.template.intervention.cost;
        action.onclick = () => {
          const result = interveneInCrisis(
            game.regionalCrises,
            arc.id,
            game.coins,
            game.day,
          );
          if (!result.ok) return showMessage(result.reason);
          game.regionalCrises = result.state;
          game.coins = result.coins;
          applyCrisisAftermath(
            game.regionalEconomy[currentPort.name],
            result.template,
            "resolved",
          );
          changeStanding(dominantFaction(currentPort).name, 6);
          addNews(
            result.template.title + ": intervention succeeds",
            result.template.intervention.result,
          );
          showMessage(
            `STORY ARC RESOLVED · ${result.template.title} leaves a lasting recovery.`,
            5,
          );
          renderPortSystems();
          updateHud();
        };
        box.append(action);
      }
      root.append(box);
    }
  if (currentPort)
    for (const event of activeEventsAt(currentPort.name)) {
      const t = eventTemplates[event.templateId],
        box = document.createElement("div");
      box.className = "event-banner event-live";
      box.innerHTML =
        "<b>" +
        t.title +
        " · through Day " +
        event.endDay +
        "</b>" +
        t.description;
      root.append(box);
    }
  if (e.active && currentPort && currentPort.name === e.port) {
    const box = document.createElement("div");
    box.className = "event-banner";
    box.innerHTML = "<b>" + e.title + "</b>" + e.description;
    root.append(box);
  } else if (
    game.laws.amberConvoy &&
    currentPort &&
    (currentPort.name === "Goldhaven" || currentPort.name === "Khaz Vhar")
  ) {
    const box = document.createElement("div");
    box.className = "event-banner";
    box.innerHTML =
      "<b>Protected Amber Run</b>Crown escorts are moving iron between Khaz Vhar and Goldhaven each day. Route risk and Goldhaven prices have fallen.";
    root.append(box);
  }
}
function renderPolitics() {
  const standings = document.getElementById("portStanding");
  standings.innerHTML = "";
  currentPort.factions.forEach((f) => {
    const row = document.createElement("div");
    row.className = "standing-row";
    row.innerHTML =
      "<span>" +
      f.name +
      '<span class="small">' +
      factionPrivilege(game.factionStanding[f.name] || 0).label +
      " · " +
      factionPrivilege(game.factionStanding[f.name] || 0).privilege +
      "</span></span><b>" +
      (game.factionStanding[f.name] || 0) +
      "</b>";
    standings.append(row);
  });
  const law = document.getElementById("localLaw");
  law.innerHTML =
    '<div class="law-head"><b>Current law</b><span class="contract-tag">' +
    (currentPort.name === "Goldhaven"
      ? game.laws.amberConvoy
        ? "Chartered"
        : "Unprotected"
      : "Local") +
    '</span></div><div class="law-effect">' +
    currentLawText(currentPort) +
    "</div>";
  const button = document.getElementById("politicsAction");
  if (currentPort.name === "Goldhaven" && !game.laws.amberConvoy) {
    button.style.display = "block";
    button.textContent = "Charter the Royal Amber Convoy · 20 influence";
    button.disabled = !canPassConvoyLaw();
    button.onclick = passConvoyLaw;
  } else {
    button.style.display = "none";
    button.onclick = null;
  }
}
function renderPortSystems() {
  if (!currentPort) return;
  const regional = game.regionalEconomy[currentPort.name];
  const summary = regionalSummary(regional);
  const evolution = portEvolution(regional);
  const features = [
    evolution.cranes && "towering cargo cranes",
    evolution.foundries && "smoking foundries",
    evolution.warehouses && "new warehouses",
    evolution.fortifications && "harbor fortifications",
  ].filter(Boolean);
  const collapsed = Object.entries(regional.industries)
    .filter(([, industry]) => industry.collapsed)
    .map(([id]) => productionChains.find((chain) => chain.id === id)?.name)
    .filter(Boolean);
  document.getElementById("portEvolution").innerHTML =
    `<b>${features.length ? features.join(" · ") : "A modest working harbor"}</b>` +
    `<span>${summary.pirateAttention >= 50 ? "Pirates are watching this wealthy harbor. " : ""}${summary.politicalAttention >= 50 ? "Courts and factions contest its growing influence. " : ""}${summary.unrest >= 45 ? "Protests and outward migration trouble the streets. " : ""}${collapsed.length ? `Collapsed: ${collapsed.join(", ")}. Restoration capital is required.` : ""}</span>`;
  renderPortOpportunities();
  renderMarket();
  renderCustomsOffice();
  renderCargoPlan();
  renderWarehouse();
  renderProductionChains();
  renderPortEvent();
  renderIntelOffice();
  renderContractList(
    document.getElementById("contractBoard"),
    ensureContractOffers(currentPort),
    false,
  );
  renderPolitics();
  renderShipyard();
  renderReadiness();
  renderMilestone(document.getElementById("milestonePort"));
}

function renderPortOpportunities() {
  const root = document.getElementById("portOpportunities");
  const offers = ensureContractOffers(currentPort);
  const opportunity = bestTradeOpportunity();
  const damaged = Math.round(game.operations.condition) < 100;
  const rows = [
    {
      title: `${offers.length} contract${offers.length === 1 ? "" : "s"} available`,
      detail: "Open Trade to review pay, deadlines, and faction consequences.",
      tab: "trade",
    },
    {
      title:
        opportunity.buy === currentPort.name
          ? `Buy ${goods[opportunity.key].name} for a known trade`
          : opportunity.sell === currentPort.name
            ? `${goods[opportunity.key].name} is in demand here`
            : "Review today’s market",
      detail:
        opportunity.buy === currentPort.name
          ? `Known destination: ${opportunity.sell}, about ${opportunity.margin} crowns margin per unit.`
          : opportunity.sell === currentPort.name
            ? `Best known source: ${opportunity.buy}, about ${opportunity.margin} crowns margin per unit.`
            : "Buy local surpluses and compare known prices before sailing.",
      tab: "market",
    },
    {
      title: "Buy a rumor lead",
      detail: `${RUMOR_COST} crowns for a broad chart circle pointing to a hidden discovery or expedition site.`,
      action: buyRumorLead,
    },
    {
      title: damaged
        ? "Your vessel needs attention"
        : "Prepare the next voyage",
      detail: damaged
        ? `${Math.round(game.operations.condition)}% condition. Repair damaged systems before a long route.`
        : `${game.operations.provisions}/30 provisions aboard; inspect route estimates before casting off.`,
      tab: "vessel",
    },
  ];
  root.innerHTML = "";
  for (const row of rows) {
    const item = document.createElement("div");
    item.className = "port-opportunity";
    item.innerHTML = `<div><b>${row.title}</b><span class="small">${row.detail}</span></div>`;
    const button = document.createElement("button");
    button.className = "parchment";
    button.textContent = row.action ? "Buy" : "Open";
    button.onclick = row.action
      ? row.action
      : () =>
          activateSectionTabs(document.getElementById("portPanel"), row.tab);
    item.append(button);
    root.append(item);
  }
}

function renderCustomsOffice() {
  const root = document.getElementById("customsOffice");
  root.innerHTML = "";
  const inspection = game.legal.lastInspection;
  const summary = document.createElement("div");
  summary.className = "politics-box";
  summary.innerHTML =
    `<div class="law-head"><b>${currentPort.realm} jurisdiction</b><span class="contract-tag">${game.legal.offenses[currentPort.name] || 0} offenses</span></div>` +
    `<div class="law-effect">${inspection?.portName === currentPort.name ? `Last arrival: ${inspection.inspected ? "inspected" : "cleared"} at ${Math.round(inspection.scrutiny * 100)}% scrutiny${inspection.fine ? ` · ${inspection.fine} crowns assessed` : ""}.` : "No recent customs record at this port."}</div>`;
  root.append(summary);
  const actions = document.createElement("div");
  actions.className = "customs-actions";
  const forgery = document.createElement("button");
  forgery.className = "parchment";
  forgery.textContent = game.legal.forgedManifest
    ? "Forged manifest prepared"
    : "Forge next manifest · 18 crowns";
  forgery.disabled = game.legal.forgedManifest || game.coins < 18;
  forgery.onclick = () => {
    game.coins -= 18;
    game.legal.forgedManifest = true;
    renderPortSystems();
    updateHud();
  };
  const remote = document.createElement("button");
  remote.className = "parchment";
  remote.textContent = game.legal.remoteAnchorage
    ? "Remote landing arranged"
    : "Arrange remote landing · 12 crowns";
  remote.disabled = game.legal.remoteAnchorage || game.coins < 12;
  remote.onclick = () => {
    game.coins -= 12;
    game.legal.remoteAnchorage = true;
    renderPortSystems();
    updateHud();
  };
  const cultivate = document.createElement("button");
  cultivate.className = "parchment";
  cultivate.textContent = game.legal.cultivatedOfficials[currentPort.name]
    ? "Customs contact cultivated"
    : "Cultivate an official · 55 crowns";
  cultivate.disabled =
    game.legal.cultivatedOfficials[currentPort.name] || game.coins < 55;
  cultivate.onclick = () => {
    const result = cultivateOfficial(game.legal, currentPort.name, game.coins);
    if (!result.ok) return showMessage(result.reason);
    game.coins = result.coins;
    renderPortSystems();
    updateHud();
  };
  actions.append(forgery, remote, cultivate);
  root.append(actions);
}

function renderCargoPlan() {
  const root = document.getElementById("cargoPlan");
  root.innerHTML = "";
  const capacities = cargoCapacities();
  normalizeCargoCompartments(game.cargoLots, capacities);
  for (const [key, compartment] of Object.entries(CARGO_COMPARTMENTS)) {
    const lots = game.cargoLots.filter((lot) => lot.compartment === key);
    const section = document.createElement("section");
    section.className = "cargo-compartment";
    section.innerHTML =
      `<div class="cargo-compartment-head"><b>${compartment.label}</b><span>${lots.length}/${capacities[key]}</span></div>` +
      `<p class="small">${compartment.description}</p>`;
    if (!capacities[key]) section.classList.add("locked");
    if (!lots.length) {
      const empty = document.createElement("div");
      empty.className = "empty-note";
      empty.textContent = capacities[key]
        ? "Empty"
        : key === "concealed"
          ? "Fit smuggler’s lockers to unlock."
          : "No space available.";
      section.append(empty);
    }
    for (const lot of lots) {
      const row = document.createElement("div");
      row.className = "cargo-lot-row";
      const details = document.createElement("span");
      details.innerHTML = `<b>${goods[lot.key].name}</b><span class="small">${cargoLotDescription(lot)}</span>`;
      const select = document.createElement("select");
      select.setAttribute("aria-label", `Move ${goods[lot.key].name}`);
      for (const [destination, data] of Object.entries(CARGO_COMPARTMENTS)) {
        const option = document.createElement("option");
        option.value = destination;
        option.textContent = data.label;
        option.selected = destination === key;
        option.disabled =
          destination !== key &&
          game.cargoLots.filter((item) => item.compartment === destination)
            .length >= capacities[destination];
        select.append(option);
      }
      select.onchange = () => {
        const result = moveCargoLot(
          game.cargoLots,
          lot.id,
          select.value,
          capacities,
        );
        if (!result.ok) showMessage(result.reason);
        renderCargoPlan();
      };
      row.append(details, select);
      section.append(row);
    }
    root.append(section);
  }
}

function localWarehouseStanding() {
  return Math.max(
    0,
    ...currentPort.factions.map(
      (faction) => game.factionStanding[faction.name] || 0,
    ),
  );
}

function renderWarehouse() {
  const root = document.getElementById("warehouse");
  root.innerHTML = "";
  const warehouse = warehouseAt(game.warehouses, currentPort.name);
  if (!warehouse?.leased) {
    const standing = localWarehouseStanding();
    const cost = warehouseLeaseCost(standing);
    const note = document.createElement("p");
    note.className = "empty-note";
    note.textContent =
      standing >= 10
        ? "Trusted local factors offer you a reduced permanent lease."
        : "A permanent lease stores up to 24 cargo lots at this port.";
    const lease = document.createElement("button");
    lease.className = "parchment";
    lease.textContent = `Lease warehouse · ${cost} crowns`;
    lease.disabled = game.coins < cost;
    lease.onclick = () => {
      const result = leaseWarehouse(
        game.warehouses,
        currentPort.name,
        game.coins,
        localWarehouseStanding(),
      );
      if (!result.ok) return showMessage(result.reason);
      game.coins = result.coins;
      addNews(
        `Warehouse leased at ${currentPort.name}`,
        `${result.cost} crowns secured permanent storage for 24 cargo lots.`,
      );
      renderPortSystems();
      updateHud();
    };
    root.append(note, lease);
    return;
  }

  const summary = document.createElement("div");
  summary.className = "warehouse-summary";
  summary.innerHTML = `<b>${warehouse.lots.length}/${warehouse.capacity} lots stored</b><span>Permanent local inventory · sheltered aging</span>`;
  root.append(summary);

  const grid = document.createElement("div");
  grid.className = "warehouse-grid";
  const aboard = document.createElement("section");
  const stored = document.createElement("section");
  aboard.className = "warehouse-column";
  stored.className = "warehouse-column";
  aboard.innerHTML = `<h4>Aboard ${activeShipClass().vesselName}</h4>`;
  stored.innerHTML = `<h4>${currentPort.name} warehouse</h4>`;

  if (!game.cargoLots.length)
    aboard.insertAdjacentHTML(
      "beforeend",
      '<p class="empty-note">No trade cargo aboard.</p>',
    );
  for (const lot of game.cargoLots) {
    const row = document.createElement("div");
    row.className = "warehouse-lot-row";
    const details = document.createElement("span");
    details.innerHTML = `<b>${goods[lot.key].name}</b><small>${cargoLotDescription(lot)}</small>`;
    const button = document.createElement("button");
    button.textContent = "Store";
    button.disabled = warehouse.lots.length >= warehouse.capacity;
    button.onclick = () => {
      const result = depositCargo(
        game.warehouses,
        currentPort.name,
        game.cargoLots,
        lot.id,
      );
      if (!result.ok) return showMessage(result.reason);
      syncCargoCounts(game, goods);
      renderPortSystems();
      updateHud();
    };
    row.append(details, button);
    aboard.append(row);
  }

  if (!warehouse.lots.length)
    stored.insertAdjacentHTML(
      "beforeend",
      '<p class="empty-note">The warehouse is empty.</p>',
    );
  for (const lot of warehouse.lots) {
    const row = document.createElement("div");
    row.className = "warehouse-lot-row";
    const details = document.createElement("span");
    details.innerHTML = `<b>${goods[lot.key].name}</b><small>${cargoLotDescription(lot)}</small>`;
    const button = document.createElement("button");
    button.textContent = "Load";
    button.disabled = cargoCount() >= game.holdMax;
    button.onclick = () => {
      const result = withdrawCargo(
        game.warehouses,
        currentPort.name,
        game.cargoLots,
        lot.id,
        game.holdMax - cargoCount(),
      );
      if (!result.ok) return showMessage(result.reason);
      result.lot.compartment = bestCargoCompartment(
        result.lot,
        cargoCapacities(),
        game.cargoLots.filter((item) => item.id !== result.lot.id),
      );
      syncCargoCounts(game, goods);
      renderPortSystems();
      updateHud();
    };
    row.append(details, button);
    stored.append(row);
  }
  grid.append(aboard, stored);
  root.append(grid);
}

function renderReadiness() {
  const root = document.getElementById("voyageReadiness");
  const ops = game.operations;
  const stats = operationalShipStats();
  const crewModifiers = crewVoyageModifiers(ops.crew);
  const routePlan = routePlanEffects(ops.routePlan);
  const readinessStats = {
    ...stats,
    routePlan: routePlan.id,
    stormResistance: stats.stormResistance * crewModifiers.stormResistance,
    crewProvisionMultiplier: crewModifiers.provisionMultiplier,
  };
  const nearbyRoutes = routesFrom(currentPort.name);
  const estimates = nearbyRoutes.map((route) => {
    const destination = route.a === currentPort.name ? route.b : route.a;
    const distance = pathLength(
      orientRoute(route, currentPort.name, destination),
    );
    const estimate = estimateVoyageReadiness(
      distance,
      readinessStats,
      routePlan.id,
    );
    return {
      destination,
      ...estimate,
      arrivalDay: game.day + estimate.days,
    };
  });
  root.innerHTML =
    `<div class="ship-stats">Plan: ${routePlan.label} · ${ops.provisions}/30 provisions · ${Math.round(ops.condition)}% overall condition · ${Math.round(ops.morale)} morale · ${Math.round(ops.crew.mutinyPressure)}% mutiny pressure · ${crewWeeklyWage(ops.crew)} crowns/week</div>` +
    `<div class="crew-grid">${Object.entries(ops.crew.groups)
      .map(
        ([role, group]) =>
          `<article class="crew-card"><header><b>${CREW_ROLES[role].label}</b><strong>${group.count}</strong></header><span>${Math.round(group.experience)} exp · ${Math.round(group.fatigue)} fatigue</span><span>${group.injuries} injured · ${Math.round(group.loyalty)} loyalty</span></article>`,
      )
      .join("")}</div>` +
    `<div class="component-grid">${Object.entries(SHIP_COMPONENTS)
      .map(
        ([key, component]) =>
          `<div class="component-condition ${ops.components[key] < 40 ? "critical" : ""}"><span>${component.label}</span><b>${Math.round(ops.components[key])}%</b></div>`,
      )
      .join("")}</div>` +
    estimates
      .slice(0, 3)
      .map((estimate) => {
        const warnings = voyageWarnings(ops, estimate);
        return `<div class="standing-row"><span><b>${estimate.destination}</b><span class="small">${estimate.days}d · arrive Day ${estimate.arrivalDay} · ${estimate.provisionsNeeded} provisions · ~${estimate.conditionRisk}% wear</span>${warnings.length ? warnings.map((warning) => `<span class="readiness-warning">⚠ ${warning}</span>`).join("") : '<span class="readiness-ready">✓ Ready to sail</span>'}</span></div>`;
      })
      .join("");
  const planner = document.createElement("div");
  planner.className = "route-plan-grid";
  for (const plan of Object.values(ROUTE_PLANS)) {
    const button = document.createElement("button");
    button.className =
      "route-plan" + (plan.id === routePlan.id ? " selected" : "");
    button.type = "button";
    button.innerHTML =
      `<b>${plan.label}</b><span>${plan.description}</span>` +
      `<small>${Math.round(plan.daysMultiplier * 100)}% days · ${Math.round(plan.provisionMultiplier * 100)}% stores · ${Math.round(plan.damageMultiplier * plan.roughnessMultiplier * 100)}% wear · ${Math.round(plan.hostileRiskMultiplier * 100)}% raider risk</small>`;
    button.onclick = () => {
      game.operations.routePlan = plan.id;
      showMessage(`${plan.label} set for the next passage.`);
      renderReadiness();
      saveGameState();
    };
    planner.append(button);
  }
  root.append(planner);

  const actions = document.createElement("div");
  actions.className = "town-actions";
  const provision = document.createElement("button");
  provision.className = "parchment";
  provision.textContent = "Buy provisions · 3 each";
  provision.disabled = game.coins < 3 || ops.provisions >= 30;
  provision.onclick = () => {
    const result = buyProvisions(game.operations, game.coins);
    game.operations = result.operations;
    game.coins = result.coins;
    showMessage(`Loaded ${result.purchased} provisions.`);
    renderPortSystems();
    updateHud();
  };
  const repairAll = document.createElement("button");
  repairAll.className = "parchment";
  repairAll.textContent = "Repair weakest systems · 2 per point";
  repairAll.disabled = game.coins < 2 || ops.condition >= 100;
  repairAll.onclick = () => {
    const result = repairOperations(game.operations, game.coins);
    game.operations = result.operations;
    game.coins = result.coins;
    applyShipUpgrades();
    showMessage(
      `Repaired ${result.repaired} component point${result.repaired === 1 ? "" : "s"}.`,
    );
    renderPortSystems();
    updateHud();
  };
  actions.append(provision, repairAll);
  const leave = document.createElement("button");
  leave.className = "parchment";
  leave.textContent = "Grant shore leave";
  leave.onclick = () => {
    const result = takeShoreLeave(game.operations.crew, game.coins);
    if (!result.ok) return showMessage(result.reason);
    game.operations.crew = result.crew;
    game.coins = result.coins;
    game.operations.morale = clampNumber(game.operations.morale + 8, 0, 100);
    advanceDays(result.days);
    showMessage(`Shore leave restored the crew · ${result.cost} crowns.`);
    renderPortSystems();
    updateHud();
  };
  actions.append(leave);
  root.append(actions);
  const recruiting = document.createElement("div");
  recruiting.className = "crew-recruiting";
  for (const offer of portRecruitmentPool(
    currentPort.name,
    currentPort.population,
  )) {
    const button = document.createElement("button");
    button.className = "parchment";
    button.textContent = `Recruit ${CREW_ROLES[offer.role].label} · ${offer.cost}`;
    button.title = `${offer.available} available · ${offer.experience} experience`;
    button.disabled = game.coins < offer.cost || offer.available <= 0;
    button.onclick = () => {
      const result = recruitCrew(game.operations.crew, offer, game.coins);
      if (!result.ok) return showMessage(result.reason);
      game.operations.crew = result.crew;
      game.coins = result.coins;
      offer.available -= 1;
      showMessage(
        `Recruited one ${CREW_ROLES[offer.role].label.toLowerCase()}.`,
      );
      renderPortSystems();
      updateHud();
    };
    recruiting.append(button);
  }
  root.append(recruiting);
  const componentActions = document.createElement("div");
  componentActions.className = "component-repairs";
  for (const [key, component] of Object.entries(SHIP_COMPONENTS)) {
    const button = document.createElement("button");
    button.className = "parchment";
    button.textContent = `Repair ${component.label}`;
    button.disabled =
      game.coins < component.repairCost || ops.components[key] >= 100;
    button.onclick = () => {
      const result = repairShipComponent(game.operations, game.coins, key);
      game.operations = result.operations;
      game.coins = result.coins;
      applyShipUpgrades();
      showMessage(
        `Repaired ${component.label.toLowerCase()} by ${result.repaired} point${result.repaired === 1 ? "" : "s"}.`,
      );
      renderPortSystems();
      updateHud();
    };
    componentActions.append(button);
  }
  root.append(componentActions);
}

function formatChainGoods(entries) {
  return Object.entries(entries)
    .map(([key, units]) => units + " " + goods[key].name)
    .join(" + ");
}
function renderProductionChains() {
  const root = document.getElementById("productionChains");
  root.innerHTML = "";
  const regional = game.regionalEconomy[currentPort.name];
  const summary = regionalSummary(regional);
  const overview = document.createElement("div");
  overview.className = "ship-stats";
  overview.textContent = `${summary.infrastructure} infrastructure · ${summary.population.toLocaleString()} people · ${summary.laborPercent}% labor · ${summary.resourcePercent}% resources · ${summary.unrest}% unrest · ${summary.dockingFee} crown docking fee`;
  root.append(overview);
  const reports = Object.fromEntries(
    (game.productionReports[currentPort.name] || []).map((report) => [
      report.id,
      report,
    ]),
  );
  for (const chain of productionChains) {
    const efficiency = currentPort.industries[chain.id];
    const report = reports[chain.id];
    const industry = regional.industries[chain.id];
    const card = document.createElement("div");
    card.className = "production-chain";
    const status = industry.collapsed
      ? "COLLAPSED"
      : report
        ? report.utilization < 0.5
          ? "Input-starved"
          : "Operating"
        : "Awaiting daily cycle";
    const recipe =
      report?.recipeId === "standard"
        ? "standard recipe"
        : chain.alternatives?.find(
            (alternative) => alternative.id === report?.recipeId,
          )?.label || "standard recipe";
    card.innerHTML =
      "<div><b>" +
      chain.name +
      '</b><span class="small">' +
      formatChainGoods(chain.inputs) +
      " → " +
      formatChainGoods(chain.outputs) +
      `</span><span class="small">${recipe} · quality ${Math.round((report?.quality || 1) * 100)}%${report?.fuelLimited ? " · fuel-starved" : ""}</span></div><span class="contract-tag">` +
      status +
      " · " +
      Math.round(efficiency * 100) +
      `%</span>${industry.magnate ? `<span class="small magnate">Local power: ${industry.magnate}, ${industry.investment >= 2 ? "rival magnate" : "rising proprietor"}</span>` : ""}`;
    const invest = document.createElement("button");
    const cost = investmentCost(industry);
    invest.className = "parchment";
    invest.textContent = industry.collapsed
      ? `Restore industry · ${cost}`
      : industry.investment >= 3
        ? "Fully developed"
        : `Invest ${cost} · level ${industry.investment}/3`;
    invest.disabled =
      (industry.investment >= 3 && !industry.collapsed) || game.coins < cost;
    invest.onclick = () => {
      const result = investInIndustry(
        regional,
        chain.id,
        game.coins,
        currentPort.name,
      );
      if (!result.ok) return showMessage(result.reason);
      game.coins = result.coins;
      addNews(
        `Investment in ${chain.name}`,
        result.restored
          ? `Your capital reopened ${currentPort.name}'s ruined ${chain.name.toLowerCase()} under ${result.magnate}.`
          : `Your capital raised ${currentPort.name}'s ${chain.name.toLowerCase()} industry to level ${result.level}, creating a new local power in ${result.magnate}.`,
      );
      showMessage(
        `${chain.name} expanded to investment level ${result.level}.`,
      );
      renderPortSystems();
      updateHud();
    };
    card.append(invest);
    root.append(card);
  }
}

function signed(value) {
  return value > 0 ? "+" + value : String(value);
}
function upgradeEffects(item) {
  const labels = {
    holdMax: "hold",
    maxSpeed: "top speed",
    accel: "acceleration",
    turnRate: "turning",
    visibilityHeightM: "lookout height",
    windDrift: "wind drift",
    inspectionRisk: "inspection risk",
    stormResistance: "storm resistance",
    crewComfort: "crew comfort",
    defense: "defense",
  };
  const effects = Object.entries(item.modifiers).map(
    ([key, value]) => signed(value) + " " + labels[key],
  );
  return effects.length ? effects.join(" · ") : "Balanced baseline";
}
function upgradeAffinities(item) {
  if (!item.affinities.length) return "No specialist alignment";
  return item.affinities.map((id) => SHIP_IDENTITIES[id].name).join(" · ");
}
function renderShipyard() {
  const root = document.getElementById("shipyard");
  root.innerHTML = "";
  const stats = applyShipUpgrades();
  const identity = calculateShipIdentity(game.shipUpgrades);
  const activeClass = SHIP_CLASSES[game.shipUpgrades.activeClass];
  const shipStats = document.getElementById("shipStats");
  shipStats.innerHTML =
    "<strong>" +
    activeClass.vesselName +
    " · " +
    activeClass.name +
    "</strong><span>" +
    activeClass.description +
    "</span><span>Fitting identity: <b>" +
    identity.name +
    "</b> · " +
    identity.description +
    "</span><span>" +
    stats.holdMax +
    " hold · " +
    shipSpeedKnots(stats.maxSpeed, stats.waterlineLengthFt).toFixed(1) +
    " knots · " +
    stats.turnRate.toFixed(2) +
    " turning · " +
    currentVisibilityKm().toFixed(1) +
    " km sight · defense " +
    stats.defense +
    "</span>";
  const classSection = document.createElement("div");
  classSection.className = "ship-class-section";
  classSection.innerHTML =
    '<h4>Vessels</h4><p class="small">Purchase ships once, then change vessels freely while docked. Fittings transfer between your owned ships.</p>';
  const classGrid = document.createElement("div");
  classGrid.className = "ship-class-grid";
  for (const item of Object.values(SHIP_CLASSES)) {
    const active = game.shipUpgrades.activeClass === item.id;
    const owned = game.shipUpgrades.ownedClasses.includes(item.id);
    const row = document.createElement("div");
    row.className = "ship-class-option" + (active ? " active" : "");
    const details = document.createElement("div");
    details.innerHTML =
      `<b>${item.name}</b><span class="ship-name">${item.vesselName}</span>` +
      `<span class="small">${item.description}</span>` +
      `<span class="upgrade-effects">${upgradeEffects(item)}</span>`;
    const button = document.createElement("button");
    button.textContent = active
      ? "Active"
      : owned
        ? "Select"
        : `Buy ${item.cost}`;
    button.disabled = active || (!owned && game.coins < item.cost);
    button.onclick = () => {
      const result = buyOrSelectShipClass(game, item.id, cargoCount());
      if (!result.ok) return showMessage(result.reason);
      applyShipUpgrades();
      normalizeCargoCompartments(game.cargoLots, cargoCapacities());
      showMessage(
        result.purchased
          ? `Purchased ${item.vesselName}, a ${item.name.toLowerCase()}.`
          : `${item.vesselName} is now your active vessel.`,
      );
      renderPortSystems();
      updateHud();
    };
    row.append(details, button);
    classGrid.append(row);
  }
  classSection.append(classGrid);
  root.append(classSection);
  for (const slot of UPGRADE_SLOTS) {
    const section = document.createElement("div");
    section.className = "upgrade-slot";
    section.innerHTML = "<h4>" + slot.name + "</h4>";
    for (const item of SHIP_UPGRADES[slot.id]) {
      const equipped = game.shipUpgrades.equipped[slot.id] === item.id;
      const owned = game.shipUpgrades.owned.includes(item.id);
      const row = document.createElement("div");
      row.className = "upgrade-option" + (equipped ? " equipped" : "");
      const details = document.createElement("div");
      details.innerHTML =
        "<b>" +
        item.name +
        '</b><span class="small">' +
        item.description +
        '</span><span class="upgrade-effects">' +
        upgradeEffects(item) +
        '</span><span class="upgrade-affinities">Identity: ' +
        upgradeAffinities(item) +
        "</span>";
      const button = document.createElement("button");
      button.textContent = equipped
        ? "Fitted"
        : owned
          ? "Equip"
          : "Buy " + item.cost;
      button.disabled = equipped || (!owned && game.coins < item.cost);
      button.onclick = () => {
        const result = buyOrEquipUpgrade(game, slot.id, item.id, cargoCount());
        if (!result.ok) return showMessage(result.reason);
        applyShipUpgrades();
        normalizeCargoCompartments(game.cargoLots, cargoCapacities());
        showMessage(
          (result.purchased ? "Purchased and fitted " : "Fitted ") +
            item.name +
            ".",
        );
        renderPortSystems();
        updateHud();
      };
      row.append(details, button);
      section.append(row);
    }
    root.append(section);
  }
}
function openPort() {
  if (!nearPort) return;
  currentPort = nearPort;
  ship.speed = 0;
  ship.anchored = true;
  if (game.departedFromPort !== null && game.voyageDistance > 35) {
    const fee = dockingFee(game.regionalEconomy[currentPort.name]);
    const paid = Math.min(game.coins, fee);
    game.coins -= paid;
    if (paid < fee)
      game.regionalEconomy[currentPort.name].unrest = clampNumber(
        game.regionalEconomy[currentPort.name].unrest + 3,
        0,
        100,
      );
    addNews(
      `Docked at ${currentPort.name}`,
      `${paid} crown${paid === 1 ? "" : "s"} paid in harbor dues.${paid < fee ? " The unpaid balance angered local officials." : ""}`,
    );
    const routePlan = routePlanEffects(game.operations.routePlan);
    const days = settledVoyageDays();
    const remainingDays = Math.max(0, days - game.voyageDaysElapsed);
    const distance = game.voyageDistance;
    advanceDays(remainingDays);
    const stats = operationalShipStats();
    const crewModifiers = crewVoyageModifiers(game.operations.crew);
    stats.stormResistance *= crewModifiers.stormResistance;
    stats.defense += crewModifiers.defense;
    const roughness = weatherRoughness(currentWeather(), stats.stormResistance);
    const specialistModifiers = specialistVoyageModifiers(game.specialists);
    const operations = resolveVoyageOperations(game.operations, {
      distance: distance * specialistModifiers.distanceMultiplier,
      days,
      roughness,
      routePlan: routePlan.id,
      stats: {
        ...stats,
        provisionMultiplier: specialistModifiers.provisionMultiplier,
        crewProvisionMultiplier: crewModifiers.provisionMultiplier,
        damageMultiplier: specialistModifiers.damageMultiplier,
        moraleLossMultiplier: specialistModifiers.moraleLossMultiplier,
      },
    });
    game.operations = operations.operations;
    const encounter = resolveHostileEncounter({
      distance,
      risk:
        hostileRiskBetween(game.departedFromPort, currentPort.name) *
        routePlan.hostileRiskMultiplier,
      defense: stats.defense + routePlan.defenseBonus,
      seed: game.day + currentPort.name.length + game.departedFromPort.length,
    });
    if (encounter.encountered) {
      openCombatEncounter(encounter, stats);
    }
    const outcome = resolveVoyageCargo(game.cargoLots, {
      distance,
      roughness:
        roughness / componentEfficiency(game.operations.components.fittings),
      inspectionRisk: 0,
      seed: game.day + currentPort.name.length,
    });
    game.cargoLots = outcome.remaining;
    syncCargoCounts(game, goods);
    if (outcome.lost.length)
      addNews(
        "Cargo damaged at sea",
        `${outcome.lost.length} fragile cargo unit${outcome.lost.length === 1 ? "" : "s"} broke during the voyage.`,
      );
    if (outcome.confiscated.length) {
      const reputationLoss = outcome.counterfeits.length * 6;
      if (reputationLoss)
        changeStanding(currentPort.factions[0].name, -reputationLoss);
      addNews(
        "Customs seizure",
        `${outcome.confiscated.length} illegal cargo unit${outcome.confiscated.length === 1 ? "" : "s"} confiscated at ${currentPort.name}.${reputationLoss ? " Discovered counterfeits damaged your reputation." : ""}`,
      );
      showMessage("CUSTOMS SEIZURE · Illegal goods confiscated.", 4);
    } else if (outcome.lost.length)
      showMessage("ROUGH VOYAGE · Fragile cargo was damaged.", 4);
    const laws = Object.fromEntries(
      Object.keys(goods).map((key) => [key, legalStatusAt(currentPort, key)]),
    );
    const customs = resolveCustoms({
      state: game.legal,
      portName: currentPort.name,
      lots: game.cargoLots,
      day: game.day,
      reputation: game.factionStanding[dominantFaction(currentPort).name] || 0,
      laws,
      seed: `${game.departedFromPort}:${distance}`,
    });
    if (!customs.admitted) {
      addNews("Entry refused at " + currentPort.name, customs.reason);
      showMessage("PORT BAN · Registered trade is unavailable.", 4);
    }
    game.coins = Math.max(0, game.coins - customs.fine - customs.remoteFee);
    if (customs.confiscated.length) {
      const seized = new Set(customs.confiscated.map((lot) => lot.id));
      game.cargoLots = game.cargoLots.filter((lot) => !seized.has(lot.id));
      syncCargoCounts(game, goods);
    }
    if (customs.standingChange)
      changeStanding(dominantFaction(currentPort).name, customs.standingChange);
    if (customs.admitted)
      addNews(
        customs.inspected ? "Customs inspection" : "Customs clearance",
        customs.inspected
          ? `${Math.round(customs.scrutiny * 100)}% scrutiny. ${customs.confiscated.length} units confiscated and ${customs.fine} crowns fined.${customs.forgeryDetected ? " The forged manifest was exposed." : ""}`
          : `The manifest cleared at ${Math.round(customs.scrutiny * 100)}% scrutiny.${customs.remoteFee ? " Cargo moved through a remote anchorage." : ""}`,
      );
    if (operations.shortage)
      addNews(
        "Provisions exhausted",
        `The crew went short by ${operations.shortage} provisions. Morale fell sharply.`,
      );
    if (operations.damage)
      addNews(
        "Voyage wear",
        `The passage consumed ${operations.provisionsUsed} provisions and caused ${operations.damage}% wear.`,
      );
    game.voyageDistance = 0;
    resetVoyageTimeState();
    game.departedFromPort = null;
  }
  const obligations = fulfillObligationsAtPort(
    game.operations,
    currentPort.factions.map((faction) => faction.name),
    game.day,
  );
  game.operations = obligations.operations;
  for (const obligation of obligations.fulfilled) {
    changeStanding(obligation.faction, 4);
    addNews(
      "Faction obligation honored",
      `Your call at ${currentPort.name} satisfied ${obligation.faction}.`,
    );
  }
  resolveContractsAtPort(currentPort);
  document.getElementById("portName").textContent = currentPort.name;
  document.getElementById("portFlavor").textContent = currentPort.flavor;
  renderPortSystems();
  // Each docking opens on the Harbor tab so arrival context — harbor state,
  // current events, and customs standing — is seen before trading.
  activateSectionTabs(document.getElementById("portPanel"), "harbor");
  document.getElementById("portPanel").style.display = "grid";
  updateHud();
}

function openCombatEncounter(encounter, stats) {
  pendingCombat = {
    encounter,
    stats,
    seed: game.day + currentPort.name.length + 31,
  };
  const strengthLabels = [
    "",
    "Light raider",
    "Armed corsair",
    "Heavy boarding ship",
  ];
  document.getElementById("combatDescription").textContent =
    `${strengthLabels[encounter.attackStrength]} shadows your wake outside ${currentPort.name}. The harbor is close, but not close enough for its guns to protect you.`;
  document.getElementById("combatPlayer").textContent =
    `${Math.round(stats.maxSpeed)} speed · ${stats.defense.toFixed(1)} defense · ${Math.round(game.operations.morale)} morale`;
  document.getElementById("combatEnemy").textContent =
    `${strengthLabels[encounter.attackStrength]} · strength ${encounter.attackStrength}/3`;
  renderCombatActions();
  document.getElementById("combatPanel").style.display = "grid";
}

function previewCombatAction(action) {
  return resolveCombatAction({
    action,
    attackStrength: pendingCombat.encounter.attackStrength,
    defense:
      pendingCombat.stats.defense + specialistCombatBonus(game.specialists),
    maxSpeed: pendingCombat.stats.maxSpeed,
    morale: game.operations.morale,
    coins: game.coins,
    seed: pendingCombat.seed,
  });
}

function describeCombatConsequence(action, result) {
  const outcomeLabels = {
    escaped: "Escapes",
    caught: "Caught",
    parleyed: "Pays them off",
    repelled: "Repels boarders",
    boarded: "Boarded",
    surrendered: "Surrenders",
  };
  const parts = [outcomeLabels[result.outcome] ?? result.outcome];
  const damage = Object.entries(result.componentDamage || {})
    .filter(([, amount]) => amount > 0)
    .map(([key, amount]) => `${SHIP_COMPONENTS[key]?.label ?? key} -${amount}`);
  if (damage.length) parts.push(damage.join(", "));
  if (result.moraleChange)
    parts.push(
      `${result.moraleChange > 0 ? "+" : ""}${result.moraleChange} morale`,
    );
  if (result.coinsLost) parts.push(`-${result.coinsLost} crowns`);
  if (action === "surrender") parts.push("Gunner loyalty -8");
  return parts.join("  ·  ");
}

function renderCombatActions() {
  const labels = {
    flee: "Run under full sail",
    parley: "Heave to and parley",
    fight: "Clear the decks",
    surrender: "Strike colors",
  };
  document.querySelectorAll("[data-combat-action]").forEach((button) => {
    const action = button.dataset.combatAction;
    const labelText = document.createElement("span");
    labelText.className = "combat-action-label";
    labelText.textContent = labels[action] ?? button.textContent.trim();
    const consequence = document.createElement("span");
    consequence.className = "combat-consequence";
    consequence.textContent = describeCombatConsequence(
      action,
      previewCombatAction(action),
    );
    button.replaceChildren(labelText, consequence);
  });
}

function resolvePendingHazard(pending, action, stats) {
  if (pending.type === "shoal") {
    return resolveShoalAction({
      action,
      exposure: pending.details.exposure,
      speed: pending.details.speed,
      seamanship: seamanshipBonus(),
    });
  }
  return resolveStormAction({
    action,
    roughness: pending.details.roughness,
    stormResistance: stats.stormResistance,
    seamanship: seamanshipBonus(),
  });
}

// Hazards resolve deterministically from values known when the modal opens, so
// we can preview each option's exact outcome. This mirrors what
// chooseMaritimeHazardAction applies so the caption never misleads.
function describeHazardConsequence(result, hasCargo) {
  const parts = [];
  const damage = Object.entries(result.componentDamage || {})
    .filter(([, amount]) => amount > 0)
    .map(([key, amount]) => `${SHIP_COMPONENTS[key]?.label ?? key} -${amount}`);
  if (damage.length) parts.push(damage.join(", "));
  if (result.moraleChange)
    parts.push(
      `${result.moraleChange > 0 ? "+" : ""}${result.moraleChange} morale`,
    );
  if (result.provisionsUsed) parts.push(`-${result.provisionsUsed} provisions`);
  if (result.daysLost)
    parts.push(
      `${result.daysLost} day${result.daysLost === 1 ? "" : "s"} lost`,
    );
  if (result.speedMultiplier < 1) {
    const lost = Math.round((1 - result.speedMultiplier) * 100);
    parts.push(lost >= 100 ? "ship stalled" : `-${lost}% speed`);
  }
  if (hasCargo && result.cargoLossRisk > 0.2) parts.push("loses 1 cargo lot");
  return parts.length ? parts.join("  ·  ") : "no lasting harm";
}

function openMaritimeHazard(type, details) {
  pendingMaritimeHazard = { type, details };
  const stats = operationalShipStats();
  const actions = document.getElementById("hazardActions");
  actions.innerHTML = "";
  const options =
    type === "shoal"
      ? [
          ["soundings", "Take soundings and creep through"],
          ["back-sails", "Back sails and warp into deep water"],
          ["force", "Keep way on and force the passage"],
        ]
      : [
          ["heave-to", "Heave to"],
          ["seek-lee", "Seek lee"],
          ["run", "Run before it"],
        ];
  document.getElementById("hazardKicker").textContent =
    type === "shoal" ? "Breakers under the bow" : "Heavy weather closes in";
  document.getElementById("hazardTitle").textContent =
    type === "shoal" ? details.name : `${details.name} squall`;
  document.getElementById("hazardDescription").textContent =
    type === "shoal"
      ? "The water pales around the keel and leadsmen call rapidly decreasing depth."
      : "The wind hardens, visibility closes, and steep seas begin breaking over the weather rail.";
  document.getElementById("hazardAssessment").textContent =
    type === "shoal"
      ? `${Math.round(details.exposure * 100)}% bank exposure · ${shipSpeedKnots(details.speed, stats.waterlineLengthFt).toFixed(1)} knots. Slowing down favors careful soundings; forcing the bank risks hull, rudder, and cargo fittings.`
      : `${Math.round(details.roughness * 100)}% sea severity · storm resistance ${stats.stormResistance.toFixed(2)}. Heaving to is safest, shelter costs time and provisions, and running preserves way at greater rigging risk.`;
  const hasCargo = game.cargoLots.length > 0;
  for (const [action, label] of options) {
    const result = resolvePendingHazard(pendingMaritimeHazard, action, stats);
    const wrap = document.createElement("div");
    wrap.className = "hazard-action";
    const button = document.createElement("button");
    button.className =
      "parchment" + (action === "force" || action === "run" ? " danger" : "");
    const labelText = document.createElement("span");
    labelText.className = "hazard-action-label";
    labelText.textContent = label;
    const consequence = document.createElement("span");
    consequence.className = "hazard-consequence";
    consequence.textContent = describeHazardConsequence(result, hasCargo);
    button.append(labelText, consequence);
    button.onclick = () => chooseMaritimeHazardAction(action);
    wrap.append(button);
    actions.append(wrap);
  }
  document.getElementById("hazardPanel").style.display = "grid";
}

function chooseMaritimeHazardAction(action) {
  if (!pendingMaritimeHazard) return;
  const stats = operationalShipStats();
  const result = resolvePendingHazard(pendingMaritimeHazard, action, stats);
  game.operations = applyComponentDamage(
    game.operations,
    result.componentDamage,
  ).operations;
  game.operations.morale = clampNumber(
    game.operations.morale + result.moraleChange,
    0,
    100,
  );
  game.operations.provisions = Math.max(
    0,
    game.operations.provisions - (result.provisionsUsed || 0),
  );
  if (result.daysLost) {
    advanceDays(result.daysLost);
    result.description += ` The maneuver cost ${result.daysLost} day${result.daysLost === 1 ? "" : "s"}.`;
  }
  ship.speed *= result.speedMultiplier;
  if (result.cargoLossRisk > 0.2 && game.cargoLots.length) {
    const lost = game.cargoLots.shift();
    syncCargoCounts(game, goods);
    result.description += ` A ${goods[lost.key].name} cargo lot was lost overboard.`;
  }
  addNews(`Seamanship: ${result.outcome}`, result.description);
  showMessage(`MARITIME HAZARD · ${result.outcome}`, 4.5);
  pendingMaritimeHazard = null;
  document.getElementById("hazardPanel").style.display = "none";
  updateHud();
  saveGameState();
}

function chooseCombatAction(action) {
  if (!pendingCombat) return;
  const result = resolveCombatAction({
    action,
    attackStrength: pendingCombat.encounter.attackStrength,
    defense:
      pendingCombat.stats.defense + specialistCombatBonus(game.specialists),
    maxSpeed: pendingCombat.stats.maxSpeed,
    morale: game.operations.morale,
    coins: game.coins,
    seed: pendingCombat.seed,
  });
  game.operations = applyComponentDamage(
    game.operations,
    result.componentDamage,
  ).operations;
  game.operations.morale = clampNumber(
    game.operations.morale + result.moraleChange,
    0,
    100,
  );
  if (action === "surrender")
    game.specialists = adjustSpecialistLoyalty(game.specialists, "gunner", -8);
  if (result.outcome === "repelled") {
    game.legacyProgress ||= { piratesRepelled: 0 };
    game.legacyProgress.piratesRepelled += 1;
  }
  game.coins -= result.coinsLost;
  addNews(`Sea encounter: ${result.outcome}`, result.description);
  showMessage(`HOSTILE ENCOUNTER · ${result.description}`, 5);
  pendingCombat = null;
  document.getElementById("combatPanel").style.display = "none";
  renderPortSystems();
  updateHud();
  saveGameState();
}
function renderMarket() {
  document.getElementById("portCoins").textContent = game.coins + " crowns";
  document.getElementById("portHold").textContent =
    cargoCount() + "/" + game.holdMax;
  const market = document.getElementById("market");
  market.innerHTML = "";
  const regional = game.regionalEconomy[currentPort.name];
  const available = availableMarketGoods(
    regional,
    productionChains,
    Object.keys(goods),
  );
  Object.keys(goods).forEach((key) => {
    if (!available.has(key)) return;
    const state = economyState(currentPort, key),
      legalStatus = legalStatusAt(currentPort, key),
      law = lawDetails(legalStatus),
      buyQuote = tradeQuote(buyPriceFor(currentPort, key), legalStatus, "buy"),
      baseSellQuote = tradeQuote(
        sellPriceFor(currentPort, key),
        legalStatus,
        "sell",
      ),
      lots = game.cargoLots.filter((lot) => lot.key === key),
      nextLot = lots[0],
      sellQuote = nextLot
        ? Math.max(
            1,
            Math.round(
              baseSellQuote *
                cargoValueMultiplier(nextLot, currentPort.name, goods[key]),
            ),
          )
        : baseSellQuote,
      condition = economyCondition(currentPort, key);
    const tradeAccess = canTrade({
      state: game.legal,
      portName: currentPort.name,
      good: key,
      status: legalStatus,
      day: game.day,
      units: game.cargo[key],
    });
    const row = document.createElement("div");
    row.className = "trade-row";
    const klass =
      condition === "Shortage"
        ? "condition-shortage"
        : condition === "Surplus" || condition === "Glut"
          ? "condition-surplus"
          : "";
    const label = document.createElement("div");
    label.className = "trade-good";
    label.innerHTML =
      `<span class="resource-icon-frame" title="${goods[key].name}">` +
      `<svg class="resource-icon" aria-hidden="true"><use href="#resource-${key}"></use></svg>` +
      "</span>" +
      '<span class="trade-good-details"><b>' +
      goods[key].name +
      '</b><span class="small">Buy ' +
      buyQuote +
      " · Sell " +
      sellQuote +
      " crowns · aboard " +
      game.cargo[key] +
      '</span><span class="market-stock"><span class="market-condition ' +
      klass +
      '">' +
      condition +
      `</span> · <span class="legal-status legal-${legalStatus}">${law.label}</span> · ` +
      Math.floor(state.stock) +
      " units in market</span>" +
      (lots.length
        ? '<span class="cargo-manifest">' +
          lots
            .map((lot, index) => {
              const value = Math.round(
                cargoValueMultiplier(lot, currentPort.name, goods[key]) * 100,
              );
              const condition = cargoCondition(lot, goods[key]);
              return `<span class="cargo-quality quality-${lot.quality} condition-${condition.id}"><b>#${index + 1}</b> ${cargoLotDescription(lot)} · ${value}% market value</span>`;
            })
            .join("") +
          "</span>"
        : "") +
      "</span>";
    const buy = document.createElement("button");
    buy.textContent = "Buy " + buyQuote;
    buy.title = "Buy one for " + buyQuote + " crowns";
    buy.disabled =
      !tradeAccess.ok ||
      game.coins < buyQuote ||
      cargoCount() >= game.holdMax ||
      state.stock < 1;
    buy.onclick = () => {
      const access = canTrade({
        state: game.legal,
        portName: currentPort.name,
        good: key,
        status: legalStatus,
        day: game.day,
        units: game.cargo[key],
      });
      if (!access.ok) return showMessage(access.reason);
      const livePrice = tradeQuote(
        buyPriceFor(currentPort, key),
        legalStatus,
        "buy",
      );
      if (game.coins < livePrice) return showMessage("Not enough crowns.");
      if (cargoCount() >= game.holdMax) return showMessage("The hold is full.");
      if (state.stock < 1)
        return showMessage("The market has no more " + goods[key].name + ".");
      game.coins -= livePrice;
      const lot = createCargoLot({
        key,
        cost: livePrice,
        origin: currentPort.name,
        day: game.day,
        sequence: game.cargoLots.length,
        good: goods[key],
      });
      lot.compartment = bestCargoCompartment(
        lot,
        cargoCapacities(),
        game.cargoLots,
      );
      game.cargoLots.push(lot);
      syncCargoCounts(game, goods);
      state.stock -= 1;
      renderPortSystems();
      updateHud();
    };
    const sell = document.createElement("button");
    sell.textContent = "Sell " + sellQuote;
    sell.title = "Sell one for " + sellQuote + " crowns";
    sell.disabled = game.cargo[key] <= 0 || !tradeAccess.ok;
    sell.onclick = () => {
      if (game.cargo[key] <= 0) return showMessage("None aboard.");
      const lotIndex = game.cargoLots.findIndex((lot) => lot.key === key);
      const lot = game.cargoLots[lotIndex];
      const livePrice = Math.max(
          1,
          Math.round(
            tradeQuote(sellPriceFor(currentPort, key), legalStatus, "sell") *
              cargoValueMultiplier(lot, currentPort.name, goods[key]),
          ),
        ),
        cost = lot.cost ?? goods[key].base;
      game.cargoLots.splice(lotIndex, 1);
      syncCargoCounts(game, goods);
      game.coins += livePrice;
      state.stock += 1;
      const competition = recordPlayerCompetition(game.rivals, {
        port: currentPort.name,
        goodKey: key,
        day: game.day,
      });
      game.rivals = competition.state;
      if (competition.rivalId) {
        const rival = RIVAL_CAPTAINS.find(
          (entry) => entry.id === competition.rivalId,
        );
        addNews(
          `Market contested with ${rival.house}`,
          `Your ${goods[key].name} sale in ${currentPort.name} undercut a recent delivery by ${rival.captain}.`,
        );
      }
      const e = worldEvents.ironShortage;
      if (e.active && currentPort.name === e.port && key === e.good) {
        game.milestone.shortageProfit += Math.max(0, livePrice - cost);
        if (
          game.milestone.shortageProfit >= 50 &&
          !game.milestone.shortageExploited
        ) {
          game.milestone.shortageExploited = true;
          addNews(
            "A timely market coup",
            "Your iron sales into Goldhaven’s emergency earned enough profit to prove the value of a protected route.",
          );
          showMessage(
            "SHORTAGE EXPLOITED · Your iron sales have strengthened the Guild’s petition.",
            4,
          );
        }
      }
      updateMilestoneCompletion();
      renderPortSystems();
      updateHud();
    };
    row.append(label, buy, sell);
    if (
      legalStatus === "licensed" &&
      !tradeAccess.ok &&
      !game.legal.portBans[currentPort.name]
    ) {
      const permit = document.createElement("button");
      permit.textContent = "Permit 35";
      permit.disabled = game.coins < 35;
      permit.onclick = () => {
        const result = buyPermit(
          game.legal,
          currentPort.name,
          key,
          game.day,
          game.coins,
        );
        if (!result.ok) return showMessage(result.reason);
        game.coins = result.coins;
        showMessage(`Permit issued through Day ${result.expiresDay}.`);
        renderPortSystems();
        updateHud();
      };
      row.append(permit);
    }
    market.append(row);
  });
}
function renderLedger() {
  renderMilestone(document.getElementById("milestoneLedger"));
  renderLegacies(document.getElementById("legacyLedger"));
  renderContractList(
    document.getElementById("activeContractsLedger"),
    game.activeContracts,
    true,
  );
  renderDiscoveries();
  const factions = document.getElementById("factionLedger");
  factions.innerHTML = "";
  const standings = Object.entries(game.factionStanding)
    .filter(([, v]) => v !== 0)
    .sort((a, b) => b[1] - a[1]);
  if (!standings.length)
    factions.innerHTML =
      '<p class="empty-note">Complete contracts to build political standing.</p>';
  else
    standings.forEach(([name, value]) => {
      const privilege = factionPrivilege(value);
      const row = document.createElement("div");
      row.className = "standing-row";
      row.innerHTML =
        "<span>" +
        name +
        '<span class="small">' +
        privilege.label +
        " · " +
        privilege.privilege +
        (factionRivals(name).length
          ? " · Rivals: " + factionRivals(name).join(", ")
          : "") +
        "</span></span><b>" +
        value +
        "</b>";
      factions.append(row);
      if (value >= 45 && !game.factionCharter) {
        const charter = document.createElement("button");
        charter.className = "parchment";
        charter.textContent = `Accept ${name} charter`;
        charter.onclick = () => {
          const result = chooseFactionCharter(game, name);
          if (!result.ok) return showMessage(result.reason);
          addNews(
            "Formal charter sworn",
            `You entered the service of ${name}. Its rivals have closed their doors.`,
          );
          renderLedger();
          updateHud();
        };
        factions.append(charter);
      }
    });
  if (game.factionCharter) {
    const charter = document.createElement("div");
    charter.className = "event-banner";
    charter.innerHTML = `<b>Formal charter</b>${game.factionCharter} · rival contracts unavailable`;
    factions.prepend(charter);
  }
  const obligations = game.operations.obligations.filter(
    (item) => !item.fulfilled && !item.failed,
  );
  if (obligations.length) {
    const heading = document.createElement("h4");
    heading.textContent = "Outstanding obligations";
    factions.append(heading);
    for (const obligation of obligations) {
      const row = document.createElement("div");
      row.className = "standing-row";
      row.innerHTML = `<span>Call on ${obligation.faction}</span><b>Day ${obligation.dueDay}</b>`;
      factions.append(row);
    }
  }
  const intel = document.getElementById("intelLedger");
  intel.innerHTML = "";
  if (!game.intelligence.length)
    intel.innerHTML =
      '<p class="empty-note">Buy reports from a port Whisper Network.</p>';
  else
    game.intelligence.forEach((report) => {
      const freshness = intelligenceFreshness(report, game.day),
        expired = freshness.label === "Expired",
        card = document.createElement("div");
      card.className =
        "intel-card intel-known" + (expired ? " intel-expired" : "");
      card.innerHTML =
        '<div class="intel-head"><h4>' +
        report.title +
        '</h4><span class="contract-tag">' +
        freshness.label +
        '</span></div><p class="small">' +
        report.body +
        '</p><div class="intel-meta">Purchased Day ' +
        report.boughtDay +
        " in " +
        report.origin +
        " · source confidence " +
        report.confidence +
        "%</div>";
      intel.append(card);
    });
  const traffic = document.getElementById("merchantLedger");
  traffic.innerHTML = "";
  const sightings = Object.values(game.merchantSightings).sort(
    (a, b) => b.day - a.day,
  );
  if (!sightings.length)
    traffic.innerHTML =
      '<p class="empty-note">No merchant vessels have been identified yet. Sail close enough to sight them or buy a shipping list.</p>';
  else
    sightings.forEach((s) => {
      const rival = RIVAL_CAPTAINS.find((entry) => entry.id === s.rivalId);
      const standing = rival ? game.rivals.captains[rival.id] : null;
      const row = document.createElement("div");
      row.className = "merchant-sighting";
      row.innerHTML =
        "<span><b>" +
        s.name +
        '</b><br><span class="small">' +
        (rival
          ? `${rival.captain} · ${rival.house} · ${rivalRelationshipLabel(standing.relationship)}<br>`
          : "") +
        s.origin +
        " → " +
        s.destination +
        " · " +
        s.cargoUnits +
        " " +
        goods[s.cargoKey].name +
        '</span></span><span class="contract-tag">Day ' +
        s.day +
        "</span>";
      traffic.append(row);
    });
  const news = document.getElementById("newsLedger");
  news.innerHTML = "";
  if (!game.news.length)
    news.innerHTML = '<p class="empty-note">No major port news yet.</p>';
  else
    game.news.forEach((item) => {
      const card = document.createElement("div");
      card.className = "news-card";
      card.innerHTML =
        "<h4>Day " +
        item.day +
        " · " +
        item.title +
        "</h4><p>" +
        item.body +
        "</p>";
      news.append(card);
    });
}
function renderShipPanel() {
  const stats = operationalShipStats();
  const identity = calculateShipIdentity(game.shipUpgrades);
  const activeClass = SHIP_CLASSES[game.shipUpgrades.activeClass];
  const ops = game.operations;

  document.getElementById("shipRegisterName").textContent =
    activeClass.vesselName;
  document.getElementById("shipRegisterDescription").textContent =
    activeClass.name + " — " + activeClass.description;

  document.getElementById("shipRegisterStats").innerHTML =
    "<strong>Fitting identity: " +
    identity.name +
    "</strong><span>" +
    identity.description +
    "</span><span>" +
    stats.holdMax +
    " hold · " +
    shipSpeedKnots(stats.maxSpeed, stats.waterlineLengthFt).toFixed(1) +
    " knots · " +
    stats.turnRate.toFixed(2) +
    " turning · " +
    currentVisibilityKm().toFixed(1) +
    " km sight · defense " +
    (stats.defense + crewVoyageModifiers(ops.crew).defense).toFixed(1) +
    "</span>";

  const fittings = document.getElementById("shipRegisterFittings");
  fittings.innerHTML = "<h4>Fitted gear</h4>";
  const gearList = document.createElement("div");
  gearList.className = "fitted-gear-list";
  for (const slot of UPGRADE_SLOTS) {
    const equippedId = game.shipUpgrades.equipped[slot.id];
    const upgrade =
      SHIP_UPGRADES[slot.id].find((item) => item.id === equippedId) || null;
    const row = document.createElement("div");
    row.className = "fitted-gear-row";
    row.innerHTML =
      '<span class="fitted-gear-slot">' +
      slot.name +
      "</span>" +
      '<span class="fitted-gear-name">' +
      (upgrade ? upgrade.name : "—") +
      "</span>" +
      '<span class="fitted-gear-stats">' +
      (upgrade ? upgradeEffects(upgrade) : "Nothing fitted") +
      "</span>";
    gearList.append(row);
  }
  fittings.append(gearList);

  document.getElementById("shipRegisterCrew").innerHTML =
    ops.provisions +
    "/30 provisions · " +
    Math.round(ops.condition) +
    "% overall condition · " +
    Math.round(ops.morale) +
    " morale · wages Day " +
    ops.wagesDueDay +
    (ops.wageArrears ? " · " + ops.wageArrears + " crowns in arrears" : "");

  document.getElementById("shipRegisterCrewGroups").innerHTML = Object.entries(
    ops.crew.groups,
  )
    .map(
      ([role, group]) =>
        `<article class="crew-card"><header><b>${CREW_ROLES[role].label}</b><strong>${group.count}</strong></header><span>${Math.round(group.experience)} experience · ${Math.round(group.fatigue)} fatigue</span><span>${group.injuries} injured · ${Math.round(group.loyalty)} loyalty</span><p>${CREW_ROLES[role].description}</p></article>`,
    )
    .join("");

  document.getElementById("shipRegisterComponents").innerHTML = Object.entries(
    SHIP_COMPONENTS,
  )
    .map(
      ([key, component]) =>
        '<div class="component-condition ' +
        (ops.components[key] < 40 ? "critical" : "") +
        '"><span>' +
        component.label +
        "</span><b>" +
        Math.round(ops.components[key]) +
        "%</b></div>",
    )
    .join("");

  const specialistState = new Map(
    game.specialists.officers.map((officer) => [officer.id, officer]),
  );
  document.getElementById("shipRegisterSpecialists").innerHTML =
    SPECIALIST_ROSTER.map((definition) => {
      const officer = specialistState.get(definition.id);
      return `<article class="specialist-card"><header><span class="specialist-emblem">${definition.emblem}</span><span><h4>${definition.name}</h4><span class="small">${definition.role} · ${definition.origin}</span></span><b>${Math.round(officer.loyalty)} ♥</b></header><p><b>Benefit:</b> ${definition.benefit}</p><p><b>Flaw:</b> ${definition.flaw}</p><p class="small"><b>Ambition:</b> ${definition.ambition}<br><b>Ties:</b> ${definition.relationship} · ${officer.events} event${officer.events === 1 ? "" : "s"}</p></article>`;
    }).join("");

  const obligationsRoot = document.getElementById("shipRegisterObligations");
  const obligations = ops.obligations.filter(
    (item) => !item.fulfilled && !item.failed,
  );
  obligationsRoot.innerHTML = "";
  if (obligations.length) {
    const heading = document.createElement("h4");
    heading.textContent = "Outstanding obligations";
    obligationsRoot.append(heading);
    for (const obligation of obligations) {
      const row = document.createElement("div");
      row.className = "standing-row";
      row.innerHTML =
        "<span>Call on " +
        obligation.faction +
        "</span><b>Day " +
        obligation.dueDay +
        "</b>";
      obligationsRoot.append(row);
    }
  }

  const cargoRoot = document.getElementById("shipRegisterCargo");
  cargoRoot.innerHTML = "";
  const capacities = cargoCapacities();
  const aboard = cargoCount();
  const sealed = contractCargoCount();
  const summary = document.createElement("div");
  summary.className = "ship-stats";
  summary.innerHTML =
    "<strong>" +
    aboard +
    "/" +
    game.holdMax +
    " hold</strong>" +
    (sealed
      ? "<span>" +
        sealed +
        " unit" +
        (sealed === 1 ? "" : "s") +
        " sealed as contract cargo.</span>"
      : "");
  cargoRoot.append(summary);

  if (game.cargoLots.length) {
    const used = {};
    for (const lot of game.cargoLots)
      used[lot.compartment] = (used[lot.compartment] || 0) + 1;
    for (const [key, compartment] of Object.entries(CARGO_COMPARTMENTS)) {
      if (!used[key]) continue;
      const section = document.createElement("section");
      section.className = "cargo-compartment";
      section.innerHTML =
        '<div class="cargo-compartment-head"><b>' +
        compartment.label +
        "</b><span>" +
        used[key] +
        "/" +
        capacities[key] +
        "</span></div>";
      for (const lot of game.cargoLots.filter(
        (item) => item.compartment === key,
      )) {
        const row = document.createElement("div");
        row.className = "cargo-lot-row";
        row.innerHTML =
          "<b>" +
          goods[lot.key].name +
          '</b><span class="small">' +
          cargoLotDescription(lot) +
          "</span>";
        section.append(row);
      }
      cargoRoot.append(section);
    }
  } else {
    const empty = document.createElement("p");
    empty.className = "empty-note";
    empty.textContent = "The hold is empty.";
    cargoRoot.append(empty);
  }
}

function activeRumorLeads() {
  return game.discoveries.rumorLeads.filter(
    (lead) =>
      !lead.resolvedDay && !lead.expiredDay && game.day <= lead.expiresDay,
  );
}
function hasRumorSpecialist() {
  return game.specialists.officers.some(
    (officer) =>
      ["navigator", "naturalist"].includes(officer.id) && officer.loyalty >= 45,
  );
}
function rumorTargetsForPort(port) {
  const localFactions = port.factions.map((faction) => faction.name);
  const known = new Set([
    ...Object.keys(game.discoveries.found),
    ...Object.keys(game.exploration.sites),
    ...game.discoveries.rumorLeads
      .filter((lead) => !lead.resolvedDay && !lead.expiredDay)
      .map((lead) => lead.targetId),
  ]);
  const candidates = [
    ...discoverySites.filter((site) => !known.has(site.id)),
    ...explorationSites.filter((site) => !known.has(site.id)),
  ];
  const factional = candidates.filter((target) =>
    targetMatchesFaction(target, localFactions),
  );
  return factional.length ? factional : candidates;
}
function buyRumorLead() {
  if (!currentPort) return;
  if (game.coins < RUMOR_COST)
    return showMessage("You cannot afford tavern rumors.");
  const targets = rumorTargetsForPort(currentPort);
  if (!targets.length) return showMessage("No fresh rumors circulate here.");
  const target = targets[game.day % targets.length];
  const lead = createRumorLead({
    port: currentPort,
    target,
    day: game.day,
    worldWidth: WORLD.w,
    factionRelated: targetMatchesFaction(
      target,
      currentPort.factions.map((f) => f.name),
    ),
    specialistBonus: hasRumorSpecialist(),
    falseLead: game.day % 9 === 0,
  });
  game.coins -= RUMOR_COST;
  game.discoveries.rumorLeads.unshift(lead);
  addNews(
    "Rumor purchased",
    `${currentPort.name} whispers point ${lead.clue} The search circle has been marked on your chart through Day ${lead.expiresDay}.`,
  );
  showMessage(`RUMOR LEAD · ${lead.clue}`, 4);
  renderPortSystems();
  updateHud();
  saveGameState();
}
function resolveRumorLead(lead) {
  lead.resolvedDay = game.day;
  if (lead.falseLead) {
    addNews("False rumor", `${lead.clue} led only to empty water.`);
    showMessage("FALSE RUMOR · the clue found only empty water", 3.5);
    return;
  }
  if (lead.targetKind === "expedition") {
    const site = explorationSites.find((entry) => entry.id === lead.targetId);
    if (site) {
      revealExplorationSurvey(site, false);
      addNews(
        "Expedition lead confirmed",
        `${site.name} has been sketched onto your chart. Sail there slowly to launch an expedition.`,
      );
      showMessage(`EXPEDITION LEAD · ${site.name} marked`, 4);
    }
    return;
  }
  const site = discoverySites.find((entry) => entry.id === lead.targetId);
  if (site) claimDiscovery(site);
}
function checkRumorLeads() {
  for (const lead of expireRumorLeads(game.discoveries.rumorLeads, game.day))
    addNews("Rumor expired", `${lead.clue} is no longer considered reliable.`);
  for (const lead of activeRumorLeads()) {
    const distance = wrappedDistance(ship.x, ship.y, lead.x, lead.y);
    if (distance <= lead.radius) resolveRumorLead(lead);
  }
}

function renderDiscoveries() {
  const root = document.getElementById("discoveryLedger");
  root.innerHTML = "";
  const records = Object.values(game.discoveries.found).sort(
    (a, b) => b.foundDay - a.foundDay,
  );
  const visibleLeads = game.discoveries.rumorLeads.some(
    (lead) => !lead.resolvedDay,
  );
  if (!records.length && !visibleLeads) {
    root.innerHTML =
      '<p class="empty-note">No hidden places recorded. Sail beyond familiar coasts and investigate close sightings.</p>';
    return;
  }
  const leads = game.discoveries.rumorLeads
    .filter((lead) => !lead.resolvedDay)
    .slice(0, 8);
  for (const lead of leads) {
    const card = document.createElement("div");
    card.className = "discovery-card rumor-card";
    const status = lead.expiredDay
      ? `Expired Day ${lead.expiredDay}`
      : `Search by Day ${lead.expiresDay}`;
    card.innerHTML =
      `<div class="intel-head"><h4>🗺 ${lead.title || "Rumor lead"}</h4><span class="contract-tag">${status}</span></div>` +
      `<div class="town-kicker">${lead.source} · ${lead.origin}${lead.interpreted ? " · interpreted" : ""}</div>` +
      `<p class="small">“${lead.clue}”</p><p><b>Search zone:</b> broad circle on the chart, radius ${Math.round(lead.radius)} leagues.</p>`;
    root.append(card);
  }
  for (const record of records) {
    const site = discoverySites.find((entry) => entry.id === record.id);
    if (!site) continue;
    const card = document.createElement("div");
    card.className = "discovery-card";
    const season = site.season
      ? '<span class="contract-tag">' +
        (seasonalSiteActive(site, game.day) ? "In season" : "Out of season") +
        "</span>"
      : "";
    card.innerHTML =
      '<div class="intel-head"><h4>' +
      site.icon +
      " " +
      site.name +
      "</h4>" +
      season +
      '</div><div class="town-kicker">' +
      site.type +
      " · found Day " +
      record.foundDay +
      '</div><p class="small">' +
      site.description +
      "</p><p><b>Consequence:</b> " +
      site.benefit +
      "</p>";
    if (record.disposition) {
      const status = document.createElement("div");
      status.className = "discovery-status";
      status.textContent =
        DISCOVERY_DISPOSITIONS[record.disposition].label +
        " · resolved Day " +
        record.resolvedDay;
      card.append(status);
    } else {
      const actions = document.createElement("div");
      actions.className = "discovery-actions";
      for (const disposition of ["secret", "sell", "share"]) {
        const button = document.createElement("button");
        button.className = "mini-action";
        button.textContent =
          disposition === "sell"
            ? "Sell · " + site.saleValue + " crowns"
            : disposition === "share"
              ? "Share · +" + site.standingValue + " standing"
              : "Keep secret";
        button.addEventListener("click", () =>
          handleDiscoveryDisposition(site.id, disposition),
        );
        actions.append(button);
      }
      card.append(actions);
    }
    root.append(card);
  }
}
function handleDiscoveryDisposition(id, disposition) {
  const result = resolveDiscovery(
    game.discoveries,
    discoverySites,
    id,
    disposition,
    game.day,
  );
  if (!result.ok) {
    showMessage(result.reason);
    return;
  }
  game.coins += result.consequence.coins;
  if (result.consequence.standing)
    changeStanding(
      result.consequence.standing.faction,
      result.consequence.standing.amount,
    );
  let outcome;
  if (disposition === "secret") {
    outcome = "The coordinates remain in your private log.";
  } else if (result.consequence.route) {
    const route = result.consequence.route;
    const perDay = Math.round(route.units);
    outcome = `A trade route has opened: about ${perDay} unit${perDay === 1 ? "" : "s"} of ${goods[route.good]?.name || route.good} per day will move from ${route.origin} to ${route.destination}, beginning Day ${route.maturesDay}.`;
  } else {
    outcome = "The information is now public.";
  }
  addNews("Fate of " + result.site.name, outcome);
  showMessage(
    result.site.name +
      " · " +
      DISCOVERY_DISPOSITIONS[disposition].label +
      (result.consequence.coins
        ? " · +" + result.consequence.coins + " crowns"
        : ""),
    3.5,
  );
  updateHud();
  renderLedger();
  saveGameState();
}
function claimDiscovery(site) {
  if (!site || game.discoveries.found[site.id]) return;
  const record = recordDiscovery(game.discoveries, site.id, game.day);
  let recovery = "";
  const sample = discoverySample(site);
  if (sample) {
    const grant = grantCargo(
      game,
      sample.good,
      sample.units,
      goods,
      cargoCapacities(),
      { origin: site.name, day: game.day },
    );
    record.recovered = { good: sample.good, units: grant.granted };
    if (grant.granted > 0)
      recovery = `Recovered ${grant.granted} ${goods[sample.good].name}`;
  }
  addNews(
    "Discovery: " + site.name,
    `${site.description}${recovery ? ` ${recovery}.` : ""} Decide in the Captain’s Ledger whether to keep, sell, or share it.`,
  );
  showMessage(
    `DISCOVERY · ${site.name}${recovery ? ` · ${recovery}` : ""}`,
    4.5,
  );
  updateHud();
  saveGameState();
  openDiscoveryDetails(site);
}
function openDiscoveryDetails(site) {
  if (!site) return;
  renderDiscoveryPanel(site.id);
  document.getElementById("discoveryPanel").style.display = "grid";
}
function closeDiscoveryDetails() {
  document.getElementById("discoveryPanel").style.display = "none";
}
function renderDiscoveryPanel(id) {
  const site = discoverySites.find((entry) => entry.id === id);
  const record = game.discoveries.found[id];
  if (!site || !record) {
    closeDiscoveryDetails();
    return;
  }
  document.getElementById("discoveryType").textContent = site.type;
  document.getElementById("discoveryName").textContent =
    site.icon + " " + site.name;
  document.getElementById("discoveryDescription").textContent =
    site.description;
  document.getElementById("discoveryBenefit").textContent = site.benefit;
  const meta = document.getElementById("discoveryMeta");
  meta.innerHTML = "";
  const metaRows = [
    ["Found", "Day " + record.foundDay],
    ["Recorded by", site.faction],
    ["Chart value", site.saleValue + " crowns"],
    ["Standing", "+" + site.standingValue + " if shared"],
  ];
  if (record.recovered) {
    const name = goods[record.recovered.good]?.name || record.recovered.good;
    metaRows.splice(1, 0, [
      "Recovered",
      record.recovered.units > 0
        ? `${record.recovered.units} ${name} in the hold`
        : `Hold full — ${name} left behind`,
    ]);
  }
  if (site.season)
    metaRows.push([
      "Season",
      seasonalSiteActive(site, game.day) ? "In season" : "Out of season",
    ]);
  if (site.route) {
    const perDay = Math.round(site.route.units);
    metaRows.push([
      "Opens route",
      `${goods[site.route.good]?.name || site.route.good}, ~${perDay}/day: ${site.route.origin} → ${site.route.destination}`,
    ]);
  }
  for (const [label, value] of metaRows) {
    const item = document.createElement("div");
    item.className = "summary-item";
    item.innerHTML = "<b>" + label + "</b><span>" + value + "</span>";
    meta.append(item);
  }
  const dispositionRoot = document.getElementById("discoveryDisposition");
  dispositionRoot.innerHTML = "";
  if (record.disposition) {
    const status = document.createElement("div");
    status.className = "discovery-status";
    status.textContent =
      DISCOVERY_DISPOSITIONS[record.disposition].label +
      " · resolved Day " +
      record.resolvedDay;
    dispositionRoot.append(status);
  } else {
    const actions = document.createElement("div");
    actions.className = "discovery-actions";
    for (const disposition of ["secret", "sell", "share"]) {
      const button = document.createElement("button");
      button.className = "parchment";
      button.textContent =
        disposition === "sell"
          ? "Sell · " + site.saleValue + " crowns"
          : disposition === "share"
            ? "Share · +" + site.standingValue + " standing"
            : "Keep secret";
      button.addEventListener("click", () => {
        handleDiscoveryDisposition(id, disposition);
        renderDiscoveryPanel(id);
      });
      actions.append(button);
    }
    dispositionRoot.append(actions);
  }
}
function openExploration() {
  if (!nearExplorationSite) return;
  ship.anchored = true;
  ship.speed = 0;
  const site = nearExplorationSite;
  document.getElementById("explorationName").textContent = site.name;
  document.getElementById("explorationObjective").textContent = site.objective;
  document.getElementById("explorationHazards").textContent =
    "Hazards: " + site.hazards;
  const progress = game.exploration.sites[site.id];
  document.getElementById("explorationStatus").textContent = progress
    ? `${progress.status} · ${progress.visits} previous expedition${progress.visits === 1 ? "" : "s"}`
    : "This coast has not been surveyed. A successful expedition reveals this landmass on your chart.";
  const options = document.getElementById("explorationApproaches");
  options.innerHTML = "";
  if (progress) {
    const unavailable = document.createElement("p");
    unavailable.className = "small";
    unavailable.textContent =
      "This shore expedition has already sailed and cannot be repeated.";
    options.append(unavailable);
    document.getElementById("explorationPanel").style.display = "grid";
    return;
  }
  for (const [approach, plan] of Object.entries(EXPLORATION_APPROACHES)) {
    const button = document.createElement("button");
    button.className = "parchment expedition-option";
    const provisionShortage = Math.max(
      0,
      plan.provisions - game.operations.provisions,
    );
    button.disabled = provisionShortage > 0;
    if (button.disabled) {
      button.setAttribute(
        "aria-label",
        `${plan.label} unavailable; need ${provisionShortage} more provisions`,
      );
      button.title = `Need ${provisionShortage} more provisions`;
    }
    button.innerHTML =
      `<b>${plan.label}</b><span>${plan.days} day${plan.days === 1 ? "" : "s"}</span>` +
      `<span class="small">${plan.provisions} provisions${provisionShortage ? ` · need ${provisionShortage} more` : ""} · ${Math.round(plan.rewardScale * 100)}% reward potential</span>`;
    button.addEventListener("click", () => undertakeExpedition(site, approach));
    options.append(button);
  }
  document.getElementById("explorationPanel").style.display = "grid";
}

function explorationHazardContext() {
  const weather = currentWeather();
  const stats = operationalShipStats();
  const equipped = game.shipUpgrades.equipped || {};
  const naturalist = specialistPower(game.specialists, "naturalist") * 10;
  return {
    hasSoundingGear:
      equipped.navigation === "brass-sextant" ||
      equipped.navigation === "tall-mast" ||
      game.shipUpgrades.activeClass === "barque" ||
      calculateShipIdentity(game.shipUpgrades).id === "explorer",
    hullCondition: game.operations.components.hull,
    visibilityKm: currentVisibilityKm(),
    weatherRoughness: weatherRoughness(weather, stats.stormResistance),
    hasClimberOrGuide: specialistPower(game.specialists, "navigator") >= 0.85,
    hasScholar: specialistPower(game.specialists, "naturalist") >= 0.85,
    hazardSpecialistBonus: naturalist,
  };
}

function undertakeExpedition(site, approach) {
  const result = resolveExpedition({
    state: game.exploration,
    site,
    approach,
    day: game.day,
    provisions: game.operations.provisions,
    morale: game.operations.morale,
    specialistBonus: specialistExplorationBonus(game.specialists),
    hazardContext: explorationHazardContext(),
  });
  if (!result.ok) {
    showMessage(result.reason);
    return;
  }
  game.operations.provisions = Math.max(
    0,
    game.operations.provisions - result.provisionsUsed,
  );
  const hazardDamage = result.record.hazard?.damage || {};
  const damageResult = applyComponentDamage(game.operations, hazardDamage);
  game.operations = damageResult.operations;
  advanceDays(result.days);
  game.operations.morale = clamp(
    game.operations.morale + result.moraleChange,
    0,
    100,
  );
  game.coins += result.record.reward;
  const discovery = discoverySites.find(
    (entry) => entry.id === result.discoveryId,
  );
  let recovery = "";
  if (discovery && !game.discoveries.found[discovery.id]) {
    const record = recordDiscovery(game.discoveries, discovery.id, game.day);
    if (result.record.success) {
      const sample = discoverySample(discovery);
      if (sample) {
        const grant = grantCargo(
          game,
          sample.good,
          sample.units,
          goods,
          cargoCapacities(),
          { origin: discovery.name, day: game.day },
        );
        record.recovered = { good: sample.good, units: grant.granted };
        if (grant.granted > 0)
          recovery = `, plus ${grant.granted} ${goods[sample.good].name} for the hold`;
      }
    }
  }
  revealExplorationSurvey(site, result.record.success);
  const hazardSummary = result.record.hazard?.notes?.length
    ? ` Hazard: ${result.record.hazard.notes.join(" ")}`
    : "";
  const damageSummary = Object.entries(damageResult.applied)
    .filter(([, amount]) => amount > 0)
    .map(
      ([component, amount]) =>
        `${amount} ${SHIP_COMPONENTS[component].label.toLowerCase()}`,
    )
    .join(", ");
  const damageText = damageSummary ? ` Ship damage: ${damageSummary}.` : "";
  const outcome = result.record.success
    ? `${site.name} was surveyed${result.record.exceptional ? " with exceptional results" : ""}. The landmass is now inked on your chart, and ${result.record.reward} crowns of specimens and salvage were recovered${recovery}.${hazardSummary}${damageText}`
    : `The expedition returned without completing its objective, but the landing area was added to your chart. ${result.record.injuries} crew members were injured.${hazardSummary}${damageText}`;
  addNews("Shore expedition: " + site.name, outcome);
  showMessage(
    result.record.success
      ? `EXPEDITION SUCCESS · ${site.name} charted · +${result.record.reward} crowns`
      : `EXPEDITION FAILED · landing area charted`,
    4.5,
  );
  document.getElementById("explorationPanel").style.display = "none";
  updateHud();
  saveGameState();
}

ui.dock.addEventListener("click", openPort);
ui.town.addEventListener("click", () => openTownDetails(nearPort));
ui.explore.addEventListener("click", openExploration);
document
  .getElementById("closeExploration")
  .addEventListener(
    "click",
    () => (document.getElementById("explorationPanel").style.display = "none"),
  );
document
  .getElementById("explorationPanel")
  .addEventListener("click", (event) => {
    if (event.target === document.getElementById("explorationPanel"))
      document.getElementById("explorationPanel").style.display = "none";
  });
document
  .getElementById("closeTown")
  .addEventListener("click", closeTownDetails);
document
  .getElementById("closeVessel")
  .addEventListener("click", closeVesselDetails);
document.getElementById("vesselPanel").addEventListener("click", (e) => {
  if (e.target === document.getElementById("vesselPanel")) closeVesselDetails();
});
document
  .getElementById("closeDiscovery")
  .addEventListener("click", closeDiscoveryDetails);
document.getElementById("discoveryPanel").addEventListener("click", (e) => {
  if (e.target === document.getElementById("discoveryPanel"))
    closeDiscoveryDetails();
});
document
  .getElementById("closeReport")
  .addEventListener(
    "click",
    () => (document.getElementById("reportPanel").style.display = "none"),
  );
document.getElementById("reportPanel").addEventListener("click", (e) => {
  if (e.target === document.getElementById("reportPanel"))
    document.getElementById("reportPanel").style.display = "none";
});
document.getElementById("combatPanel").addEventListener("click", (event) => {
  const button = event.target.closest("[data-combat-action]");
  if (button) chooseCombatAction(button.dataset.combatAction);
});
document.getElementById("reportLedger").addEventListener("click", () => {
  document.getElementById("reportPanel").style.display = "none";
  renderLedger();
  activateSectionTabs(document.getElementById("ledgerPanel"), "milestone");
  document.getElementById("ledgerPanel").style.display = "grid";
});
document.getElementById("townDockButton").addEventListener("click", () => {
  const port = selectedTown;
  document.getElementById("townPanel").style.display = "none";
  selectedTown = null;
  minimapWrap.style.display = "none";
  if (port && nearPort === port) openPort();
});
document.getElementById("townCourseButton").addEventListener("click", () => {
  if (!selectedTown) return;
  const destination = selectedTown.name;
  if (game.navigation.destination === destination) {
    clearCourse(game.navigation);
    showMessage(`Course for ${destination} cleared.`);
  } else {
    plotCourse(
      game.navigation,
      destination,
      ports.map((port) => port.name),
    );
    showMessage(`Course plotted for ${destination}.`);
  }
  closeTownDetails();
  minimapWrap.style.display = "none";
  updateHud();
  saveGameState();
});
document.getElementById("closePort").addEventListener("click", () => {
  const leaving = currentPort;
  document.getElementById("portPanel").style.display = "none";
  currentPort = null;
  ship.anchored = true;
  game.departedFromPort = leaving ? leaving.name : null;
  game.voyageDistance = 0;
  resetVoyageTimeState();
  revealCurrentView(true);
  showMessage(
    "At anchor. Drag the wheel toward open water when you are ready to cast off.",
    3,
  );
});

// Section tabs shared by the dock, town, ship, and ledger panels. Each panel
// owns its own .port-tabs bar and .port-panel sections, so activation is scoped
// to the panel that contains the clicked tab — they never interfere.
// Re-rendering a section's inner content (renderPortSystems / openTownDetails /
// renderLedger) never rebuilds this tab structure, so the active section
// persists across buys and other actions; only opening a panel resets to its
// first tab.
function activateSectionTabs(root, name) {
  if (!root) return;
  root
    .querySelectorAll(".port-tab")
    .forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === name));
  root
    .querySelectorAll(".port-panel")
    .forEach((panel) =>
      panel.classList.toggle("active", panel.dataset.tab === name),
    );
  const body = root.querySelector(".port-body");
  if (body) body.scrollTop = 0;
}
document.querySelectorAll(".port-tabs").forEach((bar) => {
  const root = bar.closest("#portPanel, #townPanel, #shipPanel, #ledgerPanel");
  bar.addEventListener("click", (event) => {
    const btn = event.target.closest(".port-tab");
    if (btn) activateSectionTabs(root, btn.dataset.tab);
  });
});
const ledgerButton = document.getElementById("ledgerButton"),
  ledgerPanel = document.getElementById("ledgerPanel");
ledgerButton.addEventListener("click", () => {
  renderLedger();
  activateSectionTabs(ledgerPanel, "milestone");
  ledgerPanel.style.display = "grid";
});
document
  .getElementById("closeLedger")
  .addEventListener("click", () => (ledgerPanel.style.display = "none"));
ledgerPanel.addEventListener("click", (e) => {
  if (e.target === ledgerPanel) ledgerPanel.style.display = "none";
});

const shipButton = document.getElementById("shipButton"),
  shipPanel = document.getElementById("shipPanel");
shipButton.addEventListener("click", () => {
  renderShipPanel();
  activateSectionTabs(shipPanel, "vessel");
  shipPanel.style.display = "grid";
});
document
  .getElementById("closeShip")
  .addEventListener("click", () => (shipPanel.style.display = "none"));
shipPanel.addEventListener("click", (e) => {
  if (e.target === shipPanel) shipPanel.style.display = "none";
});

const menuButton = document.getElementById("menuButton"),
  menuPanel = document.getElementById("menuPanel");
menuButton.addEventListener("click", () => {
  menuPanel.style.display = "grid";
});
document
  .getElementById("closeMenu")
  .addEventListener("click", () => (menuPanel.style.display = "none"));
menuPanel.addEventListener("click", (e) => {
  if (e.target === menuPanel) menuPanel.style.display = "none";
});
document.getElementById("newGameButton").addEventListener("click", () => {
  if (confirm("Begin a new voyage? Your current progress will be lost.")) {
    suppressSaving = true;
    gameStarted = false;
    localStorage.removeItem(SAVE_KEY);
    localStorage.setItem(MAP_SEED_KEY, createDistinctMapSeed(mapSeed));
    location.reload();
  }
});
document.getElementById("saveGameButton").addEventListener("click", () => {
  saveGameState();
  showMessage("Voyage progress saved.");
  menuPanel.style.display = "none";
});
document.getElementById("loadGameButton").addEventListener("click", () => {
  if (loadGameState()) {
    updateHud();
    if (gameStarted) {
      prepareRestoredVoyageStartup();
      intro.style.display = "grid";
    }
    menuPanel.style.display = "none";
  }
});
function renderChart() {
  buildVisibilityPolygon(true);
  const c = minimapCtx,
    w = minimap.width,
    h = minimap.height,
    sx = w / WORLD.w,
    sy = h / WORLD.h;
  c.globalCompositeOperation = "source-over";
  c.clearRect(0, 0, w, h);
  c.drawImage(mapLayer, 0, 0, w, h);
  const f = minimapFogCtx;
  f.clearRect(0, 0, w, h);
  f.fillStyle = "rgba(23,20,16,.92)";
  f.fillRect(0, 0, w, h);
  f.globalCompositeOperation = "destination-out";
  f.globalAlpha = 0.48;
  f.drawImage(exploredMask, 0, 0, w, h);
  f.globalAlpha = 1;
  punchCurrentVisibility(f, sx, sy, true);
  f.globalCompositeOperation = "source-over";
  c.drawImage(minimapFog, 0, 0);
  if (game.laws.amberConvoy) {
    c.strokeStyle = "rgba(190,132,45,.95)";
    c.lineWidth = 3;
    c.setLineDash([9, 6]);
    c.beginPath();
    c.moveTo(650 * sx, 485 * sy);
    c.bezierCurveTo(
      850 * sx,
      570 * sy,
      1070 * sx,
      780 * sy,
      1190 * sx,
      1050 * sy,
    );
    c.lineTo(1450 * sx, 1185 * sy);
    c.stroke();
    c.setLineDash([]);
  }
  for (const contract of game.activeContracts) {
    const p = getPortByName(contract.destination);
    if (p) {
      c.strokeStyle = "#d5a13d";
      c.lineWidth = 3;
      c.beginPath();
      c.arc(p.x * sx, p.y * sy, 12, 0, Math.PI * 2);
      c.stroke();
    }
  }
  const objective = currentObjective({
    game,
    currentPortName: currentPort?.name || null,
    nearPortName: nearPort?.name || null,
    homePortName: HOME_PORT.name,
  });
  if (objective.destination) {
    const p = getPortByName(objective.destination);
    if (p) {
      c.strokeStyle = "#75c978";
      c.lineWidth = 4;
      c.beginPath();
      c.arc(p.x * sx, p.y * sy, 19, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = "#fff0c5";
      c.font = "bold 14px Georgia";
      c.textAlign = "center";
      c.fillText(objective.title, p.x * sx, p.y * sy - 25);
    }
  }
  for (const lead of activeRumorLeads()) {
    c.strokeStyle = lead.falseLead
      ? "rgba(180,92,70,.75)"
      : "rgba(244,218,157,.85)";
    c.fillStyle = "rgba(244,218,157,.12)";
    c.lineWidth = 2;
    c.setLineDash([6, 6]);
    for (const offset of [-WORLD.w, 0, WORLD.w]) {
      c.beginPath();
      c.arc(
        (lead.x + offset) * sx,
        lead.y * sy,
        lead.radius * sx,
        0,
        Math.PI * 2,
      );
      c.fill();
      c.stroke();
    }
    c.setLineDash([]);
  }
  const courseDestination = getPortByName(game.navigation.destination);
  if (courseDestination) {
    const bearing = courseBearing(ship, courseDestination, WORLD.w);
    c.strokeStyle = "#66c8b5";
    c.lineWidth = 3;
    c.setLineDash([9, 6]);
    for (const offset of [-WORLD.w, 0, WORLD.w]) {
      c.beginPath();
      c.moveTo((wrapX(ship.x) + offset) * sx, ship.y * sy);
      c.lineTo((bearing.destinationX + offset) * sx, courseDestination.y * sy);
      c.stroke();
    }
    c.setLineDash([]);
    c.beginPath();
    c.arc(
      courseDestination.x * sx,
      courseDestination.y * sy,
      23,
      0,
      Math.PI * 2,
    );
    c.stroke();
  }
  for (const site of explorationSites) {
    const progress = game.exploration.sites[site.id];
    if (!progress && !isWorldPointExplored(site.x, site.y)) continue;
    c.strokeStyle = progress?.status === "surveyed" ? "#7bcda0" : "#f4da9d";
    c.fillStyle = progress ? "rgba(52,72,46,.88)" : "rgba(62,45,25,.82)";
    c.lineWidth = 2;
    c.setLineDash(progress?.status === "surveyed" ? [] : [4, 3]);
    c.beginPath();
    c.arc(site.x * sx, site.y * sy, 7, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.setLineDash([]);
  }
  for (const event of game.scheduledEvents) {
    if (!event.known || event.started) continue;
    const t = eventTemplates[event.templateId],
      p = getPortByName(t.port);
    c.strokeStyle = "#8b4e2d";
    c.lineWidth = 3;
    c.setLineDash([5, 4]);
    c.beginPath();
    c.arc(p.x * sx, p.y * sy, 15, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
  }
  for (const merchant of merchantShips) {
    if (!merchantVisible(merchant)) continue;
    c.fillStyle = merchant.color;
    c.strokeStyle = "#f1ddb0";
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(wrapX(merchant.x) * sx, (merchant.y - 8) * sy);
    c.lineTo((wrapX(merchant.x) + 6) * sx, (merchant.y + 6) * sy);
    c.lineTo((wrapX(merchant.x) - 6) * sx, (merchant.y + 6) * sy);
    c.closePath();
    c.fill();
    c.stroke();
  }
  c.save();
  c.translate(wrapX(ship.x) * sx, ship.y * sy);
  c.scale(0.5, 0.5);
  drawShip(
    c,
    0,
    0,
    ship.angle,
    game.windAngle,
    game.windStrength,
    game.shipUpgrades.activeClass,
  );
  c.restore();
  renderChartedCities();
}
function renderChartedCities() {
  chartedCities.replaceChildren();
  const indicators = chartedCityIndicators(
    ports,
    (port) => isWorldPointExplored(port.x, port.y),
    WORLD,
  );
  for (const indicator of indicators) {
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = "charted-city";
    marker.style.left = indicator.left;
    marker.style.top = indicator.top;
    marker.dataset.cityName = indicator.city.name;
    marker.setAttribute("aria-label", `Open ${indicator.city.name}`);
    marker.addEventListener("click", () => {
      minimapWrap.style.display = "none";
      openTownDetails(indicator.city, true);
    });
    chartedCities.append(marker);
  }
}
mapButton.addEventListener("click", () => {
  minimapWrap.style.display = "grid";
  renderChart();
});
minimap.addEventListener("pointerup", (e) => {
  const rect = minimap.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * WORLD.w;
  const y = ((e.clientY - rect.top) / rect.height) * WORLD.h;
  const merchant = nearestVisibleMerchant(x, y, 58);
  if (merchant) {
    openVesselDetails(merchant);
    return;
  }
  const port = nearestKnownPort(x, y, 72);
  if (port) openTownDetails(port, true);
});
document
  .getElementById("closeMap")
  .addEventListener("click", () => (minimapWrap.style.display = "none"));
minimapWrap.addEventListener("click", (e) => {
  if (e.target === minimapWrap) minimapWrap.style.display = "none";
});

const restoredSavedGame = loadGameState();
if (!restoredSavedGame) {
  applyShipUpgrades();
  setWeatherForDay(game.day);
  processWorldEventsForDay();
}
buildVisibilityPolygon(true);
camera.x = ship.x;
camera.y = ship.y;
updateHud();
if (restoredSavedGame && gameStarted) {
  prepareRestoredVoyageStartup();
} else if (new URLSearchParams(location.search).has("autostart")) {
  requestAnimationFrame(() => beginButton.click());
}

window.setInterval(saveGameState, 5000);
window.addEventListener("pagehide", saveGameState);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveGameState();
});
