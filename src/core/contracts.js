import { estimateVoyageDays } from "./voyage-time.js";

export function createContractOffer({
  origin,
  index,
  day,
  serial,
  destinations,
  cargoNames,
  getPort,
  distanceBetween,
  estimateDays,
}) {
  const destinationName =
    destinations[(index + day + origin.name.length) % destinations.length];
  const destination = getPort(destinationName);
  const distance = distanceBetween(destination, origin);
  const courier = index === 1;
  const cargoUnits = courier ? 1 : 2 + ((day + index + origin.name.length) % 3);
  const cargoName = courier
    ? "sealed diplomatic pouch"
    : cargoNames[(day * 3 + index + origin.name.length) % cargoNames.length];
  const sponsor =
    origin.name === "Goldhaven"
      ? "Guild of Gilded Oars"
      : origin.factions[Math.min(1, index % origin.factions.length)].name;

  return {
    offer: {
      id: `C${serial}`,
      origin: origin.name,
      destination: destinationName,
      title: `${courier ? "Urgent dispatch" : "Cargo commission"} to ${destinationName}`,
      cargoName,
      cargoUnits,
      reward: Math.round(
        45 + distance * 0.07 + cargoUnits * 9 + (courier ? 20 : 0),
      ),
      influence: origin.name === "Goldhaven" ? 8 : 5 + index,
      faction: sponsor,
      estimatedDays: estimateDays
        ? estimateDays(distance, { origin, destination })
        : estimateVoyageDays(distance),
      acceptedDay: null,
      deadline: null,
    },
    nextSerial: serial + 1,
  };
}

export function contractOffersForPort({
  cache,
  day,
  createOffer,
  offerCount = 3,
  refreshDays = 4,
}) {
  if (cache && day - cache.refreshedDay < refreshDays) return cache;

  return {
    refreshedDay: day,
    offers: Array.from({ length: offerCount }, (_, index) =>
      createOffer(index),
    ),
  };
}

export function contractCargoCount(contracts) {
  return contracts.reduce((sum, contract) => sum + contract.cargoUnits, 0);
}

/* node:coverage disable */
const SURVEY_THEMES = Object.freeze([
  {
    key: "northern-chain",
    title: "Chart northern islands",
    description: "Chart three islands near the northern chain.",
    required: 3,
    target: "exploration",
    match: ({ site }) => site.y < 760,
    rewards: { coins: 180, standing: 8, charter: "Northern survey charter" },
  },
  {
    key: "glasswater-passage",
    title: "Find a safer Glasswater passage",
    description: "Publish reliable bearings for a safer Glasswater passage.",
    required: 1,
    target: "discovery",
    disposition: "share",
    match: ({ site }) =>
      site.route?.destination === "Glasswater" ||
      site.route?.origin === "Glasswater" ||
      String(site.benefit || "")
        .toLowerCase()
        .includes("glasswater"),
    rewards: { coins: 110, standing: 10, route: true },
  },
  {
    key: "navy-reefs",
    title: "Survey reefs for the Royal Navy",
    description:
      "Survey reef hazards and submit the soundings to naval pilots.",
    required: 2,
    target: "exploration",
    match: ({ site }) =>
      String(site.hazards || "")
        .toLowerCase()
        .includes("reef"),
    rewards: {
      coins: 135,
      standing: 9,
      upgradeDiscount: "Sounding gear discount",
    },
  },
  {
    key: "free-keel-secret",
    title: "Keep Free Keel locations secret",
    description:
      "Keep a valuable location secret for the Free Keel Brotherhood.",
    required: 1,
    target: "discovery",
    disposition: "secret",
    match: ({ site }) => site.faction === "Free Keel Brotherhood",
    rewards: { coins: 95, standing: 12, charter: "Free Keel quiet anchorage" },
  },
  {
    key: "deep-delvers-minerals",
    title: "Reveal mineral deposits",
    description: "Reveal mineral deposits for the Deep Delvers’ Union.",
    required: 1,
    target: "discovery",
    disposition: "share",
    match: ({ site }) =>
      site.faction === "Deep Delvers’ Union" ||
      site.type === "Hidden resource deposit" ||
      site.route?.good === "ore",
    rewards: { coins: 125, standing: 11, recruit: "Delver prospector" },
  },
  {
    key: "salvage-registry",
    title: "Register salvage rights",
    description:
      "Register salvage sites with the Pearl Senate before wreckers strip them.",
    required: 1,
    target: "discovery",
    disposition: "sell",
    sponsor: "Pearl Senate",
    match: ({ site }) =>
      site.type === "Salvage site" || site.route?.good === "fittings",
    rewards: { coins: 165, standing: 9, charter: "Pearl salvage writ" },
  },
  {
    key: "seasonal-fisheries",
    title: "Chart seasonal fisheries",
    description: "Chart seasonal fisheries for the Tideborn Commons.",
    required: 1,
    target: "discovery",
    disposition: "share",
    sponsor: "Tideborn Commons",
    match: ({ site }) =>
      Boolean(site.season) || site.route?.good === "provisions",
    rewards: { coins: 90, standing: 10, route: true },
  },
  {
    key: "ruin-index",
    title: "Index drowned ruins",
    description: "Index ruins and old observatories for the Lantern League.",
    required: 2,
    target: "discovery",
    disposition: "share",
    sponsor: "Lantern League",
    match: ({ site }) =>
      String(site.type || "")
        .toLowerCase()
        .includes("ruin") ||
      String(site.name || "")
        .toLowerCase()
        .includes("observatory"),
    rewards: { coins: 150, standing: 12, recruit: "League antiquarian" },
  },
  {
    key: "hidden-anchorages",
    title: "Mark hidden anchorages",
    description: "Mark hidden anchorages for discreet Free Keel resupply.",
    required: 2,
    target: "discovery",
    disposition: "secret",
    sponsor: "Free Keel Brotherhood",
    match: ({ site }) =>
      site.type === "Uncharted anchorage" ||
      String(site.name || "")
        .toLowerCase()
        .includes("anchorage"),
    rewards: { coins: 130, standing: 14, charter: "Free Keel resupply code" },
  },
  {
    key: "western-approaches",
    title: "Survey western approaches",
    description:
      "Survey western approaches for packet captains leaving Goldhaven.",
    required: 2,
    target: "exploration",
    sponsor: "Guild of Gilded Oars",
    match: ({ site }) => site.x < 1800,
    rewards: { coins: 120, standing: 7, route: true },
  },
  {
    key: "eastern-headlands",
    title: "Map eastern headlands",
    description: "Map eastern headlands for long-haul navigators.",
    required: 2,
    target: "exploration",
    sponsor: "Rimegate Admiralty",
    match: ({ site }) => site.x > 3600,
    rewards: { coins: 145, standing: 8, recruit: "Headland pilot" },
  },
  {
    key: "freshwater-sources",
    title: "Find freshwater sources",
    description: "Find freshwater sources to support longer island crossings.",
    required: 2,
    target: "exploration",
    sponsor: "Chartmakers’ Hall",
    match: ({ site }) =>
      String(site.objective || "")
        .toLowerCase()
        .includes("freshwater"),
    rewards: {
      coins: 105,
      standing: 7,
      upgradeDiscount: "Cask refit discount",
    },
  },
  {
    key: "fogbound-channels",
    title: "Sound fogbound channels",
    description: "Sound fogbound channels before the next convoy season.",
    required: 2,
    target: "exploration",
    sponsor: "Rimegate Admiralty",
    match: ({ site }) =>
      String(site.hazards || "")
        .toLowerCase()
        .includes("fog"),
    rewards: { coins: 150, standing: 9, route: true },
  },
  {
    key: "jungle-medicinals",
    title: "Survey jungle medicinals",
    description:
      "Survey jungle gullies for medicinal plants and safe landing paths.",
    required: 2,
    target: "exploration",
    sponsor: "Communion of the Drowned Bell",
    match: ({ site }) =>
      String(site.hazards || "")
        .toLowerCase()
        .includes("jungle") ||
      String(site.hazards || "")
        .toLowerCase()
        .includes("thornwood"),
    rewards: { coins: 125, standing: 10, recruit: "Shore herbalist" },
  },
  {
    key: "settlement-recognition",
    title: "Confirm new settlements",
    description:
      "Confirm emerging settlements for future feeder-port charters.",
    required: 1,
    target: "discovery",
    disposition: "share",
    sponsor: "Guild of Gilded Oars",
    match: ({ site }) =>
      site.type === "Emerging settlement" ||
      String(site.benefit || "")
        .toLowerCase()
        .includes("feeder port"),
    rewards: { coins: 155, standing: 10, charter: "Feeder-port charter" },
  },
  {
    key: "rare-ecosystems",
    title: "Catalogue rare ecosystems",
    description:
      "Catalogue rare ecosystems for naturalists before traders overrun them.",
    required: 1,
    target: "discovery",
    disposition: "share",
    sponsor: "League of the Hooded Lantern",
    match: ({ site }) =>
      site.type === "Rare ecosystem" || site.route?.good === "medicine",
    rewards: { coins: 115, standing: 11, recruit: "Hooded naturalist" },
  },
  {
    key: "smuggler-coves",
    title: "Identify smuggler coves",
    description: "Identify smuggler coves for confidential underworld charts.",
    required: 1,
    target: "discovery",
    disposition: "secret",
    sponsor: "Knives of Saint Orra",
    match: ({ site }) => site.type === "Smuggler cove",
    rewards: { coins: 170, standing: 8, charter: "Coded cove signals" },
  },
  {
    key: "cliff-traverses",
    title: "Chart cliff traverses",
    description: "Chart cliff traverses for specialist mountain pilots.",
    required: 2,
    target: "exploration",
    sponsor: "Deep Delvers’ Union",
    match: ({ site }) =>
      String(site.hazards || "")
        .toLowerCase()
        .includes("cliff") ||
      String(site.hazards || "")
        .toLowerCase()
        .includes("scree"),
    rewards: { coins: 135, standing: 9, recruit: "Delver climber" },
  },
]);
/* node:coverage enable */

export function surveyContractThemeCount() {
  return SURVEY_THEMES.length;
}

export function createSurveyContractOffer({ origin, index, day, serial }) {
  const theme =
    SURVEY_THEMES[(day + index + origin.name.length) % SURVEY_THEMES.length];
  const sponsor =
    origin.factions?.[index % Math.max(1, origin.factions.length)]?.name ||
    theme.sponsor ||
    theme.description.match(/for the ([^.]+)\./)?.[1] ||
    "Chartmakers’ Hall";
  return {
    offer: {
      id: `S${serial}`,
      kind: "survey",
      origin: origin.name,
      destination: null,
      title: theme.title,
      cargoName: "survey papers",
      cargoUnits: 0,
      reward: theme.rewards.coins,
      influence: theme.rewards.standing,
      faction: sponsor,
      estimatedDays: theme.required * 2,
      acceptedDay: null,
      deadline: null,
      survey: {
        key: theme.key,
        description: theme.description,
        target: theme.target,
        required: theme.required,
        completed: [],
        disposition: theme.disposition || null,
        rewards: theme.rewards,
      },
    },
    nextSerial: serial + 1,
  };
}

export function surveyContractProgress(contract, event) {
  if (contract?.kind !== "survey" || !contract.survey || !event?.site)
    return null;
  if (contract.survey.target !== event.type) return null;
  if (
    contract.survey.disposition &&
    contract.survey.disposition !== event.disposition
  )
    return null;
  const theme = SURVEY_THEMES.find((item) => item.key === contract.survey.key);
  if (!theme || !theme.match(event)) return null;
  if (contract.survey.completed.includes(event.site.id)) return null;
  contract.survey.completed.push(event.site.id);
  const complete = contract.survey.completed.length >= contract.survey.required;
  return {
    complete,
    completed: contract.survey.completed.length,
    required: contract.survey.required,
  };
}
