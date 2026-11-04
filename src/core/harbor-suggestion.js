import { PORT_NAMES, FACTION_NAMES } from "../names.js";
import {
  calculateShipStats,
  normalizeShipUpgradeState,
  SHIP_CLASSES,
} from "./upgrades.js";
import { contractCargoCount } from "./contracts.js";

export function harborSuggestion(game, portName, shortageActive) {
  if (portName === PORT_NAMES.orvessaQuay) {
    if (
      shortageActive &&
      !game.milestone.shortageExploited &&
      game.cargo.iron > 0
    )
      return {
        title: "Sell iron toward the convoy charter",
        detail: `${game.milestone.shortageProfit}/50 crowns of shortage profit earned.`,
        tab: "market",
        good: "iron",
      };
    if (
      game.completedContracts >= 3 &&
      game.milestone.shortageExploited &&
      !game.laws.amberConvoy &&
      (game.factionStanding[FACTION_NAMES.syrrelwakeOarwrightPact] || 0) >= 20
    )
      return {
        title: "Charter the Royal Amber Convoy",
        detail: "Spend 20 Guild influence for protected iron shipments.",
        tab: "politics",
      };
    if (
      shortageActive &&
      game.completedContracts >= 3 &&
      !game.milestone.shortageExploited
    )
      return {
        title: "Supply the home port’s iron shortage",
        detail:
          "Buy iron in Narthkel or Drazh Ovek, then sell it here toward the convoy charter.",
        tab: "chart",
        port: PORT_NAMES.narthkel,
      };
  }
  const state = normalizeShipUpgradeState(game.shipUpgrades);
  const current = calculateShipStats(state);
  const cargo =
    Object.values(game.cargo).reduce((sum, n) => sum + n, 0) +
    contractCargoCount(game.activeContracts);
  const ids = game.activeContracts.some((c) => c.kind === "survey")
    ? ["barque", "carrack"]
    : cargo > current.holdMax / 2
      ? ["carrack"]
      : ["sloop", "carrack"];
  for (const id of ids) {
    const vessel = SHIP_CLASSES[id];
    const stats = calculateShipStats({ ...state, activeClass: id });
    if (
      state.ownedClasses.includes(id) ||
      game.coins < vessel.cost + 60 ||
      stats.holdMax < cargo
    )
      continue;
    const benefit =
      id === "carrack"
        ? `${stats.holdMax} hold (${stats.holdMax - current.holdMax >= 0 ? "+" : ""}${stats.holdMax - current.holdMax}); trades agility for carrying space.`
        : id === "barque"
          ? "Greater lookout height, storm resistance, and crew comfort; less cargo space."
          : "Faster acceleration and turning for deliveries; less cargo space.";
    return {
      title: `Consider the ${vessel.name}`,
      detail: `${vessel.cost} crowns · ${benefit}`,
      tab: "vessel",
      vessel: id,
    };
  }
  return null;
}
