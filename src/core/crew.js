import { clamp } from "./math.js";

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
