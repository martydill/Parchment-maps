import { legacyMetrics } from "./legacies.js";
import { SHIP_UPGRADES } from "./upgrades.js";
import { PORT_NAMES } from "../names.js";

export const QUEST_CHAINS = Object.freeze([
  {
    id: "commerce",
    title: "A merchant’s foothold",
    description: "Turn your first commission into a trading house.",
  },
  {
    id: "exploration",
    title: "Beyond familiar waters",
    description: "Visit new harbors and turn discoveries into useful charts.",
  },
  {
    id: "command",
    title: "A captain’s reputation",
    description: "Refit your ship, keep a promise, and build a working fleet.",
  },
]);

export const QUESTS = Object.freeze([
  quest(
    "first-commission",
    "commerce",
    "A letter of introduction",
    `Complete one commission on time. Dock at ${PORT_NAMES.orvessaQuay} and open the Guildhall to find work.`,
    "contracts",
    1,
    20,
  ),
  quest(
    "first-warehouse",
    "commerce",
    "A place on the quay",
    "Lease a warehouse at any port through Dock → Warehouse. A lease gives you room to store cargo between voyages.",
    "warehouses",
    1,
    30,
    "first-commission",
  ),
  quest(
    "cargo-profit",
    "commerce",
    "Buy low, sail far",
    "Earn 100 crowns of profit from cargo sales. Compare prices between ports; commission payments do not count.",
    "tradeProfit",
    100,
    60,
    "first-warehouse",
  ),
  quest(
    "industry-patron",
    "commerce",
    "Tools of the trade",
    "Invest two industry levels in port production chains through Market → Workshops.",
    "industries",
    2,
    90,
    "cargo-profit",
  ),
  quest(
    "trading-house",
    "commerce",
    "An archipelago exchange",
    "Lease warehouses in three ports to establish your trading house.",
    "warehouses",
    3,
    140,
    "industry-patron",
  ),
  quest(
    "three-harbors",
    "exploration",
    "Three harbor lights",
    "Dock at three different ports. Open the chart and choose a harbor beyond your usual route.",
    "ports",
    3,
    25,
  ),
  quest(
    "first-discovery",
    "exploration",
    "A mark on the chart",
    "Record a discovery. Investigate a site at sea or complete an expedition that reveals one.",
    "discoveries",
    1,
    35,
    "three-harbors",
  ),
  quest(
    "first-survey",
    "exploration",
    "Boots on unfamiliar ground",
    "Successfully survey one expedition site. Approach an island site, stop your ship, and choose Explore.",
    "surveys",
    1,
    50,
    "first-discovery",
  ),
  quest(
    "shared-charts",
    "exploration",
    "Charts for every captain",
    "Sell or share three discoveries from Ledger → Discoveries. Secret locations do not count.",
    "publicDiscoveries",
    3,
    80,
    "first-survey",
  ),
  quest(
    "six-discoveries",
    "exploration",
    "Beyond the old bearings",
    "Record six discoveries across the archipelago. Follow rumors and expedition leads to find more.",
    "discoveries",
    6,
    120,
    "shared-charts",
  ),
  quest(
    "first-refit",
    "command",
    "A ship of your own",
    "Equip one paid ship fitting at a port shipyard. Starter fittings do not count.",
    "refits",
    1,
    30,
  ),
  quest(
    "officer-promise",
    "command",
    "A captain keeps their word",
    "Complete an officer’s personal request. Open the ship’s register → Officers to inspect requests and deadlines.",
    "promises",
    1,
    60,
    "first-refit",
  ),
  quest(
    "first-fleet-ship",
    "command",
    "A second pennant",
    "Commission one fleet vessel at a port shipyard. Manage it from Ledger → Fleet.",
    "fleetShips",
    1,
    80,
    "officer-promise",
  ),
  quest(
    "fleet-deliveries",
    "command",
    "Cargo under your colors",
    "Complete three fleet deliveries. Assign a route and captain in Ledger → Fleet, then let voyage days pass.",
    "fleetDeliveries",
    3,
    100,
    "first-fleet-ship",
  ),
  quest(
    "two-routes",
    "command",
    "An admiral’s schedule",
    "Run two fleet vessels on trade routes at the same time. Commission another vessel and assign its route in the Fleet ledger.",
    "fleetActiveRoutes",
    2,
    150,
    "fleet-deliveries",
  ),
]);

function quest(
  id,
  chain,
  title,
  detail,
  metric,
  target,
  reward,
  requires = null,
) {
  return Object.freeze({
    id,
    chain,
    title,
    detail,
    metric,
    target,
    reward,
    requires,
  });
}

export function createQuestState() {
  return {
    completed: [],
    tracked: null,
    progress: {},
    visitedPorts: [],
    tradeProfit: 0,
  };
}

function nonnegative(value) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function normalizeQuestState(value) {
  const completed = QUESTS.filter(
    (item) =>
      Array.isArray(value?.completed) && value.completed.includes(item.id),
  ).map((item) => item.id);
  // A damaged save cannot unlock a chain by completing only its last quest.
  const validCompleted = completed.filter((id) => {
    let item = QUESTS.find((entry) => entry.id === id);
    while (item.requires) {
      if (!completed.includes(item.requires)) return false;
      item = QUESTS.find((entry) => entry.id === item.requires);
    }
    return true;
  });
  const tracked = QUESTS.find(
    (item) =>
      item.id === value?.tracked &&
      !validCompleted.includes(item.id) &&
      (!item.requires || validCompleted.includes(item.requires)),
  );
  return {
    completed: validCompleted,
    tracked: tracked?.id || null,
    progress: Object.fromEntries(
      QUESTS.map((item) => [
        item.id,
        Math.min(item.target, nonnegative(value?.progress?.[item.id])),
      ]),
    ),
    visitedPorts: Array.isArray(value?.visitedPorts)
      ? [
          ...new Set(
            value.visitedPorts.filter(
              (name) => typeof name === "string" && name.trim(),
            ),
          ),
        ]
      : [],
    tradeProfit: nonnegative(value?.tradeProfit),
  };
}

export function recordQuestPort(game, portName) {
  game.quests = normalizeQuestState(game.quests);
  if (
    typeof portName === "string" &&
    portName.trim() &&
    !game.quests.visitedPorts.includes(portName)
  )
    game.quests.visitedPorts.push(portName);
}

export function recordQuestTrade(game, profit) {
  game.quests = normalizeQuestState(game.quests);
  game.quests.tradeProfit += nonnegative(profit);
}

function questMetrics(game, state) {
  const metrics = legacyMetrics(game);
  return {
    ...metrics,
    contracts: nonnegative(game.completedContracts),
    warehouses: metrics.leasedWarehouses,
    industries: metrics.industryInvestment,
    ports: state.visitedPorts.length,
    tradeProfit: state.tradeProfit,
    surveys: Object.values(game.exploration?.sites || {}).filter(
      (site) => site?.status === "surveyed",
    ).length,
    refits: Object.entries(SHIP_UPGRADES).filter(([slot, choices]) =>
      choices.some(
        (item) =>
          item.cost > 0 && item.id === game.shipUpgrades?.equipped?.[slot],
      ),
    ).length,
    promises: (game.specialists?.officers || []).filter(
      (officer) => officer.ambition?.status === "completed",
    ).length,
  };
}

// Keep earned progress even if a fitting, fleet route, or warehouse changes later.
// Progress also accumulates for locked quests, so earlier achievements count.
export function updateQuestProgress(game) {
  const state = normalizeQuestState(game.quests);
  const metrics = questMetrics(game, state);
  for (const item of QUESTS)
    state.progress[item.id] = Math.min(
      item.target,
      Math.max(state.progress[item.id], nonnegative(metrics[item.metric])),
    );
  game.quests = state;
  return state;
}

export function questJournal(game) {
  const state = updateQuestProgress(game);
  return QUESTS.map((item) => {
    const completed = state.completed.includes(item.id);
    const locked = Boolean(
      item.requires && !state.completed.includes(item.requires),
    );
    const progress = completed ? item.target : state.progress[item.id];
    return {
      ...item,
      completed,
      locked,
      progress,
      ready: !completed && !locked && progress >= item.target,
      tracked: state.tracked === item.id,
    };
  });
}

export function trackQuest(game, id) {
  const item = questJournal(game).find((entry) => entry.id === id);
  if (!item || item.locked || item.completed) return false;
  game.quests.tracked = game.quests.tracked === id ? null : id;
  return true;
}

export function claimQuestReward(game, id) {
  const item = questJournal(game).find((entry) => entry.id === id);
  if (!item) return { ok: false, reason: "Unknown quest." };
  if (item.completed)
    return { ok: false, reason: "This reward has already been collected." };
  if (item.locked)
    return {
      ok: false,
      reason: "Complete the previous quest in this chain first.",
    };
  if (!item.ready)
    return { ok: false, reason: "Finish the quest requirements first." };
  game.quests.completed.push(id);
  if (game.quests.tracked === id) game.quests.tracked = null;
  game.coins += item.reward;
  return { ok: true, quest: item };
}

export function questObjective(game, suggest = false) {
  if (!suggest && !game.quests?.tracked) return null;
  const journal = questJournal(game);
  const item =
    journal.find((entry) => entry.tracked) ||
    (suggest && journal.find((entry) => !entry.completed && !entry.locked));
  if (!item) return null;
  return {
    id: `quest-${item.id}`,
    title: item.ready ? `Collect reward: ${item.title}` : item.title,
    detail: `${item.detail} · ${item.progress}/${item.target} · Reward: ${item.reward} crowns.`,
    action: "quests",
    destination: null,
    urgency: item.ready ? "ready" : "normal",
  };
}
