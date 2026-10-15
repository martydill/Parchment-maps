import { PORT_NAMES, FACTION_NAMES } from "../names.js";
import { clamp } from "./math.js";

export const SPECIALIST_ROSTER = Object.freeze(
  [
    [
      "navigator",
      "Navigator",
      "Eira Voss",
      "✦",
      PORT_NAMES.narthkel,
      FACTION_NAMES.narthkelAdmiralty,
      "Shortens passages and improves forecasts.",
      `Will not aid violence against ${PORT_NAMES.narthkel}.`,
      "Chart the warm current beyond the northern ice.",
    ],
    [
      "purser",
      "Purser",
      "Silas Quill",
      "¤",
      PORT_NAMES.orvessaQuay,
      FACTION_NAMES.syrrelwakeOarwrightPact,
      "Reduces provision use.",
      "May quietly skim the ship's accounts.",
      `Purchase an ${PORT_NAMES.orvessaQuay} counting house.`,
    ],
    [
      "boatswain",
      "Boatswain",
      "Mara Flint",
      "⚓",
      "Blackcliff",
      "Free Captains' Brotherhood",
      "Reduces hull and rigging wear.",
      "Harsh discipline can cost morale.",
      "Command a ship rebuilt by her own hands.",
    ],
    [
      "gunner",
      "Gunner",
      "Bram Calder",
      "✹",
      "Emberward",
      "Emberward Naval Office",
      "Adds combat power and intimidation.",
      "Despises surrender.",
      "Defeat the corsair called the Pale Jackal.",
    ],
    [
      "surgeon",
      "Surgeon",
      "Dr. Ilyan Sable",
      "✚",
      PORT_NAMES.mirravel,
      "Communion of the Drowned Bell",
      "Mitigates voyage morale loss.",
      "Demands costly medicines.",
      "Publish a cure for red-tide fever.",
    ],
    [
      "factor",
      "Factor",
      "Nadiya Vale",
      "§",
      "Pearlstrand",
      FACTION_NAMES.pearlSenate,
      "Improves contract rewards.",
      "Proud patrons expect success.",
      "Win a seat in the Pearl Senate.",
    ],
    [
      "smuggler",
      "Smuggler",
      "Kestrel Rook",
      "☾",
      "Miremouth",
      FACTION_NAMES.knivesOfOrraVey,
      "Improves forged papers and concealed cargo.",
      "Old debts attract attention.",
      "Erase every copy of the Black Ledger.",
    ],
    [
      "naturalist",
      "Naturalist",
      "Tomas Reed",
      "❧",
      "Verdant Reach",
      "League of the Hooded Lantern",
      "Improves exploration outcomes.",
      "Takes risks for rare specimens.",
      "Complete a living atlas.",
    ],
  ].map(
    ([
      id,
      role,
      name,
      emblem,
      origin,
      relationship,
      benefit,
      flaw,
      ambition,
    ]) => ({
      id,
      role,
      name,
      emblem,
      origin,
      relationship,
      benefit,
      flaw,
      ambition,
    }),
  ),
);

export const OFFICER_AMBITIONS = Object.freeze({
  navigator: {
    title: "A course for home",
    destination: PORT_NAMES.narthkel,
    request:
      "My mother is losing her sight. Take me home while she can still see the charts we drew together.",
    task: "Visit Eira’s family and collect her mother’s current charts.",
    cost: 30,
    ability: "Homewater pilotage",
    reward: "Voyage wear calculations use another 12% less passage distance.",
    outcome:
      "Eira’s mother traced the northern currents one last time. Eira has adapted those lessons for every passage.",
  },
  purser: {
    title: "An honest account",
    destination: PORT_NAMES.orvessaQuay,
    request:
      "My old counting house is closing. Help me settle its debts before the victuallers scatter, and I can rebuild our supply network.",
    task: "Settle the counting house’s outstanding accounts.",
    cost: 45,
    ability: "Victuallers’ compact",
    reward: "Voyage provision use reduced by another 20%.",
    outcome:
      "Silas paid every supplier by name. The grateful victuallers shared their best methods for preserving stores.",
  },
  boatswain: {
    title: "Leave no shipmate behind",
    destination: PORT_NAMES.drazhOvek,
    request:
      "The rigger who pulled me from a wreck is trapped in a debt yard. Help me buy her freedom before her contract is sold.",
    task: "Free Mara’s former shipmate from the repair yard.",
    cost: 35,
    ability: "Second-skin bracing",
    reward: "Voyage wear reduced by another 25%.",
    outcome:
      "Mara’s shipmate walked free and taught the crew her double-bracing technique before returning home.",
  },
  gunner: {
    title: "The last signal",
    destination: PORT_NAMES.cindervaleStrand,
    request:
      "My former signalman escaped the Pale Jackal, but passage out costs more than he has. We must reach him before the corsair’s agents do.",
    task: "Rescue Bram’s signalman and arrange safe passage.",
    cost: 40,
    ability: "Crossfire drill",
    reward: "+0.6 combat defense from coordinated gun crews.",
    outcome:
      "Bram’s signalman escaped aboard a friendly cutter. His signal book gave our gun crews a new crossfire drill.",
  },
  surgeon: {
    title: "A cure worth the crossing",
    destination: PORT_NAMES.mirravel,
    request:
      "My former teacher has one surviving red-tide culture. Bring me to her clinic before it spoils, and help fund the final trials.",
    task: "Fund and complete the clinic’s red-tide trials.",
    cost: 45,
    ability: "Red-tide remedy",
    reward: "Voyage morale loss reduced by another 50%.",
    outcome:
      "Ilyan’s trials succeeded. The new treatment and healthier watches have eased the hardship of long voyages.",
  },
  factor: {
    title: "A seat at the table",
    destination: PORT_NAMES.pearlspirel,
    request:
      "My mentor has secured an audience with the Senate factors. Help me attend and pay the introduction dues before the session ends.",
    task: "Sponsor Nadiya’s audience with the Senate factors.",
    cost: 60,
    ability: "Senate introductions",
    reward: "Contract reward multiplier increased by 10 percentage points.",
    outcome:
      "Nadiya won the factors’ respect. Their introductions now strengthen every commission she negotiates.",
  },
  smuggler: {
    title: "One name in the Black Ledger",
    destination: PORT_NAMES.mirelune,
    request:
      "A former shipmate is hiding from my old creditors. Help me purchase the page bearing her name before the debt collectors sail.",
    task: "Buy the ledger page and escort Kestrel’s shipmate to safety.",
    cost: 50,
    ability: "Quiet manifests",
    reward:
      "Customs scrutiny reduced by 15 percentage points, to a minimum of 5%.",
    outcome:
      "Kestrel burned the ledger page. The rescued clerk shared the manifest conventions that keep customs officers at ease.",
  },
  naturalist: {
    title: "The living atlas",
    destination: PORT_NAMES.verdigate,
    request:
      "The field station near my childhood home is packing up. Take me there and help preserve its specimens before the collection is lost.",
    task: "Preserve the field station’s specimens with Tomas.",
    cost: 35,
    ability: "Living atlas",
    reward: "+5 exploration bonus from the preserved field notes.",
    outcome:
      "Tomas saved the collection and copied its field notes. The crew can now recognize signs once missed on unfamiliar shores.",
  },
});

const REQUEST_STATUSES = new Set([
  "offered",
  "accepted",
  "completed",
  "refused",
  "failed",
]);

function nonnegativeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
}

function normalizeAmbition(value) {
  if (!REQUEST_STATUSES.has(value?.status))
    return { status: "unoffered", offeredDay: null, deadline: null };
  const offeredDay = nonnegativeInteger(value.offeredDay, 1);
  return {
    status: value.status,
    offeredDay,
    deadline: Math.max(
      offeredDay,
      nonnegativeInteger(value.deadline, offeredDay),
    ),
  };
}

export function createSpecialistState() {
  return {
    officers: SPECIALIST_ROSTER.map(({ id }) => ({
      id,
      loyalty: 60,
      events: 0,
      ambition: normalizeAmbition(),
    })),
    lastEventDay: 0,
    lastAmbitionDay: 0,
  };
}

export function normalizeSpecialistState(value) {
  const saved = new Map(
    (Array.isArray(value?.officers) ? value.officers : [])
      .filter((item) => item && typeof item === "object")
      .map((item) => [item.id, item]),
  );
  return {
    officers: SPECIALIST_ROSTER.map(({ id }) => {
      const item = saved.get(id);
      const loyalty = Number(item?.loyalty ?? 60);
      return {
        id,
        loyalty: Number.isFinite(loyalty) ? clamp(loyalty, 0, 100) : 60,
        events: nonnegativeInteger(item?.events),
        ambition: normalizeAmbition(item?.ambition),
      };
    }),
    lastEventDay: nonnegativeInteger(value?.lastEventDay),
    lastAmbitionDay: nonnegativeInteger(value?.lastAmbitionDay),
  };
}

export function officerAbilityUnlocked(state, id) {
  return normalizeSpecialistState(state).officers.some(
    (officer) => officer.id === id && officer.ambition.status === "completed",
  );
}

// One request at a time leaves room for commissions and other obligations.
// Deadlines run from the offer, so postponing a decision does not buy time.
export function advanceOfficerAmbitions(state, day, estimatedDays = 4) {
  const next = normalizeSpecialistState(state);
  const events = [];
  for (const officer of next.officers) {
    const request = officer.ambition;
    if (
      ["offered", "accepted"].includes(request.status) &&
      day > request.deadline
    ) {
      const promised = request.status === "accepted";
      const loss = promised ? 12 : 4;
      request.status = "failed";
      officer.loyalty = Math.max(0, officer.loyalty - loss);
      const definition = SPECIALIST_ROSTER.find(
        (item) => item.id === officer.id,
      );
      events.push({
        officerId: officer.id,
        title: `${definition.name}: ${promised ? "a broken promise" : "an unanswered request"}`,
        body: `${OFFICER_AMBITIONS[officer.id].title} expired. ${loss} loyalty lost.`,
      });
    }
  }
  const waiting = next.officers.some((officer) =>
    ["offered", "accepted"].includes(officer.ambition.status),
  );
  const officer = next.officers.find(
    (item) => item.ambition.status === "unoffered",
  );
  if (
    !waiting &&
    officer &&
    day >= 3 &&
    (!next.lastAmbitionDay || day - next.lastAmbitionDay >= 7)
  ) {
    const days =
      typeof estimatedDays === "function"
        ? estimatedDays(OFFICER_AMBITIONS[officer.id].destination)
        : estimatedDays;
    officer.ambition = {
      status: "offered",
      offeredDay: day,
      deadline: day + Math.max(8, nonnegativeInteger(days, 4) + 4),
    };
    next.lastAmbitionDay = day;
    const definition = SPECIALIST_ROSTER.find((item) => item.id === officer.id);
    events.push({
      officerId: officer.id,
      title: `${definition.name} asks a favor`,
      body: `${OFFICER_AMBITIONS[officer.id].request} Open Ship → Officers. Decide and finish by Day ${officer.ambition.deadline}.`,
    });
  }
  return { state: next, events };
}

export function resolveOfficerAmbition(
  state,
  { officerId, action, day, portName = null, coins = 0 },
) {
  const next = normalizeSpecialistState(state);
  const officer = next.officers.find((item) => item.id === officerId);
  if (!officer) return { ok: false, reason: "Unknown officer." };
  const request = officer.ambition;
  if (!["offered", "accepted"].includes(request.status))
    return { ok: false, reason: "This request is no longer available." };
  if (day > request.deadline)
    return { ok: false, reason: "The request’s deadline has passed." };
  const definition = SPECIALIST_ROSTER.find((item) => item.id === officerId);
  const ambition = OFFICER_AMBITIONS[officerId];
  let body;
  if (action === "accept" && request.status === "offered") {
    request.status = "accepted";
    body = `You promised to help at ${ambition.destination} by Day ${request.deadline}. Set aside ${ambition.cost} crowns to fulfill the promise.`;
  } else if (action === "refuse" && request.status === "offered") {
    request.status = "refused";
    officer.loyalty = Math.max(0, officer.loyalty - 8);
    body = "You declined the request. 8 loyalty lost.";
  } else if (action === "complete" && request.status === "accepted") {
    if (portName !== ambition.destination)
      return { ok: false, reason: `Dock at ${ambition.destination} to help.` };
    if (!Number.isFinite(coins) || coins < ambition.cost)
      return { ok: false, reason: `You need ${ambition.cost} crowns to help.` };
    coins -= ambition.cost;
    request.status = "completed";
    officer.loyalty = Math.min(100, officer.loyalty + 15);
    body = `${ambition.outcome} +15 loyalty. Unlocked ${ambition.ability}: ${ambition.reward}`;
  } else return { ok: false, reason: "That choice is unavailable." };
  return {
    ok: true,
    state: next,
    coins,
    event: { title: `${definition.name}: ${ambition.title}`, body },
  };
}

export function specialistPower(state, id) {
  const officer = normalizeSpecialistState(state).officers.find(
    (item) => item.id === id,
  );
  return officer ? 0.5 + officer.loyalty / 200 : 0;
}

export function specialistVoyageModifiers(state) {
  return {
    distanceMultiplier:
      (1 - specialistPower(state, "navigator") * 0.08) *
      (officerAbilityUnlocked(state, "navigator") ? 0.88 : 1),
    provisionMultiplier:
      (1 - specialistPower(state, "purser") * 0.1) *
      (officerAbilityUnlocked(state, "purser") ? 0.8 : 1),
    damageMultiplier:
      (1 - specialistPower(state, "boatswain") * 0.18) *
      (officerAbilityUnlocked(state, "boatswain") ? 0.75 : 1),
    moraleLossMultiplier:
      (1 - specialistPower(state, "surgeon") * 0.2) *
      (officerAbilityUnlocked(state, "surgeon") ? 0.5 : 1),
  };
}
export const specialistRewardMultiplier = (state) =>
  1 +
  specialistPower(state, "factor") * 0.08 +
  (officerAbilityUnlocked(state, "factor") ? 0.1 : 0);
export const specialistCombatBonus = (state) =>
  specialistPower(state, "gunner") * 0.7 +
  (officerAbilityUnlocked(state, "gunner") ? 0.6 : 0);
export const specialistExplorationBonus = (state) =>
  specialistPower(state, "naturalist") * 8 +
  (officerAbilityUnlocked(state, "naturalist") ? 5 : 0);
export const specialistCustomsRelief = (state) =>
  officerAbilityUnlocked(state, "smuggler") ? 0.15 : 0;

export function adjustSpecialistLoyalty(state, id, amount) {
  const next = normalizeSpecialistState(state);
  const officer = next.officers.find((item) => item.id === id);
  if (officer) officer.loyalty = clamp(officer.loyalty + amount, 0, 100);
  return next;
}

export function resolveSpecialistEvent(state, day) {
  const next = normalizeSpecialistState(state);
  if (day < 7 || day - next.lastEventDay < 7)
    return { state: next, event: null };
  const index = (Math.floor(day / 7) - 1) % SPECIALIST_ROSTER.length;
  const officer = next.officers[index];
  const definition = SPECIALIST_ROSTER[index];
  const low = officer.loyalty < 45;
  officer.events++;
  officer.loyalty = clamp(officer.loyalty + (low ? -1 : 1), 0, 100);
  next.lastEventDay = day;
  return {
    state: next,
    event: {
      title: low
        ? `${definition.name}'s flaw`
        : `${definition.name}'s initiative`,
      body: low ? definition.flaw : definition.benefit,
      morale: low ? -2 : 1,
      coins:
        definition.id === "purser" && low
          ? -3
          : definition.id === "factor" && !low
            ? 3
            : 0,
    },
  };
}
