// Centralized original names for people, places, ships, factions, and titles.
// Import these constants instead of hard-coding narrative entity names.

export const GAME_NAME = "The Brindlewake Mercatorium";

export const SHIP_NAMES = Object.freeze({
  starter: "The Vaelith Kest",
  amberHeron: "Amber Heron",
  silverWake: "Silver Wake",
  crownPetrel: "Crown Petrel",
});

export const PERSON_NAMES = Object.freeze({
  orrenVaelix: "Orren Vaelix",
  ilyraVale: "Captain Ilyra Vale",
  torrenVoss: "Captain Torren Voss",
  mirelleVaelix: "Lady Mirelle Vaelix",
});

export const LAND_NAMES = Object.freeze({
  orravelle: "Orravelle",
  veyrAshreach: "The Veyr Ashreach",
  elderwythe: "Elderwythe",
  mirravelIsles: "Mirravel Isles",
  drazhmark: "Drazhmark",
  thrymmSpires: "The Thrymm Spires",
  lunemire: "Lunemire",
  sivvynIsle: "Sivvyn Isle",
  kavrensward: "Kavrensward",
  kavrelChain: "Kavrel Chain",
  thornvayle: "Thornvayle",
  sythrenCoast: "Sythren Coast",
  orynthSteppe: "The Orynth Steppe",
  aurelmarch: "Aurelmarch",
  eoslynKeys: "Eoslyn Keys",
  vesprynKeys: "Vespryn Keys",
  solvyrMarch: "Solvyr March",
  verdantate: "The Verdantate",
  stormvaneCrown: "Stormvane Crown",
  ossuwhale: "Ossuwhale",
  orrawardIsle: "Orraward Isle",
  rimevault: "Rimevault",
  lazulynAtolls: "The Lazulyn Atolls",
  mirdIsle: "Mird Isle",
  orraVey: "Orra Vey",
  lumevarIsles: "The Lumevar Isles",
});

export const PORT_NAMES = Object.freeze({
  orvessaQuay: "Orvessa Quay",
  narthkel: "Narthkel",
  velquorin: "Velquorin",
  mirravel: "Mirravel",
  drazhOvek: "Drazh Ovek",
  thrymmor: "Thrymmor",
  mirelune: "Mirelune",
  kavrenQuay: "Kavren Quay",
  veyrgloam: "Veyrgloam",
  cindervaleStrand: "Cindervale Strand",
  heliovar: "Heliovar",
  pearlveinBay: "Pearlvein Bay",
  starrynFall: "Starryn Fall",
  meridQasryn: "Merid Qasryn",
  aetherreach: "Aetherreach",
  vesperport: "Vesperport",
  eoswatch: "Eoswatch",
  crimsonharrow: "Crimsonharrow",
  pearlspirel: "Pearlspirel",
  verdigate: "Verdigate",
  cloudhollow: "Cloudhollow",
  stormholden: "Stormholden",
  ossuwhale: "Ossuwhale",
  orrasanctAnchorage: "Orrasanct Anchorage",
  kavrelHaven: "Kavrel Haven",
});

export const FACTION_NAMES = Object.freeze({
  syrrelwakeOarwrightPact: "Syrrelwake Oarwright Pact",
  freeKeelBrotherhood: "Free Keel Brotherhood",
  narthkelAdmiralty: "Narthkel Admiralty",
  pearlSenate: "Pearl Senate",
  deepDelversUnion: "Deep Delvers’ Union",
  blackHammerCompact: "Black Hammer Compact",
  silverLoomConsortium: "Silver Loom Consortium",
  lanternLeague: "Lantern League",
  tidebornCommons: "Tideborn Commons",
  mirrorKnives: "Mirror Knives",
  diversCommunion: "Divers’ Communion",
  knivesOfOrraVey: "Knives of Orra Vey",
});

export const HOUSE_NAMES = Object.freeze({
  valeMaritimeExchange: "Vale Maritime Exchange",
  vossNorthernFactors: "Voss Northern Factors",
  vaelixCrownCompany: "Vaelix Crown Company",
});

export const ROUTE_NAMES = Object.freeze({
  thornvayleCircuit: "Thornvayle Circuit",
});

// Rival merchant ships sail under this fixed roster. Kept here as the single
// source of truth so the fleet name generator can avoid duplicating a name that
// is already on the water.
export const RIVAL_SHIP_NAMES = Object.freeze([
  SHIP_NAMES.amberHeron,
  SHIP_NAMES.silverWake,
  SHIP_NAMES.crownPetrel,
  "Moss Lantern",
  "Iron Minnow",
  "Velvet Gull",
  "Pearl Cormorant",
  "Ashen Star",
  "Reed Swan",
]);

// Fleet vessels receive generated "Adjective Noun" registry names so each one
// is distinct instead of reading as its bare hull class (e.g. "Merchant Cutter").
export const FLEET_NAME_PREFIXES = Object.freeze([
  "Amber",
  "Silver",
  "Sable",
  "Iron",
  "Velvet",
  "Pearl",
  "Ashen",
  "Reed",
  "Golden",
  "Crimson",
  "Dusky",
  "Salt",
  "Storm",
  "Ember",
  "Ivory",
  "Jade",
  "Copper",
  "Bronze",
  "Slate",
  "Misty",
  "Winter",
  "Scarlet",
  "Indigo",
  "Verdant",
  "Sunken",
  "Pale",
  "Russet",
  "Twilight",
  "Foam",
  "Driftwood",
  "Vermilion",
  "Lazuli",
]);
export const FLEET_NAME_NOUNS = Object.freeze([
  "Heron",
  "Wake",
  "Petrel",
  "Gull",
  "Cormorant",
  "Swan",
  "Star",
  "Minnow",
  "Lantern",
  "Kestrel",
  "Tern",
  "Albatross",
  "Marlin",
  "Osprey",
  "Kingfisher",
  "Dolphin",
  "Gannet",
  "Fulmar",
  "Skua",
  "Selkie",
  "Pelican",
  "Brambling",
  "Halcyon",
  "Whimbrel",
  "Knot",
  "Tattler",
  "Beacon",
  "Compass",
  "Coracle",
  "Moonfish",
  "Wreck",
  "Cathead",
]);

// Names a fleet vessel must never take: the rival roster plus the player's own
// flagship, so two ships never share a name on the same map.
export const RESERVED_SHIP_NAMES = Object.freeze([
  ...RIVAL_SHIP_NAMES,
  SHIP_NAMES.starter,
]);

// Deterministic "Adjective Noun" name that avoids every string in `avoid` (the
// reserved roster plus the fleet's existing names). The seed picks a starting
// combination and the walk returns the next unused one. Pure and testable.
export function generateFleetShipName(seed, avoid = []) {
  const taken = new Set(
    Array.isArray(avoid)
      ? avoid.filter((value) => typeof value === "string")
      : [],
  );
  const prefixCount = FLEET_NAME_PREFIXES.length;
  const nounCount = FLEET_NAME_NOUNS.length;
  const total = prefixCount * nounCount;
  const start = Math.abs(Math.trunc(Number(seed) || 0)) % total;
  for (let step = 0; step < total; step += 1) {
    const index = (start + step) % total;
    const prefix = FLEET_NAME_PREFIXES[index % prefixCount];
    const noun = FLEET_NAME_NOUNS[Math.floor(index / prefixCount) % nounCount];
    const name = `${prefix} ${noun}`;
    if (!taken.has(name)) return name;
  }
  // Every combination is already in use — fall back to a numbered hull.
  let suffix = 2;
  while (taken.has(`Nameless ${suffix}`)) suffix += 1;
  return `Nameless ${suffix}`;
}
