import { PORT_NAMES, FACTION_NAMES } from "../names.js";
export function currentObjective({
  game,
  currentPortName = null,
  nearPortName = null,
  homePortName = PORT_NAMES.orvessaQuay,
}) {
  const active = game.activeContracts || [];
  if (active.length) {
    const contract = active
      .slice()
      .sort((left, right) => left.deadline - right.deadline)[0];
    const daysLeft = contract.deadline - game.day;
    if (nearPortName === contract.destination) {
      return {
        id: "deliver-contract",
        title: `Deliver at ${contract.destination}`,
        detail: `Dock now to deliver ${contract.cargoName} and collect ${contract.reward} crowns.`,
        action: "dock",
        destination: contract.destination,
        urgency: daysLeft <= 1 ? "danger" : "ready",
      };
    }
    if (currentPortName) {
      const provisions = game.operations?.provisions || 0;
      return {
        id: provisions < 4 ? "prepare-contract" : "sail-contract",
        title:
          provisions < 4
            ? `Prepare for ${contract.destination}`
            : `Sail to ${contract.destination}`,
        detail:
          provisions < 4
            ? `Buy provisions in Vessel before casting off. The commission is due Day ${contract.deadline}.`
            : `${contract.cargoName} is aboard. Reach ${contract.destination} by Day ${contract.deadline} (${daysLeft} day${daysLeft === 1 ? "" : "s"} left).`,
        action: provisions < 4 ? "vessel" : "map",
        destination: contract.destination,
        urgency: daysLeft <= 1 ? "danger" : "normal",
      };
    }
    return {
      id: "sail-contract",
      title: `Sail to ${contract.destination}`,
      detail: `Deliver ${contract.cargoName} by Day ${contract.deadline} for ${contract.reward} crowns. Open the chart to check your course.`,
      action: "map",
      destination: contract.destination,
      urgency: daysLeft <= 1 ? "danger" : "normal",
    };
  }

  if (game.completedContracts < 3) {
    if (currentPortName === homePortName) {
      return {
        id: "accept-contract",
        title: "Accept your first commission",
        detail: `Open Trade and choose an ${PORT_NAMES.orvessaQuay} commission. Sealed cargo loads automatically and its destination appears on the chart.`,
        action: "trade",
        destination: homePortName,
        urgency: "ready",
      };
    }
    if (nearPortName === homePortName) {
      return {
        id: "dock-home",
        title: `Dock at ${PORT_NAMES.orvessaQuay}`,
        detail:
          "The Guild contract board is waiting. Dock, open Trade, and accept a commission.",
        action: "dock",
        destination: homePortName,
        urgency: "ready",
      };
    }
    return {
      id: "return-home",
      title: `Return to ${PORT_NAMES.orvessaQuay}`,
      detail:
        "Dock at your home port and open Trade to take a Guild commission.",
      action: "map",
      destination: homePortName,
      urgency: "normal",
    };
  }

  if (!game.milestone.shortageExploited) {
    return {
      id: "exploit-shortage",
      title: game.milestone.shortageProfit
        ? "Continue the iron trade"
        : `Exploit ${PORT_NAMES.orvessaQuay}’s iron shortage`,
      detail: `Buy iron cheaply in ${PORT_NAMES.narthkel} or ${PORT_NAMES.drazhOvek}, then sell it in ${PORT_NAMES.orvessaQuay} until you earn 50 crowns of shortage profit.`,
      action: "map",
      destination: game.milestone.shortageProfit
        ? PORT_NAMES.orvessaQuay
        : PORT_NAMES.narthkel,
      urgency: "normal",
    };
  }

  const guildStanding =
    game.factionStanding?.[FACTION_NAMES.syrrelwakeOarwrightPact] || 0;
  if (!game.milestone.lawChanged) {
    return {
      id: "change-law",
      title:
        guildStanding >= 20
          ? "Charter the Royal Amber Convoy"
          : "Build Guild influence",
      detail:
        guildStanding >= 20
          ? `Dock at ${PORT_NAMES.orvessaQuay} and open Politics to spend 20 influence on the convoy charter.`
          : "Complete Guild commissions until your standing reaches 20.",
      action:
        currentPortName === homePortName && guildStanding >= 20
          ? "politics"
          : "map",
      destination: homePortName,
      urgency: "normal",
    };
  }

  return {
    id: "merchant-prince",
    title: "Merchant Prince",
    detail:
      "Your charter is secure. Trade, explore, invest in ports, build faction alliances, and expand your fleet.",
    action: "ledger",
    destination: null,
    urgency: "complete",
  };
}

export function voyageWarnings(operations, estimate) {
  const warnings = [];
  if (operations.provisions < estimate.provisionsNeeded) {
    warnings.push(
      `Load ${estimate.provisionsNeeded - operations.provisions} more provisions.`,
    );
  }
  if (operations.condition < 55) {
    warnings.push("Repair the ship before a demanding passage.");
  }
  if (operations.morale < 35) {
    warnings.push("Low morale will slow the ship and worsen voyage risks.");
  }
  if (operations.wagesDueDay <= estimate.arrivalDay) {
    warnings.push(
      `Crew wages fall due before arrival on Day ${estimate.arrivalDay}.`,
    );
  }
  return warnings;
}
