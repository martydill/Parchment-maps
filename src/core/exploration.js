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
  const injuries = complications;
  const moraleChange = success ? (exceptional ? 5 : -complications * 2) : -8;
  const reward = success
    ? Math.round(site.reward * plan.rewardScale * (exceptional ? 1.25 : 1))
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
    provisionsUsed: plan.provisions,
    moraleChange,
    discoveryId: success ? site.discoveryId : null,
  };
}
