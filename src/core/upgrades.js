export const BASE_SHIP_STATS = Object.freeze({
  holdMax: 18,
  maxSpeed: 175,
  accel: 120,
  turnRate: 2.7,
  visibilityHeightM: 12,
  windDrift: 1,
  inspectionRisk: 1,
  stormResistance: 1,
  crewComfort: 1,
  defense: 0,
});

export const SHIP_CLASSES = Object.freeze({
  cutter: shipClass(
    "cutter",
    "Merchant cutter",
    "The Wren",
    0,
    "A balanced coastal trader: inexpensive, responsive, and adaptable.",
    {},
  ),
  sloop: shipClass(
    "sloop",
    "Courier sloop",
    "The Peregrine",
    260,
    "A narrow, fast dispatch vessel with limited room for speculative cargo.",
    { maxSpeed: 24, accel: 18, turnRate: 0.24, holdMax: -5 },
  ),
  carrack: shipClass(
    "carrack",
    "Deepwater carrack",
    "The Atlas",
    360,
    "A broad-beamed ocean carrier that exchanges speed and agility for capacity.",
    {
      holdMax: 12,
      maxSpeed: -18,
      accel: -14,
      turnRate: -0.34,
      stormResistance: 0.12,
    },
  ),
  barque: shipClass(
    "barque",
    "Survey barque",
    "The Far Horizon",
    320,
    "A long-range exploration vessel with a tall observation platform and hardened hull.",
    {
      visibilityHeightM: 7,
      stormResistance: 0.22,
      crewComfort: 0.18,
      holdMax: -3,
      maxSpeed: -6,
    },
  ),
  brig: shipClass(
    "brig",
    "Armed merchant brig",
    "The Resolute",
    420,
    "A guarded trader built to discourage raiders, though its weight attracts scrutiny.",
    {
      defense: 2,
      holdMax: 3,
      maxSpeed: -12,
      turnRate: -0.2,
      inspectionRisk: 0.14,
    },
  ),
  dhow: shipClass(
    "dhow",
    "Shallow-draft dhow",
    "The Sandpiper",
    300,
    "An agile, discreet trader suited to uncertain coasts and evasive landfalls.",
    {
      turnRate: 0.42,
      accel: 10,
      inspectionRisk: -0.16,
      windDrift: -0.12,
      holdMax: -2,
      stormResistance: -0.08,
    },
  ),
});

export const UPGRADE_SLOTS = Object.freeze([
  { id: "hull", name: "Hull" },
  { id: "sails", name: "Sails" },
  { id: "rudder", name: "Rudder" },
  { id: "cargo", name: "Cargo fittings" },
  { id: "quarters", name: "Crew quarters" },
  { id: "navigation", name: "Navigation instruments" },
  { id: "armament", name: "Defensive armament" },
]);

export const SHIP_IDENTITIES = Object.freeze({
  courier: identity(
    "Swift courier",
    "Built to outrun schedules, competitors, and trouble.",
    { maxSpeed: 12, accel: 8, holdMax: -2 },
  ),
  freighter: identity(
    "Deepwater freighter",
    "A heavy carrier that turns cargo space into profit at the expense of agility.",
    { holdMax: 4, turnRate: -0.18, accel: -6 },
  ),
  stormrunner: identity(
    "Storm runner",
    "A weatherwise vessel prepared to endure hard passages rather than avoid them.",
    { stormResistance: 0.22, windDrift: -0.08, maxSpeed: -6 },
  ),
  smuggler: identity(
    "Silent trader",
    "A discreet ship made for hidden cargo and evasive landfalls.",
    { inspectionRisk: -0.18, turnRate: 0.16, holdMax: -1 },
  ),
  explorer: identity(
    "Survey barque",
    "A far-seeing expedition ship whose specialist gear consumes working space.",
    { visibilityHeightM: 4, stormResistance: 0.1, holdMax: -2 },
  ),
  escort: identity(
    "Armed escort",
    "A guarded merchant vessel that accepts weight and scrutiny for security.",
    { defense: 1, inspectionRisk: 0.12, maxSpeed: -5 },
  ),
});

const UPGRADE_AFFINITIES = Object.freeze({
  "narrow-hull": ["courier", "smuggler"],
  "reinforced-hull": ["freighter", "stormrunner", "escort"],
  "lateen-sails": ["courier", "stormrunner", "smuggler", "explorer"],
  "towering-sails": ["courier", "freighter", "escort"],
  "balanced-rudder": ["courier", "smuggler"],
  "deep-rudder": ["stormrunner", "explorer", "escort"],
  "reinforced-hold": ["freighter"],
  "smugglers-lockers": ["smuggler"],
  "expanded-quarters": ["freighter", "stormrunner", "explorer"],
  "hammock-deck": ["courier", "escort"],
  "brass-sextant": ["courier", "explorer"],
  "tall-mast": ["stormrunner", "smuggler", "explorer"],
  "swivel-guns": ["escort"],
  "culverin-battery": ["escort", "freighter"],
});

export const SHIP_UPGRADES = Object.freeze({
  hull: [
    upgrade(
      "standard-hull",
      "Weathered carvel hull",
      0,
      "A balanced merchant hull.",
    ),
    upgrade(
      "narrow-hull",
      "Narrow racing hull",
      150,
      "More speed, but less hold space and storm protection.",
      {
        maxSpeed: 22,
        holdMax: -3,
        stormResistance: -0.18,
      },
    ),
    upgrade(
      "reinforced-hull",
      "Iron-braced hull",
      180,
      "Resists heavy weather, at the cost of speed and acceleration.",
      {
        stormResistance: 0.38,
        maxSpeed: -14,
        accel: -10,
      },
    ),
  ],
  sails: [
    upgrade(
      "patched-sails",
      "Patched square sails",
      0,
      "Reliable, ordinary canvas.",
    ),
    upgrade(
      "lateen-sails",
      "Lateen sail plan",
      125,
      "Turns and accelerates quickly, but gives up top speed.",
      {
        turnRate: 0.55,
        accel: 16,
        maxSpeed: -12,
      },
    ),
    upgrade(
      "towering-sails",
      "Towering square rig",
      165,
      "Fast in open water, but slow to answer the helm and vulnerable to wind.",
      {
        maxSpeed: 28,
        turnRate: -0.48,
        windDrift: 0.22,
        stormResistance: -0.12,
      },
    ),
  ],
  rudder: [
    upgrade(
      "oak-rudder",
      "Oak barn-door rudder",
      0,
      "A sturdy, balanced steering surface.",
    ),
    upgrade(
      "balanced-rudder",
      "Balanced rudder",
      110,
      "Sharper handling, with added drag at speed.",
      {
        turnRate: 0.52,
        maxSpeed: -8,
      },
    ),
    upgrade(
      "deep-rudder",
      "Deep-water rudder",
      135,
      "Strong steering authority, but catches wind and rough seas.",
      {
        turnRate: 0.32,
        windDrift: 0.18,
        stormResistance: -0.1,
      },
    ),
  ],
  cargo: [
    upgrade(
      "open-hold",
      "Open merchant hold",
      0,
      "Standard capacity and easy customs access.",
    ),
    upgrade(
      "reinforced-hold",
      "Reinforced cargo racks",
      145,
      "Carries more cargo safely, but the extra weight slows the vessel.",
      {
        holdMax: 6,
        maxSpeed: -10,
        accel: -8,
      },
    ),
    upgrade(
      "smugglers-lockers",
      "Smuggler’s lockers",
      170,
      "Conceals cargo from casual searches, while sacrificing capacity and stability.",
      {
        inspectionRisk: -0.4,
        holdMax: -2,
        stormResistance: -0.12,
      },
    ),
  ],
  quarters: [
    upgrade(
      "plain-berths",
      "Plain crew berths",
      0,
      "Cramped but serviceable accommodations.",
    ),
    upgrade(
      "expanded-quarters",
      "Expanded crew quarters",
      120,
      "Improves morale and endurance, but consumes cargo space.",
      {
        crewComfort: 0.42,
        holdMax: -3,
      },
    ),
    upgrade(
      "hammock-deck",
      "Hammock deck",
      105,
      "Makes room for extra hands and faster sail handling, but adds weight aloft.",
      {
        accel: 14,
        maxSpeed: -6,
        stormResistance: -0.08,
      },
    ),
  ],
  navigation: [
    upgrade(
      "coastal-charts",
      "Coastal charts",
      0,
      "Basic charts and a serviceable compass.",
    ),
    upgrade(
      "brass-sextant",
      "Brass sextant",
      135,
      "Extends reliable sighting range, but its deck station creates drag and clutter.",
      {
        visibilityHeightM: 5,
        accel: -4,
      },
    ),
    upgrade(
      "tall-mast",
      "Tall lookout mast",
      175,
      "Reveals a farther horizon, while making the ship slower to turn and less stormworthy.",
      {
        visibilityHeightM: 10,
        turnRate: -0.25,
        stormResistance: -0.2,
      },
    ),
  ],
  armament: [
    upgrade(
      "unarmed",
      "Unarmed merchantman",
      0,
      "No guns: light, quick, and inexpensive.",
    ),
    upgrade(
      "swivel-guns",
      "Deck swivel guns",
      155,
      "Deters light attackers, but costs speed and hold capacity.",
      {
        defense: 1,
        maxSpeed: -7,
        holdMax: -1,
      },
    ),
    upgrade(
      "culverin-battery",
      "Culverin battery",
      240,
      "Serious protection with serious weight and cargo demands.",
      {
        defense: 2,
        maxSpeed: -18,
        accel: -12,
        holdMax: -3,
        turnRate: -0.18,
      },
    ),
  ],
});

function upgrade(id, name, cost, description, modifiers = {}) {
  return Object.freeze({
    id,
    name,
    cost,
    description,
    modifiers,
    affinities: Object.freeze(UPGRADE_AFFINITIES[id] || []),
  });
}

function identity(name, description, modifiers) {
  return Object.freeze({ name, description, modifiers });
}

function shipClass(id, name, vesselName, cost, description, modifiers) {
  return Object.freeze({
    id,
    name,
    vesselName,
    cost,
    description,
    modifiers: Object.freeze(modifiers),
  });
}

export function createShipUpgradeState() {
  const equipped = {};
  const owned = [];
  for (const slot of UPGRADE_SLOTS) {
    const standard = SHIP_UPGRADES[slot.id][0];
    equipped[slot.id] = standard.id;
    owned.push(standard.id);
  }
  return {
    activeClass: "cutter",
    ownedClasses: ["cutter"],
    equipped,
    owned,
  };
}

export function normalizeShipUpgradeState(state) {
  const normalized = createShipUpgradeState();
  if (!state || typeof state !== "object") return normalized;
  const ownedClasses = new Set(
    Array.isArray(state.ownedClasses) ? state.ownedClasses : [],
  );
  const selectedClass = SHIP_CLASSES[state.activeClass];
  if (selectedClass) normalized.activeClass = selectedClass.id;
  ownedClasses.add(normalized.activeClass);
  normalized.ownedClasses = [...ownedClasses].filter((id) => SHIP_CLASSES[id]);
  const owned = new Set(Array.isArray(state.owned) ? state.owned : []);
  for (const slot of UPGRADE_SLOTS) {
    const choices = SHIP_UPGRADES[slot.id];
    const selected = choices.find(
      (item) => item.id === state.equipped?.[slot.id],
    );
    if (selected) normalized.equipped[slot.id] = selected.id;
    owned.add(normalized.equipped[slot.id]);
  }
  normalized.owned = [...owned].filter((id) => findUpgrade(id));
  return normalized;
}

export function findUpgrade(id) {
  for (const slot of UPGRADE_SLOTS) {
    const item = SHIP_UPGRADES[slot.id].find(
      (candidate) => candidate.id === id,
    );
    if (item) return item;
  }
  return null;
}

export function calculateShipIdentity(upgradeState) {
  const state = normalizeShipUpgradeState(upgradeState);
  const scores = Object.fromEntries(
    Object.keys(SHIP_IDENTITIES).map((id) => [id, 0]),
  );
  for (const id of Object.values(state.equipped)) {
    for (const affinity of findUpgrade(id).affinities) scores[affinity] += 1;
  }
  const ranking = Object.entries(scores).sort(
    ([leftId, leftScore], [rightId, rightScore]) =>
      rightScore - leftScore ||
      Object.keys(SHIP_IDENTITIES).indexOf(leftId) -
        Object.keys(SHIP_IDENTITIES).indexOf(rightId),
  );
  const [id, score] = ranking[0];
  const active = score >= 3;
  return {
    id: active ? id : null,
    name: active ? SHIP_IDENTITIES[id].name : "General merchantman",
    description: active
      ? SHIP_IDENTITIES[id].description
      : "Fit three compatible specialist upgrades to establish a ship identity.",
    score,
    required: 3,
    scores,
    modifiers: active ? SHIP_IDENTITIES[id].modifiers : {},
  };
}

export function calculateShipStats(upgradeState) {
  const stats = { ...BASE_SHIP_STATS };
  const state = normalizeShipUpgradeState(upgradeState);
  for (const [stat, amount] of Object.entries(
    SHIP_CLASSES[state.activeClass].modifiers,
  ))
    stats[stat] += amount;
  for (const id of Object.values(state.equipped)) {
    const item = findUpgrade(id);
    for (const [stat, amount] of Object.entries(item.modifiers))
      stats[stat] += amount;
  }
  for (const [stat, amount] of Object.entries(
    calculateShipIdentity(state).modifiers,
  ))
    stats[stat] += amount;
  return stats;
}

export function buyOrSelectShipClass(game, classId, cargoAboard = 0) {
  const shipClass = SHIP_CLASSES[classId];
  if (!shipClass) return { ok: false, reason: "Unknown ship class." };

  game.shipUpgrades = normalizeShipUpgradeState(game.shipUpgrades);
  if (game.shipUpgrades.activeClass === classId)
    return { ok: false, reason: "That ship is already active." };
  const owned = game.shipUpgrades.ownedClasses.includes(classId);
  if (!owned && game.coins < shipClass.cost)
    return { ok: false, reason: "Not enough crowns." };

  const candidate = normalizeShipUpgradeState(game.shipUpgrades);
  candidate.activeClass = classId;
  if (!candidate.ownedClasses.includes(classId))
    candidate.ownedClasses.push(classId);
  if (calculateShipStats(candidate).holdMax < cargoAboard)
    return {
      ok: false,
      reason: "Unload cargo before changing to this ship class.",
    };

  if (!owned) game.coins -= shipClass.cost;
  game.shipUpgrades = candidate;
  return { ok: true, purchased: !owned, shipClass };
}

export function buyOrEquipUpgrade(game, slotId, upgradeId, cargoAboard = 0) {
  const choices = SHIP_UPGRADES[slotId];
  const item = choices?.find((candidate) => candidate.id === upgradeId);
  if (!item) return { ok: false, reason: "Unknown ship fitting." };

  game.shipUpgrades = normalizeShipUpgradeState(game.shipUpgrades);
  const owned = game.shipUpgrades.owned.includes(item.id);
  if (!owned && game.coins < item.cost)
    return { ok: false, reason: "Not enough crowns." };

  const candidate = normalizeShipUpgradeState(game.shipUpgrades);
  candidate.equipped[slotId] = item.id;
  if (!candidate.owned.includes(item.id)) candidate.owned.push(item.id);
  if (calculateShipStats(candidate).holdMax < cargoAboard)
    return { ok: false, reason: "Unload cargo before fitting this option." };

  if (!owned) game.coins -= item.cost;
  game.shipUpgrades = candidate;
  return { ok: true, purchased: !owned, item };
}
