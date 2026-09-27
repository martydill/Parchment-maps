import {
  GAME_NAME,
  PORT_NAMES,
  LAND_NAMES,
  FACTION_NAMES,
  RIVAL_SHIP_NAMES,
} from "./names.js";
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
import { MAP_TILT_COS, unprojectMapPoint } from "./core/projection.js";
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
  shouldShowStartupModal,
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
  normalizeCargoLot,
  normalizeCargoLots,
  resolveVoyageCargo,
  syncCargoCounts,
} from "./core/cargo.js";
import {
  ageWarehouseCargo,
  normalizeWarehouseState,
} from "./core/warehouses.js";
import {
  calculateShipIdentity,
  calculateShipStats,
  normalizeShipUpgradeState,
  SHIP_CLASSES,
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
import {
  advanceCrises,
  applyCrisisAftermath,
  CRISIS_TEMPLATES,
  crisisAtPort,
  crisisEconomyModifiers,
  normalizeCrisisState,
} from "./core/crises.js";
import {
  applyComponentDamage,
  adjustedIntelCost,
  combatEnemyProfile,
  componentEfficiency,
  contractOutcome,
  factionPrivilege,
  fulfillObligationsAtPort,
  intelligenceFreshness,
  maybeCreateObligation,
  normalizeOperationsState,
  processObligations,
  processWages,
  resolveCombatAction,
  resolveHostileEncounter,
  resolveVoyageOperations,
  routePlanEffects,
  SHIP_COMPONENTS,
  weatherRoughness,
} from "./core/operations.js";
import {
  advanceRegionalResources,
  availableMarketGoods,
  createRegionalState,
  dockingFee,
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
  createSurveyContractOffer,
  surveyContractProgress,
} from "./core/contracts.js";
import {
  bestTradeOpportunity as findBestTradeOpportunity,
  intelActionLabel,
  intelEffectText,
  upcomingEvents as findUpcomingEvents,
} from "./core/intelligence.js";
import { currentObjective } from "./core/guidance.js";
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
  resolveCrewVoyageEvent,
  normalizeCrewState,
  resolveCrewIncident,
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
  assignRoute,
  fleetRenderObject,
  loadDepartureCargo,
  normalizeFleetState,
  resolveFleetArrival,
  runFleetDay,
  suggestRouteTemplates,
  updateFleetShip,
} from "./core/fleet.js";
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
  directionalVisibilityRadius,
  localWeatherAtBearing,
} from "./core/weather.js";
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
  buildSeaField,
  routeLaneAroundLand,
  segmentClear,
} from "./core/navfield.js";
import {
  createMapRendering,
  createRoughSeaParticles,
  drawMerchantShip,
  drawShip,
  drawWeatherEffects,
  wrappedCircleIntersectsViewport,
} from "./rendering.js";
import { renderChartPanel } from "./ui/chart-panel.js";
import {
  configureUiPanels,
  openExploration,
  renderDiscoveryPanel,
  renderLedger,
  renderPortSystems,
  renderShipPanel,
  updateHud,
} from "./ui/panels.js";
import { activateSectionTabs } from "./ui/tabs.js";
import { configurePortPanels } from "./ui/port-panels.js";

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
  const spawn = mapPoint(
    HOME_PORT.spawnX,
    HOME_PORT.spawnY,
    LAND_NAMES.orravelle,
  );
  mapRecord(HOME_PORT, LAND_NAMES.orravelle);
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
  terrainPolygon: [],
  nearShoreLandIndices: [],
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
function currentVisibilityKm(angle = ship.angle) {
  return localWeatherAtBearing({
    baseWeather: getInterpolatedWeather(),
    position: ship,
    angle,
    day: game.day,
    voyageDistance: game.voyageDistance,
    horizonKm: visibility.horizonKm,
  }).visibilityKm;
}
function currentWeather(angle = ship.angle) {
  return localWeatherAtBearing({
    baseWeather: getInterpolatedWeather(),
    position: ship,
    angle,
    day: game.day,
    voyageDistance: game.voyageDistance,
    horizonKm: visibility.horizonKm,
  });
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
  [PORT_NAMES.orvessaQuay]: [
    PORT_NAMES.narthkel,
    PORT_NAMES.mirelune,
    PORT_NAMES.drazhOvek,
  ],
  [PORT_NAMES.narthkel]: [
    PORT_NAMES.orvessaQuay,
    PORT_NAMES.velquorin,
    PORT_NAMES.mirelune,
  ],
  [PORT_NAMES.velquorin]: [
    PORT_NAMES.narthkel,
    PORT_NAMES.mirravel,
    PORT_NAMES.orvessaQuay,
  ],
  [PORT_NAMES.mirravel]: [
    PORT_NAMES.velquorin,
    PORT_NAMES.kavrenQuay,
    PORT_NAMES.drazhOvek,
  ],
  [PORT_NAMES.drazhOvek]: [
    PORT_NAMES.orvessaQuay,
    PORT_NAMES.kavrenQuay,
    PORT_NAMES.thrymmor,
  ],
  [PORT_NAMES.thrymmor]: [
    PORT_NAMES.orvessaQuay,
    PORT_NAMES.mirelune,
    PORT_NAMES.drazhOvek,
  ],
  [PORT_NAMES.mirelune]: [
    PORT_NAMES.orvessaQuay,
    PORT_NAMES.thrymmor,
    PORT_NAMES.narthkel,
  ],
  [PORT_NAMES.kavrenQuay]: [
    PORT_NAMES.mirravel,
    PORT_NAMES.drazhOvek,
    PORT_NAMES.orvessaQuay,
  ],
};

Object.assign(contractRoutes, {
  [PORT_NAMES.veyrgloam]: [
    PORT_NAMES.orvessaQuay,
    PORT_NAMES.cindervaleStrand,
    PORT_NAMES.orrasanctAnchorage,
  ],
  [PORT_NAMES.cindervaleStrand]: [
    PORT_NAMES.veyrgloam,
    PORT_NAMES.heliovar,
    PORT_NAMES.orrasanctAnchorage,
  ],
  [PORT_NAMES.heliovar]: [
    PORT_NAMES.cindervaleStrand,
    PORT_NAMES.pearlveinBay,
    PORT_NAMES.orrasanctAnchorage,
  ],
  [PORT_NAMES.pearlveinBay]: [
    PORT_NAMES.heliovar,
    PORT_NAMES.starrynFall,
    PORT_NAMES.kavrelHaven,
  ],
  [PORT_NAMES.starrynFall]: [
    PORT_NAMES.pearlveinBay,
    PORT_NAMES.meridQasryn,
    PORT_NAMES.kavrelHaven,
  ],
  [PORT_NAMES.meridQasryn]: [
    PORT_NAMES.starrynFall,
    PORT_NAMES.aetherreach,
    PORT_NAMES.stormholden,
  ],
  [PORT_NAMES.aetherreach]: [
    PORT_NAMES.meridQasryn,
    PORT_NAMES.vesperport,
    PORT_NAMES.veyrgloam,
  ],
  [PORT_NAMES.vesperport]: [
    PORT_NAMES.aetherreach,
    PORT_NAMES.eoswatch,
    PORT_NAMES.ossuwhale,
  ],
  [PORT_NAMES.eoswatch]: [
    PORT_NAMES.vesperport,
    PORT_NAMES.mirelune,
    PORT_NAMES.crimsonharrow,
  ],
  [PORT_NAMES.crimsonharrow]: [
    PORT_NAMES.orrasanctAnchorage,
    PORT_NAMES.pearlspirel,
    PORT_NAMES.eoswatch,
  ],
  [PORT_NAMES.pearlspirel]: [
    PORT_NAMES.crimsonharrow,
    PORT_NAMES.verdigate,
    PORT_NAMES.kavrenQuay,
  ],
  [PORT_NAMES.verdigate]: [
    PORT_NAMES.pearlspirel,
    PORT_NAMES.cloudhollow,
    PORT_NAMES.kavrelHaven,
  ],
  [PORT_NAMES.cloudhollow]: [
    PORT_NAMES.verdigate,
    PORT_NAMES.stormholden,
    PORT_NAMES.kavrelHaven,
  ],
  [PORT_NAMES.stormholden]: [
    PORT_NAMES.cloudhollow,
    PORT_NAMES.ossuwhale,
    PORT_NAMES.meridQasryn,
  ],
  [PORT_NAMES.ossuwhale]: [
    PORT_NAMES.stormholden,
    PORT_NAMES.vesperport,
    PORT_NAMES.cloudhollow,
  ],
  [PORT_NAMES.orrasanctAnchorage]: [
    PORT_NAMES.cindervaleStrand,
    PORT_NAMES.heliovar,
    PORT_NAMES.crimsonharrow,
  ],
  [PORT_NAMES.kavrelHaven]: [
    PORT_NAMES.pearlveinBay,
    PORT_NAMES.starrynFall,
    PORT_NAMES.verdigate,
  ],
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
    title: `${PORT_NAMES.orvessaQuay} Iron Emergency`,
    port: PORT_NAMES.orvessaQuay,
    good: "iron",
    multiplier: 1.72,
    startDay: 0,
    description: `A collapse at the northern foundries has emptied the crown shipyards. ${PORT_NAMES.orvessaQuay} is paying exceptional prices for dwarf-forged iron.`,
  },
};

const eventTemplates = {
  loomStrike: {
    title: "Silver Loom Strike",
    port: PORT_NAMES.velquorin,
    good: "silk",
    duration: 5,
    priceMultiplier: 1.48,
    productionDelta: -1.7,
    consumptionDelta: 0,
    stockDelta: -7,
    faction: FACTION_NAMES.silverLoomConsortium,
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
    port: PORT_NAMES.mirravel,
    good: "spice",
    duration: 4,
    priceMultiplier: 0.72,
    productionDelta: 1.4,
    consumptionDelta: 0,
    stockDelta: 15,
    faction: FACTION_NAMES.pearlSenate,
    factionShift: 5,
    routeName: "The Whispering Cut",
    routeRisk: "Crowded but safe",
    forecast:
      "Warehouse clerks report that three spice fleets will arrive together under Senate protection.",
    description: `Three moonspice fleets have reached ${PORT_NAMES.mirravel} at once. Warehouses are overflowing and export prices have fallen.`,
  },
  marchMobilization: {
    title: `${PORT_NAMES.narthkel} Mobilization`,
    port: PORT_NAMES.narthkel,
    good: "iron",
    duration: 6,
    priceMultiplier: 1.36,
    productionDelta: 0,
    consumptionDelta: 1.5,
    stockDelta: -8,
    faction: FACTION_NAMES.blackHammerCompact,
    factionShift: 7,
    routeName: "The Northern Packet",
    routeRisk: "Naval inspections",
    forecast:
      "The Seven Captains are buying weapons through intermediaries and calling veteran crews back to service.",
    description: `${PORT_NAMES.narthkel} has begun a naval mobilization. Armorers consume iron rapidly and every Northern Packet faces inspection.`,
  },
  tunnelCollapse: {
    title: `${PORT_NAMES.drazhOvek} Deep-Tunnel Collapse`,
    port: PORT_NAMES.drazhOvek,
    good: "iron",
    duration: 6,
    priceMultiplier: 1.55,
    productionDelta: -1.9,
    consumptionDelta: 0,
    stockDelta: -11,
    faction: FACTION_NAMES.deepDelversUnion,
    factionShift: 8,
    routeName: "The Amber Run",
    routeRisk: "Unreliable supply",
    forecast:
      "Delvers whisper of groaning supports beneath the western galleries. Mine output may soon be interrupted.",
    description: `A deep gallery has collapsed beneath ${PORT_NAMES.drazhOvek}. Iron output is sharply reduced while the Delvers demand safety concessions.`,
  },
  courtSeason: {
    title: "Kingfisher Court Season",
    port: PORT_NAMES.kavrenQuay,
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
    title: `${PORT_NAMES.mirelune} Customs Embargo`,
    port: PORT_NAMES.mirelune,
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
    description: `${PORT_NAMES.mirelune} has imposed emergency customs restrictions. Moonspice is scarce and captains risk cargo seizures.`,
  },
};

const merchantRoutePaths = [
  {
    a: PORT_NAMES.orvessaQuay,
    b: PORT_NAMES.narthkel,
    points: [
      [650, 485],
      [760, 430],
      [880, 385],
      [1000, 360],
    ],
  },
  {
    a: PORT_NAMES.narthkel,
    b: PORT_NAMES.velquorin,
    points: [
      [1000, 360],
      [1180, 405],
      [1360, 455],
      [1545, 470],
    ],
  },
  {
    a: PORT_NAMES.velquorin,
    b: PORT_NAMES.mirravel,
    points: [
      [1545, 470],
      [1710, 535],
      [1870, 650],
      [2000, 765],
    ],
  },
  {
    a: PORT_NAMES.mirravel,
    b: PORT_NAMES.kavrenQuay,
    points: [
      [2000, 765],
      [2070, 875],
      [2035, 1000],
      [1950, 1105],
    ],
  },
  {
    a: PORT_NAMES.kavrenQuay,
    b: PORT_NAMES.drazhOvek,
    points: [
      [1950, 1105],
      [1800, 1175],
      [1615, 1225],
      [1450, 1185],
    ],
  },
  {
    a: PORT_NAMES.drazhOvek,
    b: PORT_NAMES.orvessaQuay,
    points: [
      [1450, 1185],
      [1230, 1060],
      [1060, 825],
      [835, 620],
      [650, 485],
    ],
  },
  {
    a: PORT_NAMES.orvessaQuay,
    b: PORT_NAMES.mirelune,
    points: [
      [650, 485],
      [545, 650],
      [430, 865],
      [360, 1140],
    ],
  },
  {
    a: PORT_NAMES.mirelune,
    b: PORT_NAMES.thrymmor,
    points: [
      [360, 1140],
      [505, 1220],
      [685, 1210],
      [830, 1135],
    ],
  },
  {
    a: PORT_NAMES.thrymmor,
    b: PORT_NAMES.drazhOvek,
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
    a: PORT_NAMES.orvessaQuay,
    b: PORT_NAMES.veyrgloam,
    points: [
      [650, 485],
      [1200, 530],
      [1800, 600],
      [2380, 650],
    ],
  },
  {
    a: PORT_NAMES.veyrgloam,
    b: PORT_NAMES.cindervaleStrand,
    points: [
      [2380, 650],
      [2620, 720],
      [2900, 750],
      [3130, 700],
    ],
  },
  {
    a: PORT_NAMES.cindervaleStrand,
    b: PORT_NAMES.orrasanctAnchorage,
    points: [
      [3130, 700],
      [3220, 900],
      [3180, 1080],
      [3050, 1210],
    ],
  },
  {
    a: PORT_NAMES.orrasanctAnchorage,
    b: PORT_NAMES.crimsonharrow,
    points: [
      [3050, 1210],
      [2840, 1380],
      [2630, 1560],
      [2470, 1760],
    ],
  },
  {
    a: PORT_NAMES.orrasanctAnchorage,
    b: PORT_NAMES.heliovar,
    points: [
      [3050, 1210],
      [3260, 1120],
      [3470, 1010],
      [3660, 930],
    ],
  },
  {
    a: PORT_NAMES.heliovar,
    b: PORT_NAMES.pearlveinBay,
    points: [
      [3660, 930],
      [3890, 850],
      [4160, 760],
      [4380, 720],
    ],
  },
  {
    a: PORT_NAMES.pearlveinBay,
    b: PORT_NAMES.starrynFall,
    points: [
      [4380, 720],
      [4500, 690],
      [4660, 690],
      [4800, 700],
    ],
  },
  {
    a: PORT_NAMES.pearlveinBay,
    b: PORT_NAMES.kavrelHaven,
    points: [
      [4380, 720],
      [4480, 900],
      [4590, 1080],
      [4700, 1220],
    ],
  },
  {
    a: PORT_NAMES.kavrelHaven,
    b: PORT_NAMES.starrynFall,
    points: [
      [4700, 1220],
      [4800, 1040],
      [4850, 850],
      [4800, 700],
    ],
  },
  {
    a: PORT_NAMES.kavrelHaven,
    b: PORT_NAMES.verdigate,
    points: [
      [4700, 1220],
      [4470, 1390],
      [4100, 1580],
      [3760, 1780],
    ],
  },
  {
    a: PORT_NAMES.starrynFall,
    b: PORT_NAMES.meridQasryn,
    points: [
      [4800, 700],
      [5050, 650],
      [5300, 650],
      [5530, 700],
    ],
  },
  {
    a: PORT_NAMES.meridQasryn,
    b: PORT_NAMES.aetherreach,
    points: [
      [5530, 700],
      [5790, 650],
      [6040, 680],
      [6240, 760],
    ],
  },
  {
    a: PORT_NAMES.aetherreach,
    b: PORT_NAMES.vesperport,
    points: [
      [6240, 760],
      [6320, 1000],
      [6310, 1320],
      [6280, 1600],
    ],
  },
  {
    a: PORT_NAMES.vesperport,
    b: PORT_NAMES.eoswatch,
    points: [
      [6280, 1600],
      [6360, 1650],
      [40, 1690],
      [80, 1730],
    ],
  },
  {
    a: PORT_NAMES.eoswatch,
    b: PORT_NAMES.mirelune,
    points: [
      [80, 1730],
      [150, 1510],
      [250, 1300],
      [360, 1140],
    ],
  },
  {
    a: PORT_NAMES.crimsonharrow,
    b: PORT_NAMES.pearlspirel,
    points: [
      [2470, 1760],
      [2750, 1680],
      [3090, 1630],
      [3410, 1660],
    ],
  },
  {
    a: PORT_NAMES.pearlspirel,
    b: PORT_NAMES.verdigate,
    points: [
      [3410, 1660],
      [3520, 1700],
      [3650, 1750],
      [3760, 1780],
    ],
  },
  {
    a: PORT_NAMES.verdigate,
    b: PORT_NAMES.cloudhollow,
    points: [
      [3760, 1780],
      [4020, 1680],
      [4360, 1560],
      [4640, 1510],
    ],
  },
  {
    a: PORT_NAMES.cloudhollow,
    b: PORT_NAMES.stormholden,
    points: [
      [4640, 1510],
      [4780, 1530],
      [4910, 1590],
      [5020, 1640],
    ],
  },
  {
    a: PORT_NAMES.stormholden,
    b: PORT_NAMES.ossuwhale,
    points: [
      [5020, 1640],
      [5300, 1740],
      [5610, 1870],
      [5920, 1940],
    ],
  },
  {
    a: PORT_NAMES.ossuwhale,
    b: PORT_NAMES.vesperport,
    points: [
      [5920, 1940],
      [6060, 1850],
      [6180, 1710],
      [6280, 1600],
    ],
  },
  {
    a: PORT_NAMES.meridQasryn,
    b: PORT_NAMES.stormholden,
    points: [
      [5530, 700],
      [5460, 980],
      [5300, 1300],
      [5020, 1640],
    ],
  },
  {
    a: PORT_NAMES.mirravel,
    b: PORT_NAMES.orrasanctAnchorage,
    points: [
      [2000, 765],
      [2350, 900],
      [2720, 1080],
      [3050, 1210],
    ],
  },
  {
    a: PORT_NAMES.kavrenQuay,
    b: PORT_NAMES.pearlspirel,
    points: [
      [1950, 1105],
      [2300, 1300],
      [2850, 1510],
      [3410, 1660],
    ],
  },
  {
    a: PORT_NAMES.kavrelHaven,
    b: PORT_NAMES.cloudhollow,
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

// Bake land-avoidance into every lane now that its waypoints are in world
// coordinates: rasterize the (already transformed) coastlines once, then re-route
// any lane segment that crosses land around it. Rivals, the player's fleet (which
// reuses these same lanes), and the minimap overlay all consume the result.
const seaField = buildSeaField(lands, { width: WORLD.w, height: WORLD.h });
for (const route of merchantRoutePaths) {
  route.points = routeLaneAroundLand(seaField, route.points);
}

// Invariant check: every baked lane should now stay off land. A count here
// means a detour fell back to its authored (crossing) segment — worth knowing.
let landCrossings = 0;
for (const route of merchantRoutePaths) {
  for (let i = 0; i + 1 < route.points.length; i += 1) {
    if (
      !segmentClear(
        seaField,
        route.points[i][0],
        route.points[i][1],
        route.points[i + 1][0],
        route.points[i + 1][1],
      )
    )
      landCrossings += 1;
  }
}
if (landCrossings > 0 && typeof console !== "undefined") {
  console.warn(`${landCrossings} sea-lane segments still cross land`);
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

const merchantNames = RIVAL_SHIP_NAMES;
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
  return game.factionStanding[FACTION_NAMES.syrrelwakeOarwrightPact] || 0;
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
  game.economy[PORT_NAMES.narthkel].iron.stock = 48;
  game.economy[PORT_NAMES.drazhOvek].iron.stock = 52;
  game.economy[PORT_NAMES.velquorin].silk.stock = 49;
  game.economy[PORT_NAMES.mirravel].spice.stock = 47;
  game.economy[PORT_NAMES.orvessaQuay].iron.stock = 15;
  game.economy[PORT_NAMES.kavrenQuay].silk.stock = 9;
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
  if (
    game.laws.amberConvoy &&
    key === "iron" &&
    port.name === PORT_NAMES.orvessaQuay
  )
    return 0.82;
  if (
    game.laws.amberConvoy &&
    key === "iron" &&
    port.name === PORT_NAMES.drazhOvek
  )
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
    const source = economyState(getPortByName(PORT_NAMES.drazhOvek), "iron");
    const dest = economyState(getPortByName(PORT_NAMES.orvessaQuay), "iron");
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
        ` The ${FACTION_NAMES.syrrelwakeOarwrightPact} is seeking captains who can reopen the Amber Run.`,
    );
    showMessage(
      `PORT NEWS: ${PORT_NAMES.orvessaQuay} is suffering an iron shortage. The crown shipyards are paying a premium.`,
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
    runFleetDay(game);
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
function makeSurveyContractOffer(origin, index) {
  const result = createSurveyContractOffer({
    origin,
    index,
    day: game.day,
    serial: game.contractSerial,
  });
  game.contractSerial = result.nextSerial;
  return result.offer;
}
function ensureContractOffers(port) {
  const cache = contractOffersForPort({
    cache: game.contractOffers[port.name],
    day: game.day,
    createOffer: (index) =>
      index === 2
        ? makeSurveyContractOffer(port, index)
        : makeContractOffer(port, index),
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
  if (contract.destination)
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
function completeSurveyContracts(event) {
  const remaining = [];
  for (const contract of game.activeContracts) {
    const progress = surveyContractProgress(contract, event);
    if (!progress?.complete) {
      remaining.push(contract);
      if (progress)
        addNews(
          "Survey progress",
          `${contract.title}: ${progress.completed}/${progress.required} logged.`,
        );
      continue;
    }
    const rewards = contract.survey.rewards;
    game.coins += rewards.coins;
    changeStanding(contract.faction, rewards.standing);
    game.completedContracts++;
    addNews(
      "Survey commission fulfilled",
      `${contract.title} earned ${rewards.coins} crowns, +${rewards.standing} standing with ${contract.faction}${rewards.charter ? `, and ${rewards.charter}` : ""}${rewards.upgradeDiscount ? `, plus ${rewards.upgradeDiscount}` : ""}${rewards.recruit ? `, plus access to ${rewards.recruit}` : ""}.`,
    );
  }
  game.activeContracts = remaining;
}
function resolveContractsAtPort(port) {
  const remaining = [];
  const resolved = [];
  for (const contract of game.activeContracts) {
    if (contract.kind === "survey" || contract.destination !== port.name) {
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
        contract.origin === PORT_NAMES.orvessaQuay &&
        contract.faction !== FACTION_NAMES.syrrelwakeOarwrightPact
      ) {
        changeStanding(FACTION_NAMES.syrrelwakeOarwrightPact, 4);
        influenceGains[FACTION_NAMES.syrrelwakeOarwrightPact] =
          (influenceGains[FACTION_NAMES.syrrelwakeOarwrightPact] || 0) + 4;
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
  if (port.name === PORT_NAMES.orvessaQuay)
    return game.laws.amberConvoy
      ? `Royal Amber Convoy Charter — protected iron convoys now run between ${PORT_NAMES.orvessaQuay} and ${PORT_NAMES.drazhOvek}.`
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
    currentPort.name === PORT_NAMES.orvessaQuay &&
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
  changeStanding(FACTION_NAMES.syrrelwakeOarwrightPact, -20);
  game.laws.amberConvoy = true;
  game.milestone.lawChanged = true;
  worldEvents.ironShortage.active = false;
  const gold = economyState(getPortByName(PORT_NAMES.orvessaQuay), "iron");
  gold.stock = clampNumber(gold.stock + 16, 0, 70);
  addNews(
    "Royal Amber Convoy Chartered",
    `Your petition passed. Crown escorts now carry iron from ${PORT_NAMES.drazhOvek}, lowering ${PORT_NAMES.orvessaQuay} prices and reducing risk on the Amber Run.`,
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

function fleetContext() {
  return {
    routes: merchantRoutePaths,
    worldWidth: WORLD.w,
    hazardsEnabled: true,
    portX: (name) => getPortByName(name)?.x ?? 0,
    economyState: (name, key) => {
      const port = getPortByName(name);
      return port ? economyState(port, key) : null;
    },
    pricingOptions: (name, key) => {
      const port = getPortByName(name);
      return port ? pricingOptions(port, key) : null;
    },
    good: (key) => ({ ...(goods[key] || {}), key }),
    goodsKeys: () => Object.keys(goods),
    day: game.day,
    specialistState: game.specialists,
    recordCompetition: (portName, key, day) => {
      const port = getPortByName(portName);
      if (port)
        game.rivals = recordPlayerCompetition(game.rivals, {
          port: port.name,
          goodKey: key,
          day,
        });
    },
  };
}

function updateFleetShips(dt) {
  const fleet = game.fleet;
  if (!fleet || !Array.isArray(fleet.ships) || fleet.ships.length === 0) return;
  const ctx = fleetContext();
  for (const ship of fleet.ships) {
    const { arrived } = updateFleetShip(ship, dt, ctx);
    if (!arrived) continue;
    const events = resolveFleetArrival(game, ship, ctx);
    for (const event of events) {
      if (event.type === "delivery") {
        const goodName = goods[event.key]?.name || event.key;
        const line = `${ship.name} delivered ${event.units} ${goodName} to ${event.port}.`;
        if (event.significant) addNews("Fleet delivery", line);
        else showMessage(line, 2.4);
      } else if (event.type === "storm") {
        const line = `${ship.name} rode out a storm${event.damage ? ` · ${event.damage} damage` : ""}.`;
        if (event.significant) addNews("Fleet vessel storms", line);
        else showMessage(line, 2.4);
      } else if (event.type === "pirate") {
        const line = event.repelled
          ? `${ship.name} repelled a pirate attack.`
          : `${ship.name} was raided · ${event.coinsLost} crowns and ${event.cargoLost} cargo lost.`;
        addNews(
          event.repelled ? "Pirates repelled" : "Fleet vessel raided",
          line,
        );
      }
    }
  }
}

function startFleetRoute(shipId, ports) {
  const ctx = fleetContext();
  const result = assignRoute(game, shipId, ports, ctx);
  if (!result.ok) return result;
  const ship = game.fleet?.ships?.find((entry) => entry.id === shipId);
  if (ship) loadDepartureCargo(game, ship, ctx);
  return result;
}

function fleetRouteSuggestions() {
  return suggestRouteTemplates(fleetContext());
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
function nearestFleetShip(x, y, radius) {
  let best = null,
    dBest = radius;
  for (const ship of game.fleet?.ships || []) {
    if (ship.status === "laidUp") continue;
    const d = Math.hypot(x - nearestWrappedX(ship.x, x), y - ship.y);
    if (d < dBest) {
      dBest = d;
      best = ship;
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

initializeMerchantShips();

function onLand(x, y) {
  return lands.some((land) => pointInWrappedPolygon(x, y, land.poly, WORLD.w));
}

const roughSeaParticles = createRoughSeaParticles(roughSeas, onLand);
function buildVisibilityPolygon(force = false) {
  const baseWeather = getInterpolatedWeather();
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
  visibility.terrainPolygon.length = 0;
  const nearShoreLandIndices = new Set();
  for (let i = 0; i < visibility.rays; i++) {
    const a = (i / visibility.rays) * Math.PI * 2;
    const dx = Math.cos(a),
      dy = Math.sin(a);
    const localRadius = directionalVisibilityRadius({
      baseWeather,
      position: ship,
      angle: a,
      day: game.day,
      voyageDistance: game.voyageDistance,
      horizonKm: visibility.horizonKm,
      worldUnitsPerKm: visibility.worldUnitsPerKm,
    });
    let hit = localRadius;
    let hitLandIndex = -1;
    for (const [landIndex, land] of lands.entries()) {
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
          if (d !== null && d < hit) {
            hit = d;
            hitLandIndex = landIndex;
          }
        }
      }
    }
    const nearShore = hitLandIndex >= 0 && hit < 200;
    if (nearShore) nearShoreLandIndices.add(hitLandIndex);
    const visibleHit = Math.min(localRadius, hit + 5);
    const terrainHit = Math.min(localRadius, hit + (nearShore ? 170 : 5));
    visibility.polygon.push({
      x: ship.x + dx * visibleHit,
      y: ship.y + dy * visibleHit,
    });
    visibility.terrainPolygon.push({
      x: ship.x + dx * terrainHit,
      y: ship.y + dy * terrainHit,
    });
  }
  visibility.nearShoreLandIndices = [...nearShoreLandIndices];
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
  game.legacyProgress.fleetRevenue = Math.max(
    0,
    Math.floor(Number(game.legacyProgress.fleetRevenue) || 0),
  );
  game.legacyProgress.fleetDeliveries = Math.max(
    0,
    Math.floor(Number(game.legacyProgress.fleetDeliveries) || 0),
  );
  game.fleet = normalizeFleetState(game.fleet);
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

function punchNearShoreTerrain(c) {
  if (!visibility.nearShoreLandIndices.length) return;
  c.save();
  c.globalAlpha = 0.38;
  c.fillStyle = "#000";
  for (const landIndex of visibility.nearShoreLandIndices) {
    const land = lands[landIndex];
    const center = polygonCentroid(land.poly);
    const nearestOffset = Math.round((ship.x - center.x) / WORLD.w) * WORLD.w;
    for (const offset of [
      nearestOffset - WORLD.w,
      nearestOffset,
      nearestOffset + WORLD.w,
    ]) {
      c.save();
      c.beginPath();
      land.poly.forEach(([x, y], index) => {
        if (index) c.lineTo(x + offset, y);
        else c.moveTo(x + offset, y);
      });
      c.closePath();
      c.clip();
      polygonPath(c, visibility.terrainPolygon, 1, 1, offset);
      c.fill();
      c.restore();
    }
  }
  c.restore();
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
    z * MAP_TILT_COS,
    WORLD.w,
  );
}

function drawAnimatedRoughSeas(c, time, z) {
  c.save();
  c.lineCap = "round";
  // Batch rendering by reducing state changes - process all particles for each sea
  for (let seaIndex = 0; seaIndex < roughSeas.length; seaIndex++) {
    const sea = roughSeas[seaIndex];
    if (!isWorldCircleInViewport(sea.x, sea.y, Math.max(sea.rx, sea.ry), z))
      continue;
    const nearestX = nearestWrappedX(sea.x, camera.x);

    // Group particles by similar transformations to reduce state changes
    const particles = roughSeaParticles[seaIndex];
    if (!particles || particles.length === 0) continue;

    // Pre-calculate common values
    const baseColor1 = [249, 232, 184];
    const baseColor2 = [57, 61, 47];

    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      const phase = time * particle.speed + particle.phaseOffset;
      const x = nearestX + particle.baseX + Math.cos(phase) * particle.swell;
      const y =
        sea.y + particle.baseY + Math.sin(phase * 1.35) * particle.swell * 0.45;
      const crest = (Math.sin(phase) + 1) * 0.5;

      c.save();
      c.translate(x, y);
      c.rotate(particle.rotation);
      c.scale(particle.scale, particle.scale);

      // First stroke
      c.strokeStyle = `rgba(${baseColor1[0]},${baseColor1[1]},${baseColor1[2]},${0.1 + crest * 0.2})`;
      c.lineWidth = (1.2 + crest) / z;
      c.beginPath();
      c.moveTo(-15, 3);
      c.quadraticCurveTo(-8, -7 - crest * 3, -1, 1);
      c.quadraticCurveTo(6, 9, 14, -2 - crest * 2);
      c.stroke();

      // Second stroke
      c.strokeStyle = `rgba(${baseColor2[0]},${baseColor2[1]},${baseColor2[2]},${0.12 + crest * 0.11})`;
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

const panelContext = {
  clearCourse,
  courseBearing,
  bestCargoCompartment,
  syncCargoCounts,
  RIVAL_CAPTAINS,
  updateMilestoneCompletion,
  rivalRelationshipLabel,
  crewVoyageModifiers,
  UPGRADE_SLOTS,
  CREW_ROLES,
  contractCargoCount,
  CARGO_COMPARTMENTS,
  createCargoLot,
  EXPLORATION_APPROACHES,
  chooseFactionCharter,
  factionRivals,
  SPECIALIST_ROSTER,
  recordPlayerCompetition,
  undertakeExpedition,
  handleDiscoveryDisposition,
  acceptContract,
  addNews,
  availableMarketGoods,
  buyPermit,
  buyPriceFor,
  calculateShipIdentity,
  canTrade,
  cargoCapacities,
  cargoCondition,
  cargoCount,
  cargoLotDescription,
  cargoValueMultiplier,
  closeDiscoveryDetails,
  compassDirection,
  completeLegacyCapstone,
  contractConflict,
  continueLegacySandbox,
  currentObjective,
  currentVisibilityKm,
  DISCOVERY_DISPOSITIONS,
  discoverySites,
  document,
  economyCondition,
  economyState,
  ensureContractOffers,
  FACTION_NAMES,
  factionPrivilege,
  game,
  get currentPort() {
    return currentPort;
  },
  get nearExplorationSite() {
    return nearExplorationSite;
  },
  get nearPort() {
    return nearPort;
  },
  getPortByName,
  goods,
  guildStanding,
  HOME_PORT,
  intelligenceFreshness,
  inventory: { ship },
  lawDetails,
  LEGACY_PATHS,
  legacyChecklist,
  legacyReadyForCapstone,
  legalStatusAt,
  localCurrent,
  operationalShipStats,
  PORT_NAMES,
  portEvolution,
  productionChains,
  regionalSummary,
  saveGameState,
  sellPriceFor,
  seasonalSiteActive,
  SHIP_CLASSES,
  SHIP_COMPONENTS,
  SHIP_UPGRADES,
  shipSpeedKnots,
  showMessage,
  tradeQuote,
  ui,
  worldEvents,
  WORLD,
  wrapX,
  activeEventsAt,
  activeShipClass,
  advanceDays,
  applyShipUpgrades,
  bestTradeOpportunity,
  buyIntel,
  buyRumorLead,
  canPassConvoyLaw,
  currentLawText,
  describeCargoRequirements,
  ensureIntelOffers,
  eventTemplates,
  orientRoute,
  passConvoyLaw,
  renderPortSystems,
  resolveCrisisIntervention,
  routesFrom,
  showIntelReport,
  updateHud,
  ports,
  startFleetRoute,
  fleetRouteSuggestions,
};
configureUiPanels(panelContext);
configurePortPanels(panelContext);

function applyNarrativeNames() {
  document.title = `${GAME_NAME} — Encircling World V9`;
  document.getElementById("homePortLabel").textContent = PORT_NAMES.orvessaQuay;
  document.getElementById("introGameTitle").textContent = GAME_NAME;
  document.getElementById("introHomeRealm").textContent =
    `the Crown of ${LAND_NAMES.orravelle}`;
  document.getElementById("introHomePort").textContent = PORT_NAMES.orvessaQuay;
  document.getElementById("introHomeLand").textContent = LAND_NAMES.orravelle;
  document.getElementById("introGuildName").textContent =
    FACTION_NAMES.syrrelwakeOarwrightPact;
  beginButton.querySelector(".start-new-label").textContent =
    `Begin at ${PORT_NAMES.orvessaQuay}`;
}
applyNarrativeNames();

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
  nearPort = beginAtHomePort({
    camera,
    homePort: HOME_PORT,
    ports,
    ship,
  });
  gameStarted = true;
  addNews(
    "The first commission",
    `The ${FACTION_NAMES.syrrelwakeOarwrightPact} has posted three introductory commissions at ${PORT_NAMES.orvessaQuay}. Fulfill them to build influence.`,
  );
  addNews(
    "Sails on the horizon",
    "Independent merchants now carry real cargo between the archipelago’s ports. Their arrivals will change local stock and prices.",
  );
  revealStartedGame({
    message: `Welcome home. Dock at ${PORT_NAMES.orvessaQuay} for contracts and intelligence, or watch the sea for merchant traffic.`,
    save: true,
  });
}

function resumeSavedVoyage() {
  nearPort =
    ports.find(
      (port) => wrappedDistance(ship.x, ship.y, port.x, port.y) < 95,
    ) || null;
  revealStartedGame({
    message: "Voyage restored from this browser.",
    openChart: false,
  });
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
  return unprojectMapPoint(
    clientX - rect.left,
    clientY - rect.top,
    camera.x,
    camera.y,
    camera.zoom,
    rect.width,
    rect.height,
  );
}

// Cache for fog rendering state to avoid unnecessary redraws
const fogRenderState = {
  lastCameraX: 0,
  lastCameraY: 0,
  lastVW: 0,
  lastVH: 0,
  needsFullRedraw: true,
  mistParticles: [],
  initMistParticles: function () {
    this.mistParticles = [];
    for (let i = 0; i < 11; i++) {
      this.mistParticles.push({
        index: i,
        rx: 150 + (i % 4) * 38,
        squash: 0.24 + (i % 3) * 0.055,
        rotation: ((i % 5) - 2) * 0.08,
      });
    }
  },
};
fogRenderState.initMistParticles();

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
  // Optimized: use pre-calculated particles and reduce state changes
  for (let i = 0; i < fogRenderState.mistParticles.length; i++) {
    const p = fogRenderState.mistParticles[i];
    const x = ((i * 211 + time * 7600) % (vw + 420)) - 210;
    const y = ((i * 127 + Math.sin(time * 42 + i) * 48) % (vh + 220)) - 110;

    f.save();
    f.translate(x, y);
    f.rotate(p.rotation);
    f.scale(1, p.squash);
    const mist = f.createRadialGradient(0, 0, 0, 0, 0, p.rx);
    mist.addColorStop(0, "rgba(239,233,214,.065)");
    mist.addColorStop(0.52, "rgba(239,233,214,.025)");
    mist.addColorStop(1, "rgba(239,233,214,0)");
    f.fillStyle = mist;
    f.beginPath();
    f.arc(0, 0, p.rx, 0, Math.PI * 2);
    f.fill();
    f.restore();
  }
  f.restore();

  f.globalCompositeOperation = "destination-out";
  f.save();
  const z = camera.zoom;
  f.translate(vw / 2, vh / 2);
  f.scale(z, z * MAP_TILT_COS);
  f.translate(-camera.x, -camera.y);
  f.globalAlpha = 0.48;
  for (const offset of worldCopiesNear(camera.x))
    f.drawImage(exploredMask, offset, 0, WORLD.w, WORLD.h);
  f.globalAlpha = 1;
  punchCurrentVisibility(f, 1, 1);
  punchNearShoreTerrain(f);
  f.restore();
  f.globalCompositeOperation = "source-over";

  // A pale, blurred boundary suggests the wall of mist at the visual horizon.
  f.save();
  f.translate(vw / 2, vh / 2);
  f.scale(camera.zoom, camera.zoom * MAP_TILT_COS);
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
  // Batch text rendering setup - set common properties once
  c.textAlign = "center";
  c.textBaseline = "middle";

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
      c.fillText(merchant.name, x, merchant.y - 19 / z);
    }
  }
  // Player fleet: assigned trade routes, then the vessels sailing them.
  for (const ship of game.fleet?.ships || []) {
    if (ship.status === "laidUp" || !ship.route) continue;
    c.strokeStyle = "rgba(106,140,138,.5)";
    c.lineWidth = 1.4 / z;
    c.setLineDash([4 / z, 6 / z]);
    for (const leg of ship.route.legs) {
      c.beginPath();
      leg.points.forEach((point, index) => {
        const wx = nearestWrappedX(point[0], camera.x);
        if (index === 0) c.moveTo(wx, point[1]);
        else c.lineTo(wx, point[1]);
      });
      c.stroke();
    }
    c.setLineDash([]);
  }
  for (const ship of game.fleet?.ships || []) {
    if (ship.status === "laidUp") continue;
    const render = fleetRenderObject(ship);
    const x = nearestWrappedX(render.x, camera.x);
    if (!isWorldCircleInViewport(render.x, render.y, 60, z)) continue;
    // A green halo marks player vessels apart from rival traffic, and the name
    // reads in the same green so the fleet is identifiable at a glance.
    c.beginPath();
    c.arc(x, render.y, 12 / z, 0, Math.PI * 2);
    c.fillStyle = "rgba(58,170,99,.22)";
    c.fill();
    c.lineWidth = 1.8 / z;
    c.strokeStyle = "rgba(46,158,90,.9)";
    c.stroke();
    drawMerchantShip(c, render, z, x);
    c.fillStyle = "rgba(34,150,82,.96)";
    c.font = "bold " + 11 / z + "px Georgia";
    c.textAlign = "center";
    c.textBaseline = "alphabetic";
    c.fillText(ship.name, x, render.y - 19 / z);
  }
  c.restore();
}
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, vw, vh);
  const z = camera.zoom;
  const time = performance.now();
  const worldTransform = () => {
    ctx.save();
    ctx.translate(vw / 2, vh / 2);
    ctx.scale(z, z * MAP_TILT_COS);
    ctx.translate(-camera.x, -camera.y);
  };

  // World layer rendering
  worldTransform();
  for (const offset of worldCopiesNear(camera.x))
    ctx.drawImage(mapLayer, offset, 0);
  drawAnimatedRoughSeas(ctx, time, z);
  drawDynamicTradeWorld(ctx, z, time);

  // Batch trail and wind rendering
  ctx.save();
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
  const windCos = Math.cos(game.windAngle) * 30;
  const windSin = Math.sin(game.windAngle) * 30;

  for (let i = 0; i < 14; i++) {
    const x = windLeft + ((i * 173 + time * 0.025) % windSpan),
      y = (i * 197 + Math.floor(camera.y)) % WORLD.h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + windCos, y + windSin);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore(); // Restore world transform

  renderFog();

  // The ship and immediate docking cue remain readable above the fog layer.
  worldTransform();
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
      aheadVisibilityKm: currentWeather(ship.angle).visibilityKm,
      asternVisibilityKm: currentWeather(ship.angle + Math.PI).visibilityKm,
      headingAngle: ship.angle,
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
  // Fleet vessels trade autonomously in real time and keep sailing even while
  // the player is docked or has a town dossier open — otherwise commissioning a
  // ship, assigning a route, and checking the Fleet tab from port would appear
  // to do nothing. Rivals (updateMerchantShips) stay paused at port as ambient
  // traffic, unchanged.
  if (gameStarted) updateFleetShips(dt);
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
  const dt = Math.min(0.05, (now - last) / 1000);
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
  const fleetShip = nearestFleetShip(
    world.x,
    world.y,
    Math.max(34, 26 / camera.zoom),
  );
  if (fleetShip) {
    openFleetLedger();
    return;
  }
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
      nearestFleetShip(world.x, world.y, Math.max(34, 26 / camera.zoom)) ||
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

function describeCargoRequirements(requirements) {
  return Object.entries(requirements || {})
    .map(([key, units]) => `${units} ${goods[key]?.name || key}`)
    .join(" + ");
}

function resolveCrisisIntervention(result, body, standingReward) {
  game.regionalCrises = result.state;
  if (Number.isFinite(result.coins)) game.coins = result.coins;
  applyCrisisAftermath(
    game.regionalEconomy[currentPort.name],
    result.template,
    "resolved",
  );
  changeStanding(dominantFaction(currentPort).name, standingReward);
  addNews(result.template.title + ": intervention succeeds", body);
  showMessage(
    `STORY ARC RESOLVED · ${result.template.title} leaves a lasting recovery.`,
    5,
  );
  renderPortSystems();
  updateHud();
  saveGameState();
}

function leadingVoyageMentor(specialists) {
  const officer = normalizeSpecialistState(specialists)
    .officers.filter((candidate) => candidate.loyalty >= 70)
    .sort((a, b) => b.loyalty - a.loyalty || b.events - a.events)[0];
  return officer?.id || null;
}

function applyCrewVoyageEvent(event) {
  for (const [component, amount] of Object.entries(event.repair || {})) {
    if (game.operations.components[component] === undefined) continue;
    game.operations.components[component] = clampNumber(
      game.operations.components[component] + amount,
      0,
      100,
    );
  }
  if (event.provisions) {
    game.operations.provisions = clampNumber(
      game.operations.provisions + event.provisions,
      0,
      30,
    );
  }
  game.operations.condition =
    Object.values(game.operations.components).reduce(
      (sum, value) => sum + value,
      0,
    ) / Object.values(game.operations.components).length;
  game.operations.morale = clampNumber(
    game.operations.morale + event.morale,
    0,
    100,
  );
  if (event.officer && event.officerLoyalty) {
    game.specialists = adjustSpecialistLoyalty(
      game.specialists,
      event.officer,
      event.officerLoyalty,
    );
  }
  addNews(
    event.title,
    `${event.body} ${event.roleLabel} gained ${event.traitLabel}.`,
  );
  showMessage(`CREW PROGRESSION · ${event.traitLabel} gained.`, 4);
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
    const crewProgress = resolveCrewVoyageEvent(game.operations.crew, {
      origin: game.departedFromPort,
      destination: currentPort.name,
      days,
      distance,
      roughness,
      shortage: operations.shortage,
      routePlan: routePlan.id,
      specialistId: leadingVoyageMentor(game.specialists),
      seed: `${game.departedFromPort}:${currentPort.name}:${game.day}:${Math.round(distance)}`,
    });
    game.operations.crew = crewProgress.crew;
    if (crewProgress.event) applyCrewVoyageEvent(crewProgress.event);
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

function encounterRollLike(seed) {
  const value = Math.sin(Number(seed || 0) * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function combatCargoValue() {
  return game.cargoLots.reduce(
    (sum, lot) => sum + (goods[lot.key]?.base || 0),
    0,
  );
}

function combatLocationAdvantage() {
  const weather = currentWeather(ship.angle);
  let advantage = 0;
  if (weather.visibilityKm < 8) advantage += 0.04;
  if ((weather.roughness || 0) > 0.35) advantage += 0.03;
  if (nearPort === currentPort) advantage += 0.03;
  return advantage;
}

function combatOfficerBonus(action) {
  if (action === "fight")
    return specialistPower(game.specialists, "gunner") * 0.42;
  if (action === "flee")
    return specialistPower(game.specialists, "navigator") * 0.28;
  if (action === "parley")
    return specialistPower(game.specialists, "factor") * 0.32;
  if (action === "surrender")
    return specialistPower(game.specialists, "purser") * 0.18;
  return 0;
}

function combatOfficerNote(action) {
  if (action === "fight" && specialistPower(game.specialists, "gunner") > 0)
    return "Gunner steadies the batteries";
  if (action === "flee" && specialistPower(game.specialists, "navigator") > 0)
    return "Navigator finds broken water";
  if (action === "parley" && specialistPower(game.specialists, "factor") > 0)
    return "Factor bargains down the ransom";
  if (action === "surrender" && specialistPower(game.specialists, "purser") > 0)
    return "Purser hides the strongbox";
  return "";
}

function prizedCargoLot(profile) {
  if (!game.cargoLots.length) return null;
  const preferred = profile.cargoPreference || [];
  return (
    preferred
      .map((key) => game.cargoLots.find((lot) => lot.key === key))
      .find(Boolean) ||
    [...game.cargoLots].sort(
      (a, b) => (goods[b.key]?.base || 0) - (goods[a.key]?.base || 0),
    )[0]
  );
}

function removeCombatCargo(profile) {
  const lot = prizedCargoLot(profile);
  if (!lot) return null;
  game.cargoLots = game.cargoLots.filter((item) => item.id !== lot.id);
  syncCargoCounts(game, goods);
  return lot;
}

function combatSceneRandom(seed) {
  let value = (Math.floor(seed) || 1) >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function drawCombatRidge(c, width, horizon, peaks, fill, ink) {
  c.beginPath();
  c.moveTo(0, horizon);
  peaks.forEach(([x, y]) => c.lineTo(x * width, y));
  c.lineTo(width, horizon);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  c.strokeStyle = ink;
  c.lineWidth = 1.4;
  c.stroke();
}

function drawCombatCoastline(c, width, height, climate, seed) {
  const random = combatSceneRandom(seed + 73);
  const horizon = height * 0.43;
  const peaks = [];
  for (let index = 0; index <= 24; index++) {
    const x = index / 24;
    const summit = 0.24 + random() * 0.15;
    peaks.push([x, horizon - (Math.sin(x * Math.PI) * summit + random() * 5)]);
  }
  const tones =
    climate === "ice"
      ? ["#a7b9ae", "#768a82", "rgba(224,231,214,.75)"]
      : climate === "marsh"
        ? ["#9a9a68", "#667653", "rgba(67,91,56,.78)"]
        : ["#ae9b70", "#777650", "rgba(67,78,49,.78)"];
  drawCombatRidge(c, width, horizon, peaks, tones[0], "rgba(59,49,31,.52)");
  const nearPeaks = peaks.map(([x, y], index) => [
    x,
    Math.min(horizon + 5, y + 15 + Math.sin(index * 1.9) * 7),
  ]);
  drawCombatRidge(
    c,
    width,
    horizon + 9,
    nearPeaks,
    tones[1],
    "rgba(53,48,29,.62)",
  );

  // A foreground headland bends into the water and leaves a small sheltered cove.
  c.beginPath();
  c.moveTo(width * 0.76, horizon + 5);
  c.bezierCurveTo(
    width * 0.71,
    height * 0.52,
    width * 0.82,
    height * 0.55,
    width * 0.78,
    height * 0.61,
  );
  c.bezierCurveTo(
    width * 0.75,
    height * 0.66,
    width * 0.9,
    height * 0.68,
    width * 0.88,
    height * 0.76,
  );
  c.bezierCurveTo(
    width * 0.86,
    height * 0.84,
    width * 0.94,
    height * 0.86,
    width,
    height * 0.82,
  );
  c.lineTo(width, height);
  c.lineTo(width * 0.7, height);
  c.closePath();
  c.fillStyle = tones[2];
  c.fill();
  c.strokeStyle = "rgba(58,43,27,.82)";
  c.lineWidth = 2;
  c.stroke();

  // Warm exposed rock and short ink hachures give the shore a readable edge.
  c.beginPath();
  c.moveTo(width * 0.76, horizon + 5);
  c.bezierCurveTo(
    width * 0.71,
    height * 0.52,
    width * 0.82,
    height * 0.55,
    width * 0.78,
    height * 0.61,
  );
  c.bezierCurveTo(
    width * 0.75,
    height * 0.66,
    width * 0.9,
    height * 0.68,
    width * 0.88,
    height * 0.76,
  );
  c.strokeStyle = "rgba(220,196,145,.9)";
  c.lineWidth = 4;
  c.stroke();
  c.strokeStyle = "rgba(49,42,27,.34)";
  c.lineWidth = 1;
  for (let index = 0; index < 13; index++) {
    const x = width * (0.84 + random() * 0.14);
    const y = height * (0.72 + random() * 0.23);
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + 7 + random() * 11, y - 3 - random() * 7);
    c.stroke();
  }
}

function renderCombatScene(canvas, climate, enemyClass, seed, weatherName) {
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(bounds.width * pixelRatio);
  canvas.height = Math.round(bounds.height * pixelRatio);
  const c = canvas.getContext("2d");
  c.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const width = bounds.width;
  const height = bounds.height;
  const horizon = height * 0.43;
  const random = combatSceneRandom(seed + weatherName.length * 37);

  const sky = c.createLinearGradient(0, 0, 0, horizon + 20);
  const stormy = climate === "storm" || /squall|gale|storm/i.test(weatherName);
  sky.addColorStop(0, stormy ? "#64777b" : "#91b4b6");
  sky.addColorStop(0.65, stormy ? "#9b927d" : "#d1bd91");
  sky.addColorStop(1, "#d7c79e");
  c.fillStyle = sky;
  c.fillRect(0, 0, width, height);
  const light = c.createRadialGradient(
    width * 0.2,
    height * 0.18,
    2,
    width * 0.2,
    height * 0.18,
    height * 0.44,
  );
  light.addColorStop(0, "rgba(247,226,173,.54)");
  light.addColorStop(1, "rgba(247,226,173,0)");
  c.fillStyle = light;
  c.fillRect(0, 0, width, height);
  const sea = c.createLinearGradient(0, horizon, 0, height);
  sea.addColorStop(0, stormy ? "#52777b" : "#668c8a");
  sea.addColorStop(0.42, stormy ? "#345f68" : "#3c7279");
  sea.addColorStop(1, stormy ? "#203f4c" : "#244f59");
  c.fillStyle = sea;
  c.fillRect(0, horizon, width, height - horizon);
  drawCombatCoastline(c, width, height, climate, seed);

  // Receding, broken wave crests tighten toward the horizon and broaden nearby.
  c.lineCap = "round";
  for (let index = 0; index < 62; index++) {
    const depth = (index + random() * 0.7) / 62;
    const y = horizon + 10 + depth * depth * (height - horizon - 8);
    const x = random() * width;
    const span = 8 + depth * 45 + random() * 27;
    c.beginPath();
    c.moveTo(x - span * 0.5, y);
    c.quadraticCurveTo(x, y - 1.5 - depth * 2, x + span * 0.5, y + 0.3);
    c.strokeStyle =
      index % 4 === 0
        ? `rgba(219,220,190,${0.09 + depth * 0.16})`
        : `rgba(19,51,55,${0.12 + depth * 0.13})`;
    c.lineWidth = 0.6 + depth * 1.1;
    c.stroke();
  }
  drawCombatCoastline(c, width, height, climate, seed);
  // Pale wash and foam curl along the headland's shallow water.
  c.beginPath();
  c.moveTo(width * 0.755, horizon + 7);
  c.bezierCurveTo(
    width * 0.72,
    height * 0.53,
    width * 0.84,
    height * 0.56,
    width * 0.79,
    height * 0.62,
  );
  c.bezierCurveTo(
    width * 0.76,
    height * 0.68,
    width * 0.91,
    height * 0.69,
    width * 0.89,
    height * 0.77,
  );
  c.strokeStyle = "rgba(225,224,196,.78)";
  c.lineWidth = 2.4;
  c.shadowColor = "rgba(235,229,200,.55)";
  c.shadowBlur = 5;
  c.stroke();
  c.shadowBlur = 0;

  // Reuse the same faceted, projected ship meshes used on the main chart.
  const playerScale = 3.55;
  c.save();
  c.translate(width * 0.32, height * 0.69);
  c.scale(playerScale, playerScale);
  drawMerchantShip(
    c,
    {
      x: 0,
      y: 0,
      angle: 0.03,
      vesselClass: game.shipUpgrades.activeClass,
      idNum: seed,
      color: "#9c3d2c",
    },
    playerScale,
  );
  c.restore();

  const enemyScale = enemyClass === "carrack" ? 2.7 : 3.05;
  c.save();
  c.translate(width * 0.65, height * 0.59);
  c.scale(enemyScale, enemyScale);
  drawMerchantShip(
    c,
    {
      x: 0,
      y: 0,
      angle: Math.PI - 0.04,
      vesselClass: enemyClass,
      idNum: seed + 53,
      color: "#71352a",
    },
    enemyScale,
  );
  c.restore();
}

function combatBackdropClass() {
  const weather = currentWeather(ship.angle);
  const land = currentPort?.land || "open-sea";
  const climate = land.toLowerCase().includes("rime")
    ? "ice"
    : land.toLowerCase().includes("mire")
      ? "marsh"
      : land.toLowerCase().includes("storm") || weather.roughness > 0.38
        ? "storm"
        : land.toLowerCase().includes("keys") ||
            land.toLowerCase().includes("isle")
          ? "isles"
          : "coast";
  return `combat-visual ${climate}`;
}

function openCombatEncounter(encounter, stats) {
  const seed = game.day + currentPort.name.length + 31;
  const profile = combatEnemyProfile(seed, encounter.attackStrength);
  pendingCombat = {
    encounter,
    stats,
    profile,
    seed,
  };
  const strengthLabels = [
    "",
    "Light raider",
    "Armed corsair",
    "Heavy boarding ship",
  ];
  document.getElementById("combatDescription").textContent =
    `${profile.label}: ${profile.description} ${strengthLabels[encounter.attackStrength]} shadows your wake outside ${currentPort.name}. The harbor is close, but not close enough for its guns to protect you.`;
  document.getElementById("combatPlayer").textContent =
    `${Math.round(stats.maxSpeed)} speed · ${stats.defense.toFixed(1)} defense · ${Math.round(game.operations.morale)} morale`;
  document.getElementById("combatEnemy").textContent =
    `${strengthLabels[encounter.attackStrength]} · strength ${encounter.attackStrength}/3 · ${profile.label}`;
  document.getElementById("combatPanel").style.display = "grid";
  renderCombatVisual(strengthLabels[encounter.attackStrength], profile);
  renderCombatActions();
}

function renderCombatVisual(enemyLabel, profile) {
  const visual = document.getElementById("combatVisual");
  const backdrop = combatBackdropClass();
  visual.className = backdrop;
  document.getElementById("combatLocation").textContent =
    `${currentPort.land} waters`;
  const weatherName = currentWeather(ship.angle).name;
  document.getElementById("combatWaters").textContent = weatherName;
  document.getElementById("combatEnemyVisualLabel").textContent = enemyLabel;
  document.getElementById("combatProfileLabel").textContent = profile.label;
  const enemyClasses = ["cutter", "cutter", "brig", "carrack"];
  renderCombatScene(
    visual.querySelector(".combat-scene"),
    backdrop.split(" ").at(-1),
    enemyClasses[pendingCombat.encounter.attackStrength],
    pendingCombat.seed,
    weatherName,
  );
}

addEventListener("resize", () => {
  if (
    !pendingCombat ||
    document.getElementById("combatPanel").style.display !== "grid"
  )
    return;
  const strength = pendingCombat.encounter.attackStrength;
  const labels = ["", "Light raider", "Armed corsair", "Heavy boarding ship"];
  renderCombatVisual(labels[strength], pendingCombat.profile);
});

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
    profile: pendingCombat.profile,
    cargoValue: combatCargoValue(),
    officerBonus: combatOfficerBonus(action),
    locationAdvantage: combatLocationAdvantage(),
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
  if (result.prizeValue) parts.push(`+${result.prizeValue} salvage`);
  if (result.cargoLossRisk > 0) {
    const risk = Math.round(result.cargoLossRisk * 100);
    parts.push(`${risk}% cargo risk`);
  }
  const note = combatOfficerNote(action);
  if (note) parts.push(note);
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
    profile: pendingCombat.profile,
    cargoValue: combatCargoValue(),
    officerBonus: combatOfficerBonus(action),
    locationAdvantage: combatLocationAdvantage(),
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
  let cargoText = "";
  if (
    result.cargoLossRisk &&
    encounterRollLike(pendingCombat.seed + 23) < result.cargoLossRisk
  ) {
    const lost = removeCombatCargo(pendingCombat.profile);
    if (lost) cargoText = ` Raiders seized ${goods[lost.key].name}.`;
  }
  if (result.prizeValue) game.coins += result.prizeValue;
  game.coins -= result.coinsLost;
  addNews(
    `Sea encounter: ${result.outcome}`,
    `${result.description}${cargoText}${result.prizeValue ? ` Prize salvage yielded ${result.prizeValue} crowns.` : ""}`,
  );
  showMessage(`HOSTILE ENCOUNTER · ${result.description}`, 5);
  pendingCombat = null;
  document.getElementById("combatPanel").style.display = "none";
  renderPortSystems();
  updateHud();
  saveGameState();
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
  completeSurveyContracts({
    type: "discovery",
    site: result.site,
    disposition,
  });
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

function applyExpeditionAftermath(events) {
  const notes = [];
  for (const event of events || []) {
    if (event.type === "crew-treatment") {
      const group =
        game.operations.crew.groups[event.role] ||
        game.operations.crew.groups.deck;
      group.injuries = Math.min(group.count, group.injuries + event.injuries);
      notes.push(`${event.title}: ${event.summary}`);
    } else if (event.type === "crew-trait") {
      const group = game.operations.crew.groups[event.role];
      if (!group) continue;
      group.experience = clamp(group.experience + event.experience, 0, 100);
      group.loyalty = clamp(group.loyalty + event.loyalty, 0, 100);
      group.traits = Array.from(
        new Set([...(group.traits || []), event.trait]),
      );
      notes.push(`${event.title}: ${event.summary}`);
    } else if (event.type === "rival-interest") {
      const rival = RIVAL_CAPTAINS[event.rivalIndex % RIVAL_CAPTAINS.length];
      const standing = game.rivals.captains[rival.id];
      standing.reputation = clamp(
        standing.reputation + event.reputation,
        0,
        100,
      );
      standing.relationship = clamp(
        standing.relationship + event.relationship,
        -100,
        100,
      );
      notes.push(`${rival.captain}: ${event.summary}`);
    } else if (event.type === "exclusive-demand") {
      changeStanding(event.faction, event.standing);
      notes.push(`${event.faction}: ${event.summary}`);
    } else if (event.type === "stranded-party") {
      game.operations.provisions = Math.max(
        0,
        game.operations.provisions - event.provisions,
      );
      advanceDays(event.days);
      notes.push(event.summary);
    } else if (event.type === "artifact-omen") {
      notes.push(
        `${event.summary} Watch for trouble near day ${event.triggerDay}.`,
      );
    } else if (event.type === "named-anchorage") {
      notes.push(event.summary);
    }
  }
  if (notes.length) addNews("Expedition aftermath", notes.join(" "));
  return notes;
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
  const aftermathNotes = applyExpeditionAftermath(result.record.aftermath);
  revealExplorationSurvey(site, result.record.success);
  if (result.record.success)
    completeSurveyContracts({ type: "exploration", site });
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
  const aftermathText = aftermathNotes.length
    ? ` Aftermath: ${aftermathNotes.join(" ")}`
    : "";
  const outcome = result.record.success
    ? `${site.name} was surveyed${result.record.exceptional ? " with exceptional results" : ""}. The landmass is now inked on your chart, and ${result.record.reward} crowns of specimens and salvage were recovered${recovery}.${hazardSummary}${damageText}${aftermathText}`
    : `The expedition returned without completing its objective, but the landing area was added to your chart. ${result.record.injuries} crew members were injured.${hazardSummary}${damageText}${aftermathText}`;
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
// Opens the Captain's Ledger straight to the Fleet tab — used when a fleet
// vessel is clicked on the world map or minimap.
function openFleetLedger() {
  renderLedger();
  activateSectionTabs(ledgerPanel, "fleet");
  ledgerPanel.style.display = "grid";
}
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
    if (gameStarted) resumeSavedVoyage();
    menuPanel.style.display = "none";
  }
});
function renderChart() {
  renderChartPanel({
    activeRumorLeads,
    buildVisibilityPolygon,
    chartedCities,
    courseBearing,
    currentObjective,
    currentPort,
    drawShipOptions: {
      angle: ship.angle,
      classId: game.shipUpgrades.activeClass,
      windAngle: game.windAngle,
      windStrength: game.windStrength,
    },
    eventTemplates,
    exploredMask,
    explorationSites,
    game,
    getPortByName,
    homePortName: HOME_PORT.name,
    isWorldPointExplored,
    mapLayer,
    merchantShips,
    merchantVisible,
    minimap,
    minimapCtx,
    minimapFog,
    minimapFogCtx,
    minimapWrap,
    nearPort,
    onOpenTown: openTownDetails,
    ports,
    punchCurrentVisibility,
    ship,
    world: WORLD,
    wrapX,
  });
}
mapButton.addEventListener("click", () => {
  minimapWrap.style.display = "grid";
  renderChart();
});
minimap.addEventListener("pointerup", (e) => {
  const rect = minimap.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * WORLD.w;
  const y = ((e.clientY - rect.top) / rect.height) * WORLD.h;
  const fleetShip = nearestFleetShip(x, y, 58);
  if (fleetShip) {
    openFleetLedger();
    return;
  }
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
// The startup modal appears only once, before any voyage has been started;
// returning to the page with a saved voyage resumes directly into the game.
const showStartupModal = shouldShowStartupModal({
  hasStartedVoyage: restoredSavedGame && gameStarted,
});
if (!showStartupModal) {
  resumeSavedVoyage();
} else if (new URLSearchParams(location.search).has("autostart")) {
  requestAnimationFrame(() => beginButton.click());
}

window.setInterval(saveGameState, 5000);
window.addEventListener("pagehide", saveGameState);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveGameState();
});
