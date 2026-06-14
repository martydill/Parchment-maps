import { clamp } from "./math.js";

export const LEGAL_STATUSES = Object.freeze({
  legal: { label: "Legal", duty: 0, permit: false, limit: Infinity },
  taxed: { label: "Taxed", duty: 0.12, permit: false, limit: Infinity },
  licensed: { label: "Licensed", duty: 0.06, permit: true, limit: Infinity },
  rationed: { label: "Rationed", duty: 0.04, permit: false, limit: 2 },
  prohibited: { label: "Prohibited", duty: 0, permit: false, limit: 0 },
});

const JURISDICTIONS = Object.freeze({
  Goldhaven: {
    scrutiny: 0.62,
    laws: {
      spice: "taxed",
      silk: "taxed",
      amber: "licensed",
      weapons: "prohibited",
    },
  },
  Rimegate: {
    scrutiny: 0.72,
    laws: {
      grain: "rationed",
      iron: "licensed",
      medicine: "taxed",
      wine: "taxed",
    },
  },
  Lethariel: {
    scrutiny: 0.48,
    laws: {
      timber: "licensed",
      herbs: "licensed",
      silk: "taxed",
      coal: "prohibited",
    },
  },
  Glasswater: {
    scrutiny: 0.38,
    laws: {
      spice: "taxed",
      pearls: "licensed",
      glass: "taxed",
      weapons: "prohibited",
    },
  },
  "Khaz Vhar": {
    scrutiny: 0.82,
    laws: {
      grain: "rationed",
      iron: "licensed",
      tools: "licensed",
      spice: "taxed",
    },
  },
});

export function createLegalState() {
  return {
    permits: {},
    cultivatedOfficials: {},
    offenses: {},
    portBans: {},
    recentBehavior: 0,
    forgedManifest: false,
    remoteAnchorage: false,
    lastInspection: null,
  };
}

export function normalizeLegalState(state) {
  const normalized = createLegalState();
  if (!state || typeof state !== "object") return normalized;
  for (const key of ["permits", "cultivatedOfficials", "offenses", "portBans"])
    normalized[key] =
      state[key] && typeof state[key] === "object" ? { ...state[key] } : {};
  normalized.recentBehavior = clamp(Number(state.recentBehavior) || 0, -20, 20);
  normalized.forgedManifest = Boolean(state.forgedManifest);
  normalized.remoteAnchorage = Boolean(state.remoteAnchorage);
  normalized.lastInspection = state.lastInspection || null;
  return normalized;
}

export function jurisdictionLaw(
  portName,
  good,
  { crises = [], dominantFaction = "" } = {},
) {
  let status = JURISDICTIONS[portName]?.laws[good] || "legal";
  const emergency = crises.some((crisis) => crisis.phase === "active");
  if (emergency && ["grain", "medicine", "provisions"].includes(good))
    status = "rationed";
  if (
    dominantFaction.includes("Commons") ||
    dominantFaction.includes("Communion")
  ) {
    if (status === "licensed") status = "taxed";
  } else if (
    dominantFaction.includes("Crown") &&
    ["amber", "weapons"].includes(good)
  )
    status = "prohibited";
  return status;
}

export function lawDetails(status) {
  return LEGAL_STATUSES[status] || LEGAL_STATUSES.legal;
}

export function hasPermit(state, portName, good, day) {
  return (state.permits[`${portName}:${good}`] || 0) >= day;
}

export function buyPermit(state, portName, good, day, coins, cost = 35) {
  if (coins < cost) return { ok: false, reason: "Not enough crowns." };
  state.permits[`${portName}:${good}`] = day + 30;
  return { ok: true, coins: coins - cost, expiresDay: day + 30 };
}

export function cultivateOfficial(state, portName, coins, cost = 55) {
  if (state.cultivatedOfficials[portName])
    return {
      ok: false,
      reason: "You already have a cultivated official here.",
    };
  if (coins < cost) return { ok: false, reason: "Not enough crowns." };
  state.cultivatedOfficials[portName] = true;
  return { ok: true, coins: coins - cost };
}

export function customsScrutiny({
  portName,
  reputation = 0,
  declaredUnits = 0,
  actualUnits = 0,
  concealedUnits = 0,
  recentBehavior = 0,
  cultivated = false,
  forgedManifest = false,
  remoteAnchorage = false,
}) {
  const base = JURISDICTIONS[portName]?.scrutiny ?? 0.5;
  return clamp(
    base -
      reputation / 250 +
      Math.max(0, actualUnits - declaredUnits) * 0.055 +
      concealedUnits * 0.035 +
      recentBehavior * 0.025 -
      (cultivated ? 0.2 : 0) -
      (remoteAnchorage ? 0.28 : 0) +
      (forgedManifest ? 0.08 : 0),
    0.05,
    0.95,
  );
}

function deterministicRoll(seed) {
  let value = 2166136261;
  for (const character of String(seed)) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0) / 4294967296;
}

export function resolveCustoms({
  state,
  portName,
  lots,
  day,
  reputation = 0,
  laws = {},
  seed = "",
}) {
  if ((state.portBans[portName] || 0) >= day)
    return {
      admitted: false,
      reason: `Port ban in force through Day ${state.portBans[portName]}.`,
      state,
      confiscated: [],
      fine: 0,
      standingChange: 0,
    };
  const forged = state.forgedManifest;
  const remote = state.remoteAnchorage;
  const concealed = lots.filter((lot) => lot.compartment === "concealed");
  const violations = lots.filter((lot) => {
    const status = laws[lot.key] || "legal";
    return (
      status === "prohibited" ||
      (status === "licensed" && !hasPermit(state, portName, lot.key, day)) ||
      (status === "rationed" &&
        lots.filter((entry) => entry.key === lot.key).indexOf(lot) >=
          lawDetails(status).limit)
    );
  });
  const declaredUnits = forged
    ? Math.max(0, lots.length - concealed.length - violations.length)
    : lots.length;
  const scrutiny = customsScrutiny({
    portName,
    reputation,
    declaredUnits,
    actualUnits: lots.length,
    concealedUnits: concealed.length,
    recentBehavior: state.recentBehavior,
    cultivated: state.cultivatedOfficials[portName],
    forgedManifest: forged,
    remoteAnchorage: remote,
  });
  const inspected = deterministicRoll(`${seed}:${portName}:${day}`) < scrutiny;
  const forgeryDetected =
    forged &&
    inspected &&
    deterministicRoll(`${seed}:forgery:${portName}`) < scrutiny + 0.15;
  const confiscated = inspected
    ? violations.filter(
        (lot) =>
          lot.compartment !== "concealed" ||
          deterministicRoll(`${seed}:${lot.id}:locker`) < scrutiny * 0.45,
      )
    : [];
  const offense = confiscated.length > 0 || forgeryDetected;
  if (offense) state.offenses[portName] = (state.offenses[portName] || 0) + 1;
  const offenseCount = state.offenses[portName] || 0;
  const fine = offense ? 12 + confiscated.length * 18 + offenseCount * 8 : 0;
  if (offenseCount >= 3) state.portBans[portName] = day + 20;
  state.recentBehavior = clamp(
    state.recentBehavior + (offense ? 4 : inspected ? -1 : 0),
    -20,
    20,
  );
  state.forgedManifest = false;
  state.remoteAnchorage = false;
  state.lastInspection = {
    portName,
    day,
    scrutiny,
    inspected,
    forgeryDetected,
    confiscated: confiscated.length,
    fine,
  };
  return {
    admitted: true,
    state,
    scrutiny,
    inspected,
    forgeryDetected,
    confiscated,
    fine,
    standingChange: offense ? -Math.min(15, 3 + offenseCount * 2) : 0,
    remoteFee: remote ? 8 : 0,
  };
}

export function tradeQuote(basePrice, status, direction = "buy") {
  const law = lawDetails(status);
  const duty = direction === "sell" ? law.duty * 0.65 : law.duty;
  return Math.max(1, Math.round(basePrice * (1 + duty)));
}

export function canTrade({ state, portName, good, status, day, units = 0 }) {
  if ((state.portBans[portName] || 0) >= day)
    return { ok: false, reason: "A port ban prevents registered trade." };
  if (status === "prohibited")
    return { ok: false, reason: "Prohibited by this jurisdiction." };
  if (status === "licensed" && !hasPermit(state, portName, good, day))
    return { ok: false, reason: "A valid commodity permit is required." };
  if (status === "rationed" && units >= lawDetails(status).limit)
    return { ok: false, reason: "The legal ration has been reached." };
  return { ok: true };
}
