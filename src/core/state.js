import { createShipUpgradeState } from "./upgrades.js";
import { createDiscoveryState } from "./discoveries.js";
import { createOperationsState } from "./operations.js";
import { applyStandingChange } from "./factions.js";
import { createExplorationState } from "./exploration.js";
import { createCrisisState } from "./crises.js";
import { createLegalState } from "./jurisdictions.js";
import { createWarehouseState } from "./warehouses.js";
import { createSpecialistState } from "./specialists.js";
import { createNavigationState } from "./navigation.js";
import { createRivalState } from "./rivals.js";
import { createMaritimeHazardState } from "./maritime-hazards.js";
import { createLegacyState } from "./legacies.js";

export function createGameState() {
  return {
    mapSeed: null,
    day: 1,
    coins: 120,
    holdMax: 18,
    shipUpgrades: createShipUpgradeState(),
    cargo: { spice: 0, iron: 0, silk: 0 },
    cargoLots: [],
    windAngle: 0.12,
    windStrength: 0.14,
    weatherName: "Clear",
    weatherVisibilityKm: 24,
    cargoCost: { spice: [], iron: [], silk: [] },
    economy: {},
    productionReports: {},
    contractOffers: {},
    activeContracts: [],
    completedContracts: 0,
    failedContracts: 0,
    contractSerial: 1,
    factionStanding: {},
    factionCharter: null,
    laws: { amberConvoy: false },
    milestone: {
      shortageProfit: 0,
      shortageExploited: false,
      lawChanged: false,
      complete: false,
    },
    news: [],
    intelligence: [],
    intelOffers: {},
    intelSerial: 1,
    scheduledEvents: [],
    activeWorldEvents: [],
    worldEventSerial: 1,
    regionalCrises: createCrisisState(),
    merchantSightings: {},
    voyageDistance: 0,
    voyageDayProgress: 0,
    voyageDaysElapsed: 0,
    departedFromPort: null,
    discoveries: createDiscoveryState(),
    exploration: createExplorationState(),
    operations: createOperationsState(),
    regionalEconomy: {},
    legal: createLegalState(),
    warehouses: createWarehouseState(),
    specialists: createSpecialistState(),
    navigation: createNavigationState(),
    rivals: createRivalState(),
    maritimeHazards: createMaritimeHazardState(),
    legacy: createLegacyState(),
    legacyProgress: { piratesRepelled: 0 },
  };
}

export function cargoCount(game, contractCargo = 0) {
  return (
    Object.values(game.cargo).reduce((total, units) => total + units, 0) +
    contractCargo
  );
}

export function addNews(game, title, body, limit = 18) {
  game.news.unshift({ day: game.day, title, body });
  game.news = game.news.slice(0, limit);
}

export function changeStanding(game, faction, amount, _clamp) {
  applyStandingChange(game.factionStanding, faction, amount);
  return game.factionStanding[faction];
}
