import {
  clamp,
  nearestWrapped,
  normalizeAngle,
  wrap,
  wrappedDistance as calculateWrappedDistance,
} from "./core/math.js";
import {
  expandPolygon,
  pointInPolygon,
  polygonCentroid,
  raySegmentDistance,
} from "./core/geometry.js";
import {
  edgeInwardVector,
  limitOutwardWind,
  readSailingInput,
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
  unwrapPath,
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
  ageCargo,
  bestCargoCompartment,
  cargoCompartmentCapacities,
  CARGO_COMPARTMENTS,
  cargoLotDescription,
  cargoValueMultiplier,
  createCargoLot,
  moveCargoLot,
  normalizeCargoCompartments,
  normalizeCargoLots,
  resolveVoyageCargo,
  syncCargoCounts,
} from "./core/cargo.js";
import {
  buyOrEquipUpgrade,
  calculateShipStats,
  normalizeShipUpgradeState,
  SHIP_UPGRADES,
  UPGRADE_SLOTS,
} from "./core/upgrades.js";
import {
  activeDiscoveryTrade,
  advanceDiscoveryConsequences,
  discoverNearby,
  DISCOVERY_DISPOSITIONS,
  normalizeDiscoveryState,
  resolveDiscovery,
  seasonalSiteActive,
} from "./core/discoveries.js";
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
  resolveHostileEncounter,
  resolveVoyageOperations,
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
  discoverySites,
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

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const DPR = Math.min(2, window.devicePixelRatio || 1);
const WORLD = { w: 6400, h: 2400 };
let vw = 0,
  vh = 0;
const camera = { x: 0, y: 0, zoom: 1 };
const keys = new Set();
let last = performance.now();
let gameStarted = false;
let nearPort = null;
let currentPort = null;
let selectedTown = null;
let messageTimer = 0;
let edgeRecoveryActive = false;
let edgeMessageCooldown = 0;
const SAVE_KEY = "gilded-archipelago-save";

const game = createGameState();

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
function setWeatherForDay(day) {
  const weather = weatherPatterns[(day - 1) % weatherPatterns.length];
  game.weatherName = weather.name;
  game.weatherVisibilityKm = weather.visibilityKm;
  visibility.lastRadius = -1;
}
function currentVisibilityKm() {
  return Math.min(visibility.horizonKm, game.weatherVisibilityKm);
}
function currentWeather() {
  return weatherPatterns[(game.day - 1) % weatherPatterns.length];
}
function applyShipUpgrades() {
  game.shipUpgrades = normalizeShipUpgradeState(game.shipUpgrades);
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
  return { price, production, consumption };
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
    processWorldEventsForDay();
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
    game.windAngle += 0.62 * days;
    game.windStrength = 0.18 + ((game.day * 37) % 22) / 100;
    setWeatherForDay(game.day);
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
  const destinations = contractRoutes[origin.name];
  const destinationName =
    destinations[(index + game.day + origin.name.length) % destinations.length];
  const destination = getPortByName(destinationName),
    distance = wrappedDistance(
      destination.x,
      destination.y,
      origin.x,
      origin.y,
    );
  const courier = index === 1;
  const cargoUnits = courier
    ? 1
    : 2 + ((game.day + index + origin.name.length) % 3);
  const cargoName = courier
    ? "sealed diplomatic pouch"
    : contractCargoNames[
        (game.day * 3 + index + origin.name.length) % contractCargoNames.length
      ];
  const sponsor =
    origin.name === "Goldhaven"
      ? "Guild of Gilded Oars"
      : origin.factions[Math.min(1, index % origin.factions.length)].name;
  const reward = Math.round(
    45 + distance * 0.07 + cargoUnits * 9 + (courier ? 20 : 0),
  );
  const influence = origin.name === "Goldhaven" ? 8 : 5 + index;
  return {
    id: "C" + game.contractSerial++,
    origin: origin.name,
    destination: destinationName,
    title:
      (courier ? "Urgent dispatch" : "Cargo commission") +
      " to " +
      destinationName,
    cargoName,
    cargoUnits,
    reward,
    influence,
    faction: sponsor,
    estimatedDays: Math.max(2, Math.ceil(distance / 430)),
    acceptedDay: null,
    deadline: null,
  };
}
function ensureContractOffers(port) {
  let cache = game.contractOffers[port.name];
  if (!cache || game.day - cache.refreshedDay >= 4) {
    cache = {
      refreshedDay: game.day,
      offers: [0, 1, 2].map((i) => makeContractOffer(port, i)),
    };
    game.contractOffers[port.name] = cache;
  }
  return cache.offers;
}
function contractCargoCount() {
  return game.activeContracts.reduce((sum, c) => sum + c.cargoUnits, 0);
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
  let completed = [];
  for (const contract of game.activeContracts) {
    if (contract.destination !== port.name) {
      remaining.push(contract);
      continue;
    }
    const standing = game.factionStanding[contract.faction] || 0;
    const outcome = contractOutcome(contract, game.day, standing);
    game.coins += outcome.reward;
    changeStanding(contract.faction, outcome.standing);
    if (outcome.completed) {
      game.completedContracts++;
      if (
        contract.origin === "Goldhaven" &&
        contract.faction !== "Guild of Gilded Oars"
      )
        changeStanding("Guild of Gilded Oars", 4);
      completed.push(contract);
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
  if (completed.length)
    showMessage(
      completed.length +
        " contract" +
        (completed.length > 1 ? "s" : "") +
        " completed. Rewards and influence added.",
      4,
    );
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
      color: merchantColors[i % merchantColors.length],
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
  game.merchantSightings[merchant.id] = {
    name: merchant.name,
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

function strokeHandDrawn(c, drawPath, color, width, z = 1) {
  c.save();
  c.strokeStyle = color;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.lineWidth = width / z;
  drawPath();
  c.stroke();
  c.globalAlpha = 0.34;
  c.translate(0.55 / z, -0.35 / z);
  c.lineWidth = Math.max(0.65 / z, (width * 0.55) / z);
  drawPath();
  c.stroke();
  c.restore();
}

function drawMerchantShip(c, merchant, z = 1, renderX = merchant.x) {
  c.save();
  c.translate(renderX, merchant.y);
  c.rotate(merchant.angle + Math.PI / 2);
  c.fillStyle = "rgba(35,24,14,.2)";
  c.beginPath();
  c.ellipse(3, 5, 7, 16, -0.08, 0, Math.PI * 2);
  c.fill();

  c.fillStyle = "#704425";
  c.beginPath();
  c.moveTo(0, -14);
  c.quadraticCurveTo(7, -5, 6, 9);
  c.quadraticCurveTo(4, 13, 0, 16);
  c.quadraticCurveTo(-5, 12, -6, 8);
  c.quadraticCurveTo(-7, -5, 0, -14);
  c.closePath();
  c.fill();
  strokeHandDrawn(
    c,
    () => {
      c.beginPath();
      c.moveTo(0, -14);
      c.quadraticCurveTo(7, -5, 6, 9);
      c.quadraticCurveTo(4, 13, 0, 16);
      c.quadraticCurveTo(-5, 12, -6, 8);
      c.quadraticCurveTo(-7, -5, 0, -14);
      c.closePath();
    },
    "#2b1a10",
    1.25,
    z,
  );

  strokeHandDrawn(
    c,
    () => {
      c.beginPath();
      c.moveTo(-4, 7);
      c.quadraticCurveTo(0, 10, 5, 7);
      c.moveTo(0, -10);
      c.lineTo(0, 9);
    },
    "#342116",
    0.9,
    z,
  );

  c.fillStyle = "#ead9aa";
  c.beginPath();
  c.moveTo(1, -9);
  c.quadraticCurveTo(7, -4, 9, 4);
  c.quadraticCurveTo(5, 3, 1, 6);
  c.closePath();
  c.fill();
  strokeHandDrawn(
    c,
    () => {
      c.beginPath();
      c.moveTo(1, -9);
      c.quadraticCurveTo(7, -4, 9, 4);
      c.quadraticCurveTo(5, 3, 1, 6);
      c.closePath();
    },
    "#483321",
    0.85,
    z,
  );

  c.fillStyle = merchant.color;
  c.beginPath();
  c.moveTo(1, -5);
  c.lineTo(7, -1);
  c.lineTo(1, 1);
  c.closePath();
  c.fill();
  c.restore();
}
function openVesselDetails(merchant) {
  if (!merchant) return;
  selectedMerchant = merchant;
  recordMerchantSighting(merchant);
  document.getElementById("vesselFlag").textContent =
    "Registered merchant · " +
    dominantFaction(getPortByName(merchant.origin)).name;
  document.getElementById("vesselName").textContent = merchant.name;
  document.getElementById("vesselDescription").textContent =
    "A working trader sailing the regional economy in real time. Its arrival will alter market stock at " +
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
  document.getElementById("vesselPanel").style.display = "grid";
}
function closeVesselDetails() {
  document.getElementById("vesselPanel").style.display = "none";
  selectedMerchant = null;
}
function upcomingEvents(days = 9) {
  return game.scheduledEvents
    .filter(
      (e) =>
        !e.started && e.startDay > game.day && e.startDay <= game.day + days,
    )
    .sort((a, b) => a.startDay - b.startDay);
}
function bestTradeOpportunity() {
  let best = null;
  for (const key of Object.keys(goods)) {
    for (const buy of ports) {
      for (const sell of ports) {
        if (buy === sell) continue;
        const margin = sellPriceFor(sell, key) - buyPriceFor(buy, key);
        if (!best || margin > best.margin)
          best = { key, buy: buy.name, sell: sell.name, margin };
      }
    }
  }
  return best;
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
function intelEffectText(report) {
  if (report.type === "forecast")
    return (
      report.affectedPort +
      " has been marked on your chart, and the confidential forecast now appears in that town’s political record."
    );
  if (report.type === "market")
    return (
      "The recommended " +
      report.buyPort +
      " → " +
      report.sellPort +
      " trade is saved in your ledger. Both ports have been marked on your chart. Prices remain dynamic and can change as stock moves."
    );
  if (report.type === "shipping")
    return (
      "The named merchant vessel is now visible on your chart through Day " +
      report.expiresDay +
      ", even when it is beyond normal sight range."
    );
  return "The report has been saved in your captain’s ledger.";
}
function intelActionLabel(report) {
  if (report.type === "forecast") return "Inspect " + report.affectedPort;
  if (report.type === "market") return "Inspect " + report.sellPort;
  if (report.type === "shipping") return "Inspect Tracked Vessel";
  return "Open Ledger";
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
  const wx = wrapX(x);
  return lands.some((land) => pointInPolygon(wx, y, land.poly));
}
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

function saveGameState() {
  if (!gameStarted) return;
  try {
    const data = createSaveData({
      game,
      ship,
      merchants: merchantShips,
      worldEvents,
      exploredMap: exploredMask.toDataURL("image/png"),
      gameStarted,
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
  game.discoveries = normalizeDiscoveryState(game.discoveries);
  game.operations = normalizeOperationsState(game.operations);
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
  game.productionReports ||= {};
  const freshEconomy = createEconomyState(ports, goods);
  for (const port of ports) {
    game.economy[port.name] ||= {};
    for (const key of Object.keys(goods))
      game.economy[port.name][key] ||= freshEconomy[port.name][key];
  }
  Object.assign(ship, saved.ship);
  ship.trail = Array.isArray(saved.ship.trail) ? saved.ship.trail : [];
  applyShipUpgrades();
  merchantShips.length = 0;
  merchantShips.push(...saved.merchants);
  Object.assign(worldEvents, saved.worldEvents);
  gameStarted = saved.gameStarted;
  restoreExploredMap(saved.exploredMap);
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

function seeded(n) {
  let t = n + 0x6d2b79f5;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const mapLayer = document.createElement("canvas");
mapLayer.width = WORLD.w;
mapLayer.height = WORLD.h;
const m = mapLayer.getContext("2d");

// A lower-resolution persistent exploration mask keeps fog rendering fast on
// mobile while retaining a soft, hand-painted edge on the parchment chart.
const FOG_MASK_SCALE = 0.18;
const exploredMask = document.createElement("canvas");
exploredMask.width = Math.ceil(WORLD.w * FOG_MASK_SCALE);
exploredMask.height = Math.ceil(WORLD.h * FOG_MASK_SCALE);
const exploredCtx = exploredMask.getContext("2d");
const fogCanvas = document.createElement("canvas");
const fogCtx = fogCanvas.getContext("2d");
const minimapFog = document.createElement("canvas");
minimapFog.width = 1440;
minimapFog.height = 540;
const minimapFogCtx = minimapFog.getContext("2d");

function drawTree(c, x, y, s) {
  c.save();
  c.translate(x, y);
  c.strokeStyle = "rgba(39,31,20,.9)";
  c.fillStyle = "rgba(63,67,37,.72)";
  c.lineWidth = Math.max(1.4, s * 0.07);
  const trunks = [
    [-0.34, 0.06, 0.72],
    [0, -0.02, 1],
    [0.33, 0.08, 0.7],
  ];
  trunks.forEach(([ox, oy, sc]) => {
    c.beginPath();
    c.moveTo(ox * s, oy * s + s * 0.42 * sc);
    c.lineTo(ox * s, oy * s - s * 0.42 * sc);
    c.stroke();
    for (let tier = 0; tier < 3; tier++) {
      const yy = oy * s - s * (0.36 - tier * 0.2) * sc,
        w = s * (0.28 + tier * 0.08) * sc;
      c.beginPath();
      c.moveTo(ox * s, yy - s * 0.22 * sc);
      c.lineTo(ox * s - w, yy + s * 0.18 * sc);
      c.lineTo(ox * s + w, yy + s * 0.18 * sc);
      c.closePath();
      c.fill();
      c.stroke();
    }
  });
  c.restore();
}
function drawMountain(c, x, y, s) {
  c.save();
  c.translate(x, y);
  c.strokeStyle = "rgba(43,33,21,.9)";
  c.lineWidth = Math.max(1.5, s * 0.065);
  c.fillStyle = "rgba(111,93,57,.28)";
  c.beginPath();
  c.moveTo(-s, s * 0.58);
  c.lineTo(0, -s);
  c.lineTo(s, s * 0.58);
  c.closePath();
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(-s * 0.38, -s * 0.39);
  c.lineTo(0, -s);
  c.lineTo(s * 0.34, -s * 0.43);
  c.lineTo(s * 0.1, -s * 0.54);
  c.lineTo(-s * 0.04, -s * 0.34);
  c.closePath();
  c.stroke();
  c.lineWidth = Math.max(1, s * 0.035);
  for (let i = 0; i < 4; i++) {
    c.beginPath();
    c.moveTo(-s * 0.82 + i * s * 0.16, s * 0.48);
    c.lineTo(-s * 0.22 + i * s * 0.08, -s * 0.13);
    c.stroke();
    c.beginPath();
    c.moveTo(s * 0.82 - i * s * 0.15, s * 0.48);
    c.lineTo(s * 0.24 - i * s * 0.07, -s * 0.08);
    c.stroke();
  }
  c.restore();
}
function drawPortIcon(c, p) {
  c.save();
  c.translate(p.x, p.y);
  const regional = game.regionalEconomy[p.name];
  const evolution = regional ? portEvolution(regional) : {};
  c.strokeStyle = "#291b10";
  c.fillStyle = "#a83f2f";
  c.lineWidth = 3;
  c.beginPath();
  c.arc(0, 0, 8, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  if (evolution.warehouses) {
    c.fillStyle = "rgba(111,66,31,.78)";
    c.fillRect(7, -21, 20, 14);
    c.strokeRect(7, -21, 20, 14);
    c.beginPath();
    c.moveTo(5, -21);
    c.lineTo(17, -29);
    c.lineTo(29, -21);
    c.stroke();
  }
  if (evolution.cranes) {
    c.beginPath();
    c.moveTo(31, -6);
    c.lineTo(31, -39);
    c.lineTo(52, -39);
    c.lineTo(39, -31);
    c.moveTo(47, -37);
    c.lineTo(47, -21);
    c.stroke();
  }
  if (evolution.foundries) {
    c.fillStyle = "rgba(67,51,38,.82)";
    c.fillRect(-39, -29, 9, 23);
    c.strokeRect(-39, -29, 9, 23);
    c.fillStyle = "rgba(76,67,56,.3)";
    c.beginPath();
    c.arc(-34, -37, 7, 0, Math.PI * 2);
    c.fill();
  }
  if (evolution.fortifications) {
    c.beginPath();
    c.moveTo(-45, -4);
    c.lineTo(-45, -18);
    c.lineTo(-39, -18);
    c.lineTo(-39, -13);
    c.lineTo(-31, -13);
    c.lineTo(-31, -4);
    c.stroke();
  }
  if (evolution.crisis) {
    c.fillStyle = "#8d231c";
    c.font = "700 18px Georgia";
    c.fillText("!", -52, -24);
  }
  c.beginPath();
  c.moveTo(0, -10);
  c.lineTo(0, -34);
  c.lineTo(20, -25);
  c.lineTo(0, -18);
  c.stroke();
  c.lineWidth = 1.6;
  c.fillStyle = "rgba(85,55,28,.72)";
  c.fillRect(-25, -18, 8, 12);
  c.strokeRect(-25, -18, 8, 12);
  c.fillRect(-15, -25, 10, 19);
  c.strokeRect(-15, -25, 10, 19);
  c.beginPath();
  c.moveTo(-28, -18);
  c.lineTo(-21, -27);
  c.lineTo(-14, -18);
  c.stroke();
  c.beginPath();
  c.moveTo(-17, -25);
  c.lineTo(-10, -35);
  c.lineTo(-3, -25);
  c.stroke();
  c.fillStyle = "#2a1b10";
  c.font = "700 20px Georgia";
  c.textAlign = "center";
  c.fillText(p.name, 0, 29);
  if (p.home) {
    c.font = "700 12px Georgia";
    c.fillStyle = "rgba(53,31,16,.82)";
    c.fillText("HOME PORT", 0, 46);
  }
  c.restore();
}
function polyPath(c, poly) {
  c.beginPath();
  poly.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
  c.closePath();
}
function drawWaveGlyph(c, x, y, s = 1, alpha = 0.18) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.strokeStyle = `rgba(48,58,49,${alpha})`;
  c.lineWidth = 1.2;
  c.beginPath();
  c.arc(-7, 0, 7, Math.PI * 0.08, Math.PI * 0.92);
  c.arc(7, 0, 7, Math.PI * 0.08, Math.PI * 0.92);
  c.stroke();
  c.restore();
}
function drawRoughWaterMark(c, x, y, s, angle = 0, alpha = 0.32) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.scale(s, s);
  c.strokeStyle = `rgba(43,48,39,${alpha})`;
  c.lineCap = "round";
  c.lineWidth = 1.35;
  c.beginPath();
  c.moveTo(-14, 3);
  c.quadraticCurveTo(-8, -8, -2, 1);
  c.quadraticCurveTo(4, 10, 11, -2);
  c.quadraticCurveTo(15, -7, 20, 1);
  c.stroke();
  c.globalAlpha = 0.58;
  c.beginPath();
  c.moveTo(-9, 8);
  c.quadraticCurveTo(-3, 3, 3, 8);
  c.quadraticCurveTo(9, 13, 15, 7);
  c.stroke();
  c.restore();
}
function drawRock(c, x, y, s = 8) {
  c.save();
  c.translate(x, y);
  c.strokeStyle = "rgba(50,37,22,.72)";
  c.fillStyle = "rgba(105,79,44,.45)";
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(-s, 4);
  c.lineTo(-s * 0.42, -s * 0.72);
  c.lineTo(s * 0.15, -s);
  c.lineTo(s * 0.78, -s * 0.25);
  c.lineTo(s, 4);
  c.closePath();
  c.fill();
  c.stroke();
  c.beginPath();
  c.ellipse(0, 7, s * 1.5, s * 0.45, 0, 0, Math.PI * 2);
  c.strokeStyle = "rgba(65,54,34,.28)";
  c.stroke();
  c.restore();
}
function drawShoal(c, x, y, rx, ry, label) {
  const rnd = seeded(Math.round(x * 7 + y * 13));
  c.save();
  c.translate(x, y);
  c.rotate(-0.16);
  c.strokeStyle = "rgba(69,55,32,.28)";
  c.setLineDash([2, 6]);
  c.lineWidth = 1.2;
  for (let ring = 0; ring < 3; ring++) {
    c.beginPath();
    c.ellipse(0, 0, rx - ring * 12, ry - ring * 7, 0, 0, Math.PI * 2);
    c.stroke();
  }
  c.setLineDash([]);
  c.fillStyle = "rgba(68,52,28,.25)";
  for (let i = 0; i < 170; i++) {
    const a = rnd() * Math.PI * 2,
      r = Math.sqrt(rnd());
    c.fillRect(Math.cos(a) * rx * r, Math.sin(a) * ry * r, 1.2, 1.2);
  }
  c.restore();
  if (label) {
    c.save();
    c.fillStyle = "rgba(45,33,20,.7)";
    c.font = "italic 20px Georgia";
    c.textAlign = "center";
    c.fillText(label, x, y - ry - 13);
    c.restore();
  }
}
function drawRoute(c, points, label) {
  const unwrapped = unwrapPath(points, points[0][0], WORLD.w);
  for (const offset of [-WORLD.w, 0, WORLD.w]) {
    c.save();
    c.translate(offset, 0);
    c.strokeStyle = "rgba(55,39,22,.40)";
    c.fillStyle = "rgba(55,39,22,.50)";
    c.lineWidth = 1.7;
    c.setLineDash([9, 10]);
    c.beginPath();
    unwrapped.forEach((p, i) =>
      i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]),
    );
    c.stroke();
    c.setLineDash([]);
    for (let i = 1; i < unwrapped.length - 1; i++) {
      const [x, y] = unwrapped[i];
      c.save();
      c.translate(x, y);
      c.rotate(Math.PI / 4);
      c.strokeRect(-5, -5, 10, 10);
      c.restore();
    }
    if (label) {
      const mid = unwrapped[Math.floor(unwrapped.length / 2)];
      c.font = "italic 17px Georgia";
      c.textAlign = "center";
      c.fillText(label, mid[0], mid[1] - 16);
    }
    c.restore();
  }
}
function drawCurrent(c, x, y, angle, label) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.strokeStyle = "rgba(54,62,48,.34)";
  c.lineWidth = 2;
  for (let row = -1; row <= 1; row++) {
    c.beginPath();
    c.moveTo(-55, row * 15);
    c.bezierCurveTo(-15, row * 15 - 12, 20, row * 15 + 12, 55, row * 15);
    c.stroke();
    c.beginPath();
    c.moveTo(45, row * 15 - 7);
    c.lineTo(58, row * 15);
    c.lineTo(45, row * 15 + 7);
    c.stroke();
  }
  c.restore();
  c.save();
  c.fillStyle = "rgba(47,39,25,.58)";
  c.font = "italic 18px Georgia";
  c.textAlign = "center";
  c.fillText(label, x, y + 52);
  c.restore();
}
function drawSeaMonster(c, x, y, s = 1) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.strokeStyle = "rgba(51,39,23,.68)";
  c.fillStyle = "rgba(86,74,42,.22)";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-35, 18);
  c.bezierCurveTo(-10, -18, 8, -24, 20, -2);
  c.bezierCurveTo(32, 20, 13, 33, -3, 25);
  c.bezierCurveTo(-18, 18, -14, 5, -4, 2);
  c.stroke();
  c.beginPath();
  c.moveTo(15, -3);
  c.quadraticCurveTo(34, -25, 45, -12);
  c.quadraticCurveTo(52, -3, 38, 5);
  c.stroke();
  c.beginPath();
  c.arc(37, -10, 2.3, 0, Math.PI * 2);
  c.fillStyle = "rgba(45,31,18,.8)";
  c.fill();
  c.beginPath();
  c.moveTo(42, -18);
  c.lineTo(48, -29);
  c.lineTo(50, -16);
  c.stroke();
  c.beginPath();
  c.moveTo(-10, 26);
  c.bezierCurveTo(-20, 43, -38, 45, -45, 31);
  c.stroke();
  c.restore();
}
function drawCompassRose(c, cx, cy, r = 86) {
  c.save();
  c.translate(cx, cy);
  c.strokeStyle = "rgba(42,28,16,.78)";
  c.fillStyle = "rgba(91,59,28,.2)";
  c.lineWidth = 2;
  c.beginPath();
  c.arc(0, 0, r, 0, Math.PI * 2);
  c.stroke();
  c.beginPath();
  c.arc(0, 0, r * 0.72, 0, Math.PI * 2);
  c.stroke();
  c.beginPath();
  for (let i = 0; i < 32; i++) {
    const a = (i * Math.PI) / 16 - Math.PI / 2,
      rr =
        i % 8 === 0
          ? r * 0.92
          : i % 4 === 0
            ? r * 0.66
            : i % 2 === 0
              ? r * 0.46
              : r * 0.27;
    const px = Math.cos(a) * rr,
      py = Math.sin(a) * rr;
    i ? c.lineTo(px, py) : c.moveTo(px, py);
  }
  c.closePath();
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(0, -r * 0.96);
  c.lineTo(-9, 4);
  c.lineTo(0, -8);
  c.lineTo(9, 4);
  c.closePath();
  c.fillStyle = "rgba(48,31,17,.65)";
  c.fill();
  c.stroke();
  c.fillStyle = "rgba(45,30,17,.86)";
  c.font = "700 21px Georgia";
  c.textAlign = "center";
  c.fillText("N", 0, -r - 12);
  c.fillText("S", 0, r + 25);
  c.fillText("W", -r - 18, 7);
  c.fillText("E", r + 18, 7);
  c.restore();
}

function roundedRectPath(c, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  c.moveTo(x + safeRadius, y);
  c.lineTo(x + width - safeRadius, y);
  c.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  c.lineTo(x + width, y + height - safeRadius);
  c.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  c.lineTo(x + safeRadius, y + height);
  c.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  c.lineTo(x, y + safeRadius);
  c.quadraticCurveTo(x, y, x + safeRadius, y);
  c.closePath();
}

function drawParchmentBase(c) {
  c.clearRect(0, 0, WORLD.w, WORLD.h);
  const base = c.createLinearGradient(0, 0, 0, WORLD.h);
  base.addColorStop(0, "#dec58f");
  base.addColorStop(0.5, "#c9aa70");
  base.addColorStop(1, "#b98f51");
  c.fillStyle = base;
  c.fillRect(0, 0, WORLD.w, WORLD.h);
  const rnd = seeded(9917);
  c.save();
  for (let i = 0; i < 85; i++) {
    const x = rnd() * WORLD.w,
      y = rnd() * WORLD.h,
      rx = 18 + rnd() * 120,
      ry = 10 + rnd() * 72;
    const g = c.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    g.addColorStop(0, `rgba(88,48,18,${0.02 + rnd() * 0.07})`);
    g.addColorStop(1, "rgba(88,48,18,0)");
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(x, y, rx, ry, rnd() * Math.PI, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 0.2;
  for (let i = 0; i < 26000; i++) {
    const x = rnd() * WORLD.w,
      y = rnd() * WORLD.h,
      a = 0.08 + rnd() * 0.34;
    c.fillStyle = `rgba(70,42,20,${a})`;
    c.fillRect(x, y, 0.5 + rnd() * 1.7, 0.5 + rnd() * 1.7);
  }
  c.globalAlpha = 0.13;
  c.strokeStyle = "rgba(72,40,17,.55)";
  for (let i = 0; i < 1300; i++) {
    const x = rnd() * WORLD.w,
      y = rnd() * WORLD.h,
      len = 7 + rnd() * 32;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + len, y + (rnd() - 0.5) * 2);
    c.stroke();
  }
  c.restore();
  // folded creases
  c.save();
  c.globalAlpha = 0.18;
  c.strokeStyle = "rgba(76,42,17,.34)";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(WORLD.w * 0.49, 0);
  c.bezierCurveTo(
    WORLD.w * 0.5,
    320,
    WORLD.w * 0.47,
    760,
    WORLD.w * 0.5,
    WORLD.h,
  );
  c.stroke();
  c.strokeStyle = "rgba(255,244,205,.32)";
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(WORLD.w * 0.49 + 4, 0);
  c.bezierCurveTo(
    WORLD.w * 0.5 + 4,
    320,
    WORLD.w * 0.47 + 4,
    760,
    WORLD.w * 0.5 + 4,
    WORLD.h,
  );
  c.stroke();
  c.restore();
  // Polar wear darkens north and south only. East and west remain seamless
  // because those chart edges touch when sailing around the globe.
  const polar = c.createLinearGradient(0, 0, 0, WORLD.h);
  polar.addColorStop(0, "rgba(49,24,8,.43)");
  polar.addColorStop(0.08, "rgba(75,39,14,.12)");
  polar.addColorStop(0.22, "rgba(75,39,14,0)");
  polar.addColorStop(0.78, "rgba(75,39,14,0)");
  polar.addColorStop(0.92, "rgba(75,39,14,.12)");
  polar.addColorStop(1, "rgba(49,24,8,.43)");
  c.fillStyle = polar;
  c.fillRect(0, 0, WORLD.w, WORLD.h);
}
function buildMapLayer() {
  drawParchmentBase(m);
  const rnd = seeded(91);

  // sea glyphs and tiny ink specks
  for (let y = 55; y < WORLD.h - 40; y += 31) {
    for (
      let x = 45 + (Math.floor(y / 31) % 2) * 36;
      x < WORLD.w - 40;
      x += 76
    ) {
      if (!onLand(x, y) && rnd() > 0.11)
        drawWaveGlyph(
          m,
          x + (rnd() - 0.5) * 18,
          y + (rnd() - 0.5) * 8,
          0.58 + rnd() * 0.55,
          0.1 + rnd() * 0.11,
        );
    }
  }
  roughSeas.forEach((sea, seaIndex) => {
    const seaRnd = seeded(8200 + seaIndex * 97);
    for (let i = 0; i < 155 * sea.strength; i++) {
      const theta = seaRnd() * Math.PI * 2;
      const radius = Math.sqrt(seaRnd());
      const x = sea.x + Math.cos(theta) * sea.rx * radius;
      const y = sea.y + Math.sin(theta) * sea.ry * radius;
      if (!onLand(x, y)) {
        drawRoughWaterMark(
          m,
          x,
          y,
          0.55 + seaRnd() * 0.75,
          sea.angle + (seaRnd() - 0.5) * 0.32,
          0.15 + seaRnd() * 0.14,
        );
      }
    }
  });

  // ancient trade routes beneath labels
  drawRoute(
    m,
    [
      [650, 485],
      [850, 570],
      [1070, 780],
      [1190, 1050],
      [1450, 1185],
    ],
    "The Amber Run",
  );
  drawRoute(
    m,
    [
      [1000, 360],
      [1280, 430],
      [1545, 470],
      [1770, 610],
      [2000, 765],
    ],
    "The Moonroad",
  );
  drawRoute(
    m,
    [
      [360, 1140],
      [650, 1215],
      [1030, 1260],
      [1450, 1185],
      [1950, 1105],
    ],
    "Kingfisher Passage",
  );
  merchantRoutePaths
    .slice(9)
    .forEach((route) => drawRoute(m, route.points, null));

  // shoals, bars, currents and hazards
  drawShoal(m, 315, 660, 135, 44, "The Glass Shoals");
  drawShoal(m, 1815, 720, 150, 48, "Whispering Sand");
  drawShoal(m, 1050, 1260, 100, 35, "Widow Bank");
  drawShoal(m, 1290, 560, 85, 28, null);
  drawCurrent(m, 980, 930, 0.18, "Southward Current");
  drawCurrent(m, 1810, 1030, -0.38, "The Grey Drift");
  drawSeaMonster(m, 760, 660, 0.92);
  drawSeaMonster(m, 1760, 1240, 0.66);
  worldShoals.slice(4).forEach((v) => drawShoal(m, ...v));
  worldCurrents.slice(2).forEach((v) => drawCurrent(m, ...v));
  worldMonsters.slice(2).forEach((v) => drawSeaMonster(m, ...v));

  // small islets and reefs, visually rich but not collision obstacles
  for (let i = 0; i < 210; i++) {
    let x = rnd() * WORLD.w,
      y = rnd() * WORLD.h,
      guard = 0;
    while (
      (onLand(x, y) ||
        ports.some((p) => wrappedDistance(x, y, p.x, p.y) < 70)) &&
      guard++ < 20
    ) {
      x = rnd() * WORLD.w;
      y = rnd() * WORLD.h;
    }
    if (!onLand(x, y)) drawRock(m, x, y, 4 + rnd() * 8);
  }

  // Latitude and longitude lines reinforce that this is an encircling world.
  m.save();
  m.strokeStyle = "rgba(62,45,26,.13)";
  m.lineWidth = 1;
  m.setLineDash([5, 12]);
  for (let x = 0; x <= WORLD.w; x += 800) {
    m.beginPath();
    m.moveTo(x, 35);
    m.lineTo(x, WORLD.h - 35);
    m.stroke();
  }
  for (let y = 400; y < WORLD.h; y += 400) {
    m.beginPath();
    m.moveTo(0, y);
    m.lineTo(WORLD.w, y);
    m.stroke();
  }
  m.setLineDash([]);
  m.strokeStyle = "rgba(55,32,16,.72)";
  m.lineWidth = 7;
  m.beginPath();
  m.moveTo(0, 21);
  m.lineTo(WORLD.w, 21);
  m.moveTo(0, WORLD.h - 21);
  m.lineTo(WORLD.w, WORLD.h - 21);
  m.stroke();
  m.strokeStyle = "rgba(92,58,29,.58)";
  m.lineWidth = 2;
  m.beginPath();
  m.moveTo(0, 34);
  m.lineTo(WORLD.w, 34);
  m.moveTo(0, WORLD.h - 34);
  m.lineTo(WORLD.w, WORLD.h - 34);
  m.stroke();
  m.restore();

  // islands with layered coast contours and internal parchment texture
  lands.forEach((l, li) => {
    for (const off of [22, 14, 7]) {
      polyPath(m, expandPolygon(l.poly, off));
      m.strokeStyle = `rgba(54,43,25,${off === 22 ? 0.22 : off === 14 ? 0.34 : 0.48})`;
      m.lineWidth = off === 22 ? 2 : 1.5;
      m.stroke();
    }
    polyPath(m, l.poly);
    m.fillStyle = l.color;
    m.fill();
    m.strokeStyle = "#3b2b1a";
    m.lineWidth = 7;
    m.stroke();
    polyPath(m, l.poly);
    m.strokeStyle = "rgba(230,211,157,.54)";
    m.lineWidth = 2;
    m.stroke();

    // land stipple and short hatching clipped to each island
    m.save();
    polyPath(m, l.poly);
    m.clip();
    const lr = seeded(400 + li * 31);
    m.fillStyle = "rgba(52,38,22,.16)";
    for (let i = 0; i < 320; i++) {
      const x = lr() * WORLD.w,
        y = lr() * WORLD.h;
      if (pointInPoly(x, y, l.poly))
        m.fillRect(x, y, 1 + lr() * 1.5, 1 + lr() * 1.5);
    }
    m.strokeStyle = "rgba(47,36,23,.12)";
    m.lineWidth = 1;
    for (let i = 0; i < 90; i++) {
      const x = lr() * WORLD.w,
        y = lr() * WORLD.h;
      if (pointInPoly(x, y, l.poly)) {
        m.beginPath();
        m.moveTo(x, y);
        m.lineTo(x + 8 + lr() * 12, y - 3 - lr() * 5);
        m.stroke();
      }
    }
    m.restore();

    // Short, irregular hachures give the shore the engraved depth of a
    // navigator's hand-inked chart without obscuring ports or terrain.
    m.save();
    m.strokeStyle = "rgba(48,34,20,.25)";
    m.lineWidth = 1;
    for (let i = 0; i < l.poly.length; i += 3) {
      const [x, y] = l.poly[i];
      const cent = polygonCentroid(l.poly);
      const dx = x - cent.x,
        dy = y - cent.y,
        distance = Math.hypot(dx, dy) || 1,
        nx = dx / distance,
        ny = dy / distance;
      for (let hatch = 0; hatch < 3; hatch++) {
        const shift = hatch * 5;
        m.beginPath();
        m.moveTo(x + nx * (9 + shift), y + ny * (9 + shift));
        m.lineTo(x + nx * (18 + shift), y + ny * (18 + shift));
        m.stroke();
      }
    }
    m.restore();

    if (l.name) {
      const cent = polygonCentroid(l.poly);
      m.fillStyle = "rgba(46,34,20,.58)";
      m.font = "italic 29px Georgia";
      m.textAlign = "center";
      m.fillText(l.name, cent.x, cent.y);
    }
  });

  // original landmarks plus denser procedural groves and ranges
  forests.forEach((v) => drawTree(m, ...v));
  mountains.forEach((v) => drawMountain(m, ...v));
  const detailRnd = seeded(774);
  const forestLands = [
    "Avelorn",
    "Eldergreen",
    "Mistmere",
    "Crownsward",
    "Varkesh",
    "Thornwake",
    "Serpent Coast",
    "Dawnmarch",
    "Dawnward Keys",
    "Duskward Keys",
    "Southmarch",
    "The Jade Dominion",
    "Tempest Crown",
    "Whalegrave",
    "Isle of Saints",
    "Kestrel Chain",
  ];
  const mountainLands = [
    "The Dragonspine",
    "Varkesh",
    "The Ashen Reach",
    "Needle Isle",
    "Thornwake",
    "Serpent Coast",
    "The Ivory Steppe",
    "Dawnmarch",
    "Southmarch",
    "The Jade Dominion",
    "Tempest Crown",
    "Whalegrave",
    "Frostcrown",
  ];
  lands.forEach((l) => {
    if (forestLands.includes(l.name)) {
      for (let i = 0; i < 22; i++) {
        let x,
          y,
          g = 0;
        do {
          x = l.poly[0][0] + detailRnd() * 900;
          y = l.poly[0][1] + detailRnd() * 650;
          g++;
        } while (!pointInPoly(x, y, l.poly) && g < 80);
        if (pointInPoly(x, y, l.poly)) drawTree(m, x, y, 9 + detailRnd() * 10);
      }
    }
    if (mountainLands.includes(l.name)) {
      for (let i = 0; i < 10; i++) {
        let x,
          y,
          g = 0;
        do {
          x = l.poly[0][0] + detailRnd() * 820;
          y = l.poly[0][1] + detailRnd() * 620;
          g++;
        } while (!pointInPoly(x, y, l.poly) && g < 80);
        if (pointInPoly(x, y, l.poly))
          drawMountain(m, x, y, 12 + detailRnd() * 15);
      }
    }
  });

  ports.forEach((p) => drawPortIcon(m, p));

  // sea regions, calligraphic labels, and decorative flourishes
  m.fillStyle = "rgba(45,42,29,.55)";
  m.textAlign = "center";
  m.font = "italic 38px Georgia";
  m.fillText("THE SAPPHIRE SEA", 1200, 520);
  m.font = "italic 27px Georgia";
  m.fillText("THE WESTERN DEEPS", 300, 700);
  m.fillText("SEA OF WHISPERS", 1900, 930);
  m.font = "italic 20px Georgia";
  m.fillText("Calmwater Reach", 470, 830);
  m.fillText("Wyrmwatch Sound", 1510, 690);
  m.fillText("The Pale Expanse", 2050, 450);
  for (const [label, x, y, size] of seaRegionLabels.slice(3)) {
    m.font = "italic " + size + "px Georgia";
    m.fillText(label, x, y);
  }
  m.strokeStyle = "rgba(53,37,20,.42)";
  m.lineWidth = 1.5;
  m.beginPath();
  m.moveTo(1030, 540);
  m.quadraticCurveTo(1200, 575, 1370, 540);
  m.stroke();
  m.beginPath();
  m.moveTo(1135, 550);
  m.quadraticCurveTo(1200, 585, 1265, 550);
  m.stroke();

  drawCompassRose(m, 2200, 235, 84);
  drawCompassRose(m, 4470, 300, 70);
  drawCompassRose(m, 6020, 2180, 66);

  // title cartouche in the empty northwestern sea
  m.save();
  m.translate(285, 210);
  m.strokeStyle = "rgba(56,34,17,.55)";
  m.fillStyle = "rgba(222,195,135,.25)";
  m.lineWidth = 2;
  m.beginPath();
  roundedRectPath(m, -130, -45, 260, 90, 18);
  m.fill();
  m.stroke();
  m.fillStyle = "rgba(47,29,15,.78)";
  m.font = "700 24px Georgia";
  m.textAlign = "center";
  m.fillText("THE ENCIRCLING WORLD", 0, -5);
  m.font = "italic 15px Georgia";
  m.fillText("East and west meet beyond the First Meridian", 0, 20);
  m.restore();
}
buildMapLayer();

function drawAnimatedRoughSeas(c, time, z) {
  c.save();
  c.lineCap = "round";
  for (let seaIndex = 0; seaIndex < roughSeas.length; seaIndex++) {
    const sea = roughSeas[seaIndex];
    const nearestX = nearestWrappedX(sea.x, camera.x);
    const left = nearestX - sea.rx;
    const right = nearestX + sea.rx;
    const top = sea.y - sea.ry;
    const bottom = sea.y + sea.ry;
    if (
      right < camera.x - vw / (2 * z) ||
      left > camera.x + vw / (2 * z) ||
      bottom < camera.y - vh / (2 * z) ||
      top > camera.y + vh / (2 * z)
    )
      continue;

    const rnd = seeded(9300 + seaIndex * 131);
    const count = Math.round(22 * sea.strength);
    for (let i = 0; i < count; i++) {
      const baseX = (rnd() - 0.5) * sea.rx * 1.75;
      const baseY = (rnd() - 0.5) * sea.ry * 1.75;
      const phase = time * (0.00042 + rnd() * 0.0002) + rnd() * Math.PI * 2;
      const swell = 4 + rnd() * 7;
      const x = nearestX + baseX + Math.cos(phase) * swell;
      const y = sea.y + baseY + Math.sin(phase * 1.35) * swell * 0.45;
      if (onLand(x, y)) continue;
      const scale = 0.7 + rnd() * 0.7;
      const crest = (Math.sin(phase) + 1) * 0.5;
      c.save();
      c.translate(x, y);
      c.rotate(sea.angle + (rnd() - 0.5) * 0.24);
      c.scale(scale, scale);
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
  camera.zoom = Math.max(0.72, Math.min(1.05, Math.min(vw / 720, vh / 650)));
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
  message: document.getElementById("message"),
  controlHint: document.getElementById("controlHint"),
  steeringStatus: document.getElementById("steeringStatus"),
  objective: document.getElementById("objectiveText"),
};
function cargoCount() {
  return countCargo(game, contractCargoCount());
}
function updateHud() {
  ui.speed.textContent = Math.round(Math.abs(ship.speed) / 7) + " knots";
  const dirs = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
  const idx =
    Math.round(
      ((((game.windAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) /
        (Math.PI * 2)) *
        8,
    ) % 8;
  ui.wind.textContent = "Wind " + dirs[idx];
  const km = currentVisibilityKm();
  ui.visibility.textContent =
    game.weatherName +
    " · " +
    (km < 10 ? km.toFixed(1) : Math.round(km)) +
    " km sight";
  ui.coins.textContent = game.coins + " crowns";
  ui.day.textContent = "Day " + game.day;
  ui.hold.textContent = cargoCount() + "/" + game.holdMax;
  ui.objective.textContent =
    (game.milestone.complete
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
        "/20") +
    " · longitude " +
    Math.round((wrapX(ship.x) / WORLD.w) * 360) +
    "°";
  if (ship.anchored)
    ui.steeringStatus.textContent = "AT ANCHOR · DRAG THE WHEEL TO SAIL";
  else if (Math.abs(ship.speed) < 5)
    ui.steeringStatus.textContent = "DRAG TOWARD YOUR DESTINATION";
  else ui.steeringStatus.textContent = "SAILING · RELEASE TO COAST";
}
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

function drawShip(c, x, y, a) {
  c.save();
  c.translate(x, y);
  c.rotate(a + Math.PI / 2);

  c.fillStyle = "rgba(37,25,14,.2)";
  c.beginPath();
  c.ellipse(5, 7, 12, 27, -0.08, 0, Math.PI * 2);
  c.fill();

  c.fillStyle = "#754726";
  c.beginPath();
  c.moveTo(0, -25);
  c.quadraticCurveTo(13, -12, 11, 17);
  c.quadraticCurveTo(8, 23, 0, 28);
  c.quadraticCurveTo(-8, 23, -11, 17);
  c.quadraticCurveTo(-13, -11, 0, -25);
  c.closePath();
  c.fill();
  strokeHandDrawn(
    c,
    () => {
      c.beginPath();
      c.moveTo(0, -25);
      c.quadraticCurveTo(13, -12, 11, 17);
      c.quadraticCurveTo(8, 23, 0, 28);
      c.quadraticCurveTo(-8, 23, -11, 17);
      c.quadraticCurveTo(-13, -11, 0, -25);
      c.closePath();
    },
    "#2b1b11",
    2,
  );

  c.fillStyle = "rgba(47,29,17,.24)";
  c.beginPath();
  c.moveTo(-8, 14);
  c.quadraticCurveTo(0, 19, 9, 14);
  c.lineTo(8, 20);
  c.quadraticCurveTo(0, 25, -8, 20);
  c.closePath();
  c.fill();

  strokeHandDrawn(
    c,
    () => {
      c.beginPath();
      c.moveTo(-9, 11);
      c.quadraticCurveTo(0, 16, 10, 11);
      c.moveTo(-8, 17);
      c.quadraticCurveTo(0, 22, 8, 17);
    },
    "#4b2b19",
    1,
  );

  strokeHandDrawn(
    c,
    () => {
      c.beginPath();
      c.moveTo(0, -17);
      c.lineTo(0, 15);
    },
    "#332217",
    1.7,
  );
  strokeHandDrawn(
    c,
    () => {
      c.beginPath();
      c.moveTo(-8, 13);
      c.lineTo(0, -16);
      c.lineTo(10, 12);
    },
    "rgba(61,43,28,.72)",
    0.8,
  );

  c.fillStyle = "#ead9aa";
  c.beginPath();
  c.moveTo(1, -12);
  c.quadraticCurveTo(12, -5, 17, 6);
  c.quadraticCurveTo(9, 5, 1, 10);
  c.closePath();
  c.fill();
  strokeHandDrawn(
    c,
    () => {
      c.beginPath();
      c.moveTo(1, -12);
      c.quadraticCurveTo(12, -5, 17, 6);
      c.quadraticCurveTo(9, 5, 1, 10);
      c.closePath();
    },
    "#493321",
    1.25,
  );

  strokeHandDrawn(
    c,
    () => {
      c.beginPath();
      c.moveTo(3, -8);
      c.quadraticCurveTo(8, -5, 13, 1);
      c.moveTo(3, 5);
      c.quadraticCurveTo(8, 3, 14, 4);
    },
    "rgba(122,88,49,.55)",
    0.7,
  );

  c.fillStyle = "#9c3d2c";
  c.beginPath();
  c.moveTo(2, -5);
  c.quadraticCurveTo(8, -2, 12, 0);
  c.lineTo(2, 3);
  c.closePath();
  c.fill();

  c.fillStyle = "#d8b768";
  for (const deckX of [-5, 5]) {
    c.beginPath();
    c.arc(deckX, 12, 1.1, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

function renderFog() {
  if (!gameStarted) return;
  buildVisibilityPolygon();
  const f = fogCtx;
  f.setTransform(DPR, 0, 0, DPR, 0, 0);
  f.clearRect(0, 0, vw, vh);

  // Uncharted water is an opaque ink wash. Previously seen water remains as a
  // dim chart memory, while the current line of sight is cut out of the wash.
  const wash = f.createLinearGradient(0, 0, vw, vh);
  wash.addColorStop(0, "rgba(25,22,18,.94)");
  wash.addColorStop(0.55, "rgba(18,19,18,.92)");
  wash.addColorStop(1, "rgba(31,24,17,.95)");
  f.fillStyle = wash;
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

function drawDynamicTradeWorld(c, z) {
  c.save();
  for (const site of discoverySites) {
    const record = game.discoveries.found[site.id];
    if (!record) continue;
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
    c.lineDashOffset = -(performance.now() * 0.025) % (28 / z);
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
    const pulse = 25 + Math.sin(performance.now() / 220) * 5;
    c.strokeStyle = "rgba(215,159,55,.95)";
    c.lineWidth = 4 / z;
    c.beginPath();
    c.arc(x, p.y, pulse, 0, Math.PI * 2);
    c.stroke();
  }
  for (const event of game.scheduledEvents) {
    if (!event.known || event.started) continue;
    const t = eventTemplates[event.templateId],
      p = getPortByName(t.port),
      x = nearestWrappedX(p.x, camera.x);
    c.strokeStyle = "rgba(139,78,45,.9)";
    c.lineWidth = 3 / z;
    c.setLineDash([7 / z, 7 / z]);
    c.beginPath();
    c.arc(x, p.y, 34 + Math.sin(performance.now() / 300) * 3, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
  }
  for (const merchant of merchantShips) {
    if (!merchantVisible(merchant)) continue;
    const x = nearestWrappedX(merchant.x, camera.x);
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
  ctx.save();
  ctx.translate(vw / 2, vh / 2);
  ctx.scale(z, z);
  ctx.translate(-camera.x, -camera.y);
  for (const offset of worldCopiesNear(camera.x))
    ctx.drawImage(mapLayer, offset, 0);
  drawAnimatedRoughSeas(ctx, performance.now(), z);
  drawDynamicTradeWorld(ctx, z);
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
    const x = windLeft + ((i * 173 + performance.now() * 0.025) % windSpan),
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
  drawShip(ctx, ship.x, ship.y, ship.angle);
  if (nearPort) {
    const px = nearestWrappedX(nearPort.x, ship.x);
    ctx.strokeStyle = "rgba(173,54,39,.85)";
    ctx.lineWidth = 3 / z;
    ctx.beginPath();
    ctx.arc(
      px,
      nearPort.y,
      42 + Math.sin(performance.now() / 220) * 4,
      0,
      Math.PI * 2,
    );
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
  // vignette
  const vig = ctx.createRadialGradient(
    vw / 2,
    vh / 2,
    Math.min(vw, vh) * 0.25,
    vw / 2,
    vh / 2,
    Math.max(vw, vh) * 0.72,
  );
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(32,20,10,.32)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, vw, vh);
}

const input = { x: 0, y: 0, power: 0 };
let controlsUsed = false;
function hideControlHint() {
  if (controlsUsed) return;
  controlsUsed = true;
  ui.controlHint.classList.add("hidden");
}

function readInput() {
  const result = readSailingInput(keys, input, ship.angle);
  if (result.keyboardActive) hideControlHint();
  return result;
}
const MAP_MARGIN = 58;
const EDGE_RECOVERY_ZONE = 155;
function update(dt) {
  if (!gameStarted || currentPort || selectedTown || selectedMerchant) return;
  updateMerchantShips(dt);
  edgeMessageCooldown = Math.max(0, edgeMessageCooldown - dt);
  const inp = readInput();
  const edge = edgeInwardVector(ship.y, WORLD.h, EDGE_RECOVERY_ZONE);
  edgeRecoveryActive = edge.strength > 0.56;
  if (ship.anchored) {
    ship.speed = 0;
    if (inp.active) {
      ship.anchored = false;
      hideControlHint();
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
  let nx =
    ship.x +
    (Math.cos(ship.angle) * ship.speed + safeWind.x + edge.x * recoveryPush) *
      dt;
  let ny =
    ship.y +
    (Math.sin(ship.angle) * ship.speed + safeWind.y + edge.y * recoveryPush) *
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
    ship.speed = 0;
    showMessage("Shallows ahead — drag the wheel back toward open water.", 1.8);
  } else {
    const oldCycle = Math.floor(ship.x / WORLD.w),
      newCycle = Math.floor(nx / WORLD.w);
    game.voyageDistance += Math.hypot(nx - ship.x, ny - ship.y);
    ship.x = nx;
    ship.y = ny;
    if (oldCycle !== newCycle)
      showMessage(
        "FIRST MERIDIAN CROSSED · the world continues around the globe.",
        3.8,
      );
  }
  camera.x += (ship.x - camera.x) * Math.min(1, dt * 4.5);
  camera.y += (ship.y - camera.y) * Math.min(1, dt * 4.5);
  visibility.revealCooldown -= dt;
  if (visibility.revealCooldown <= 0) {
    revealCurrentView();
    const found = discoverNearby(
      game.discoveries,
      discoverySites,
      ship,
      game.day,
      wrappedDistance,
    );
    for (const discovery of found) {
      addNews(
        "Discovery: " + discovery.site.name,
        discovery.site.description +
          " Decide in the Captain’s Ledger whether to keep, sell, or share it.",
      );
      showMessage(
        "DISCOVERY · " +
          discovery.site.name +
          " — recorded in the Captain’s Ledger",
        4.5,
      );
    }
    visibility.revealCooldown = 0.12;
  }
  ship.trail.unshift({
    x: ship.x - Math.cos(ship.angle) * 20,
    y: ship.y - Math.sin(ship.angle) * 20,
  });
  if (ship.trail.length > 28) ship.trail.pop();
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

addEventListener("keydown", (e) => {
  keys.add(e.key.toLowerCase());
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key))
    e.preventDefault();
});
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

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
  if (input.power > 0.18) hideControlHint();
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
      ) || nearestKnownPort(world.x, world.y, Math.max(45, 34 / camera.zoom))
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
  renderMarket();
  renderCargoPlan();
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

function renderReadiness() {
  const root = document.getElementById("voyageReadiness");
  const ops = game.operations;
  const stats = operationalShipStats();
  const nearbyRoutes = routesFrom(currentPort.name);
  const estimates = nearbyRoutes.map((route) => {
    const destination = route.a === currentPort.name ? route.b : route.a;
    const distance = pathLength(
      orientRoute(route, currentPort.name, destination),
    );
    return { destination, ...estimateVoyageReadiness(distance, stats) };
  });
  root.innerHTML =
    `<div class="ship-stats">${ops.provisions}/30 provisions · ${Math.round(ops.condition)}% overall condition · ${Math.round(ops.morale)} morale · wages Day ${ops.wagesDueDay}</div>` +
    `<div class="component-grid">${Object.entries(SHIP_COMPONENTS)
      .map(
        ([key, component]) =>
          `<div class="component-condition ${ops.components[key] < 40 ? "critical" : ""}"><span>${component.label}</span><b>${Math.round(ops.components[key])}%</b></div>`,
      )
      .join("")}</div>` +
    estimates
      .slice(0, 3)
      .map(
        (estimate) =>
          `<div class="standing-row"><span>${estimate.destination}<span class="small">${estimate.days}d · ${estimate.provisionsNeeded} provisions · ~${estimate.conditionRisk}% wear</span></span></div>`,
      )
      .join("");
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
  root.append(actions);
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
function renderShipyard() {
  const root = document.getElementById("shipyard");
  root.innerHTML = "";
  const stats = applyShipUpgrades();
  document.getElementById("shipStats").textContent =
    stats.holdMax +
    " hold · " +
    Math.round(stats.maxSpeed / 7) +
    " knots · " +
    stats.turnRate.toFixed(2) +
    " turning · " +
    currentVisibilityKm().toFixed(1) +
    " km sight · defense " +
    stats.defense;
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
    const days = Math.max(1, Math.ceil(game.voyageDistance / 620));
    const distance = game.voyageDistance;
    advanceDays(days);
    const stats = operationalShipStats();
    const roughness = weatherRoughness(currentWeather(), stats.stormResistance);
    const operations = resolveVoyageOperations(game.operations, {
      distance,
      days,
      roughness,
      stats,
    });
    game.operations = operations.operations;
    const encounter = resolveHostileEncounter({
      distance,
      risk: hostileRiskBetween(game.departedFromPort, currentPort.name),
      defense: stats.defense,
      seed: game.day + currentPort.name.length + game.departedFromPort.length,
    });
    if (encounter.encountered) {
      game.operations = applyComponentDamage(
        game.operations,
        encounter.componentDamage,
      ).operations;
      game.operations.morale = clampNumber(
        game.operations.morale + encounter.moraleChange,
        0,
        100,
      );
      const coinsLost = Math.min(game.coins, encounter.coinsLost);
      game.coins -= coinsLost;
      addNews(
        encounter.repelled ? "Raiders repelled" : "Raiders board The Wren",
        encounter.repelled
          ? `The ship's defensive armament drove off attackers. Crew morale rose after the victory.`
          : `Attackers caused ${encounter.conditionDamage}% damage and stole ${coinsLost} crowns. Better defensive armament could deter or repel future raids.`,
      );
      showMessage(
        encounter.repelled
          ? "RAIDERS REPELLED · The ship's armament proved its worth."
          : "HOSTILE BOARDING · Raiders damaged the ship and stole crowns.",
        4,
      );
    }
    const outcome = resolveVoyageCargo(game.cargoLots, {
      distance,
      roughness:
        roughness / componentEfficiency(game.operations.components.fittings),
      inspectionRisk:
        stats.inspectionRisk /
        componentEfficiency(game.operations.components.fittings),
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
  document.getElementById("portPanel").style.display = "grid";
  updateHud();
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
      buyQuote = buyPriceFor(currentPort, key),
      baseSellQuote = sellPriceFor(currentPort, key),
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
    const row = document.createElement("div");
    row.className = "trade-row";
    const klass =
      condition === "Shortage"
        ? "condition-shortage"
        : condition === "Surplus" || condition === "Glut"
          ? "condition-surplus"
          : "";
    const label = document.createElement("div");
    label.innerHTML =
      "<b>" +
      goods[key].name +
      '</b><br><span class="small">Buy ' +
      buyQuote +
      " · Sell " +
      sellQuote +
      " crowns · aboard " +
      game.cargo[key] +
      '</span><span class="market-stock"><span class="market-condition ' +
      klass +
      '">' +
      condition +
      "</span> · " +
      Math.floor(state.stock) +
      " units in market</span>" +
      (lots.length
        ? '<span class="cargo-manifest">' +
          lots
            .map(
              (lot, index) =>
                `<span><b>#${index + 1}</b> ${cargoLotDescription(lot)}</span>`,
            )
            .join("") +
          "</span>"
        : "");
    const buy = document.createElement("button");
    buy.textContent = "Buy " + buyQuote;
    buy.title = "Buy one for " + buyQuote + " crowns";
    buy.disabled =
      game.coins < buyQuote || cargoCount() >= game.holdMax || state.stock < 1;
    buy.onclick = () => {
      const livePrice = buyPriceFor(currentPort, key);
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
    sell.disabled = game.cargo[key] <= 0;
    sell.onclick = () => {
      if (game.cargo[key] <= 0) return showMessage("None aboard.");
      const lotIndex = game.cargoLots.findIndex((lot) => lot.key === key);
      const lot = game.cargoLots[lotIndex];
      const livePrice = Math.max(
          1,
          Math.round(
            sellPriceFor(currentPort, key) *
              cargoValueMultiplier(lot, currentPort.name, goods[key]),
          ),
        ),
        cost = lot.cost ?? goods[key].base;
      game.cargoLots.splice(lotIndex, 1);
      syncCargoCounts(game, goods);
      game.coins += livePrice;
      state.stock += 1;
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
    market.append(row);
  });
}
function renderLedger() {
  renderMilestone(document.getElementById("milestoneLedger"));
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
      const row = document.createElement("div");
      row.className = "merchant-sighting";
      row.innerHTML =
        "<span><b>" +
        s.name +
        '</b><br><span class="small">' +
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
function renderDiscoveries() {
  const root = document.getElementById("discoveryLedger");
  root.innerHTML = "";
  const records = Object.values(game.discoveries.found).sort(
    (a, b) => b.foundDay - a.foundDay,
  );
  if (!records.length) {
    root.innerHTML =
      '<p class="empty-note">No hidden places recorded. Sail beyond familiar coasts and investigate close sightings.</p>';
    return;
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
  const outcome =
    disposition === "secret"
      ? "The coordinates remain in your private log."
      : result.consequence.route
        ? "Merchants are preparing to exploit the route; local markets will change."
        : "The information is now public.";
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
ui.dock.addEventListener("click", openPort);
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
  .getElementById("closeReport")
  .addEventListener(
    "click",
    () => (document.getElementById("reportPanel").style.display = "none"),
  );
document.getElementById("reportPanel").addEventListener("click", (e) => {
  if (e.target === document.getElementById("reportPanel"))
    document.getElementById("reportPanel").style.display = "none";
});
document.getElementById("reportLedger").addEventListener("click", () => {
  document.getElementById("reportPanel").style.display = "none";
  renderLedger();
  document.getElementById("ledgerPanel").style.display = "grid";
});
document.getElementById("townDockButton").addEventListener("click", () => {
  const port = selectedTown;
  document.getElementById("townPanel").style.display = "none";
  selectedTown = null;
  minimapWrap.style.display = "none";
  if (port && nearPort === port) openPort();
});
document.getElementById("closePort").addEventListener("click", () => {
  const leaving = currentPort;
  document.getElementById("portPanel").style.display = "none";
  currentPort = null;
  ship.anchored = true;
  game.departedFromPort = leaving ? leaving.name : null;
  game.voyageDistance = 0;
  revealCurrentView(true);
  showMessage(
    "At anchor. Drag the wheel toward open water when you are ready to cast off.",
    3,
  );
});
document.getElementById("beginButton").addEventListener("click", () => {
  document.getElementById("intro").style.display = "none";
  gameStarted = true;
  ship.x = HOME_PORT.spawnX;
  ship.y = HOME_PORT.spawnY;
  ship.angle = HOME_PORT.departureAngle;
  ship.speed = 0;
  ship.anchored = true;
  ship.trail.length = 0;
  camera.x = ship.x;
  camera.y = ship.y;
  nearPort = ports.find((p) => p.home);
  ui.dock.style.display = "block";
  revealCurrentView(true);
  addNews(
    "The first commission",
    "The Guild of Gilded Oars has posted three introductory commissions at Goldhaven. Fulfill them to build influence.",
  );
  addNews(
    "Sails on the horizon",
    "Independent merchants now carry real cargo between the archipelago’s ports. Their arrivals will change local stock and prices.",
  );
  showMessage(
    "Welcome home. Dock at Goldhaven for contracts and intelligence, or watch the sea for merchant traffic.",
    4.5,
  );
  saveGameState();
});
const ledgerButton = document.getElementById("ledgerButton"),
  ledgerPanel = document.getElementById("ledgerPanel");
ledgerButton.addEventListener("click", () => {
  renderLedger();
  ledgerPanel.style.display = "grid";
});
document
  .getElementById("closeLedger")
  .addEventListener("click", () => (ledgerPanel.style.display = "none"));
ledgerPanel.addEventListener("click", (e) => {
  if (e.target === ledgerPanel) ledgerPanel.style.display = "none";
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
  c.fillStyle = "#9e3027";
  c.strokeStyle = "#f1ddb0";
  c.lineWidth = 2;
  c.beginPath();
  c.arc(wrapX(ship.x) * sx, ship.y * sy, 8, 0, Math.PI * 2);
  c.fill();
  c.stroke();
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
  document.getElementById("intro").style.display = "none";
  nearPort =
    ports.find(
      (port) => wrappedDistance(ship.x, ship.y, port.x, port.y) < 95,
    ) || null;
  ui.dock.style.display = nearPort ? "block" : "none";
  revealCurrentView(true);
  showMessage("Voyage restored from this browser.", 3);
} else if (new URLSearchParams(location.search).has("autostart")) {
  requestAnimationFrame(() => document.getElementById("beginButton").click());
}

window.setInterval(saveGameState, 5000);
window.addEventListener("pagehide", saveGameState);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveGameState();
});
