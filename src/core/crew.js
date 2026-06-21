import { clamp } from "./math.js";

export const CREW_TRAITS = Object.freeze({
  deck: Object.freeze({
    routeSavvy: {
      id: "route-savvy",
      label: "Route-savvy",
      description:
        "Veteran hands trim sail faster on familiar, demanding passages.",
    },
    stormHardened: {
      id: "storm-hardened",
      label: "Storm-hardened",
      description:
        "Green water and hard watches no longer shake the deck crew easily.",
    },
    currentReaders: {
      id: "current-readers",
      label: "Current-readers",
      description:
        "Lookouts read bird paths, weed lines, and swells before the chart confirms them.",
    },
  }),
  marines: Object.freeze({
    boardingDrilled: {
      id: "boarding-drilled",
      label: "Boarding-drilled",
      description:
        "The guard drills until hostile sails look like opportunities, not omens.",
    },
    convoySentinels: {
      id: "convoy-sentinels",
      label: "Convoy sentinels",
      description:
        "Marines learn the patient signals and restraint needed to guard merchant convoys.",
    },
  }),
  artisans: Object.freeze({
    juryRiggers: {
      id: "jury-riggers",
      label: "Jury-riggers",
      description:
        "Carpenters and sailmakers can improvise repairs before damage spreads.",
    },
    copperhands: {
      id: "copperhands",
      label: "Copperhands",
      description:
        "Artisans learn to patch pumps, fittings, and battered hardware with dockyard precision.",
    },
  }),
  stewards: Object.freeze({
    rationMasters: {
      id: "ration-masters",
      label: "Ration-masters",
      description:
        "Pursers stretch stores without making the mess deck feel punished.",
    },
    marketReaders: {
      id: "market-readers",
      label: "Market-readers",
      description:
        "Supercargo clerks spot profitable harbor rumors before rivals do.",
    },
    discreetFactors: {
      id: "discreet-factors",
      label: "Discreet factors",
      description:
        "Stewards keep manifests quiet, cargo stories consistent, and dock gossip useful.",
    },
    contractBrokers: {
      id: "contract-brokers",
      label: "Contract brokers",
      description:
        "The ship's clerks learn which clauses, seals, and introductions turn arrivals into commissions.",
    },
  }),
});

const CREW_TRAIT_BY_ID = Object.freeze(
  Object.fromEntries(
    Object.values(CREW_TRAITS)
      .flatMap((traits) => Object.values(traits))
      .map((trait) => [trait.id, trait]),
  ),
);

export function crewTraitLabel(id) {
  return CREW_TRAIT_BY_ID[id]?.label || id;
}

export const CREW_ROLES = Object.freeze({
  deck: {
    label: "Deck crew",
    description: "Sail handlers and helmsmen; experience steadies the ship.",
    baseCount: 8,
    wage: 1,
    provisions: 1,
  },
  marines: {
    label: "Marines",
    description: "Armed guards who strengthen boarding defense.",
    baseCount: 2,
    wage: 2,
    provisions: 1.25,
  },
  artisans: {
    label: "Artisans",
    description: "Carpenters and sailmakers able to patch damage at sea.",
    baseCount: 2,
    wage: 2,
    provisions: 1,
  },
  stewards: {
    label: "Stewards",
    description: "Pursers and supercargo staff who husband stores and trade.",
    baseCount: 2,
    wage: 1,
    provisions: 0.8,
  },
});

const freshGroup = (role) => ({
  role,
  count: CREW_ROLES[role].baseCount,
  experience: role === "deck" ? 45 : 35,
  fatigue: 0,
  injuries: 0,
  loyalty: 70,
  traits: [],
});

export function createCrewState() {
  return {
    groups: Object.fromEntries(
      Object.keys(CREW_ROLES).map((role) => [role, freshGroup(role)]),
    ),
    mutinyPressure: 0,
    lastIncidentDay: 0,
  };
}

export function normalizeCrewState(value) {
  const fresh = createCrewState();
  if (!value || typeof value !== "object") return fresh;
  for (const role of Object.keys(CREW_ROLES)) {
    const saved = value.groups?.[role];
    if (!saved || typeof saved !== "object") continue;
    const group = fresh.groups[role];
    group.count = clamp(Math.floor(Number(saved.count) || 0), 0, 20);
    group.experience = clamp(Number(saved.experience), 0, 100);
    group.fatigue = clamp(Number(saved.fatigue), 0, 100);
    group.injuries = clamp(
      Math.floor(Number(saved.injuries) || 0),
      0,
      group.count,
    );
    group.loyalty = clamp(Number(saved.loyalty), 0, 100);
    group.traits = Array.isArray(saved.traits)
      ? [
          ...new Set(saved.traits.filter((trait) => typeof trait === "string")),
        ].slice(0, 6)
      : [];
  }
  fresh.mutinyPressure = clamp(Number(value.mutinyPressure), 0, 100);
  fresh.lastIncidentDay = Math.max(
    0,
    Math.floor(Number(value.lastIncidentDay) || 0),
  );
  return fresh;
}

export function crewWeeklyWage(crew) {
  const state = normalizeCrewState(crew);
  return Math.round(
    Object.entries(state.groups).reduce(
      (sum, [role, group]) => sum + group.count * CREW_ROLES[role].wage,
      0,
    ),
  );
}

export function crewVoyageModifiers(crew) {
  const state = normalizeCrewState(crew);
  const effective = (role) => {
    const group = state.groups[role];
    return (
      Math.max(0, group.count - group.injuries) *
      (0.55 + group.experience / 200) *
      (1 - group.fatigue / 160)
    );
  };
  return {
    stormResistance: 1 + Math.max(0, effective("deck") - 4) * 0.025,
    defense: effective("marines") * 0.32,
    provisionMultiplier: clamp(
      Object.entries(state.groups).reduce(
        (sum, [role, group]) => sum + group.count * CREW_ROLES[role].provisions,
        0,
      ) / 14,
      0.65,
      2.4,
    ),
    repairCapacity: Math.ceil(effective("artisans") / 2),
    tradeBonus: Math.min(0.08, effective("stewards") * 0.012),
  };
}

export function applyCrewVoyage(
  crew,
  { days = 1, roughness = 0, shortage = 0 },
) {
  const next = normalizeCrewState(crew);
  const pushed = days >= 4;
  for (const [role, group] of Object.entries(next.groups)) {
    const workload = days * (role === "deck" ? 5 : 3) + roughness * 8;
    group.fatigue = clamp(group.fatigue + workload - (pushed ? 0 : 2), 0, 100);
    group.experience = clamp(group.experience + days * 0.35, 0, 100);
    if (shortage) group.loyalty = clamp(group.loyalty - shortage * 2, 0, 100);
  }
  const injuryRisk = roughness * days + shortage * 0.7;
  if (injuryRisk >= 3) {
    const role = injuryRisk >= 6 ? "deck" : "artisans";
    const group = next.groups[role];
    group.injuries = Math.min(group.count, group.injuries + 1);
  }
  next.mutinyPressure = crewMutinyPressure(next, shortage * 12);
  return next;
}

export function crewMutinyPressure(crew, arrearsPressure = 0) {
  const state = normalizeCrewState(crew);
  const groups = Object.values(state.groups);
  const average = (field) =>
    groups.reduce((sum, group) => sum + group[field], 0) / groups.length;
  return clamp(
    arrearsPressure +
      Math.max(0, 50 - average("loyalty")) * 0.9 +
      Math.max(0, average("fatigue") - 45) * 0.55 +
      groups.reduce((sum, group) => sum + group.injuries, 0) * 2,
    0,
    100,
  );
}

export function resolveCrewIncident(crew, { day, arrears = 0, coins = 0 }) {
  const next = normalizeCrewState(crew);
  next.mutinyPressure = crewMutinyPressure(next, arrears * 0.9);
  if (
    next.mutinyPressure < 35 ||
    day - next.lastIncidentDay < 4 ||
    day % 4 !== 0
  )
    return { crew: next, incident: null };
  next.lastIncidentDay = day;
  const severity = next.mutinyPressure;
  if (severity >= 85) {
    for (const group of Object.values(next.groups))
      group.loyalty = clamp(group.loyalty - 12, 0, 100);
    return {
      crew: next,
      incident: {
        type: "mutiny",
        title: "Mutiny on the lower deck",
        body: "The crew refused orders until the captain restored discipline.",
        morale: -18,
        coinsLost: Math.min(coins, 20),
      },
    };
  }
  const role = severity >= 65 ? "deck" : severity >= 50 ? "stewards" : null;
  if (role) next.groups[role].count = Math.max(0, next.groups[role].count - 1);
  return {
    crew: next,
    incident: {
      type: severity >= 65 ? "desertion" : severity >= 50 ? "theft" : "refusal",
      title:
        severity >= 65
          ? "Crew desertion"
          : severity >= 50
            ? "Stores pilfered"
            : "Orders refused",
      body:
        severity >= 65
          ? "A sailor slipped ashore rather than continue under arrears."
          : severity >= 50
            ? "Disloyal hands stole from the ship's purse."
            : "Exhausted hands refused an extra watch.",
      morale: severity >= 65 ? -8 : -5,
      coinsLost: severity >= 50 ? Math.min(coins, 8) : 0,
    },
  };
}

export function portRecruitmentPool(portName, population = 0) {
  const roles = Object.keys(CREW_ROLES);
  const seed = [...portName].reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  );
  return roles.map((role, index) => ({
    role,
    available: 1 + ((seed + index * 3 + Math.floor(population / 10000)) % 5),
    experience: 25 + ((seed * (index + 2)) % 46),
    cost: 5 + Math.round(CREW_ROLES[role].wage * 3),
  }));
}

export function recruitCrew(crew, offer, coins) {
  const next = normalizeCrewState(crew);
  if (!CREW_ROLES[offer?.role])
    return { ok: false, reason: "Unknown crew role.", crew: next, coins };
  if (offer.available <= 0)
    return {
      ok: false,
      reason: "No recruits remain in this pool.",
      crew: next,
      coins,
    };
  if (coins < offer.cost)
    return { ok: false, reason: "Not enough crowns.", crew: next, coins };
  const group = next.groups[offer.role];
  group.experience =
    (group.experience * group.count + offer.experience) / (group.count + 1);
  group.count += 1;
  group.loyalty = clamp(group.loyalty + 2, 0, 100);
  return { ok: true, crew: next, coins: coins - offer.cost };
}

export function takeShoreLeave(crew, coins, days = 1) {
  const next = normalizeCrewState(crew);
  const count = Object.values(next.groups).reduce(
    (sum, group) => sum + group.count,
    0,
  );
  const cost = Math.max(8, Math.ceil(count * 0.75));
  if (coins < cost)
    return {
      ok: false,
      reason: "Not enough crowns for shore leave.",
      crew: next,
      coins,
      days: 0,
    };
  for (const group of Object.values(next.groups)) {
    group.fatigue = clamp(group.fatigue - 28, 0, 100);
    group.loyalty = clamp(group.loyalty + 10, 0, 100);
    group.injuries = Math.max(0, group.injuries - 1);
  }
  next.mutinyPressure = crewMutinyPressure(next);
  return { ok: true, crew: next, coins: coins - cost, cost, days };
}

export function applyCrewTrait(
  crew,
  role,
  traitId,
  experience = 0,
  loyalty = 0,
) {
  const next = normalizeCrewState(crew);
  const group = next.groups[role];
  if (!group || !CREW_TRAIT_BY_ID[traitId]) {
    return { crew: next, gained: false };
  }
  const hadTrait = group.traits.includes(traitId);
  group.traits = [...new Set([...group.traits, traitId])].slice(0, 6);
  group.experience = clamp(group.experience + experience, 0, 100);
  group.loyalty = clamp(group.loyalty + loyalty, 0, 100);
  return { crew: next, gained: !hadTrait };
}

export function resolveCrewVoyageEvent(crew, context = {}) {
  let next = normalizeCrewState(crew);
  const days = Math.max(0, Math.floor(Number(context.days) || 0));
  const distance = Math.max(0, Number(context.distance) || 0);
  const roughness = Math.max(0, Number(context.roughness) || 0);
  const shortage = Math.max(0, Number(context.shortage) || 0);
  const routePlan = context.routePlan || "balanced";
  const specialistId = context.specialistId || null;
  const eventSeed = String(
    context.seed ||
      `${context.origin || "sea"}:${context.destination || "port"}:${days}:${Math.round(distance)}`,
  );

  if (days < 1 && distance < 400 && roughness < 0.25 && !shortage) {
    return { crew: next, event: null };
  }

  const candidates = [
    {
      id: "navigator-drills",
      role: "deck",
      trait: CREW_TRAITS.deck.routeSavvy.id,
      officer: "navigator",
      score:
        (specialistId === "navigator" ? 5 : 0) +
        (distance >= 1100 ? 3 : 0) +
        (days >= 3 ? 2 : 0),
      title: "Navigator's noon drills",
      body: "The navigator turns every watch change into a lesson in bearings, sail trim, and remembered landmarks.",
      morale: 1,
      officerLoyalty: 2,
    },
    {
      id: "boatswain-rigging",
      role: "artisans",
      trait: CREW_TRAITS.artisans.juryRiggers.id,
      officer: "boatswain",
      score:
        (specialistId === "boatswain" ? 5 : 0) +
        (roughness >= 0.45 ? 4 : 0) +
        (routePlan === "fast" ? 2 : 0),
      title: "Boatswain's damage party",
      body: "The boatswain keeps spare line, wedges, and tar ready until the artisans can patch trouble before it blooms.",
      morale: 1,
      repair: { rigging: 3, hull: 1 },
      officerLoyalty: 2,
    },
    {
      id: "gunner-quarters",
      role: "marines",
      trait: CREW_TRAITS.marines.boardingDrilled.id,
      officer: "gunner",
      score:
        (specialistId === "gunner" ? 5 : 0) +
        (routePlan === "battle" ? 4 : 0) +
        (days >= 2 ? 1 : 0),
      title: "Gunner's prize quarters",
      body: "The gunner drills the marines at boarding stations until the ship can answer a hostile hail without panic.",
      morale: 2,
      officerLoyalty: 2,
    },
    {
      id: "purser-ledger",
      role: "stewards",
      trait: shortage
        ? CREW_TRAITS.stewards.rationMasters.id
        : CREW_TRAITS.stewards.marketReaders.id,
      officer: "purser",
      score:
        (specialistId === "purser" || specialistId === "factor" ? 5 : 0) +
        (shortage ? 5 : 0) +
        (routePlan === "rationing" ? 3 : 0),
      title: shortage ? "Purser's hard ledger" : "Stewards' harbor ledger",
      body: shortage
        ? "The purser rewrites the mess rota so short rations feel planned rather than desperate."
        : "The stewards compare manifests, whispers, and prices until the next market opens before the ship docks.",
      morale: shortage ? 3 : 1,
      provisions: shortage ? 1 : 0,
      officerLoyalty: 2,
    },
    {
      id: "storm-watch",
      role: "deck",
      trait: CREW_TRAITS.deck.stormHardened.id,
      officer: "surgeon",
      score: (roughness >= 0.75 ? 6 : 0) + (days >= 3 ? 2 : 0),
      title: "Storm-watch rotation",
      body: "The surgeon and mates enforce dry blankets, short watches, and hot broth until the deck crew learns how to endure dirty weather.",
      morale: 2,
      officerLoyalty: specialistId === "surgeon" ? 2 : 0,
    },
    {
      id: "naturalist-sea-signs",
      role: "deck",
      trait: CREW_TRAITS.deck.currentReaders.id,
      officer: "naturalist",
      score:
        (specialistId === "naturalist" ? 5 : 0) +
        (distance >= 900 ? 2 : 0) +
        (roughness < 0.35 ? 2 : 0),
      title: "Naturalist's sea signs",
      body: "The naturalist makes the lookouts compare birds, water color, and drifting weed until the sea itself becomes a second chart.",
      morale: 1,
      officerLoyalty: 2,
    },
    {
      id: "smuggler-manifest-lessons",
      role: "stewards",
      trait: CREW_TRAITS.stewards.discreetFactors.id,
      officer: "smuggler",
      score:
        (specialistId === "smuggler" ? 5 : 0) +
        (distance >= 700 ? 2 : 0) +
        (routePlan === "fast" ? 1 : 0),
      title: "Smuggler's manifest lessons",
      body: "The smuggler teaches the stewards how to keep manifests plausible, quiet, and ready for unfriendly questions.",
      morale: 1,
      officerLoyalty: 2,
    },
    {
      id: "factor-quay-auction",
      role: "stewards",
      trait: CREW_TRAITS.stewards.contractBrokers.id,
      officer: "factor",
      score:
        (specialistId === "factor" ? 5 : 0) +
        (days >= 2 ? 2 : 0) +
        (routePlan === "balanced" ? 1 : 0),
      title: "Factor's quay auction",
      body: "The factor rehearses introductions, seals, and cargo stories with the stewards before the harbor brokers can set the terms.",
      morale: 1,
      officerLoyalty: 2,
    },
    {
      id: "convoy-signal-watch",
      role: "marines",
      trait: CREW_TRAITS.marines.convoySentinels.id,
      officer: "gunner",
      score:
        (routePlan === "battle" ? 4 : 0) +
        (distance >= 1000 ? 2 : 0) +
        (specialistId === "gunner" ? 1 : 0),
      title: "Convoy signal watch",
      body: "The marines practice lantern codes and warning shots until they can guard a merchant line without wasting powder.",
      morale: 1,
      officerLoyalty: specialistId === "gunner" ? 1 : 0,
    },
    {
      id: "dockyard-hardware-drills",
      role: "artisans",
      trait: CREW_TRAITS.artisans.copperhands.id,
      officer: "boatswain",
      score:
        (days >= 4 ? 3 : 0) +
        (roughness < 0.5 ? 2 : 0) +
        (specialistId === "boatswain" ? 1 : 0),
      title: "Dockyard hardware drills",
      body: "Between watches, the artisans practice pump, hinge, and fitting repairs with the boatswain's battered box of spare copper.",
      morale: 1,
      repair: { fittings: 2, rudder: 1 },
      officerLoyalty: specialistId === "boatswain" ? 1 : 0,
    },
  ];

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return `${eventSeed}:${a.id}`.localeCompare(`${eventSeed}:${b.id}`);
  });

  const chosen = candidates.find(
    (candidate) =>
      candidate.score > 0 &&
      !next.groups[candidate.role].traits.includes(candidate.trait),
  );
  if (!chosen) return { crew: next, event: null };

  const applied = applyCrewTrait(
    next,
    chosen.role,
    chosen.trait,
    3 + Math.min(days, 4),
    chosen.morale,
  );
  next = applied.crew;
  if (chosen.provisions) {
    for (const group of Object.values(next.groups)) {
      group.loyalty = clamp(group.loyalty + 1, 0, 100);
    }
  }
  return {
    crew: next,
    event: {
      id: chosen.id,
      title: chosen.title,
      body: chosen.body,
      role: chosen.role,
      roleLabel: CREW_ROLES[chosen.role].label,
      trait: chosen.trait,
      traitLabel: crewTraitLabel(chosen.trait),
      morale: chosen.morale,
      repair: chosen.repair || {},
      provisions: chosen.provisions || 0,
      officer: chosen.officer,
      officerLoyalty: chosen.officerLoyalty || 0,
      gained: applied.gained,
    },
  };
}
