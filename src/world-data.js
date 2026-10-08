import {
  PORT_NAMES,
  LAND_NAMES,
  FACTION_NAMES,
  PERSON_NAMES,
  ROUTE_NAMES,
} from "./names.js";
// Static world, economy catalog, and map annotation data.
// Keep browser state and rendering behavior in app.js; this module is data-only.

import { continentalCoast, ruggedCoast } from "./core/coastlines.js";
import { pointInPolygon, polygonCentroid } from "./core/geometry.js";
import { RESOURCE_DISCOVERY_TYPES } from "./core/discoveries.js";

export const HOME_PORT = {
  name: PORT_NAMES.orvessaQuay,
  x: 650,
  y: 485,
  spawnX: 705,
  spawnY: 485,
  departureAngle: 0,
};
export const goods = {
  grain: { name: "Crown Grain", base: 9, terms: ["grain", "granaries"] },
  timber: {
    name: "Ship Timber",
    base: 13,
    terms: ["timber", "hardwood", "pine"],
  },
  ore: { name: "Iron Ore", base: 11, terms: ["ore", "mines", "iron mines"] },
  herbs: {
    name: "Medicinal Herbs",
    base: 16,
    perishRate: 0.045,
    terms: ["herb", "resin", "fungi"],
  },
  spice: { name: "Moonspice", base: 28, terms: ["spice"] },
  silk: { name: "Starweave Silk", base: 34, terms: ["silk", "fine cloth"] },
  iron: {
    name: "Dwarf-forged Iron",
    base: 18,
    processed: true,
    terms: ["iron ingot", "ironwork", "weapons", "machinery"],
  },
  provisions: {
    name: "Sea Provisions",
    base: 17,
    processed: true,
    terms: ["provisions", "preserved", "salt fish"],
  },
  medicine: {
    name: "Apothecary Medicines",
    base: 31,
    processed: true,
    perishRate: 0.08,
    terms: ["medicine"],
  },
  fittings: {
    name: "Ship Fittings",
    base: 38,
    processed: true,
    terms: ["vessels", "shipyard", "machinery"],
  },
  garments: {
    name: "Court Garments",
    base: 52,
    processed: true,
    terms: ["fashion", "fine cloth", "luxur"],
  },
  salt: {
    name: "Whitecliff Salt",
    base: 8,
    terms: ["salt", "salt pans", "brine"],
  },
  tea: {
    name: "Cloudleaf Tea",
    base: 24,
    perishRate: 0.025,
    terms: ["tea", "cloudleaf", "tea terraces"],
  },
  ceramics: {
    name: "Jade Ceramics",
    base: 29,
    fragility: 0.4,
    terms: ["ceramic", "porcelain", "pottery", "kiln"],
  },
  pearls: {
    name: "Nacre Pearls",
    base: 46,
    terms: ["pearl", "nacre", "diving grounds"],
  },
  amber: {
    name: "Storm Amber",
    base: 39,
    terms: ["amber", "storm amber", "fossil resin"],
  },
  wine: {
    name: `${PORT_NAMES.heliovar} Wine`,
    base: 27,
    fragility: 0.25,
    terms: ["wine", "vineyard", "vintage"],
  },
  copper: {
    name: "Red Copper",
    base: 15,
    terms: ["copper", "copper mines"],
  },
  coal: {
    name: "Deep Coal",
    base: 10,
    terms: ["coal", "colliery", "fuel"],
  },
  glass: {
    name: "Tideglass",
    base: 36,
    processed: true,
    fragility: 0.45,
    terms: ["glass", "tideglass", "glassworks"],
  },
  tools: {
    name: "Machinist Tools",
    base: 33,
    processed: true,
    terms: ["tool", "machinery", "instruments"],
  },
};
goods.silk.premiumPorts = [PORT_NAMES.velquorin, PORT_NAMES.kavrenQuay];
goods.silk.faction = FACTION_NAMES.silverLoomConsortium;
goods.fittings.fragility = 0.2;
goods.spice.fragility = 0.15;
goods.medicine.fragility = 0.35;
export const discoverySites = [
  {
    id: "starfall-anchorage",
    type: "Uncharted anchorage",
    name: "Starfall Anchorage",
    x: 1080,
    y: 570,
    radius: 46,
    icon: "⚓",
    description:
      "A deep, storm-sheltered bowl behind black skerries, absent from every Admiralty chart.",
    benefit:
      "A public chart will shorten the northern packet and attract timber traffic.",
    saleValue: 95,
    faction: FACTION_NAMES.freeKeelBrotherhood,
    standingValue: 8,
    route: {
      origin: PORT_NAMES.orvessaQuay,
      destination: PORT_NAMES.narthkel,
      good: "timber",
      units: 1.1,
      delay: 4,
    },
  },
  {
    id: "moon-iron",
    requiresExpedition: true,
    type: "Hidden resource deposit",
    name: "Moon-Iron Seam",
    x: 1270,
    y: 930,
    radius: 42,
    icon: "◆",
    description:
      "Blue-grey ore glitters in a wave-cut cliff, rich enough to feed a small foundry.",
    benefit: `Disclosure will establish a new iron supply into ${PORT_NAMES.drazhOvek}.`,
    saleValue: 140,
    faction: FACTION_NAMES.deepDelversUnion,
    standingValue: 10,
    route: {
      origin: PORT_NAMES.orvessaQuay,
      destination: PORT_NAMES.drazhOvek,
      good: "ore",
      units: 1.8,
      delay: 6,
    },
  },
  {
    id: "drowned-observatory",
    requiresExpedition: true,
    type: "Ruins",
    name: "Drowned Observatory",
    x: 2160,
    y: 570,
    radius: 48,
    icon: "✦",
    description:
      "A tidal stair descends to a brass orrery whose surviving plates correct old longitude errors.",
    benefit: `Scholars can turn its bearings into a safer ${PORT_NAMES.mirravel} passage.`,
    saleValue: 125,
    faction: FACTION_NAMES.lanternLeague,
    standingValue: 9,
    route: {
      origin: PORT_NAMES.velquorin,
      destination: PORT_NAMES.mirravel,
      good: "silk",
      units: 1.2,
      delay: 5,
    },
  },
  {
    id: "velvet-cove",
    type: "Smuggler cove",
    name: "Velvet Cove",
    x: 1760,
    y: 690,
    radius: 44,
    icon: "☠",
    description:
      "False mangroves screen a lamp-lit inlet, hidden storehouses, and a quay with no customs seal.",
    benefit: `Revealing it redirects illicit spice into ${PORT_NAMES.mirravel}'s public market.`,
    saleValue: 110,
    faction: FACTION_NAMES.mirrorKnives,
    standingValue: 9,
    route: {
      origin: PORT_NAMES.velquorin,
      destination: PORT_NAMES.mirravel,
      good: "spice",
      units: 1.4,
      delay: 3,
    },
  },
  {
    id: "needle-thread",
    type: "Reef shortcut",
    name: "Needle’s Thread",
    x: 1190,
    y: 620,
    radius: 38,
    icon: "↝",
    description:
      "Two pale stones align to reveal a navigable cut through reefs marked impassable.",
    benefit:
      "Merchants will adopt the cut and increase traffic between northern ports.",
    saleValue: 160,
    faction: FACTION_NAMES.syrrelwakeOarwrightPact,
    standingValue: 12,
    route: {
      origin: PORT_NAMES.narthkel,
      destination: PORT_NAMES.velquorin,
      good: "iron",
      units: 1.7,
      delay: 4,
    },
  },
  {
    id: "silverfin-run",
    type: "Seasonal fishing ground",
    name: "Silverfin Run",
    x: 830,
    y: 710,
    radius: 52,
    icon: "◀",
    description:
      "A cold current turns white with migrating silverfin for only a few days each cycle.",
    benefit: `In season, public knowledge adds provisions to ${PORT_NAMES.orvessaQuay}.`,
    saleValue: 75,
    faction: FACTION_NAMES.tidebornCommons,
    standingValue: 7,
    season: { cycle: 12, start: 3, end: 7 },
    route: {
      origin: PORT_NAMES.narthkel,
      destination: PORT_NAMES.orvessaQuay,
      good: "provisions",
      units: 1.5,
      delay: 2,
    },
  },
  {
    id: "gilded-wreck",
    type: "Salvage site",
    name: "Wreck of the Gilded Hart",
    x: 1875,
    y: 940,
    radius: 46,
    icon: "⚒",
    description:
      "A royal carrack lies upright in clear water, its fittings visible between split decks.",
    benefit: "Salvagers can recover fittings and seed a regular repair trade.",
    saleValue: 180,
    faction: FACTION_NAMES.pearlSenate,
    standingValue: 10,
    route: {
      origin: PORT_NAMES.mirravel,
      destination: PORT_NAMES.drazhOvek,
      good: "fittings",
      units: 1,
      delay: 5,
    },
  },
  {
    id: "new-candle",
    type: "Emerging settlement",
    name: "New Candle",
    x: 2260,
    y: 900,
    radius: 52,
    icon: "⌂",
    description:
      "Pilots, pearl fishers, and their families have built a permanent quay on an unnamed island.",
    benefit: `Recognition will turn the settlement into a feeder port for ${PORT_NAMES.mirravel}.`,
    saleValue: 150,
    faction: FACTION_NAMES.diversCommunion,
    standingValue: 12,
    route: {
      origin: PORT_NAMES.orvessaQuay,
      destination: PORT_NAMES.mirravel,
      good: "grain",
      units: 1.6,
      delay: 7,
    },
  },
];

const expeditionDiscoverySites = [
  {
    id: "moon-iron-uplands",
    name: "Moon-Iron Cliffs",
    objective: "Prospect the blue-grey seam above the wave-cut cliffs.",
    x: 1270,
    y: 930,
    radius: 76,
    difficulty: 8,
    reward: 45,
    discoveryId: "moon-iron",
    hazards: "Loose basalt, exposed anchorage",
    land: LAND_NAMES.drazhmark,
  },
  {
    id: "observatory-tideway",
    name: "Drowned Observatory",
    objective: "Cross the tidal stair and recover the surviving star plates.",
    x: 2160,
    y: 570,
    radius: 80,
    difficulty: 11,
    reward: 60,
    discoveryId: "drowned-observatory",
    hazards: "Rising tide, unstable chambers",
    land: LAND_NAMES.mirravelIsles,
  },
];

const discoveryNames = [
  "Albatross",
  "Amber",
  "Bell",
  "Blackfin",
  "Brass",
  "Candle",
  "Cloud",
  "Cormorant",
  "Crown",
  "Dawn",
  "Dragon",
  "Echo",
  "Emerald",
  "Gannet",
  "Ghost",
  "Gull",
  "Ivory",
  "Jade",
  "Lantern",
  "Leviathan",
  "Moon",
  "Needle",
  "Osprey",
  "Pearl",
  "Pilgrim",
  "Raven",
  "Saint",
  "Sapphire",
  "Silver",
  "Star",
  "Storm",
  "Sun",
  "Tempest",
  "Tern",
  "Whale",
  "Wind",
];
const discoveryFeatures = [
  {
    suffix: "Haven",
    type: "Uncharted anchorage",
    icon: "⚓",
    description: "a sheltered natural harbor concealed behind wave-cut stone",
    benefit: "gives merchant captains a safe refuge on a dangerous passage",
  },
  {
    suffix: "Seam",
    type: "Hidden resource deposit",
    icon: "◆",
    description: "a rich mineral vein exposed where the tide scoured a cliff",
    benefit: "opens a valuable source of raw material for regional workshops",
  },
  {
    suffix: "Archive",
    type: "Ruins",
    icon: "✦",
    description: "weathered chambers preserving charts from a forgotten age",
    benefit: "corrects old sailing directions and rewards further scholarship",
  },
  {
    suffix: "Cove",
    type: "Smuggler cove",
    icon: "☠",
    description:
      "a concealed quay marked by coded lamps and hidden storehouses",
    benefit: "redirects illicit cargo into a lawful public market",
  },
  {
    suffix: "Passage",
    type: "Reef shortcut",
    icon: "↝",
    description: "a narrow but navigable channel between knife-edged reefs",
    benefit: "shortens a busy route and encourages regular merchant traffic",
  },
  {
    suffix: "Shoal",
    type: "Seasonal fishing ground",
    icon: "◀",
    description:
      "a current where great schools gather during part of each cycle",
    benefit: "supplies nearby ports with seasonal food and sailors' work",
  },
  {
    suffix: "Wreck",
    type: "Salvage site",
    icon: "⚒",
    description: "the intact remains of a lost merchant vessel in clear water",
    benefit: "supports a continuing trade in salvage and repair materials",
  },
  {
    suffix: "Quay",
    type: "Emerging settlement",
    icon: "⌂",
    description: "a young island community building a permanent stone landing",
    benefit: "creates a new feeder settlement for established ports",
  },
  {
    suffix: "Garden",
    type: "Rare ecosystem",
    icon: "❈",
    description: "an isolated habitat crowded with unusual medicinal life",
    benefit: "provides healers with a renewable source of rare ingredients",
  },
  {
    suffix: "Beacon",
    type: "Navigational landmark",
    icon: "☼",
    description:
      "a distinctive sea-mark visible through the region's worst haze",
    benefit: "makes landfall safer and reduces losses along nearby routes",
  },
];
const discoveryPorts = [
  PORT_NAMES.orvessaQuay,
  PORT_NAMES.narthkel,
  PORT_NAMES.velquorin,
  PORT_NAMES.mirravel,
  PORT_NAMES.drazhOvek,
  PORT_NAMES.thrymmor,
  PORT_NAMES.mirelune,
  PORT_NAMES.kavrenQuay,
  PORT_NAMES.veyrgloam,
  PORT_NAMES.cindervaleStrand,
  PORT_NAMES.heliovar,
  PORT_NAMES.pearlveinBay,
  PORT_NAMES.starrynFall,
  PORT_NAMES.meridQasryn,
  PORT_NAMES.aetherreach,
  PORT_NAMES.vesperport,
  PORT_NAMES.eoswatch,
  PORT_NAMES.crimsonharrow,
  PORT_NAMES.pearlspirel,
  PORT_NAMES.verdigate,
  PORT_NAMES.cloudhollow,
  PORT_NAMES.stormholden,
  PORT_NAMES.ossuwhale,
  PORT_NAMES.orrasanctAnchorage,
  PORT_NAMES.kavrelHaven,
];
const discoveryGoods = Object.keys(goods);
const discoveryFactions = [
  FACTION_NAMES.freeKeelBrotherhood,
  FACTION_NAMES.deepDelversUnion,
  FACTION_NAMES.lanternLeague,
  FACTION_NAMES.mirrorKnives,
  FACTION_NAMES.syrrelwakeOarwrightPact,
  FACTION_NAMES.tidebornCommons,
  FACTION_NAMES.pearlSenate,
  FACTION_NAMES.diversCommunion,
  FACTION_NAMES.silverLoomConsortium,
  "Reedboat Families",
];

// Fill the expanded world with a deterministic catalog of unique finds.
// Positions follow open-water bands rather than random generation, so old and
// new saves always share the same chart. The first BASE_DISCOVERY_SITES entries
// form the shared chart; the entries beyond that are extra resource deposits
// (the discovery types that yield recoverable cargo), appended after the base
// catalog so older saves keep their existing finds at the same coordinates.
const BASE_DISCOVERY_SITES = 100;
const EXTRA_RESOURCE_DEPOSITS = 32;
const resourceFeatures = discoveryFeatures.filter((feature) =>
  RESOURCE_DISCOVERY_TYPES.has(feature.type),
);
const usedNames = new Set();
for (
  let index = discoverySites.length;
  index < BASE_DISCOVERY_SITES + EXTRA_RESOURCE_DEPOSITS;
  index++
) {
  const extra = index >= BASE_DISCOVERY_SITES;
  const feature = extra
    ? resourceFeatures[(index - BASE_DISCOVERY_SITES) % resourceFeatures.length]
    : discoveryFeatures[index % discoveryFeatures.length];
  let nameSlot = (index * 7) % discoveryNames.length;
  let givenName = discoveryNames[nameSlot];
  let name = `${givenName} ${feature.suffix}`;
  while (usedNames.has(name)) {
    nameSlot = (nameSlot + 1) % discoveryNames.length;
    givenName = discoveryNames[nameSlot];
    name = `${givenName} ${feature.suffix}`;
  }
  usedNames.add(name);
  const origin = discoveryPorts[index % discoveryPorts.length];
  const destination = discoveryPorts[(index * 7 + 3) % discoveryPorts.length];
  const seasonal = feature.type === "Seasonal fishing ground";
  discoverySites.push({
    id: extra
      ? `resource-find-${String(index - BASE_DISCOVERY_SITES + 1).padStart(3, "0")}`
      : `charted-find-${String(index + 1).padStart(3, "0")}`,
    type: feature.type,
    name,
    x: 180 + ((index * 593) % 6040),
    y: 110 + ((index * 337) % 2050),
    radius: 38 + (index % 4) * 4,
    icon: feature.icon,
    description: `Surveyors report ${feature.description}.`,
    benefit: `Publishing the find ${feature.benefit}.`,
    saleValue: 70 + (index % 12) * 10,
    faction: discoveryFactions[index % discoveryFactions.length],
    standingValue: 6 + (index % 7),
    ...(seasonal
      ? { season: { cycle: 12, start: 2 + (index % 4), end: 7 + (index % 3) } }
      : {}),
    route: {
      origin,
      destination:
        destination === origin ? PORT_NAMES.orvessaQuay : destination,
      good: discoveryGoods[(index * 3) % discoveryGoods.length],
      units: 0.8 + (index % 6) * 0.2,
      delay: 2 + (index % 6),
    },
  });
}

export const productionChains = [
  {
    id: "forge",
    name: "Foundry",
    inputs: { ore: 1.5 },
    alternatives: [
      {
        id: "scrap",
        label: "Scrap remelting",
        inputs: { iron: 1.25 },
        outputScale: 0.72,
      },
    ],
    outputs: { iron: 1 },
    rate: 1.4,
    fuel: 0.16,
  },
  {
    id: "victualler",
    name: "Victualling houses",
    inputs: { grain: 1.4, spice: 0.08 },
    alternatives: [
      {
        id: "salted",
        label: "Salted herb stores",
        inputs: { grain: 1.15, herbs: 0.3 },
        outputScale: 0.86,
      },
    ],
    outputs: { provisions: 1 },
    rate: 1.25,
  },
  {
    id: "apothecary",
    name: "Apothecaries",
    inputs: { herbs: 1.25 },
    alternatives: [
      {
        id: "spiced-tonic",
        label: "Spiced tonics",
        inputs: { herbs: 0.7, spice: 0.35 },
        outputScale: 0.9,
      },
    ],
    outputs: { medicine: 1 },
    rate: 0.9,
  },
  {
    id: "shipwright",
    name: "Shipwrights",
    inputs: { timber: 1.3, iron: 0.55 },
    alternatives: [
      {
        id: "iron-frame",
        label: "Iron-framed fittings",
        inputs: { timber: 0.65, iron: 1 },
        outputScale: 0.92,
      },
    ],
    outputs: { fittings: 1 },
    rate: 0.75,
    fuel: 0.12,
  },
  {
    id: "tailor",
    name: "Luxury ateliers",
    inputs: { silk: 1.15, spice: 0.12 },
    alternatives: [
      {
        id: "herbal-dyes",
        label: "Herbal dyes",
        inputs: { silk: 1, herbs: 0.4 },
        outputScale: 0.88,
      },
    ],
    outputs: { garments: 1 },
    rate: 0.7,
  },
  {
    id: "glassworks",
    name: "Tideglass furnaces",
    inputs: { salt: 0.45, coal: 0.7 },
    alternatives: [
      {
        id: "timber-fired",
        label: "Timber-fired glass",
        inputs: { salt: 0.5, timber: 0.9 },
        outputScale: 0.78,
      },
    ],
    outputs: { glass: 1 },
    rate: 0.72,
    fuel: 0.2,
  },
  {
    id: "machinist",
    name: "Machinist halls",
    inputs: { iron: 0.75, copper: 0.55 },
    alternatives: [
      {
        id: "iron-tools",
        label: "All-iron tools",
        inputs: { iron: 1.4 },
        outputScale: 0.82,
      },
    ],
    outputs: { tools: 1 },
    rate: 0.8,
    fuel: 0.14,
  },
];

export const weatherPatterns = [
  { name: "Clear", visibilityKm: 24, roughness: 0.08 },
  { name: "High haze", visibilityKm: 9.5, roughness: 0.12 },
  { name: "Rain squalls", visibilityKm: 6.2, roughness: 0.5 },
  { name: "Sea mist", visibilityKm: 3.4, roughness: 0.16 },
  { name: "Bright", visibilityKm: 18, roughness: 0.06 },
  { name: "Low cloud", visibilityKm: 7.4, roughness: 0.2 },
  { name: "Clear", visibilityKm: 22, roughness: 0.09 },
  { name: "Morning fog", visibilityKm: 4.6, roughness: 0.14 },
];
export const lands = [
  {
    name: LAND_NAMES.orravelle,
    color: "#80784c",
    poly: [
      [180, 260],
      [265, 160],
      [440, 115],
      [610, 165],
      [730, 280],
      [700, 430],
      [610, 500],
      [485, 470],
      [410, 560],
      [265, 520],
      [155, 405],
    ],
  },
  {
    name: LAND_NAMES.veyrAshreach,
    color: "#77704a",
    poly: [
      [880, 90],
      [1060, 80],
      [1210, 165],
      [1260, 300],
      [1175, 390],
      [1015, 370],
      [920, 275],
    ],
  },
  {
    name: LAND_NAMES.elderwythe,
    color: "#7c7950",
    poly: [
      [1480, 150],
      [1680, 105],
      [1855, 165],
      [1935, 310],
      [1870, 470],
      [1715, 540],
      [1545, 475],
      [1440, 330],
    ],
  },
  {
    name: LAND_NAMES.mirravelIsles,
    color: "#8b8157",
    poly: [
      [1985, 655],
      [2115, 600],
      [2250, 675],
      [2225, 795],
      [2110, 855],
      [1990, 785],
    ],
  },
  {
    name: LAND_NAMES.drazhmark,
    color: "#766d45",
    poly: [
      [1360, 850],
      [1510, 770],
      [1685, 810],
      [1810, 940],
      [1780, 1110],
      [1655, 1250],
      [1460, 1200],
      [1325, 1060],
    ],
  },
  {
    name: LAND_NAMES.thrymmSpires,
    color: "#80754b",
    poly: [
      [555, 820],
      [735, 750],
      [895, 830],
      [930, 995],
      [850, 1150],
      [700, 1265],
      [525, 1180],
      [455, 1020],
    ],
  },
  {
    name: LAND_NAMES.lunemire,
    color: "#8c8257",
    poly: [
      [120, 900],
      [250, 820],
      [385, 865],
      [425, 1010],
      [360, 1150],
      [195, 1195],
      [90, 1070],
    ],
  },
  {
    name: LAND_NAMES.sivvynIsle,
    color: "#8d8256",
    poly: [
      [1100, 650],
      [1160, 590],
      [1235, 625],
      [1265, 710],
      [1200, 775],
      [1118, 742],
    ],
  },
  {
    name: LAND_NAMES.kavrensward,
    color: "#83784c",
    poly: [
      [1880, 1120],
      [1975, 1030],
      [2090, 1050],
      [2170, 1165],
      [2135, 1310],
      [1980, 1370],
      [1870, 1285],
    ],
  },
];

// The original named archipelago is only one region of a much larger world.
// These additional continents, island chains, and meridian keys extend the
// chart while keeping every coastline hand-authored and navigable.
lands.push(
  {
    name: LAND_NAMES.thornvayle,
    color: "#7d7549",
    poly: [
      [2320, 340],
      [2520, 190],
      [2820, 205],
      [3090, 350],
      [3260, 590],
      [3150, 860],
      [2890, 970],
      [2590, 850],
      [2380, 650],
    ],
  },
  {
    name: LAND_NAMES.sythrenCoast,
    color: "#85804f",
    poly: [
      [3410, 250],
      [3770, 130],
      [4210, 215],
      [4460, 490],
      [4380, 850],
      [4090, 1040],
      [3690, 955],
      [3400, 690],
    ],
  },
  {
    name: LAND_NAMES.orynthSteppe,
    color: "#918258",
    poly: [
      [4680, 270],
      [5000, 125],
      [5440, 185],
      [5680, 430],
      [5600, 770],
      [5290, 940],
      [4850, 850],
      [4650, 600],
    ],
  },
  {
    name: LAND_NAMES.aurelmarch,
    color: "#82784c",
    poly: [
      [5780, 320],
      [6050, 175],
      [6310, 265],
      [6380, 510],
      [6250, 790],
      [5990, 940],
      [5760, 700],
    ],
  },
  {
    name: LAND_NAMES.eoslynKeys,
    color: "#8b8054",
    poly: [
      [15, 1450],
      [175, 1340],
      [395, 1450],
      [440, 1740],
      [300, 2005],
      [55, 1930],
    ],
  },
  {
    name: LAND_NAMES.vesprynKeys,
    color: "#7c7147",
    poly: [
      [5980, 1450],
      [6200, 1355],
      [6385, 1490],
      [6380, 1900],
      [6190, 2060],
      [5940, 1880],
    ],
  },
  {
    name: LAND_NAMES.solvyrMarch,
    color: "#806f43",
    poly: [
      [2430, 1410],
      [2770, 1260],
      [3200, 1320],
      [3510, 1570],
      [3470, 2010],
      [3150, 2240],
      [2690, 2170],
      [2410, 1870],
    ],
  },
  {
    name: LAND_NAMES.verdantate,
    color: "#788052",
    poly: [
      [3720, 1380],
      [4090, 1220],
      [4520, 1300],
      [4790, 1560],
      [4720, 1980],
      [4400, 2240],
      [3960, 2150],
      [3690, 1800],
    ],
  },
  {
    name: LAND_NAMES.stormvaneCrown,
    color: "#726c48",
    poly: [
      [4980, 1430],
      [5250, 1270],
      [5560, 1385],
      [5650, 1700],
      [5480, 1950],
      [5150, 1885],
      [4950, 1640],
    ],
  },
  {
    name: PORT_NAMES.ossuwhale,
    color: "#82764c",
    poly: [
      [5630, 1840],
      [5870, 1725],
      [6070, 1900],
      [5990, 2190],
      [5745, 2260],
      [5580, 2040],
    ],
  },
  {
    name: LAND_NAMES.orrawardIsle,
    color: "#91855d",
    poly: [
      [2910, 995],
      [3070, 895],
      [3250, 980],
      [3270, 1160],
      [3100, 1250],
      [2930, 1160],
    ],
  },
  {
    name: LAND_NAMES.kavrelChain,
    color: "#897f56",
    poly: [
      [4510, 990],
      [4690, 890],
      [4910, 1005],
      [4870, 1200],
      [4660, 1260],
      [4500, 1120],
    ],
  },
  {
    name: LAND_NAMES.rimevault,
    color: "#777754",
    poly: [
      [3210, 95],
      [3430, 55],
      [3650, 135],
      [3720, 300],
      [3550, 390],
      [3310, 335],
      [3160, 220],
    ],
  },
  {
    name: LAND_NAMES.lazulynAtolls,
    color: "#90875e",
    poly: [
      [5210, 1020],
      [5310, 950],
      [5425, 1015],
      [5400, 1130],
      [5280, 1180],
      [5180, 1110],
    ],
  },
  {
    name: LAND_NAMES.mirdIsle,
    color: "#80784e",
    poly: [
      [3830, 1030],
      [3950, 965],
      [4090, 1030],
      [4100, 1170],
      [3970, 1230],
      [3835, 1160],
    ],
  },
  {
    name: LAND_NAMES.orraVey,
    color: "#8a8058",
    poly: [
      [2470, 1010],
      [2570, 940],
      [2690, 1000],
      [2680, 1130],
      [2560, 1180],
      [2460, 1110],
    ],
  },
  {
    name: LAND_NAMES.lumevarIsles,
    color: "#8c8256",
    poly: [
      [5540, 1030],
      [5650, 970],
      [5770, 1040],
      [5750, 1165],
      [5620, 1215],
      [5520, 1140],
    ],
  },
);

function coastalIsland(cx, cy, rx, ry, seed, color = "#82784e") {
  const poly = [];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    const wave = Math.sin((seed + i * 17) * 9.173) * 18371.31;
    const radius = 0.72 + (wave - Math.floor(wave)) * 0.42;
    poly.push([cx + Math.cos(a) * rx * radius, cy + Math.sin(a) * ry * radius]);
  }
  return {
    name: "",
    color,
    poly: ruggedCoast(poly, seed, 0.42),
    satellite: true,
  };
}

lands.forEach((land, index) => {
  const seed = 101 + index * 29;
  const relief = 0.72 + ((index * 7) % 5) * 0.12;
  const broadOutline = land.satellite
    ? land.poly
    : continentalCoast(land.poly, seed, relief);
  land.poly = ruggedCoast(broadOutline, seed, land.satellite ? 0.45 : 1);
});
lands.push(
  coastalIsland(790, 250, 55, 26, 701, "#80784c"),
  coastalIsland(1320, 250, 42, 21, 702, "#77704a"),
  coastalIsland(1410, 570, 68, 25, 703, "#7c7950"),
  coastalIsland(1890, 590, 37, 19, 704, "#8b8157"),
  coastalIsland(2260, 900, 64, 29, 705, "#8b8157"),
  coastalIsland(1220, 1010, 48, 25, 706, "#766d45"),
  coastalIsland(950, 700, 35, 18, 707, "#80754b"),
  coastalIsland(2250, 475, 72, 26, 708, "#7d7549"),
  coastalIsland(3300, 430, 46, 24, 709, "#85804f"),
  coastalIsland(4540, 470, 58, 22, 710, "#918258"),
  coastalIsland(5700, 510, 40, 20, 711, "#82784c"),
  coastalIsland(515, 1480, 67, 28, 712, "#8b8054"),
  coastalIsland(5850, 1630, 54, 24, 713, "#7c7147"),
  coastalIsland(2320, 2070, 44, 22, 714, "#806f43"),
  coastalIsland(3600, 2070, 64, 27, 715, "#788052"),
  coastalIsland(4850, 1840, 42, 20, 716, "#726c48"),
  coastalIsland(5480, 2130, 58, 25, 717, "#82764c"),
  coastalIsland(3370, 1120, 37, 18, 718, "#91855d"),
  coastalIsland(4380, 1160, 45, 20, 719, "#897f56"),
  coastalIsland(5100, 1190, 35, 17, 720, "#90875e"),
  coastalIsland(5820, 1090, 43, 19, 721, "#8c8256"),
);

const explorationObjectives = [
  "Climb inland bluffs and sketch every visible creek, ridge, and landing place.",
  "Survey the shoreline paths and mark safe anchorages for future landings.",
  "Follow old cairns through the interior and correct the blank spaces on the chart.",
  "Sound the coves, map the headlands, and record freshwater sources.",
  "Trace the highland trail to a lookout and triangulate the surrounding coast.",
];

const explorationHazards = [
  "Hidden reefs, sudden squalls",
  "Steep jungle gullies, biting insects",
  "Loose scree, exposed cliffs",
  "Tidal mud, fogbound channels",
  "Unstable ruins, uncertain footing",
  "Dense thornwood, brackish marsh",
];

const explorationNouns = [
  "Headland",
  "Watch",
  "Sounding",
  "Cairn",
  "Lookout",
  "Landing",
  "Overlook",
  "Survey",
];

function landArea(poly) {
  let total = 0;
  for (let index = 0; index < poly.length; index++) {
    const [x1, y1] = poly[index];
    const [x2, y2] = poly[(index + 1) % poly.length];
    total += x1 * y2 - x2 * y1;
  }
  return Math.abs(total) / 2;
}

function landSamplePoints(land, count) {
  const xs = land.poly.map(([x]) => x);
  const ys = land.poly.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const center = polygonCentroid(land.poly);
  const candidates = [];
  const columns = 5;
  const rows = 4;
  for (let row = 1; row <= rows; row++) {
    for (let column = 1; column <= columns; column++) {
      const x = minX + ((maxX - minX) * column) / (columns + 1);
      const y = minY + ((maxY - minY) * row) / (rows + 1);
      if (pointInPolygon(x, y, land.poly)) {
        candidates.push({
          x,
          y,
          spread: Math.hypot(x - center.x, y - center.y),
        });
      }
    }
  }
  candidates.sort((a, b) => b.spread - a.spread);
  const points = candidates.slice(0, count);
  if (!points.length) points.push({ ...center, spread: 0 });
  while (points.length < count) points.push(points[0]);
  return points;
}

function landSiteCount(land) {
  if (land.satellite || !land.name) return 1;
  const area = landArea(land.poly);
  if (area > 420000) return 4;
  if (area > 210000) return 3;
  if (area > 85000) return 2;
  return 1;
}

function explorationLandName(land, index) {
  return land.name || `Outer Islet ${String(index + 1).padStart(2, "0")}`;
}

function explorationSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function createGeneratedExplorationSites() {
  return lands.flatMap((land, landIndex) => {
    const landName = explorationLandName(land, landIndex);
    return landSamplePoints(land, landSiteCount(land)).map(
      (point, siteIndex) => {
        const noun =
          explorationNouns[(landIndex + siteIndex) % explorationNouns.length];
        const difficulty = 5 + ((landIndex * 3 + siteIndex * 5) % 15);
        return {
          id: `${explorationSlug(landName)}-${explorationSlug(noun)}-${siteIndex + 1}`,
          name: `${landName} ${noun}`,
          objective:
            explorationObjectives[
              (landIndex + siteIndex) % explorationObjectives.length
            ],
          x: Math.round(point.x),
          y: Math.round(point.y),
          radius: land.satellite ? 90 : 110,
          difficulty,
          reward: 35 + difficulty * 4 + siteIndex * 6,
          discoveryId: null,
          hazards:
            explorationHazards[
              (landIndex + siteIndex) % explorationHazards.length
            ],
          land: land.name || null,
        };
      },
    );
  });
}

export const explorationSites = [
  ...expeditionDiscoverySites,
  ...createGeneratedExplorationSites(),
];

export const ports = [
  {
    name: PORT_NAMES.orvessaQuay,
    x: HOME_PORT.x,
    y: HOME_PORT.y,
    land: LAND_NAMES.orravelle,
    home: true,
    realm: `The ${LAND_NAMES.orravelle} Crown`,
    population: 86400,
    government: `Royal charter city governed by Lord Admiral ${PERSON_NAMES.orrenVaelix}`,
    prosperity: "Very high",
    security: "Heavy crown patrols",
    flavor:
      "Ivory towers, crowded quays, and officials who tax everything twice.",
    bias: { spice: 0.8, iron: 1.25, silk: 1.1 },
    resources: [
      "Oak ship timber",
      "Grain fields",
      "Deep-water shipyards",
      "Royal banking",
      "Vellum works",
    ],
    exports: ["Finished vessels", "Grain", "Wine", "Letters of credit"],
    imports: ["Dwarf-forged iron", "Moonspice", "Starweave silk", "Obsidian"],
    factions: [
      {
        name: "The Ivory Crown",
        influence: 39,
        note: "Controls the navy, customs houses, and appointment of senior magistrates.",
      },
      {
        name: FACTION_NAMES.syrrelwakeOarwrightPact,
        influence: 28,
        note: "Merchant dynasties seeking lower tariffs and more overseas concessions.",
      },
      {
        name: FACTION_NAMES.lanternLeague,
        influence: 19,
        note: "Reformers backed by scholars, printers, and minor nobles.",
      },
      {
        name: FACTION_NAMES.tidebornCommons,
        influence: 14,
        note: "Dockworkers and sailors demanding bread-price controls and safer quays.",
      },
    ],
    routes: [
      {
        name: "The Amber Run",
        to: PORT_NAMES.drazhOvek,
        cargo: "wine, credit, iron and obsidian",
        risk: "Moderate",
        days: "7–10 days",
      },
      {
        name: "The Western Crown Route",
        to: `${PORT_NAMES.mirelune} and ${PORT_NAMES.thrymmor}`,
        cargo: "grain, timber and medicinal herbs",
        risk: "Low",
        days: "4–7 days",
      },
      {
        name: "The Northern Packet",
        to: PORT_NAMES.narthkel,
        cargo: "official dispatches, iron and luxuries",
        risk: "High in winter",
        days: "5–8 days",
      },
    ],
  },
  {
    name: PORT_NAMES.narthkel,
    x: 1000,
    y: 360,
    land: LAND_NAMES.veyrAshreach,
    realm: "The Ashen Marches",
    population: 33100,
    government: "Fortress-port ruled by the Council of Seven Captains",
    prosperity: "Steady",
    security: "Militarized harbor",
    flavor:
      "A hard northern port where iron is cheap and warm luxuries are dear.",
    bias: { spice: 1.35, iron: 0.72, silk: 1.18 },
    resources: [
      "Iron mines",
      "Coal seams",
      "Cold-water fisheries",
      "Stone quarries",
      "Mercenary companies",
    ],
    exports: ["Iron ingots", "Coal", "Salt fish", "Weapons"],
    imports: ["Moonspice", "Wine", "Fine cloth", "Fruit"],
    factions: [
      {
        name: "Seven Captains",
        influence: 44,
        note: "Old naval houses that divide the harbor forts and levy anchorage fees.",
      },
      {
        name: FACTION_NAMES.blackHammerCompact,
        influence: 27,
        note: "Mine owners and armorers pressing for war contracts.",
      },
      {
        name: "The Hearthwardens",
        influence: 18,
        note: "Temple network that runs granaries and winter relief.",
      },
      {
        name: FACTION_NAMES.freeKeelBrotherhood,
        influence: 11,
        note: "Independent captains who resist compulsory naval service.",
      },
    ],
    routes: [
      {
        name: "The Northern Packet",
        to: PORT_NAMES.orvessaQuay,
        cargo: "iron, weapons and crown dispatches",
        risk: "High in winter",
        days: "5–8 days",
      },
      {
        name: "The Moonroad",
        to: PORT_NAMES.velquorin,
        cargo: "iron tools, silk and lamp oil",
        risk: "Moderate",
        days: "4–6 days",
      },
      {
        name: "Frostwake Passage",
        to: "Outer northern mines",
        cargo: "coal, ore and provisions",
        risk: "Severe",
        days: "3–9 days",
      },
    ],
  },
  {
    name: PORT_NAMES.velquorin,
    x: 1545,
    y: 470,
    land: LAND_NAMES.elderwythe,
    realm: "The Verdant Principality",
    population: 57800,
    government: "Hereditary moon-court advised by the Grove Conclave",
    prosperity: "High",
    security: "Quiet but watchful",
    flavor:
      "Silver lanterns burn beneath ancient trees. Silk leaves these docks by moonlight.",
    bias: { spice: 1.02, iron: 1.3, silk: 0.68 },
    resources: [
      "Starweave silk",
      "Medicinal resins",
      "Rare hardwood",
      "Silverleaf dye",
      "Astronomers",
    ],
    exports: ["Starweave silk", "Dyes", "Medicines", "Carved hardwood"],
    imports: ["Iron tools", "Salt", "Grain", "Moonspice"],
    factions: [
      {
        name: "House Lethar",
        influence: 36,
        note: "The princely household and its landed retainers.",
      },
      {
        name: "Grove Conclave",
        influence: 31,
        note: "Druids and forest wardens who restrict logging and foreign settlement.",
      },
      {
        name: FACTION_NAMES.silverLoomConsortium,
        influence: 22,
        note: "Silk magnates favoring open trade and stronger convoy protection.",
      },
      {
        name: "The Rootless",
        influence: 11,
        note: "Artisans and migrants excluded from hereditary guild privileges.",
      },
    ],
    routes: [
      {
        name: "The Moonroad",
        to: `${PORT_NAMES.narthkel} and ${PORT_NAMES.mirravel}`,
        cargo: "silk, iron tools and pearl goods",
        risk: "Moderate",
        days: "4–7 days",
      },
      {
        name: "Greenwake Coastal Run",
        to: PORT_NAMES.orvessaQuay,
        cargo: "dyes, medicines and grain",
        risk: "Low",
        days: "5–6 days",
      },
      {
        name: "The Whispering Cut",
        to: PORT_NAMES.mirravel,
        cargo: "silk and rare resins",
        risk: "Pirates",
        days: "3–5 days",
      },
    ],
  },
  {
    name: PORT_NAMES.mirravel,
    x: 2000,
    y: 765,
    land: LAND_NAMES.mirravelIsles,
    realm: `The Free ${LAND_NAMES.mirravelIsles}`,
    population: 24600,
    government: "Elected pearl senate dominated by ship-owning families",
    prosperity: "Booming",
    security: "Private harbor guards",
    flavor: "Pearl divers and spice captains crowd its mirrored canals.",
    bias: { spice: 0.74, iron: 1.18, silk: 1.12 },
    resources: [
      "Pearl beds",
      "Moonspice warehouses",
      "Glass sand",
      "Coral lime",
      "Expert navigators",
    ],
    exports: ["Moonspice", "Pearls", "Cut glass", "Navigational charts"],
    imports: ["Timber", "Iron", "Grain", "Silk"],
    factions: [
      {
        name: FACTION_NAMES.pearlSenate,
        influence: 35,
        note: "Ship-owning clans who auction diving rights and harbor monopolies.",
      },
      {
        name: "Spice Factors",
        influence: 29,
        note: "Foreign-backed warehouses pressing for lower transit duties.",
      },
      {
        name: FACTION_NAMES.diversCommunion,
        influence: 21,
        note: "Mutual-aid lodges demanding safer contracts and debt limits.",
      },
      {
        name: FACTION_NAMES.mirrorKnives,
        influence: 15,
        note: "Smugglers and privateers with friends inside the customs service.",
      },
    ],
    routes: [
      {
        name: "The Moonroad",
        to: PORT_NAMES.velquorin,
        cargo: "spice, pearls and silk",
        risk: "Moderate",
        days: "3–5 days",
      },
      {
        name: "Kingfisher Passage",
        to: PORT_NAMES.kavrenQuay,
        cargo: "glass, pearls and court luxuries",
        risk: "Low",
        days: "4–6 days",
      },
      {
        name: "Whispering Sand Route",
        to: PORT_NAMES.drazhOvek,
        cargo: "spice, obsidian and iron",
        risk: "Shoals",
        days: "5–8 days",
      },
    ],
  },
  {
    name: PORT_NAMES.drazhOvek,
    x: 1450,
    y: 1185,
    land: LAND_NAMES.drazhmark,
    realm: "The Basalt Dominion",
    population: 71800,
    government: "Oligarchic furnace council under the First Forge",
    prosperity: "High",
    security: "Severe inspections",
    flavor: "Black basalt piers serve caravans from the furnace cities inland.",
    bias: { spice: 1.2, iron: 0.63, silk: 1.28 },
    resources: [
      "Iron and copper ore",
      "Obsidian",
      "Furnace coal",
      "Stonework",
      "Siege engineers",
    ],
    exports: ["Dwarf-forged iron", "Obsidian", "Machinery", "Black powder"],
    imports: ["Grain", "Silk", "Wine", "Moonspice"],
    factions: [
      {
        name: "Council of Furnaces",
        influence: 41,
        note: "Forge-lords who set production quotas and control the city guard.",
      },
      {
        name: FACTION_NAMES.deepDelversUnion,
        influence: 24,
        note: "Mine syndicates demanding safer shafts and a share of export duties.",
      },
      {
        name: "Ember Priests",
        influence: 20,
        note: "Temple hierarchy legitimizing contracts and industrial expansion.",
      },
      {
        name: "Ashen Banner",
        influence: 15,
        note: `Expansionists who want ${LAND_NAMES.drazhmark} to seize the southern sea lanes.`,
      },
    ],
    routes: [
      {
        name: "The Amber Run",
        to: PORT_NAMES.orvessaQuay,
        cargo: "iron, obsidian, wine and credit",
        risk: "Moderate",
        days: "7–10 days",
      },
      {
        name: "Kingfisher Passage",
        to: PORT_NAMES.kavrenQuay,
        cargo: "ironwork and royal luxuries",
        risk: "Low",
        days: "5–7 days",
      },
      {
        name: "Grey Drift Convoy",
        to: PORT_NAMES.mirravel,
        cargo: "obsidian and moonspice",
        risk: "Shoals and storms",
        days: "5–8 days",
      },
    ],
  },
  {
    name: PORT_NAMES.thrymmor,
    x: 830,
    y: 1135,
    land: LAND_NAMES.thrymmSpires,
    realm: `The ${PORT_NAMES.thrymmor} Freehold`,
    population: 19200,
    government: "Loose captains’ assembly protected by mountain clans",
    prosperity: "Uneven",
    security: "Rough but self-policed",
    flavor:
      "A smoky freeport beneath mountains said to contain sleeping wyrms.",
    bias: { spice: 1.1, iron: 0.79, silk: 1.22 },
    resources: [
      "Copper",
      "Sulfur",
      "Dragonbone carvings",
      "Mountain timber",
      "Salvage yards",
    ],
    exports: ["Copper", "Sulfur", "Weapons", "Salvaged cargo"],
    imports: ["Grain", "Silk", "Medicine", "Wine"],
    factions: [
      {
        name: "Free Captains’ Moot",
        influence: 34,
        note: "Private captains who recognize no authority beyond harbor custom.",
      },
      {
        name: "The Scale Clans",
        influence: 30,
        note: "Mountain families claiming ancestral rights over mines and passes.",
      },
      {
        name: "Red Ledger Company",
        influence: 23,
        note: "Armed merchants who finance expeditions into the Dragonspine.",
      },
      {
        name: "Wyrmkeepers",
        influence: 13,
        note: "Mystics opposing deep mining near alleged dragon chambers.",
      },
    ],
    routes: [
      {
        name: "Western Crown Route",
        to: `${PORT_NAMES.orvessaQuay} and ${PORT_NAMES.mirelune}`,
        cargo: "copper, herbs and grain",
        risk: "Moderate",
        days: "3–6 days",
      },
      {
        name: "Widow Bank Run",
        to: PORT_NAMES.drazhOvek,
        cargo: "sulfur, iron and machinery",
        risk: "High",
        days: "4–7 days",
      },
      {
        name: "Smuggler’s Wake",
        to: PORT_NAMES.mirravel,
        cargo: "salvage and untaxed spice",
        risk: "Patrols",
        days: "6–9 days",
      },
    ],
  },
  {
    name: PORT_NAMES.mirelune,
    x: 360,
    y: 1140,
    land: LAND_NAMES.lunemire,
    realm: `The ${LAND_NAMES.lunemire} Compact`,
    population: 14100,
    government: "Marsh elders and licensed smuggler-families",
    prosperity: "Modest",
    security: "Sparse watch posts",
    flavor:
      "Herbalists, smugglers, and reed-boats make quiet business in the mist.",
    bias: { spice: 0.9, iron: 1.4, silk: 0.95 },
    resources: ["Medicinal herbs", "Peat", "Reed fiber", "Eels", "Rare fungi"],
    exports: ["Medicines", "Peat fuel", "Reed cloth", "Preserved fish"],
    imports: ["Iron tools", "Salt", "Wine", "Coin"],
    factions: [
      {
        name: "Council of Reed Elders",
        influence: 33,
        note: "Village leaders defending local autonomy and customary water rights.",
      },
      {
        name: "Fen Apothecaries",
        influence: 29,
        note: "Herbal guilds controlling the most valuable marsh harvests.",
      },
      {
        name: "Grey Lantern Families",
        influence: 25,
        note: "Smuggler dynasties who keep unofficial channels open.",
      },
      {
        name: "The Drowned Choir",
        influence: 13,
        note: "A river cult feared by officials and respected by boatfolk.",
      },
    ],
    routes: [
      {
        name: "Western Crown Route",
        to: `${PORT_NAMES.orvessaQuay} and ${PORT_NAMES.thrymmor}`,
        cargo: "medicine, grain and iron tools",
        risk: "Low",
        days: "3–6 days",
      },
      {
        name: "Calmwater Reach",
        to: PORT_NAMES.narthkel,
        cargo: "peat, herbs and iron",
        risk: "Fog",
        days: "6–9 days",
      },
      {
        name: "Reedboat Channels",
        to: `Interior ${LAND_NAMES.lunemire}`,
        cargo: "fish, fungi and contraband",
        risk: "Local hazards",
        days: "1–4 days",
      },
    ],
  },
  {
    name: PORT_NAMES.kavrenQuay,
    x: 1950,
    y: 1105,
    land: LAND_NAMES.kavrensward,
    realm: `The Duchy of ${LAND_NAMES.kavrensward}`,
    population: 62400,
    government: "Ducal court with an influential chamber of creditors",
    prosperity: "Very high",
    security: "Elite harbor watch",
    flavor: "A wealthy royal port where fashion commands absurd prices.",
    bias: { spice: 1.05, iron: 1.12, silk: 1.5 },
    resources: [
      "Luxury ateliers",
      "Royal estates",
      "Horse breeding",
      "Fine ceramics",
      "Auction houses",
    ],
    exports: ["Ceramics", "Jewelry", "Wine", "Court fashions"],
    imports: ["Starweave silk", "Moonspice", "Ironwork", "Pearls"],
    factions: [
      {
        name: "House Corven",
        influence: 37,
        note: "The ducal family and court offices controlling land and appointments.",
      },
      {
        name: "Chamber of Creditors",
        influence: 30,
        note: "Banks and bondholders who finance the duke’s fleets and festivals.",
      },
      {
        name: "Velvet Circle",
        influence: 21,
        note: "Fashion houses and artists shaping court demand for luxury imports.",
      },
      {
        name: "Kingfisher Wardens",
        influence: 12,
        note: "Naval officers demanding more spending on southern defenses.",
      },
    ],
    routes: [
      {
        name: "Kingfisher Passage",
        to: `${PORT_NAMES.mirravel} and ${PORT_NAMES.drazhOvek}`,
        cargo: "silk, pearls, ironwork and ceramics",
        risk: "Low",
        days: "4–7 days",
      },
      {
        name: "Court Packet",
        to: PORT_NAMES.orvessaQuay,
        cargo: "royal passengers, credit and luxury goods",
        risk: "Low",
        days: "6–8 days",
      },
      {
        name: "Grey Drift Convoy",
        to: "Southern outposts",
        cargo: "weapons, horses and provisions",
        risk: "Storms",
        days: "5–9 days",
      },
    ],
  },
];

function expandedPort(spec) {
  const factionNotes = [
    "Holds the largest bloc of harbor offices, warehouses, and customs votes.",
    "Represents wealthy factors, shipowners, and long-distance creditors.",
    "Draws support from artisans, sailors, temples, and neighborhood councils.",
    "Operates through informal networks, frontier captains, and dissident guilds.",
  ];
  const names = spec.factions || [
    "Harbor Council",
    "Overseas Factors",
    "Common Assembly",
    "Free Captains",
  ];
  return {
    name: spec.name,
    x: spec.x,
    y: spec.y,
    land: spec.land,
    realm: spec.realm,
    population: spec.population,
    government: spec.government,
    prosperity: spec.prosperity || "Steady",
    security: spec.security || "Regular harbor watch",
    flavor: spec.flavor,
    bias: spec.bias,
    resources: spec.resources,
    exports: spec.exports,
    imports: spec.imports,
    factions: names.map((name, i) => ({
      name,
      influence: [38, 27, 21, 14][i],
      note: factionNotes[i],
    })),
    routes: spec.routes,
  };
}
function routeInfo(name, to, cargo, risk = "Moderate", days = "6–10 days") {
  return { name, to, cargo, risk, days };
}
ports.push(
  expandedPort({
    name: PORT_NAMES.veyrgloam,
    x: 2380,
    y: 650,
    land: LAND_NAMES.thornvayle,
    realm: `The ${LAND_NAMES.thornvayle} Compact`,
    population: 47300,
    government: "A nocturnal council of lighthouse lords and bonded navigators",
    prosperity: "High",
    security: "Beacon wardens and chain booms",
    flavor:
      "Black lanterns burn through permanent sea haze while pilots auction safe passages.",
    bias: { spice: 1.12, iron: 0.86, silk: 1.08 },
    resources: [
      "Pitch pine",
      "Lighthouse glass",
      "Black salt",
      "Pilot guilds",
      "Storm charts",
    ],
    exports: ["Pitch", "Salt", "Charts", "Hardwood"],
    imports: ["Silk", "Spice", "Wine", "Fine iron"],
    factions: [
      "Beacon Lords",
      "Gloam Factors",
      "Pilots’ Brotherhood",
      "Night Market",
    ],
    routes: [
      routeInfo(
        "Gloam Passage",
        PORT_NAMES.orvessaQuay,
        "timber, salt and charts",
      ),
      routeInfo(
        ROUTE_NAMES.thornvayleCircuit,
        PORT_NAMES.cindervaleStrand,
        "pitch, iron and provisions",
        "Low",
        "2–4 days",
      ),
      routeInfo(
        "Saintswater Line",
        PORT_NAMES.orrasanctAnchorage,
        "pilgrims, vellum and lamp oil",
      ),
    ],
  }),
  expandedPort({
    name: PORT_NAMES.cindervaleStrand,
    x: 3130,
    y: 700,
    land: LAND_NAMES.thornvayle,
    realm: `The ${LAND_NAMES.thornvayle} Compact`,
    population: 61800,
    government: "An elected forge-speaker balanced by seven coastal clans",
    prosperity: "Booming",
    security: "Clan marines",
    flavor: "Copper roofs glow above beaches of red volcanic sand.",
    bias: { spice: 1.02, iron: 0.78, silk: 1.24 },
    resources: [
      "Copper",
      "Volcanic glass",
      "Ship nails",
      "Hot springs",
      "Red cedar",
    ],
    exports: ["Copper fittings", "Glass", "Cedar", "Weapons"],
    imports: ["Grain", "Silk", "Medicine", "Moonspice"],
    factions: [
      "Forge Speaker",
      "Seven Shore Clans",
      "Red Cedar Guild",
      "Ash Monks",
    ],
    routes: [
      routeInfo(
        ROUTE_NAMES.thornvayleCircuit,
        PORT_NAMES.veyrgloam,
        "copper, pitch and cedar",
        "Low",
        "2–4 days",
      ),
      routeInfo(
        "Saintswater Line",
        PORT_NAMES.orrasanctAnchorage,
        "weapons, pilgrims and lamp oil",
      ),
      routeInfo(
        "Sunward Reach",
        PORT_NAMES.heliovar,
        "copper, spice and ceremonial glass",
        "Pirates",
        "7–11 days",
      ),
    ],
  }),
  expandedPort({
    name: PORT_NAMES.heliovar,
    x: 3660,
    y: 930,
    land: LAND_NAMES.sythrenCoast,
    realm: "The Solar Satrapies",
    population: 112400,
    government: "Temple bureaucracy under the hereditary Voice of Noon",
    prosperity: "Very high",
    security: "Sun Guard patrols",
    flavor:
      "A forest of gilded towers rises above citrus terraces and immense spice bazaars.",
    bias: { spice: 0.7, iron: 1.3, silk: 1.08 },
    resources: [
      "Saffron fields",
      "Citrus groves",
      "Astronomical schools",
      "Gold leaf",
      "Canal farms",
    ],
    exports: ["Spices", "Citrus", "Goldwork", "Almanacs"],
    imports: ["Iron", "Timber", "Silk", "Coal"],
    factions: [
      "Temple of Noon",
      "Canal Satraps",
      "Golden Bazaar",
      "Veiled Reformers",
    ],
    routes: [
      routeInfo(
        "Sunward Reach",
        PORT_NAMES.cindervaleStrand,
        "spice, copper and glass",
        "Pirates",
        "7–11 days",
      ),
      routeInfo(
        "Coil Road",
        PORT_NAMES.pearlveinBay,
        "fruit, spice and pearls",
        "Low",
        "3–5 days",
      ),
      routeInfo(
        "Saintswater Line",
        PORT_NAMES.orrasanctAnchorage,
        "pilgrims, incense and manuscripts",
      ),
    ],
  }),
  expandedPort({
    name: PORT_NAMES.pearlveinBay,
    x: 4380,
    y: 720,
    land: LAND_NAMES.sythrenCoast,
    realm: "The Nacre League",
    population: 75600,
    government: "A league senate elected by pearl houses and canal districts",
    prosperity: "High",
    security: "League cutters",
    flavor:
      "White sea walls curve around turquoise lagoons and the largest pearl exchange in the east.",
    bias: { spice: 0.84, iron: 1.16, silk: 0.96 },
    resources: [
      "Pearls",
      "Mother-of-pearl",
      "Salt pans",
      "Dye snails",
      "Fast cutters",
    ],
    exports: ["Pearls", "Dyes", "Salt", "Luxury inlay"],
    imports: ["Iron", "Timber", "Grain", "Coal"],
    factions: [
      "Pearl Houses",
      "League Admiralty",
      "Canal Districts",
      "Shell Divers",
    ],
    routes: [
      routeInfo(
        "Coil Road",
        PORT_NAMES.heliovar,
        "pearls, fruit and spice",
        "Low",
        "3–5 days",
      ),
      routeInfo(
        "White Current",
        PORT_NAMES.starrynFall,
        "pearls, horses and salt",
      ),
      routeInfo(
        "Kestrel Passage",
        PORT_NAMES.kavrelHaven,
        "dyes, silk and navigation instruments",
        "Shoals",
        "4–7 days",
      ),
    ],
  }),
  expandedPort({
    name: PORT_NAMES.starrynFall,
    x: 4800,
    y: 700,
    land: LAND_NAMES.orynthSteppe,
    realm: "The Aster Khanate",
    population: 52100,
    government: "A harbor khan chosen from the five horse-banner families",
    prosperity: "Steady",
    security: "Mounted coast guard",
    flavor:
      "Star-shaped fortifications guard a road into endless pale grasslands.",
    bias: { spice: 1.15, iron: 0.92, silk: 1.1 },
    resources: ["Steppe horses", "Ivory reed", "Salt lakes", "Felt", "Amber"],
    exports: ["Horses", "Felt", "Amber", "Salt"],
    imports: ["Grain", "Silk", "Spice", "Timber"],
    factions: [
      "Five Banners",
      "Aster Merchants",
      "Salt Riders",
      "Reed Oracles",
    ],
    routes: [
      routeInfo(
        "White Current",
        PORT_NAMES.pearlveinBay,
        "horses, pearls and salt",
      ),
      routeInfo(
        "Ivory Roadstead",
        PORT_NAMES.meridQasryn,
        "horses, felt and amber",
        "Low",
        "4–6 days",
      ),
      routeInfo(
        "Kestrel Passage",
        PORT_NAMES.kavrelHaven,
        "amber, silk and instruments",
        "Shoals",
        "4–7 days",
      ),
    ],
  }),
  expandedPort({
    name: PORT_NAMES.meridQasryn,
    x: 5530,
    y: 700,
    land: LAND_NAMES.orynthSteppe,
    realm: "The Meridian Sultanate",
    population: 90300,
    government:
      "A scholarly sultanate governed through observatories and caravan ministries",
    prosperity: "Very high",
    security: "Meridian fleet",
    flavor:
      "Blue domes and brass observatories mark the city where every navigator resets their clocks.",
    bias: { spice: 0.96, iron: 1.18, silk: 0.82 },
    resources: [
      "Observatories",
      "Silk workshops",
      "Date gardens",
      "Brasswork",
      "Caravan banks",
    ],
    exports: ["Silk", "Brass instruments", "Dates", "Star tables"],
    imports: ["Iron", "Timber", "Pearls", "Coal"],
    factions: [
      "Meridian Court",
      "Observatory College",
      "Caravan Bankers",
      "Blue Sail Union",
    ],
    routes: [
      routeInfo(
        "Ivory Roadstead",
        PORT_NAMES.starrynFall,
        "silk, horses and star tables",
        "Low",
        "4–6 days",
      ),
      routeInfo(
        "First Meridian Route",
        PORT_NAMES.aetherreach,
        "instruments, dates and letters",
        "Open ocean",
        "6–9 days",
      ),
      routeInfo(
        "Monsoon Ladder",
        PORT_NAMES.stormholden,
        "silk, brass and storm glass",
        "Seasonal storms",
        "8–12 days",
      ),
    ],
  }),
  expandedPort({
    name: PORT_NAMES.aetherreach,
    x: 6240,
    y: 760,
    land: LAND_NAMES.aurelmarch,
    realm: `The ${LAND_NAMES.aurelmarch} Principalities`,
    population: 68400,
    government: "A cliffside prince advised by aeromancers and sea captains",
    prosperity: "High",
    security: "Cliff batteries",
    flavor: `The easternmost towers catch sunrise hours before the courts of ${LAND_NAMES.orravelle}.`,
    bias: { spice: 1.08, iron: 1.06, silk: 0.9 },
    resources: [
      "Cloud silk",
      "Sulfur springs",
      "Falconry",
      "Wind instruments",
      "Highland tea",
    ],
    exports: ["Cloud silk", "Tea", "Sulfur", "Falcons"],
    imports: ["Iron", "Grain", "Pearls", "Timber"],
    factions: [
      "House of First Light",
      "Aeromancer College",
      "Cliff Captains",
      "Tea Factors",
    ],
    routes: [
      routeInfo(
        "First Meridian Route",
        PORT_NAMES.meridQasryn,
        "tea, silk and instruments",
        "Open ocean",
        "6–9 days",
      ),
      routeInfo(
        "Dawn Coast Run",
        PORT_NAMES.vesperport,
        "tea, sulfur and provisions",
        "Strong currents",
        "5–8 days",
      ),
      routeInfo(
        "Northern Circlet",
        PORT_NAMES.veyrgloam,
        "charts, tea and glass",
        "Long passage",
        "12–16 days",
      ),
    ],
  }),
  expandedPort({
    name: PORT_NAMES.vesperport,
    x: 6280,
    y: 1600,
    land: LAND_NAMES.vesprynKeys,
    realm: "The Meridian Free Keys",
    population: 28100,
    government: "A rotating captains’ moot held at the western sunset bell",
    prosperity: "Steady",
    security: "Independent watch flotilla",
    flavor:
      "Every tavern claims to be the last inn before the world begins again.",
    bias: { spice: 0.88, iron: 1.22, silk: 1.04 },
    resources: [
      "Tuna fisheries",
      "Storm rope",
      "Purple shell dye",
      "Waystations",
      "Deep wells",
    ],
    exports: ["Fish", "Rope", "Dye", "Pilotage"],
    imports: ["Iron", "Grain", "Timber", "Wine"],
    factions: [
      "Sunset Moot",
      "Waystation Keepers",
      "Purple Nets",
      "Unbound Keels",
    ],
    routes: [
      routeInfo(
        "Encircling Passage",
        PORT_NAMES.eoswatch,
        "fish, rope and global mail",
        "Variable currents",
        "2–5 days",
      ),
      routeInfo(
        "Dawn Coast Run",
        PORT_NAMES.aetherreach,
        "tea, sulfur and provisions",
        "Strong currents",
        "5–8 days",
      ),
      routeInfo(
        "Whalebone Track",
        PORT_NAMES.ossuwhale,
        "oil, rope and iron",
        "Sea beasts",
        "5–9 days",
      ),
    ],
  }),
  expandedPort({
    name: PORT_NAMES.eoswatch,
    x: 80,
    y: 1730,
    land: LAND_NAMES.eoslynKeys,
    realm: "The Meridian Free Keys",
    population: 26400,
    government: "A harbor assembly convened at the eastern sunrise bell",
    prosperity: "Steady",
    security: "Volunteer beacon guard",
    flavor:
      "The first sunrise after crossing the meridian paints its white beacons gold.",
    bias: { spice: 0.92, iron: 1.18, silk: 1.02 },
    resources: [
      "Beacon stone",
      "Flying fish",
      "Coconut fiber",
      "Water clocks",
      "Courier guilds",
    ],
    exports: ["Fiber rope", "Fish", "Clocks", "Courier service"],
    imports: ["Iron", "Grain", "Wine", "Silk"],
    factions: [
      "Sunrise Assembly",
      "Beacon Wardens",
      "Courier Houses",
      "Free Divers",
    ],
    routes: [
      routeInfo(
        "Encircling Passage",
        PORT_NAMES.vesperport,
        "mail, rope and fish",
        "Variable currents",
        "2–5 days",
      ),
      routeInfo(
        "Westward Home Run",
        PORT_NAMES.mirelune,
        "medicine, fish and letters",
        "Fog banks",
        "8–12 days",
      ),
      routeInfo(
        "Southern Circlet",
        PORT_NAMES.crimsonharrow,
        "grain, clocks and salt",
        "Open ocean",
        "10–14 days",
      ),
    ],
  }),
  expandedPort({
    name: PORT_NAMES.crimsonharrow,
    x: 2470,
    y: 1760,
    land: LAND_NAMES.solvyrMarch,
    realm: "The Crimson Republic",
    population: 79800,
    government: "A martial republic led by elected banner consuls",
    prosperity: "High",
    security: "Republican marines",
    flavor:
      "Red-painted warehouses line a harbor built from the hulls of conquered pirate ships.",
    bias: { spice: 1.05, iron: 0.82, silk: 1.2 },
    resources: [
      "Ironwood",
      "Red ochre",
      "Marine academies",
      "Wheat",
      "Horse leather",
    ],
    exports: ["Weapons", "Leather", "Grain", "Ironwood"],
    imports: ["Silk", "Spice", "Pearls", "Medicine"],
    factions: [
      "Banner Senate",
      "Marine Colleges",
      "Ironwood Factors",
      "Dock Tribunes",
    ],
    routes: [
      routeInfo(
        "Crimson Coast",
        PORT_NAMES.pearlspirel,
        "grain, weapons and pearls",
        "Low",
        "4–6 days",
      ),
      routeInfo(
        "Saintswater Line",
        PORT_NAMES.orrasanctAnchorage,
        "grain, pilgrims and ironwood",
      ),
      routeInfo(
        "Southern Circlet",
        PORT_NAMES.eoswatch,
        "grain, clocks and salt",
        "Open ocean",
        "10–14 days",
      ),
    ],
  }),
  expandedPort({
    name: PORT_NAMES.pearlspirel,
    x: 3410,
    y: 1660,
    land: LAND_NAMES.solvyrMarch,
    realm: "The Southern Principalities",
    population: 44600,
    government: "A hereditary pearl-prince constrained by a merchants’ chamber",
    prosperity: "High",
    security: "Paid harbor guard",
    flavor: "A narrow white tower signals ships across the warm southern sea.",
    bias: { spice: 0.9, iron: 1.2, silk: 0.98 },
    resources: [
      "River pearls",
      "Rice terraces",
      "Lacquer",
      "White clay",
      "Ship carpenters",
    ],
    exports: ["Pearls", "Rice", "Lacquer", "Ceramics"],
    imports: ["Iron", "Timber", "Spice", "Wool"],
    factions: [
      "Pearl Throne",
      "River Factors",
      "Lacquer Houses",
      "Rice Commons",
    ],
    routes: [
      routeInfo(
        "Crimson Coast",
        PORT_NAMES.crimsonharrow,
        "rice, weapons and pearls",
        "Low",
        "4–6 days",
      ),
      routeInfo(
        "Jadewater Route",
        PORT_NAMES.verdigate,
        "lacquer, tea and ceramics",
        "Monsoon squalls",
        "5–8 days",
      ),
      routeInfo(
        "Southern Crown Route",
        PORT_NAMES.kavrenQuay,
        "pearls, fashions and wine",
        "Long passage",
        "9–13 days",
      ),
    ],
  }),
  expandedPort({
    name: PORT_NAMES.verdigate,
    x: 3760,
    y: 1780,
    land: LAND_NAMES.verdantate,
    realm: LAND_NAMES.verdantate,
    population: 138000,
    government: "Imperial prefecture supervised by examination mandarins",
    prosperity: "Very high",
    security: "Imperial river fleet",
    flavor:
      "Canals, green-tiled warehouses, and examination halls extend far inland.",
    bias: { spice: 0.78, iron: 1.12, silk: 0.72 },
    resources: ["Tea", "Silk", "Porcelain", "Rice", "Paper mills"],
    exports: ["Tea", "Silk", "Porcelain", "Paper"],
    imports: ["Iron", "Horses", "Spice", "Amber"],
    factions: [
      "Imperial Prefecture",
      "Jade Examiners",
      "Grand Canal Guild",
      "Tea Porters",
    ],
    routes: [
      routeInfo(
        "Jadewater Route",
        PORT_NAMES.pearlspirel,
        "tea, lacquer and ceramics",
        "Monsoon squalls",
        "5–8 days",
      ),
      routeInfo(
        "Cloud Canal",
        PORT_NAMES.cloudhollow,
        "tea, paper and silk",
        "Low",
        "3–5 days",
      ),
      routeInfo(
        "Kestrel Passage",
        PORT_NAMES.kavrelHaven,
        "silk, instruments and amber",
        "Shoals",
        "5–8 days",
      ),
    ],
  }),
  expandedPort({
    name: PORT_NAMES.cloudhollow,
    x: 4640,
    y: 1510,
    land: LAND_NAMES.verdantate,
    realm: "The Cloud Mandate",
    population: 59200,
    government:
      "A mountain-sea governorship shared by monasteries and tea estates",
    prosperity: "High",
    security: "Monastic patrols",
    flavor:
      "Mist-covered stairs descend from tea mountains directly to stone piers.",
    bias: { spice: 0.86, iron: 1.26, silk: 0.76 },
    resources: [
      "High tea",
      "Medicinal fungi",
      "Bamboo",
      "Paper",
      "Monasteries",
    ],
    exports: ["Tea", "Medicine", "Bamboo", "Paper"],
    imports: ["Iron", "Salt", "Horses", "Pearls"],
    factions: [
      "Cloud Governor",
      "Tea Estates",
      "Nine Monasteries",
      "Bamboo Syndicate",
    ],
    routes: [
      routeInfo(
        "Cloud Canal",
        PORT_NAMES.verdigate,
        "tea, paper and silk",
        "Low",
        "3–5 days",
      ),
      routeInfo(
        "Monsoon Ladder",
        PORT_NAMES.stormholden,
        "tea, medicine and storm glass",
        "Seasonal storms",
        "5–9 days",
      ),
      routeInfo(
        "Kestrel Passage",
        PORT_NAMES.kavrelHaven,
        "tea, amber and instruments",
        "Shoals",
        "4–7 days",
      ),
    ],
  }),
  expandedPort({
    name: PORT_NAMES.stormholden,
    x: 5020,
    y: 1640,
    land: LAND_NAMES.stormvaneCrown,
    realm: "The Stormbound Holds",
    population: 38600,
    government: "A fortress league ruled by storm captains",
    prosperity: "Steady",
    security: "Fortress harbor",
    flavor: "Massive chains and breakwaters groan whenever the monsoon turns.",
    bias: { spice: 1.18, iron: 0.88, silk: 1.12 },
    resources: [
      "Storm glass",
      "Whale oil",
      "Basalt",
      "Lightning rods",
      "Hard sailors",
    ],
    exports: ["Storm glass", "Oil", "Basalt", "Marine crews"],
    imports: ["Grain", "Silk", "Tea", "Medicine"],
    factions: [
      "Storm Captains",
      "Chainwrights",
      "Glass Readers",
      "Lower Quays",
    ],
    routes: [
      routeInfo(
        "Monsoon Ladder",
        PORT_NAMES.cloudhollow,
        "tea, medicine and storm glass",
        "Seasonal storms",
        "5–9 days",
      ),
      routeInfo(
        "Whalebone Track",
        PORT_NAMES.ossuwhale,
        "oil, basalt and iron",
        "Sea beasts",
        "3–6 days",
      ),
      routeInfo(
        "Meridian Monsoon",
        PORT_NAMES.meridQasryn,
        "silk, brass and storm glass",
        "Severe storms",
        "8–12 days",
      ),
    ],
  }),
  expandedPort({
    name: PORT_NAMES.ossuwhale,
    x: 5920,
    y: 1940,
    land: PORT_NAMES.ossuwhale,
    realm: "The Ossuary Isles",
    population: 17400,
    government: "A conclave of whaling families and bone priests",
    prosperity: "Poor but strategic",
    security: "Armed whalers",
    flavor:
      "Ancient ribs form arches over a harbor smelling of salt, smoke, and lamp oil.",
    bias: { spice: 1.3, iron: 1.08, silk: 1.34 },
    resources: [
      "Whale oil",
      "Bone carving",
      "Ambergris",
      "Cold fisheries",
      "Deepwater hunters",
    ],
    exports: ["Oil", "Ambergris", "Bonework", "Fish"],
    imports: ["Grain", "Iron", "Cloth", "Spice"],
    factions: [
      "Bone Conclave",
      "Great Harpoon Houses",
      "Oil Chandlers",
      "Mercy of the Deep",
    ],
    routes: [
      routeInfo(
        "Whalebone Track",
        PORT_NAMES.stormholden,
        "oil, basalt and iron",
        "Sea beasts",
        "3–6 days",
      ),
      routeInfo(
        "Sunset Track",
        PORT_NAMES.vesperport,
        "oil, rope and fish",
        "Sea beasts",
        "5–9 days",
      ),
      routeInfo(
        "Southern Monsoon",
        PORT_NAMES.cloudhollow,
        "oil, tea and medicine",
        "Storms",
        "7–11 days",
      ),
    ],
  }),
  expandedPort({
    name: PORT_NAMES.orrasanctAnchorage,
    x: 3050,
    y: 1210,
    land: LAND_NAMES.orrawardIsle,
    realm: `The Concordat of ${LAND_NAMES.orraVey}`,
    population: 22100,
    government: "A neutral abbey-port administered by twelve hospitallers",
    prosperity: "Steady",
    security: "Sanctuary law",
    flavor:
      "Pilgrims, diplomats, and spies share the same sheltered cloisters.",
    bias: { spice: 1.02, iron: 1.12, silk: 0.94 },
    resources: [
      "Hospitals",
      "Scriptoria",
      "Relic workshops",
      "Fresh water",
      "Neutral courts",
    ],
    exports: ["Medicine", "Books", "Relics", "Arbitration"],
    imports: ["Grain", "Iron", "Wine", "Lamp oil"],
    factions: [
      "Twelve Hospitallers",
      "Pilgrim Factors",
      "Concordat Scribes",
      "Sanctuary Boatmen",
    ],
    routes: [
      routeInfo(
        "Saintswater Line",
        PORT_NAMES.cindervaleStrand,
        "pilgrims, weapons and lamp oil",
      ),
      routeInfo(
        "Crimson Pilgrim Route",
        PORT_NAMES.crimsonharrow,
        "grain, medicine and ironwood",
      ),
      routeInfo(
        "Sun Pilgrim Route",
        PORT_NAMES.heliovar,
        "incense, manuscripts and pilgrims",
      ),
    ],
  }),
  expandedPort({
    name: PORT_NAMES.kavrelHaven,
    x: 4700,
    y: 1220,
    land: LAND_NAMES.kavrelChain,
    realm: "The Kestrel League",
    population: 31800,
    government: "A federation of courier islands and surveyor guilds",
    prosperity: "High",
    security: "Fast patrol craft",
    flavor:
      "Signal towers flash market prices across the horizon before ships enter harbor.",
    bias: { spice: 1.04, iron: 1.08, silk: 0.92 },
    resources: [
      "Courier falcons",
      "Surveyors",
      "Signal glass",
      "Reef pilots",
      "Map engraving",
    ],
    exports: ["Charts", "Messages", "Signal glass", "Pilotage"],
    imports: ["Food", "Iron", "Silk", "Spice"],
    factions: [
      "Kestrel Council",
      "Surveyor Guild",
      "Signal Keepers",
      "Reef Pilots",
    ],
    routes: [
      routeInfo(
        "Kestrel Passage",
        PORT_NAMES.pearlveinBay,
        "dyes, charts and pearls",
        "Shoals",
        "4–7 days",
      ),
      routeInfo(
        "Jade Kestrel Route",
        PORT_NAMES.verdigate,
        "silk, tea and instruments",
        "Shoals",
        "5–8 days",
      ),
      routeInfo(
        "Aster Flight",
        PORT_NAMES.starrynFall,
        "amber, horses and charts",
        "Open water",
        "4–7 days",
      ),
    ],
  }),
);

export const forests = [
  [340, 280, 22],
  [420, 235, 18],
  [510, 300, 24],
  [590, 345, 16],
  [1600, 265, 22],
  [1700, 330, 25],
  [1760, 245, 18],
  [1545, 360, 15],
  [235, 975, 19],
  [320, 1035, 17],
  [2050, 1205, 19],
  [1985, 1250, 16],
];
export const mountains = [
  [585, 895, 34],
  [650, 940, 30],
  [730, 875, 38],
  [785, 970, 32],
  [705, 1060, 26],
  [1540, 930, 30],
  [1620, 995, 38],
  [1690, 915, 28],
  [1575, 1080, 31],
  [1010, 210, 25],
  [1090, 235, 30],
  [1150, 300, 24],
];

forests.push(
  [2580, 470, 22],
  [2770, 560, 18],
  [2940, 690, 21],
  [3850, 500, 24],
  [4040, 610, 19],
  [4210, 480, 17],
  [4930, 520, 16],
  [5200, 650, 18],
  [5900, 540, 22],
  [6110, 470, 18],
  [120, 1650, 18],
  [300, 1810, 20],
  [2750, 1670, 22],
  [3010, 1880, 19],
  [4050, 1580, 23],
  [4290, 1830, 20],
  [4480, 1460, 18],
  [5200, 1600, 17],
  [5400, 1770, 16],
  [6070, 1730, 18],
  [3160, 1080, 14],
  [4700, 1080, 13],
);
mountains.push(
  [2680, 360, 34],
  [2920, 420, 29],
  [3050, 590, 26],
  [3550, 410, 28],
  [3980, 330, 34],
  [4270, 540, 26],
  [5050, 340, 26],
  [5350, 420, 31],
  [6080, 390, 35],
  [6200, 590, 28],
  [2600, 1540, 34],
  [2920, 1460, 29],
  [3260, 1810, 31],
  [3920, 1490, 28],
  [4380, 1410, 36],
  [4570, 1710, 29],
  [5200, 1460, 35],
  [5460, 1580, 31],
  [5800, 1940, 30],
  [3440, 190, 32],
  [3560, 230, 25],
);
export const worldShoals = [
  [315, 660, 135, 44, "The Glass Shoals"],
  [1815, 720, 150, 48, "Whispering Sand"],
  [1050, 1260, 100, 35, "Widow Bank"],
  [1290, 560, 85, 28, null],
  [2210, 1590, 135, 42, "The Red Teeth"],
  [3330, 1180, 120, 38, "Pilgrim Bar"],
  [4520, 820, 115, 34, "Nacre Reefs"],
  [4840, 1320, 130, 40, "Kestrel Shoals"],
  [5720, 1260, 150, 46, "Lantern Bank"],
  [6170, 1150, 115, 35, "Meridian Shallows"],
  [820, 1880, 130, 42, "The Returning Sands"],
  [4090, 2310, 150, 44, "Jade Shelf"],
];
export const worldCurrents = [
  [980, 930, 0.18, "Southward Current"],
  [1810, 1030, -0.38, "The Grey Drift"],
  [2740, 760, 0.12, "Gloam Current"],
  [3900, 1120, 0.35, "The Serpent Flow"],
  [5260, 980, -0.22, "Meridian Stream"],
  [6100, 1250, 0.72, "Encircling Current"],
  [1300, 1840, -0.12, "Westward Return"],
  [4300, 2050, 0.25, "Monsoon River"],
];
export const worldMonsters = [
  [760, 660, 0.92],
  [1760, 1240, 0.66],
  [2800, 1030, 0.72],
  [4200, 1240, 0.82],
  [5480, 1180, 0.65],
  [6150, 2130, 0.78],
  [1180, 2060, 0.62],
];
export const seaRegionLabels = [
  ["THE SAPPHIRE SEA", 1200, 520, 38],
  ["THE WESTERN DEEPS", 300, 700, 27],
  ["SEA OF WHISPERS", 1900, 930, 27],
  ["THE GLOAMING OCEAN", 2700, 1080, 34],
  ["THE SERPENT SEA", 3950, 730, 34],
  ["THE IVORY MAIN", 5150, 1030, 34],
  ["THE FIRST MERIDIAN", 6100, 1240, 30],
  ["THE SOUTHERN ENCIRCLING SEA", 3200, 2300, 30],
  ["THE JADEWATER", 4200, 1260, 27],
  ["THE STORMWARD OCEAN", 5550, 1480, 27],
];
// Seas whose plankton ignite disturbed water at night. Centers follow
// seaRegionLabels so the name on the chart is the glow a captain sails
// through; the app maps these exactly like roughSeas.
export const bioluminescentSeas = [
  { name: "The Sea of Whispers", x: 1900, y: 930, rx: 420, ry: 260 },
  { name: "The Southern Encircling Sea", x: 3200, y: 2300, rx: 520, ry: 340 },
  { name: "The Jadewater", x: 4200, y: 1260, rx: 360, ry: 230 },
];
export const roughSeas = [
  { x: 2720, y: 1060, rx: 470, ry: 300, angle: -0.08, strength: 1 },
  { x: 5480, y: 1480, rx: 520, ry: 330, angle: 0.12, strength: 1.15 },
  { x: 6200, y: 1120, rx: 270, ry: 430, angle: -0.18, strength: 0.9 },
  { x: 1780, y: 1180, rx: 300, ry: 190, angle: -0.22, strength: 0.72 },
];
