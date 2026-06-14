import { createShipUpgradeState } from "./upgrades.js";
import { createDiscoveryState } from "./discoveries.js";

export function createGameState() {
  return {
    day: 1,
    coins: 120,
    holdMax: 18,
    shipUpgrades: createShipUpgradeState(),
    cargo: { spice: 0, iron: 0, silk: 0 },
    cargoLots: [],
    windAngle: 0.12,
    windStrength: 0.28,
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
    merchantSightings: {},
    voyageDistance: 0,
    departedFromPort: null,
    discoveries: createDiscoveryState(),
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

export function changeStanding(game, faction, amount, clamp) {
  game.factionStanding[faction] = clamp(
    (game.factionStanding[faction] || 0) + amount,
    -100,
    100,
  );
  return game.factionStanding[faction];
}
