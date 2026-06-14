import { clamp } from "./math.js";

export const QUALITY_GRADES = Object.freeze({
  poor: { label: "Poor", value: 0.72 },
  common: { label: "Common", value: 1 },
  fine: { label: "Fine", value: 1.24 },
  masterwork: { label: "Masterwork", value: 1.55 },
});

const LEGAL_LABELS = Object.freeze({
  legal: "Legal",
  embargoed: "Embargoed",
  counterfeit: "Counterfeit",
});

export const CARGO_COMPARTMENTS = Object.freeze({
  main: {
    label: "Main hold",
    description: "General stowage without special protection.",
  },
  secured: {
    label: "Secured racks",
    description: "Braced storage that halves breakage risk.",
  },
  dry: {
    label: "Dry locker",
    description: "Ventilated storage that slows spoilage.",
  },
  concealed: {
    label: "Concealed locker",
    description: "Hidden storage that sharply reduces customs risk.",
  },
});

function hash(text) {
  let value = 2166136261;
  for (const character of text) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

export function createCargoLot({
  key,
  cost,
  origin,
  day,
  sequence = 0,
  good = {},
}) {
  const roll = hash(`${key}:${origin}:${day}:${cost}:${sequence}`);
  const special = roll % 100 < 38;
  const qualityKeys = Object.keys(QUALITY_GRADES);
  const quality = special
    ? qualityKeys[(roll >>> 5) % qualityKeys.length]
    : "common";
  let legalStatus = "legal";
  if (special && roll % 17 === 0) legalStatus = "counterfeit";
  else if (special && roll % 11 === 0) legalStatus = "embargoed";

  return {
    id: `${day}-${key}-${roll.toString(36)}`,
    key,
    cost,
    origin,
    acquiredDay: day,
    age: 0,
    quality,
    legalStatus,
    fragility: special
      ? clamp(good.fragility || ((roll >>> 9) % 4) / 4, 0, 1)
      : 0,
    factionOwner:
      special && roll % 7 === 0 ? good.faction || "Independent Factors" : null,
    perishRate: good.perishRate || 0,
    compartment: "main",
  };
}

export function cargoCompartmentCapacities(
  holdMax,
  { concealedLocker = false } = {},
) {
  const capacity = Math.max(0, Math.floor(holdMax));
  const secured = Math.min(3, capacity);
  const dry = Math.min(3, Math.max(0, capacity - secured));
  const concealed = concealedLocker
    ? Math.min(2, Math.max(0, capacity - secured - dry))
    : 0;
  return {
    main: Math.max(0, capacity - secured - dry - concealed),
    secured,
    dry,
    concealed,
  };
}

export function compartmentUsage(lots) {
  const usage = Object.fromEntries(
    Object.keys(CARGO_COMPARTMENTS).map((key) => [key, 0]),
  );
  for (const lot of lots)
    usage[lot.compartment] = (usage[lot.compartment] || 0) + 1;
  return usage;
}

export function normalizeCargoCompartments(lots, capacities) {
  const usage = Object.fromEntries(
    Object.keys(CARGO_COMPARTMENTS).map((key) => [key, 0]),
  );
  for (const lot of lots) {
    const requested = CARGO_COMPARTMENTS[lot.compartment]
      ? lot.compartment
      : "main";
    const available = Object.keys(CARGO_COMPARTMENTS).find(
      (key) => usage[key] < (capacities[key] || 0),
    );
    const compartment =
      usage[requested] < (capacities[requested] || 0) ? requested : available;
    lot.compartment = compartment || "main";
    usage[lot.compartment] = (usage[lot.compartment] || 0) + 1;
  }
  return lots;
}

export function moveCargoLot(lots, lotId, compartment, capacities) {
  const lot = lots.find((candidate) => candidate.id === lotId);
  if (!lot) return { ok: false, reason: "Cargo lot not found." };
  if (!CARGO_COMPARTMENTS[compartment])
    return { ok: false, reason: "Unknown cargo compartment." };
  if (lot.compartment === compartment) return { ok: true, lot };
  const usage = compartmentUsage(lots);
  if (usage[compartment] >= (capacities[compartment] || 0))
    return { ok: false, reason: "That compartment is full." };
  lot.compartment = compartment;
  return { ok: true, lot };
}

export function bestCargoCompartment(lot, capacities, lots) {
  const usage = compartmentUsage(lots);
  const preferences =
    lot.legalStatus !== "legal"
      ? ["concealed", "secured", "main", "dry"]
      : lot.perishRate
        ? ["dry", "secured", "main", "concealed"]
        : lot.fragility
          ? ["secured", "main", "dry", "concealed"]
          : ["main", "secured", "dry", "concealed"];
  return (
    preferences.find((key) => usage[key] < (capacities[key] || 0)) || "main"
  );
}

export function normalizeCargoLots(
  game,
  goods,
  fallbackOrigin = "Unknown",
  capacities,
) {
  game.cargoLots = Array.isArray(game.cargoLots) ? game.cargoLots : [];
  const byKey = Object.groupBy
    ? Object.groupBy(game.cargoLots, (lot) => lot.key)
    : game.cargoLots.reduce((groups, lot) => {
        (groups[lot.key] ||= []).push(lot);
        return groups;
      }, {});
  for (const key of Object.keys(goods)) {
    const expected = Math.max(0, game.cargo[key] || 0);
    const existing = byKey[key] || [];
    for (let index = existing.length; index < expected; index += 1) {
      game.cargoLots.push({
        id: `legacy-${key}-${index}`,
        key,
        cost: game.cargoCost[key]?.[index] ?? goods[key].base,
        origin: fallbackOrigin,
        acquiredDay: game.day,
        age: 0,
        quality: "common",
        legalStatus: "legal",
        fragility: 0,
        factionOwner: null,
        perishRate: goods[key].perishRate || 0,
        compartment: "main",
      });
    }
  }
  if (capacities) normalizeCargoCompartments(game.cargoLots, capacities);
  syncCargoCounts(game, goods);
  return game.cargoLots;
}

export function syncCargoCounts(game, goods) {
  for (const key of Object.keys(goods)) {
    const lots = game.cargoLots.filter((lot) => lot.key === key);
    game.cargo[key] = lots.length;
    game.cargoCost[key] = lots.map((lot) => lot.cost);
  }
}

export function cargoValueMultiplier(lot, destination, good = {}) {
  let multiplier = QUALITY_GRADES[lot.quality]?.value || 1;
  multiplier *= Math.max(
    0.25,
    1 - lot.age * (lot.perishRate || good.perishRate || 0),
  );
  if (lot.origin === destination) multiplier *= 0.94;
  if (lot.legalStatus === "embargoed") multiplier *= 1.38;
  if (lot.legalStatus === "counterfeit") multiplier *= 0.82;
  if (good.premiumPorts?.includes(destination)) multiplier *= 1.22;
  return multiplier;
}

export function ageCargo(lots, days) {
  for (const lot of lots) {
    const protection = lot.compartment === "dry" ? 0.45 : 1;
    lot.age = Math.max(0, (lot.age || 0) + days * protection);
  }
}

export function resolveVoyageCargo(
  lots,
  { distance, roughness = 0, inspectionRisk = 1, seed = 0 },
) {
  const lost = [];
  const confiscated = [];
  const counterfeits = [];
  const remaining = [];
  for (const lot of lots) {
    const roll =
      (hash(`${lot.id}:${seed}:${Math.round(distance)}`) % 10000) / 10000;
    const breakProtection = lot.compartment === "secured" ? 0.45 : 1;
    const breakRisk = clamp(
      (lot.fragility || 0) * breakProtection * roughness * (distance / 1800),
      0,
      0.8,
    );
    const inspectionRoll =
      (hash(`${lot.id}:inspection:${seed}`) % 10000) / 10000;
    const illegal = lot.legalStatus !== "legal";
    const concealment = lot.compartment === "concealed" ? 0.2 : 1;
    if (roll < breakRisk) lost.push(lot);
    else if (
      illegal &&
      inspectionRoll < clamp(0.16 * inspectionRisk * concealment, 0.02, 1)
    ) {
      confiscated.push(lot);
      if (lot.legalStatus === "counterfeit") counterfeits.push(lot);
    } else remaining.push(lot);
  }
  return { remaining, lost, confiscated, counterfeits };
}

export function cargoLotDescription(lot) {
  const details = [
    QUALITY_GRADES[lot.quality]?.label || "Common",
    `from ${lot.origin}`,
  ];
  if (lot.age) details.push(`${lot.age}d old`);
  if (lot.fragility)
    details.push(lot.fragility >= 0.7 ? "very fragile" : "fragile");
  if (lot.legalStatus !== "legal") details.push(LEGAL_LABELS[lot.legalStatus]);
  if (lot.factionOwner) details.push(`${lot.factionOwner} cargo`);
  if (CARGO_COMPARTMENTS[lot.compartment])
    details.push(CARGO_COMPARTMENTS[lot.compartment].label);
  return details.join(" · ");
}
