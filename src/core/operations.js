import { clamp } from "./math.js";

export const FACTION_PRIVILEGES = Object.freeze([
  {
    standing: 10,
    label: "Trusted factor",
    privilege: "Warehousing",
    contractReward: 0.05,
  },
  {
    standing: 25,
    label: "Favored captain",
    privilege: "Customs exemption · exclusive cargo · better credit",
    contractReward: 0.1,
    intelDiscount: 0.15,
  },
  {
    standing: 45,
    label: "Chartered ally",
    privilege: "Armed escorts · restricted ship upgrades",
    contractReward: 0.15,
    intelDiscount: 0.25,
  },
]);

export const SHIP_COMPONENTS = Object.freeze({
  hull: { label: "Hull", repairCost: 2 },
  rigging: { label: "Rigging", repairCost: 2 },
  rudder: { label: "Rudder", repairCost: 2 },
  fittings: { label: "Cargo fittings", repairCost: 2 },
  weapons: { label: "Weapons", repairCost: 2 },
});

function freshComponentCondition(value = 100) {
  return Object.fromEntries(
    Object.keys(SHIP_COMPONENTS).map((key) => [key, value]),
  );
}

export function shipCondition(components) {
  const values = Object.keys(SHIP_COMPONENTS).map(
    (key) => components?.[key] ?? 100,
  );
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function componentEfficiency(condition = 100) {
  return clamp(0.45 + (clamp(Number(condition), 0, 100) / 100) * 0.55, 0.45, 1);
}

export function createOperationsState() {
  return {
    provisions: 14,
    condition: 100,
    components: freshComponentCondition(),
    morale: 75,
    wagesDueDay: 8,
    wageArrears: 0,
    obligations: [],
    nextObligationId: 1,
  };
}

export function normalizeOperationsState(value) {
  const fresh = createOperationsState();
  if (!value || typeof value !== "object") return fresh;
  const legacyCondition = clamp(
    Number(value.condition ?? fresh.condition),
    0,
    100,
  );
  const components = freshComponentCondition(legacyCondition);
  for (const key of Object.keys(SHIP_COMPONENTS))
    components[key] = clamp(
      Number(value.components?.[key] ?? legacyCondition),
      0,
      100,
    );
  return {
    provisions: clamp(Number(value.provisions ?? fresh.provisions), 0, 30),
    condition: shipCondition(components),
    components,
    morale: clamp(Number(value.morale ?? fresh.morale), 0, 100),
    wagesDueDay: Math.max(
      1,
      Math.floor(value.wagesDueDay ?? fresh.wagesDueDay),
    ),
    wageArrears: Math.max(0, Math.floor(value.wageArrears ?? 0)),
    obligations: Array.isArray(value.obligations) ? value.obligations : [],
    nextObligationId: Math.max(1, Math.floor(value.nextObligationId ?? 1)),
  };
}

export function applyComponentDamage(operations, damage = {}) {
  const next = normalizeOperationsState(operations);
  const applied = {};
  for (const key of Object.keys(SHIP_COMPONENTS)) {
    const amount = clamp(Math.round(Number(damage[key] || 0)), 0, 100);
    const before = next.components[key];
    next.components[key] = clamp(before - amount, 0, 100);
    applied[key] = before - next.components[key];
  }
  next.condition = shipCondition(next.components);
  return { operations: next, applied };
}

export function factionPrivilege(standing = 0) {
  let privilege = {
    standing: 0,
    label: "Unproven",
    privilege: "No port privileges",
    contractReward: 0,
    intelDiscount: 0,
  };
  for (const candidate of FACTION_PRIVILEGES)
    if (standing >= candidate.standing)
      privilege = { intelDiscount: 0, ...candidate };
  return privilege;
}

export function adjustedContractReward(reward, standing = 0) {
  return Math.round(reward * (1 + factionPrivilege(standing).contractReward));
}

export function adjustedIntelCost(cost, bestLocalStanding = 0) {
  return Math.max(
    1,
    Math.round(cost * (1 - factionPrivilege(bestLocalStanding).intelDiscount)),
  );
}

export function intelligenceFreshness(report, day) {
  const remaining = report.expiresDay - day;
  if (remaining < 0) return { label: "Expired", reliability: 0 };
  const lifetime = Math.max(1, report.expiresDay - (report.boughtDay ?? day));
  const reliability = clamp(remaining / lifetime, 0, 1);
  if (reliability <= 0.34) return { label: "Stale", reliability };
  if (reliability <= 0.67) return { label: "Aging", reliability };
  return { label: "Current", reliability };
}

function voyageRequirements(
  distance,
  stats,
  days = Math.max(1, Math.ceil(distance / 620)),
) {
  const provisionsNeeded = Math.max(
    1,
    Math.ceil((days * 2) / Math.max(0.7, stats.crewComfort)),
  );
  return { days, provisionsNeeded };
}

export function estimateVoyageReadiness(distance, stats) {
  const requirements = voyageRequirements(distance, stats);
  return {
    ...requirements,
    conditionRisk: Math.ceil(
      distance / 260 / Math.max(0.5, stats.stormResistance),
    ),
  };
}

export function weatherRoughness(weather, stormResistance = 1) {
  return (
    Math.max(0, Number(weather?.roughness || 0)) /
    Math.max(0.5, stormResistance)
  );
}

function encounterRoll(seed) {
  const value = Math.sin(Number(seed || 0) * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

export function resolveHostileEncounter({
  distance,
  risk = 0.18,
  defense = 0,
  seed = 0,
}) {
  const exposure = clamp((distance / 1600) * risk, 0, 0.82);
  const deterrence = clamp(defense * 0.16, 0, 0.55);
  const encountered = encounterRoll(seed) < exposure * (1 - deterrence);
  if (!encountered)
    return {
      encountered: false,
      repelled: false,
      conditionDamage: 0,
      componentDamage: {},
      moraleChange: 0,
      coinsLost: 0,
    };

  const attackStrength = 1 + Math.floor(encounterRoll(seed + 1) * 3);
  const repelled = defense >= attackStrength;
  const conditionDamage = repelled
    ? Math.max(0, attackStrength - defense)
    : 3 + attackStrength * 2;
  return {
    encountered: true,
    attackStrength,
    repelled,
    conditionDamage,
    componentDamage: {
      hull: Math.ceil(conditionDamage * 0.7),
      weapons: Math.floor(conditionDamage * 0.3),
    },
    moraleChange: repelled ? 4 : -8 - attackStrength * 2,
    coinsLost: repelled ? 0 : 8 + attackStrength * 7,
  };
}

export function resolveCombatAction({
  action,
  attackStrength = 1,
  defense = 0,
  maxSpeed = 0,
  morale = 50,
  coins = 0,
  seed = 0,
}) {
  const strength = clamp(Math.floor(Number(attackStrength)), 1, 3);
  const availableCoins = Math.max(0, Math.floor(Number(coins)));
  const roll = encounterRoll(seed + 7);

  if (action === "flee") {
    const escapeChance = clamp(
      0.24 + maxSpeed / 420 + morale / 500 - strength * 0.1,
      0.12,
      0.86,
    );
    const escaped = roll < escapeChance;
    return escaped
      ? combatResult("escaped", "You found open water and broke pursuit.", {
          moraleChange: 2,
        })
      : combatResult(
          "caught",
          "The raiders caught the ship as the crew crowded on sail.",
          {
            componentDamage: { rigging: 4 + strength * 2, hull: strength },
            moraleChange: -4 - strength,
            coinsLost: Math.min(availableCoins, 5 + strength * 4),
          },
        );
  }

  if (action === "parley") {
    const demand = Math.min(availableCoins, 8 + strength * 7);
    return combatResult(
      "parleyed",
      demand
        ? `The raiders accepted ${demand} crowns and sheered away.`
        : "Finding no coin aboard, the raiders took their payment from the ship.",
      demand
        ? { coinsLost: demand, moraleChange: -1 }
        : {
            componentDamage: { fittings: 5 + strength * 2 },
            moraleChange: -5,
          },
    );
  }

  if (action === "fight") {
    const combatPower = defense + morale / 55 + roll;
    const won = combatPower >= strength + 0.65;
    return won
      ? combatResult(
          "repelled",
          "Disciplined fire drove the raiders away before they could board.",
          {
            componentDamage: { weapons: strength, rigging: strength },
            moraleChange: 5,
          },
        )
      : combatResult(
          "boarded",
          "The defense faltered and raiders swept across the deck.",
          {
            componentDamage: {
              hull: 4 + strength * 2,
              weapons: 3 + strength * 2,
              fittings: 2 + strength,
            },
            moraleChange: -8 - strength * 2,
            coinsLost: Math.min(availableCoins, 10 + strength * 8),
          },
        );
  }

  return combatResult(
    "surrendered",
    "You struck your colors. The raiders took a measured prize and spared the crew.",
    {
      componentDamage: { fittings: 2 + strength },
      moraleChange: -4,
      coinsLost: Math.min(availableCoins, 7 + strength * 6),
    },
  );
}

function combatResult(outcome, description, effects) {
  return Object.assign(
    {
      componentDamage: {},
      moraleChange: 0,
      coinsLost: 0,
    },
    effects,
    {
      outcome,
      description,
    },
  );
}

export function resolveVoyageOperations(
  operations,
  { distance, days, roughness, stats },
) {
  const next = normalizeOperationsState(operations);
  const { provisionsNeeded } = voyageRequirements(distance, stats, days);
  const provisionsUsed = Math.min(next.provisions, provisionsNeeded);
  const shortage = provisionsNeeded - provisionsUsed;
  next.provisions -= provisionsUsed;

  const damage = clamp(
    Math.round(
      distance / 330 +
        (roughness * distance) / Math.max(150, stats.stormResistance * 850),
    ),
    0,
    35,
  );
  const rawWeights = {
    hull: 1.15 + roughness * 0.2,
    rigging: 0.9 + roughness * 0.45,
    rudder: 0.85 + roughness * 0.15,
    fittings: 0.8 + roughness * 0.25,
    weapons: 0.45,
  };
  const weightAverage =
    Object.values(rawWeights).reduce((sum, weight) => sum + weight, 0) /
    Object.keys(rawWeights).length;
  const componentDamage = Object.fromEntries(
    Object.entries(rawWeights).map(([key, weight]) => [
      key,
      Math.round((damage * weight) / weightAverage),
    ]),
  );
  const damaged = applyComponentDamage(next, componentDamage);
  Object.assign(next, damaged.operations);
  const comfortRecovery = (stats.crewComfort - 1) * days * 3;
  const moraleChange =
    comfortRecovery - days * 1.5 - shortage * 7 - damage * 0.25;
  next.morale = clamp(next.morale + moraleChange, 0, 100);

  return {
    operations: next,
    provisionsNeeded,
    provisionsUsed,
    shortage,
    damage,
    componentDamage: damaged.applied,
    speedMultiplier:
      clamp(0.7 + next.morale / 250, 0.7, 1.08) *
      Math.min(
        componentEfficiency(next.components.rigging),
        componentEfficiency(next.components.rudder),
      ),
  };
}

export function processWages(operations, day, coins, wage = 18) {
  const next = normalizeOperationsState(operations);
  let paid = 0;
  let missed = 0;
  while (day >= next.wagesDueDay) {
    if (coins >= wage) {
      coins -= wage;
      paid += wage;
      next.morale = clamp(next.morale + 4, 0, 100);
    } else {
      next.wageArrears += wage;
      missed += wage;
      next.morale = clamp(next.morale - 14, 0, 100);
    }
    next.wagesDueDay += 7;
  }
  return { operations: next, coins, paid, missed };
}

export function repairOperations(operations, coins) {
  const next = normalizeOperationsState(operations);
  let repaired = 0;
  while (coins >= 2 && next.condition < 100) {
    const key = Object.keys(SHIP_COMPONENTS).sort(
      (left, right) => next.components[left] - next.components[right],
    )[0];
    next.components[key] += 1;
    coins -= SHIP_COMPONENTS[key].repairCost;
    repaired += 1;
    next.condition = shipCondition(next.components);
  }
  return { operations: next, coins, repaired };
}

export function repairShipComponent(operations, coins, component) {
  const next = normalizeOperationsState(operations);
  const definition = SHIP_COMPONENTS[component];
  if (!definition)
    return {
      ok: false,
      reason: "Unknown ship component.",
      operations: next,
      coins,
    };
  const missing = 100 - next.components[component];
  const repaired = Math.min(missing, Math.floor(coins / definition.repairCost));
  next.components[component] += repaired;
  next.condition = shipCondition(next.components);
  return {
    ok: true,
    operations: next,
    coins: coins - repaired * definition.repairCost,
    repaired,
    component,
  };
}

export function buyProvisions(operations, coins, units = 5) {
  const next = normalizeOperationsState(operations);
  const purchased = Math.min(
    units,
    30 - next.provisions,
    Math.floor(coins / 3),
  );
  next.provisions += purchased;
  return { operations: next, coins: coins - purchased * 3, purchased };
}

export function contractOutcome(contract, day, standing = 0) {
  const lateness = day - contract.deadline;
  const fullReward = adjustedContractReward(contract.reward, standing);
  if (lateness <= 0)
    return {
      grade: "On time",
      reward: fullReward,
      standing: contract.influence,
      completed: true,
    };
  if (lateness <= 2)
    return {
      grade: "Late",
      reward: Math.round(fullReward * 0.55),
      standing: -1,
      completed: false,
    };
  return {
    grade: "Defaulted",
    reward: 0,
    standing: -3,
    completed: false,
  };
}

export function maybeCreateObligation(operations, faction, standing, day) {
  const next = normalizeOperationsState(operations);
  if (
    standing < 25 ||
    next.obligations.some((item) => item.faction === faction)
  )
    return { operations: next, obligation: null };
  const obligation = {
    id: `O${next.nextObligationId++}`,
    faction,
    dueDay: day + 8,
    fulfilled: false,
  };
  next.obligations.push(obligation);
  return { operations: next, obligation };
}

export function processObligations(operations, day) {
  const next = normalizeOperationsState(operations);
  const failed = next.obligations.filter(
    (item) => !item.fulfilled && !item.failed && day > item.dueDay,
  );
  for (const item of failed) item.failed = true;
  return { operations: next, failed };
}

export function fulfillObligationsAtPort(operations, factions, day) {
  const next = normalizeOperationsState(operations);
  const fulfilled = next.obligations.filter(
    (item) =>
      !item.fulfilled &&
      !item.failed &&
      day <= item.dueDay &&
      factions.includes(item.faction),
  );
  for (const item of fulfilled) item.fulfilled = true;
  return { operations: next, fulfilled };
}
