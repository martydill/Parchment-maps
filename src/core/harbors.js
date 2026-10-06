import { PORT_NAMES } from "../names.js";

const palettes = {
  canals: ["#8a9b80", "#ddd2ad", "#889583", "#617e7d", "#3e6368"],
  fishing: ["#84918d", "#c5c1b0", "#7b8581", "#617581", "#3c5362"],
  marsh: ["#879572", "#bcb590", "#75795d", "#89764f", "#625940"],
  tropical: ["#b2ad79", "#ecd8b0", "#a58b68", "#b46f49", "#874b39"],
  monastery: ["#a69c80", "#ded6b6", "#9b927c", "#788576", "#536959"],
};

const assignments = {
  canals: ["velquorin", "kavrenQuay", "verdigate", "pearlveinBay"],
  fishing: ["eoswatch", "ossuwhale"],
  marsh: ["mirelune"],
  tropical: ["kavrelHaven"],
  monastery: ["orrasanctAnchorage", "cloudhollow"],
  quays: ["orvessaQuay"],
  citadel: ["narthkel", "stormholden", "starrynFall", "aetherreach"],
  lighthouse: ["mirravel", "veyrgloam", "pearlspirel"],
  foundry: ["drazhOvek", "cindervaleStrand", "crimsonharrow", "thrymmor"],
  terraces: ["heliovar", "meridQasryn"],
  windmills: ["vesperport"],
};

// Pigments follow the ports' established lore: night beacons, white pearl
// towers, copper foundries, cliff batteries, and green canal warehouses.
const accents = {
  veyrgloam: {
    wall: "#8b9390",
    side: "#535e61",
    roof: "#3e505c",
    roofShade: "#293c4a",
  },
  pearlspirel: {
    wall: "#eee4c5",
    side: "#afa58b",
    roof: "#668274",
    roofShade: "#476655",
  },
  starrynFall: {
    wall: "#c7af86",
    side: "#998260",
    roof: "#917456",
    roofShade: "#6b503b",
  },
  aetherreach: {
    wall: "#d4d4bf",
    side: "#85978e",
    roof: "#668d95",
    roofShade: "#426a79",
  },
  cindervaleStrand: {
    ground: "#705950",
    wall: "#ac7a5c",
    roof: "#704c3e",
    roofShade: "#4b342d",
  },
  crimsonharrow: {
    wall: "#a36a53",
    side: "#6f5145",
    roof: "#895146",
    roofShade: "#62392f",
  },
  thrymmor: { wall: "#b49e78", roof: "#727865", roofShade: "#4b564b" },
  pearlveinBay: {
    wall: "#eae0be",
    side: "#a7b4a5",
    roof: "#69a3a0",
    roofShade: "#468280",
  },
  kavrenQuay: { wall: "#e2c5a0", roof: "#aa735b", roofShade: "#784b42" },
  verdigate: { roof: "#578475", roofShade: "#3a6655" },
  cloudhollow: { wall: "#d2c8a3", roof: "#596f57", roofShade: "#3e543e" },
};

const profiles = new Map();
for (const [kind, keys] of Object.entries(assignments)) {
  keys.forEach((key, variant) => {
    const palette = palettes[kind];
    profiles.set(
      PORT_NAMES[key],
      Object.freeze({
        kind,
        variant,
        ...(palette && {
          ground: palette[0],
          wall: palette[1],
          side: palette[2],
          roof: palette[3],
          roofShade: palette[4],
          flag: [0, -18, kind === "monastery" ? 100 : 57],
          smoke: [],
        }),
        ...accents[key],
      }),
    );
  });
}

export function harborProfile(name) {
  return profiles.get(name) ?? null;
}

// Development is derived from existing economic state, never persisted as a
// second source of truth. Old saves and callers without evolution stay valid.
export function harborDevelopment(evolution = {}) {
  const level = Number.isFinite(evolution.level)
    ? Math.max(0, Math.min(3, Math.floor(evolution.level)))
    : 1;
  const crisis = Boolean(evolution.crisis);
  return {
    level,
    crisis,
    docks: 1 + Math.max(0, level - 1),
    cargo: crisis ? 1 : 2 + level * 2,
    workers: crisis ? 2 : 3 + level * 2,
    boats: crisis ? 1 : 2 + Math.max(0, level - 1),
    warehouses: Boolean(evolution.warehouses) || level >= 2,
    cranes: Boolean(evolution.cranes) || level >= 2,
    foundries: Boolean(evolution.foundries),
    fortifications: Boolean(evolution.fortifications) || level >= 3,
  };
}
