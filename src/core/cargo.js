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
  };
}

export function normalizeCargoLots(game, goods, fallbackOrigin = "Unknown") {
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
      });
    }
  }
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
  for (const lot of lots) lot.age = Math.max(0, (lot.age || 0) + days);
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
    const breakRisk = clamp(
      (lot.fragility || 0) * roughness * (distance / 1800),
      0,
      0.8,
    );
    const inspectionRoll =
      (hash(`${lot.id}:inspection:${seed}`) % 10000) / 10000;
    const illegal = lot.legalStatus !== "legal";
    if (roll < breakRisk) lost.push(lot);
    else if (
      illegal &&
      inspectionRoll < clamp(0.16 * inspectionRisk, 0.02, 1)
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
  return details.join(" · ");
}
