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

export function createSpecialistState() {
  return {
    officers: SPECIALIST_ROSTER.map(({ id }) => ({
      id,
      loyalty: 60,
      events: 0,
    })),
    lastEventDay: 0,
  };
}

export function normalizeSpecialistState(value) {
  const saved = new Map(
    (Array.isArray(value?.officers) ? value.officers : []).map((item) => [
      item.id,
      item,
    ]),
  );
  return {
    officers: SPECIALIST_ROSTER.map(({ id }) => {
      const item = saved.get(id);
      return {
        id,
        loyalty: clamp(Number(item?.loyalty ?? 60), 0, 100),
        events: Math.max(0, Math.floor(Number(item?.events ?? 0))),
      };
    }),
    lastEventDay: Math.max(0, Math.floor(Number(value?.lastEventDay ?? 0))),
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
    distanceMultiplier: 1 - specialistPower(state, "navigator") * 0.08,
    provisionMultiplier: 1 - specialistPower(state, "purser") * 0.1,
    damageMultiplier: 1 - specialistPower(state, "boatswain") * 0.18,
    moraleLossMultiplier: 1 - specialistPower(state, "surgeon") * 0.2,
  };
}
export const specialistRewardMultiplier = (state) =>
  1 + specialistPower(state, "factor") * 0.08;
export const specialistCombatBonus = (state) =>
  specialistPower(state, "gunner") * 0.7;
export const specialistExplorationBonus = (state) =>
  specialistPower(state, "naturalist") * 8;

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
