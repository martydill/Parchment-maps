import { clamp } from "./math.js";

const RIVAL_PAIRS = Object.freeze([
  ["Deep Delvers’ Union", "Black Hammer Compact"],
  ["Guild of Gilded Oars", "Free Keel Brotherhood"],
  ["Pearl Senate", "Tideborn Commons"],
  ["Silver Loom Consortium", "Reedboat Families"],
  ["Lantern League", "Mirror Knives"],
  ["Divers’ Communion", "Velvet Circle"],
]);

export const FACTION_RIVALRIES = Object.freeze(
  RIVAL_PAIRS.reduce((relationships, [left, right]) => {
    relationships[left] = Object.freeze([right]);
    relationships[right] = Object.freeze([left]);
    return relationships;
  }, {}),
);

export function factionRivals(faction) {
  return FACTION_RIVALRIES[faction] || [];
}

export function factionsAreRivals(left, right) {
  return factionRivals(left).includes(right);
}

export function applyStandingChange(standings, faction, amount) {
  const changes = {};
  const previous = Number(standings[faction] || 0);
  standings[faction] = clamp(previous + amount, -100, 100);
  changes[faction] = standings[faction] - previous;

  if (amount > 0) {
    const rivalLoss = Math.max(1, Math.ceil(amount / 2));
    for (const rival of factionRivals(faction)) {
      const rivalPrevious = Number(standings[rival] || 0);
      standings[rival] = clamp(rivalPrevious - rivalLoss, -100, 100);
      changes[rival] = standings[rival] - rivalPrevious;
    }
  }

  return changes;
}

export function contractConflict(contract, activeContracts, charter = null) {
  if (charter && factionsAreRivals(contract.faction, charter))
    return `Your ${charter} charter bars service to ${contract.faction}.`;
  const conflict = activeContracts.find((active) =>
    factionsAreRivals(contract.faction, active.faction),
  );
  return conflict
    ? `${contract.faction} will not share your service with ${conflict.faction}.`
    : null;
}

export function chooseFactionCharter(game, faction) {
  if (game.factionCharter)
    return {
      ok: false,
      reason: `Already chartered to ${game.factionCharter}.`,
    };
  if ((game.factionStanding[faction] || 0) < 45)
    return { ok: false, reason: "A formal charter requires 45 standing." };

  game.factionCharter = faction;
  const changes = {};
  for (const rival of factionRivals(faction)) {
    const previous = Number(game.factionStanding[rival] || 0);
    game.factionStanding[rival] = clamp(previous - 25, -100, 100);
    changes[rival] = game.factionStanding[rival] - previous;
  }
  return { ok: true, faction, changes };
}
