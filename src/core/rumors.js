import { hash } from "./cargo.js";

export const RUMOR_COST = 14;
export const RUMOR_DURATION_DAYS = 14;
export const BASE_RUMOR_RADIUS = 210;
export const SPECIALIST_RUMOR_RADIUS = 135;

export const RUMOR_TYPES = Object.freeze([
  {
    id: "tavern-whisper",
    source: "tavern whisper",
    title: "Tavern whisper",
    radiusScale: 1,
    duration: 14,
    falseLeadMod: 9,
    lines: [
      "A salt-stained dice player swears the clue is",
      "The last sober voice near the hearth mutters",
      "A fiddler trades a half-remembered refrain for",
    ],
  },
  {
    id: "faction-dossier",
    source: "faction dossier",
    title: "Faction dossier",
    radiusScale: 0.82,
    duration: 18,
    falseLeadMod: 0,
    lines: [
      "A sealed faction memorandum narrows the search to",
      "Local agents compare old patrol logs and mark",
      "A patron's clerk copies a restricted note naming",
    ],
  },
  {
    id: "dockside-sighting",
    source: "dockside sighting",
    title: "Dockside sighting",
    radiusScale: 1.18,
    duration: 10,
    falseLeadMod: 7,
    lines: [
      "Net-menders saw strange birds crossing",
      "A pilot boat limped home after sighting lights",
      "Pearl divers argue about a wake leading",
    ],
  },
  {
    id: "salvaged-chart",
    source: "salvaged chart",
    title: "Salvaged chart",
    radiusScale: 0.72,
    duration: 24,
    falseLeadMod: 0,
    lines: [
      "A water-blistered chart preserves one reliable bearing:",
      "A wreck's logbook fixes a careful but incomplete mark",
      "An antique compass rose points insistently toward",
    ],
  },
  {
    id: "omens-and-songs",
    source: "omens and songs",
    title: "Omens and songs",
    radiusScale: 1.35,
    duration: 8,
    falseLeadMod: 5,
    lines: [
      "A shrine keeper reads the tide bones as",
      "Children sing that the old lights gather",
      "A dream-seller traces a trembling circle",
    ],
  },
  {
    id: "specialist-interpretation",
    source: "specialist interpretation",
    title: "Specialist interpretation",
    radiusScale: 0.62,
    duration: 20,
    falseLeadMod: 0,
    specialistOnly: true,
    lines: [
      "Your specialist reconciles three rumors into",
      "A trained eye rejects the tavern noise and keeps",
      "Crew expertise turns a vague story into",
    ],
  },
]);

const DIRECTION_WORDS = [
  "east",
  "southeast",
  "south",
  "southwest",
  "west",
  "northwest",
  "north",
  "northeast",
];

const WATER_SIGNS = [
  "where the water turns black",
  "past the gulls that will not land",
  "where moonlight seems to snag on the tide",
  "near a reef sailors mark with a prayer",
  "beyond a lane of cold green current",
  "where the sounding line comes up warm",
  "under a sky that smells of iron rain",
  "beside kelp beds that glow after sunset",
  "where broken oars drift against the current",
  "past the bell buoy that rings without wind",
  "where fog beads on brass like quicksilver",
  "near the place sailors refuse to name twice",
];

function wrappedDeltaX(fromX, toX, width) {
  const raw = toX - fromX;
  return raw - Math.round(raw / width) * width;
}

function directionFrom(origin, target, worldWidth) {
  const dx = wrappedDeltaX(origin.x, target.x, worldWidth);
  const dy = target.y - origin.y;
  const angle = Math.atan2(dy, dx);
  const index =
    Math.round((((angle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2)) * 8) %
    8;
  return DIRECTION_WORDS[index];
}

function rumorSeed(port, target, day) {
  return hash(`${port.name}:${target.id}:${day}`);
}

export function targetMatchesFaction(target, factions = []) {
  if (!target) return false;
  if (target.faction && factions.includes(target.faction)) return true;
  if (Array.isArray(target.factions))
    return target.factions.some((faction) =>
      factions.includes(faction.name || faction),
    );
  return false;
}

export function rumorTypeFor({
  seed,
  factionRelated = false,
  specialistBonus = false,
}) {
  if (specialistBonus && seed % 4 === 0)
    return RUMOR_TYPES.find((type) => type.id === "specialist-interpretation");
  if (factionRelated && seed % 3 !== 1)
    return RUMOR_TYPES.find((type) => type.id === "faction-dossier");
  const pool = RUMOR_TYPES.filter((type) => !type.specialistOnly);
  return pool[seed % pool.length];
}

export function createRumorLead({
  port,
  target,
  day,
  worldWidth,
  source = null,
  specialistBonus = false,
  falseLead = false,
  factionRelated = false,
}) {
  const seed = rumorSeed(port, target, day);
  const type = rumorTypeFor({ seed, factionRelated, specialistBonus });
  const baseRadius = specialistBonus
    ? SPECIALIST_RUMOR_RADIUS
    : BASE_RUMOR_RADIUS;
  const radius = Math.round(baseRadius * type.radiusScale);
  const unreliable =
    falseLead || (type.falseLeadMod > 0 && seed % type.falseLeadMod === 0);
  const offset = unreliable ? radius * 0.72 : radius * 0.35;
  const angle = ((seed % 360) / 180) * Math.PI;
  const centerX =
    (((target.x + Math.cos(angle) * offset) % worldWidth) + worldWidth) %
    worldWidth;
  const centerY = Math.max(0, target.y + Math.sin(angle) * offset);
  const direction = directionFrom(port, target, worldWidth);
  const sign = WATER_SIGNS[seed % WATER_SIGNS.length];
  const preface =
    type.lines[Math.floor(seed / WATER_SIGNS.length) % type.lines.length];
  const kind = target.objective ? "expedition" : "discovery";
  return {
    id: `R${day}-${port.name.replace(/\W+/g, "").slice(0, 8)}-${target.id}`,
    targetId: target.id,
    targetKind: kind,
    rumorType: type.id,
    title: type.title,
    source: source || type.source,
    origin: port.name,
    boughtDay: day,
    expiresDay: day + type.duration,
    falseLead: unreliable,
    interpreted:
      specialistBonus || type.specialistOnly || radius < BASE_RUMOR_RADIUS,
    radius,
    x: Math.round(centerX),
    y: Math.round(centerY),
    clue: `${preface} ${direction} of ${port.name}, ${sign}.`,
  };
}

export function normalizeRumorLeads(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((lead) => lead && typeof lead === "object" && lead.targetId)
    .map((lead) => {
      const type = RUMOR_TYPES.find((entry) => entry.id === lead.rumorType);
      return {
        id: String(lead.id || lead.targetId),
        targetId: String(lead.targetId),
        targetKind:
          lead.targetKind === "expedition" ? "expedition" : "discovery",
        rumorType: type?.id || "tavern-whisper",
        title: lead.title || type?.title || "Tavern whisper",
        source: lead.source || type?.source || "tavern",
        origin: lead.origin || "Unknown port",
        boughtDay: Math.max(1, Math.floor(Number(lead.boughtDay) || 1)),
        expiresDay: Math.max(1, Math.floor(Number(lead.expiresDay) || 1)),
        falseLead: Boolean(lead.falseLead),
        interpreted: Boolean(lead.interpreted),
        radius: Math.max(40, Number(lead.radius) || BASE_RUMOR_RADIUS),
        x: Number(lead.x) || 0,
        y: Number(lead.y) || 0,
        clue: lead.clue || "A vague mark on the chart.",
        resolvedDay: lead.resolvedDay || null,
        expiredDay: lead.expiredDay || null,
      };
    });
}

export function expireRumorLeads(leads, day) {
  const expired = [];
  for (const lead of leads) {
    if (!lead.resolvedDay && !lead.expiredDay && day > lead.expiresDay) {
      lead.expiredDay = day;
      expired.push(lead);
    }
  }
  return expired;
}
