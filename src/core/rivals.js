import { clamp } from "./math.js";

export const RIVAL_CAPTAINS = Object.freeze([
  {
    id: "vale",
    captain: "Captain Ilyra Vale",
    house: "Vale Maritime Exchange",
    vessel: "Amber Heron",
    faction: "Guild of Gilded Oars",
    style: "Shortage runner",
    description: "Moves quickly when a port is desperate and prices are high.",
  },
  {
    id: "voss",
    captain: "Captain Torren Voss",
    house: "Voss Northern Factors",
    vessel: "Silver Wake",
    faction: "Rimegate Admiralty",
    style: "Route specialist",
    description: "Builds dependable northern routes and remembers every favor.",
  },
  {
    id: "cassian",
    captain: "Lady Mirelle Cassian",
    house: "Cassian Crown Company",
    vessel: "Crown Petrel",
    faction: "Pearl Senate",
    style: "Political trader",
    description:
      "Uses influence and advance intelligence to secure choice cargo.",
  },
  {
    id: "reed",
    captain: "Captain Fen Reed",
    house: "Reedwater Cooperative",
    vessel: "Moss Lantern",
    faction: "Reedboat Families",
    style: "Relief merchant",
    description:
      "Supplies neglected ports and rewards captains who render aid.",
  },
  {
    id: "brass",
    captain: "Master Orik Brass",
    house: "Brass & Anvil Shipping",
    vessel: "Iron Minnow",
    faction: "Deep Delvers’ Union",
    style: "Industrial carrier",
    description:
      "Feeds workshops with bulk inputs and competes fiercely on price.",
  },
  {
    id: "serein",
    captain: "Sera Serein",
    house: "Serein Quiet Ventures",
    vessel: "Velvet Gull",
    faction: "Velvet Circle",
    style: "Information broker",
    description:
      "Treats every manifest as leverage and every meeting as a bargain.",
  },
  {
    id: "nacre",
    captain: "Captain Nadi Nacre",
    house: "Nacre Coast Combine",
    vessel: "Pearl Cormorant",
    faction: "Pearl Senate",
    style: "Luxury factor",
    description:
      "Chases rare, high-quality cargo and prestigious destinations.",
  },
  {
    id: "flint",
    captain: "Captain Rusk Flint",
    house: "Flint Free Traders",
    vessel: "Ashen Star",
    faction: "Free Captains' Brotherhood",
    style: "Aggressive speculator",
    description: "Floods promising markets before slower captains can arrive.",
  },
  {
    id: "morrow",
    captain: "Auntie Elian Morrow",
    house: "Morrow Family Caravels",
    vessel: "Reed Swan",
    faction: "Reedboat Families",
    style: "Patient networker",
    description:
      "Cultivates friendships and profits from steady repeat business.",
  },
]);

export function createRivalState() {
  return {
    captains: Object.fromEntries(
      RIVAL_CAPTAINS.map((rival) => [
        rival.id,
        {
          relationship: 0,
          reputation: 20,
          wealth: 120,
          deliveries: 0,
          lastAidDay: 0,
          lastMetDay: 0,
        },
      ]),
    ),
    claims: [],
  };
}

export function normalizeRivalState(value) {
  const fresh = createRivalState();
  if (!value || typeof value !== "object") return fresh;
  for (const rival of RIVAL_CAPTAINS) {
    const saved = value.captains?.[rival.id];
    if (!saved) continue;
    fresh.captains[rival.id] = {
      relationship: clamp(Number(saved.relationship ?? 0), -100, 100),
      reputation: clamp(Number(saved.reputation ?? 20), 0, 100),
      wealth: Math.max(0, Math.floor(Number(saved.wealth ?? 120))),
      deliveries: Math.max(0, Math.floor(Number(saved.deliveries ?? 0))),
      lastAidDay: Math.max(0, Math.floor(Number(saved.lastAidDay ?? 0))),
      lastMetDay: Math.max(0, Math.floor(Number(saved.lastMetDay ?? 0))),
    };
  }
  fresh.claims = (Array.isArray(value.claims) ? value.claims : [])
    .filter(
      (claim) =>
        fresh.captains[claim?.rivalId] &&
        typeof claim.port === "string" &&
        typeof claim.goodKey === "string",
    )
    .map((claim) => ({
      rivalId: claim.rivalId,
      port: claim.port,
      goodKey: claim.goodKey,
      day: Math.max(0, Math.floor(Number(claim.day ?? 0))),
      units: Math.max(1, Math.floor(Number(claim.units ?? 1))),
    }))
    .slice(-24);
  return fresh;
}

export function rivalForMerchant(merchant) {
  if (!merchant) return null;
  return (
    RIVAL_CAPTAINS.find((rival) => rival.id === merchant.rivalId) ||
    RIVAL_CAPTAINS.find((rival) => rival.vessel === merchant.name) ||
    null
  );
}

export function recordRivalDelivery(
  state,
  rivalId,
  { port, goodKey, units, day, unitValue = 10 },
) {
  const next = normalizeRivalState(state);
  const captain = next.captains[rivalId];
  if (!captain) return next;
  captain.deliveries += 1;
  captain.wealth += Math.max(1, Math.round(units * unitValue * 0.18));
  captain.reputation = clamp(captain.reputation + (units >= 6 ? 2 : 1), 0, 100);
  next.claims.push({ rivalId, port, goodKey, units, day });
  next.claims = next.claims.filter((claim) => day - claim.day <= 6).slice(-24);
  return next;
}

export function recordPlayerCompetition(state, { port, goodKey, day }) {
  const next = normalizeRivalState(state);
  const claim = [...next.claims]
    .reverse()
    .find(
      (entry) =>
        entry.port === port &&
        entry.goodKey === goodKey &&
        day - entry.day >= 0 &&
        day - entry.day <= 3,
    );
  if (!claim) return { state: next, rivalId: null, relationshipChange: 0 };
  const captain = next.captains[claim.rivalId];
  captain.relationship = clamp(captain.relationship - 3, -100, 100);
  captain.reputation = clamp(captain.reputation - 1, 0, 100);
  return {
    state: next,
    rivalId: claim.rivalId,
    relationshipChange: -3,
  };
}

export function aidRival(state, rivalId, day, coins, cost = 9) {
  const next = normalizeRivalState(state);
  const captain = next.captains[rivalId];
  if (!captain)
    return { ok: false, reason: "Unknown rival captain.", state: next, coins };
  if (captain.lastAidDay > 0 && day - captain.lastAidDay < 7)
    return {
      ok: false,
      reason: "This house has already received aid recently.",
      state: next,
      coins,
    };
  if (coins < cost)
    return { ok: false, reason: "Not enough crowns.", state: next, coins };
  captain.lastAidDay = day;
  captain.lastMetDay = day;
  captain.relationship = clamp(captain.relationship + 10, -100, 100);
  return { ok: true, state: next, coins: coins - cost, cost };
}

export function tradeRivalIntelligence(state, rivalId, day, coins, cost = 8) {
  const next = normalizeRivalState(state);
  const captain = next.captains[rivalId];
  if (!captain)
    return { ok: false, reason: "Unknown rival captain.", state: next, coins };
  if (coins < cost)
    return { ok: false, reason: "Not enough crowns.", state: next, coins };
  captain.lastMetDay = day;
  captain.relationship = clamp(captain.relationship + 2, -100, 100);
  return { ok: true, state: next, coins: coins - cost, cost };
}

export function rivalRelationshipLabel(value) {
  if (value >= 45) return "Trusted ally";
  if (value >= 15) return "Friendly competitor";
  if (value <= -45) return "Bitter enemy";
  if (value <= -15) return "Hostile rival";
  return "Professional rival";
}
