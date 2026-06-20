const APPROACHES = Object.freeze({
  recon: {
    label: "Reconnoiter",
    days: 1,
    provisions: 2,
    difficulty: 0,
    rewardScale: 0.65,
  },
  standard: {
    label: "Standard expedition",
    days: 3,
    provisions: 5,
    difficulty: 8,
    rewardScale: 1,
  },
  deep: {
    label: "Deep expedition",
    days: 6,
    provisions: 9,
    difficulty: 18,
    rewardScale: 1.45,
  },
});

export const EXPLORATION_APPROACHES = APPROACHES;

export function createExplorationState() {
  return {
    expeditionSerial: 1,
    sites: {},
    history: [],
  };
}

export function normalizeExplorationState(value) {
  const fresh = createExplorationState();
  if (!value || typeof value !== "object") return fresh;
  return {
    expeditionSerial: Math.max(
      1,
      Math.floor(Number(value.expeditionSerial) || 1),
    ),
    sites:
      value.sites && typeof value.sites === "object"
        ? value.sites
        : fresh.sites,
    history: Array.isArray(value.history) ? value.history : fresh.history,
  };
}

function hash(text) {
  let value = 2166136261;
  for (let index = 0; index < text.length; index++) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

export function explorationHazardProfile(site) {
  const text = String(site?.hazards || "").toLowerCase();
  if (text.includes("reef")) return "reefs";
  if (text.includes("jungle") || text.includes("thornwood")) return "jungle";
  if (text.includes("cliff") || text.includes("scree")) return "cliffs";
  if (text.includes("fogbound") || text.includes("fog")) return "fogbound";
  if (text.includes("ruin")) return "ruins";
  if (text.includes("marsh") || text.includes("mud")) return "marsh";
  return "general";
}

function hazardRoll(site, day, approach, serial, salt) {
  return hash(`${site.id}:${day}:${approach}:${serial}:${salt}`) % 100;
}

/* node:coverage disable */
function resolveHazardEffects({
  site,
  approach,
  day,
  serial,
  success,
  context = {},
}) {
  const profile = explorationHazardProfile(site);
  const effects = {
    profile,
    label: "Local hazards",
    notes: [],
    morale: 0,
    provisions: 0,
    injuries: 0,
    reward: 0,
    damage: {},
  };
  const intensity = approach === "deep" ? 2 : approach === "standard" ? 1 : 0;
  const roll = hazardRoll(site, day, approach, serial, profile);
  const specialist = Math.max(0, Number(context.hazardSpecialistBonus || 0));

  if (profile === "reefs") {
    effects.label = "Hidden reefs";
    const hasGear = Boolean(context.hasSoundingGear);
    const hull = Math.max(
      0,
      Math.min(100, Number(context.hullCondition ?? 100)),
    );
    const reefRisk =
      roll + (hasGear ? -24 : 10) + (hull < 55 ? 18 : 0) - specialist;
    if (reefRisk >= 58) {
      effects.damage.hull = 3 + intensity + (hull < 40 ? 2 : 0);
      effects.notes.push(
        "Reef soundings came late; the hull took coral scrapes.",
      );
    } else {
      effects.notes.push(
        hasGear
          ? "Sounding gear found a safe channel."
          : "Careful leadsmen kept the keel clear.",
      );
    }
  } else if (profile === "jungle") {
    effects.label = "Jungle gullies";
    effects.provisions = 1 + intensity;
    effects.morale = roll > 45 + specialist ? -(2 + intensity) : -1;
    effects.notes.push(
      "Heat, insects, and tangled gullies consumed extra stores and patience.",
    );
  } else if (profile === "cliffs") {
    effects.label = "Exposed cliffs";
    const protectedClimb = Boolean(context.hasClimberOrGuide);
    const cliffRisk = roll + (protectedClimb ? -28 : 8) - specialist;
    if (cliffRisk >= 52 || !success) {
      effects.injuries = protectedClimb ? 0 : 1;
      effects.notes.push(
        protectedClimb
          ? "A guide picked safer traverses across the cliffs."
          : "Loose scree caused a climbing injury.",
      );
    }
  } else if (profile === "fogbound") {
    effects.label = "Fogbound channels";
    const visibility = Math.max(0, Number(context.visibilityKm ?? 24));
    const roughness = Math.max(0, Number(context.weatherRoughness ?? 0));
    const fogRisk =
      roll +
      (visibility < 10 ? 24 : visibility < 16 ? 10 : -8) +
      Math.round(roughness * 18) -
      specialist;
    if (fogRisk >= 55) {
      effects.morale = -(2 + intensity);
      effects.damage.rudder = 1 + intensity;
      effects.notes.push(
        "Poor visibility turned the channels into a blind, nerve-wracking crawl.",
      );
    } else {
      effects.notes.push(
        "Clearer weather helped the boats thread the channels.",
      );
    }
  } else if (profile === "ruins") {
    effects.label = "Unstable ruins";
    const scholar = Boolean(context.hasScholar);
    if (roll < 22 + (scholar ? 18 : 0) && success) {
      effects.reward = 18 + intensity * 8 + (scholar ? 14 : 0);
      effects.notes.push(
        scholar
          ? "A scholar identified a valuable relic cache."
          : "The crew recovered a small relic cache.",
      );
    } else if (roll > 78 - specialist) {
      effects.injuries = 1;
      effects.morale = -2;
      effects.notes.push(
        "A collapsing arch and whispered curse shook the expedition.",
      );
    }
  } else if (profile === "marsh") {
    effects.label = "Marsh sickness";
    effects.provisions = intensity;
    if (roll + intensity * 10 - specialist >= 48) {
      effects.morale = -(3 + intensity);
      effects.injuries = roll > 82 ? 1 : 0;
      effects.notes.push(
        "Marsh fever and mutinous grumbling spread through the shore party.",
      );
    } else {
      effects.notes.push("The marsh was miserable, but discipline held.");
    }
  }

  if (!effects.notes.length)
    effects.notes.push("The listed hazards caused no lasting trouble.");
  return effects;
}

/* node:coverage enable */
export function expeditionRequirements(approach) {
  return APPROACHES[approach] || null;
}

export function resolveExpedition({
  state,
  site,
  approach,
  day,
  provisions,
  morale,
  specialistBonus = 0,
  hazardContext = {},
}) {
  const plan = expeditionRequirements(approach);
  if (!site || !plan)
    return { ok: false, reason: "That expedition cannot be organized." };
  if (state.sites[site.id])
    return { ok: false, reason: "That shore expedition has already sailed." };
  if (provisions < plan.provisions)
    return { ok: false, reason: "The expedition needs more provisions." };

  const serial = state.expeditionSerial;
  const roll = hash(`${site.id}:${day}:${approach}:${serial}`) % 41;
  const score =
    roll + morale * 0.25 + specialistBonus - site.difficulty - plan.difficulty;
  const success = score >= 12;
  const exceptional = success && score >= 29;
  const complications = success ? (score < 20 ? 1 : 0) : score < 3 ? 2 : 1;
  const hazard = resolveHazardEffects({
    site,
    approach,
    day,
    serial,
    success,
    context: hazardContext,
  });
  const injuries = complications + hazard.injuries;
  const moraleChange =
    (success ? (exceptional ? 5 : -complications * 2) : -8) + hazard.morale;
  const reward = success
    ? Math.round(site.reward * plan.rewardScale * (exceptional ? 1.25 : 1)) +
      hazard.reward
    : 0;
  const record = {
    id: serial,
    siteId: site.id,
    approach,
    startedDay: day,
    completedDay: day + plan.days,
    success,
    exceptional,
    injuries,
    reward,
    hazard,
  };
  state.expeditionSerial++;
  state.history.unshift(record);
  state.history = state.history.slice(0, 30);
  const previous = state.sites[site.id] || { visits: 0, status: "charted" };
  state.sites[site.id] = {
    ...previous,
    visits: previous.visits + 1,
    status: success ? "surveyed" : previous.status,
    lastVisitedDay: record.completedDay,
  };

  return {
    ok: true,
    record,
    days: plan.days,
    provisionsUsed: plan.provisions + hazard.provisions,
    moraleChange,
    discoveryId: success ? site.discoveryId : null,
  };
}
