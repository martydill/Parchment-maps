export const LEGACY_PATHS = Object.freeze({
  tradeMagnate: legacyPath(
    "tradeMagnate",
    "Trade Magnate",
    "Control warehouses and industries across the archipelago.",
    "The Exchange Panic",
    "A credit panic races from warehouse to warehouse. Convoy your reserves, honor every note, and prove that your private exchange can steady the islands.",
    "Your bonded warehouses and chartered industries become the archipelago's common market. Prices still rise and fall, but every merchant now reckons with your exchange before setting sail.",
  ),
  factionKingmaker: legacyPath(
    "factionKingmaker",
    "Faction Kingmaker",
    "Secure a charter and reshape regional law.",
    "The Charter Diet",
    "Rival envoys gather to annul your patron's concessions. Sail between courts, call in favors, and force the diet to accept your settlement.",
    "Your chosen faction rewrites harbor law under your seal. You are remembered less as a trader than as the captain who made governments bargain with commerce.",
  ),
  masterExplorer: legacyPath(
    "masterExplorer",
    "Master Explorer",
    "Chart major discoveries and dangerous waters.",
    "The Last Blank Sea",
    "A winter fog exposes a passage through the most feared waters. Complete the final survey before storms or rivals bury it again.",
    "Your charts turn rumor into route and terror into seamark. Generations of navigators will cross waters that once had no names because you sounded them first.",
  ),
  fleetAdmiral: legacyPath(
    "fleetAdmiral",
    "Fleet Admiral",
    "Command several upgraded vessels and suppress piracy.",
    "The Pirate Congress",
    "The raider captains unite for one strike against lawful shipping. Muster your refitted fleet and break their congress at sea.",
    "Your pennant becomes a promise of safe passage. Independent captains still grumble at your discipline, but pirates learn to fear every sail on the horizon.",
  ),
  shadowBroker: legacyPath(
    "shadowBroker",
    "Shadow Broker",
    "Dominate intelligence and contraband networks.",
    "The Night Ledger",
    "A stolen ledger can expose every informant you own. Move through permits, concealed holds, and black-market whispers to decide who survives the revelation.",
    "No decree moves and no cargo vanishes without reaching your desk. The archipelago calls it coincidence; captains in the know call it your invisible empire.",
  ),
  independentPrince: legacyPath(
    "independentPrince",
    "Independent Prince",
    "Build a neutral commercial league instead of joining a faction.",
    "The Neutrality Trial",
    "Great powers demand you choose a side. Bind neutral ports, captains, and markets into a league strong enough to stand alone.",
    "Your league proves that neutrality can be an institution, not a refuge. Factions still court you, but the free ports now answer first to their own compact.",
  ),
});

export function createLegacyState() {
  return {
    selected: null,
    capstoneComplete: false,
    endingSeen: false,
    sandbox: false,
  };
}

export function normalizeLegacyState(value) {
  const fresh = createLegacyState();
  if (!value || typeof value !== "object") return fresh;
  const selected = LEGACY_PATHS[value.selected] ? value.selected : null;
  return {
    selected,
    capstoneComplete: Boolean(value.capstoneComplete && selected),
    endingSeen: Boolean(value.endingSeen && selected),
    sandbox: Boolean(value.sandbox),
  };
}

export function legacyChecklist(game) {
  const pathId = game?.legacy?.selected;
  const path = LEGACY_PATHS[pathId];
  if (!path) return [];
  const metrics = legacyMetrics(game);
  const stepsByPath = {
    tradeMagnate: [
      step(
        "merchant-prince",
        "Reach Merchant Prince",
        game?.milestone?.complete,
      ),
      step(
        "warehouses",
        "Lease four warehouses",
        metrics.leasedWarehouses >= 4,
        `${metrics.leasedWarehouses}/4`,
      ),
      step(
        "industries",
        "Invest eight industry levels",
        metrics.industryInvestment >= 8,
        `${metrics.industryInvestment}/8`,
      ),
      step(
        "fleet-revenue",
        "Earn 600 crowns from fleet trade",
        metrics.fleetRevenue >= 600,
        `${metrics.fleetRevenue}/600`,
      ),
      step(
        "capital",
        "Hold 900 crowns in reserve",
        metrics.coins >= 900,
        `${metrics.coins}/900`,
      ),
    ],
    factionKingmaker: [
      step(
        "merchant-prince",
        "Reach Merchant Prince",
        game?.milestone?.complete,
      ),
      step(
        "charter",
        "Accept a formal faction charter",
        Boolean(game?.factionCharter),
        game?.factionCharter || "No charter",
      ),
      step(
        "standing",
        "Earn 70 standing with the charter faction",
        metrics.charterStanding >= 70,
        `${metrics.charterStanding}/70`,
      ),
      step(
        "law",
        "Pass the Royal Amber Convoy law",
        game?.milestone?.lawChanged,
      ),
    ],
    masterExplorer: [
      step(
        "merchant-prince",
        "Reach Merchant Prince",
        game?.milestone?.complete,
      ),
      step(
        "discoveries",
        "Record twelve discoveries",
        metrics.discoveries >= 12,
        `${metrics.discoveries}/12`,
      ),
      step(
        "public-charts",
        "Publish six discoveries",
        metrics.publicDiscoveries >= 6,
        `${metrics.publicDiscoveries}/6`,
      ),
      step(
        "hazards",
        "Survive six dangerous-water encounters",
        metrics.hazards >= 6,
        `${metrics.hazards}/6`,
      ),
    ],
    fleetAdmiral: [
      step(
        "merchant-prince",
        "Reach Merchant Prince",
        game?.milestone?.complete,
      ),
      step(
        "fleet",
        "Command three fleet vessels across two classes",
        metrics.fleetShips >= 3 && metrics.fleetClasses >= 2,
        `${metrics.fleetShips}/3 · ${metrics.fleetClasses}/2`,
      ),
      step(
        "routes",
        "Run two simultaneous trade routes",
        metrics.fleetActiveRoutes >= 2,
        `${metrics.fleetActiveRoutes}/2`,
      ),
      step(
        "upgrades",
        "Install ten ship upgrades",
        metrics.upgrades >= 10,
        `${metrics.upgrades}/10`,
      ),
      step(
        "pirates",
        "Repel five pirate attacks",
        metrics.piratesRepelled >= 5,
        `${metrics.piratesRepelled}/5`,
      ),
    ],
    shadowBroker: [
      step(
        "merchant-prince",
        "Reach Merchant Prince",
        game?.milestone?.complete,
      ),
      step(
        "intel",
        "Acquire twelve intelligence reports",
        metrics.intelligence >= 12,
        `${metrics.intelligence}/12`,
      ),
      step("concealed", "Install a concealed hold", metrics.concealedHold),
      step(
        "permits",
        "Hold four active trade permits",
        metrics.permits >= 4,
        `${metrics.permits}/4`,
      ),
    ],
    independentPrince: [
      step(
        "merchant-prince",
        "Reach Merchant Prince",
        game?.milestone?.complete,
      ),
      step(
        "neutral",
        "Remain free of formal faction charters",
        !game?.factionCharter,
        game?.factionCharter || "Neutral",
      ),
      step(
        "ports",
        "Lease warehouses in six ports",
        metrics.leasedWarehouses >= 6,
        `${metrics.leasedWarehouses}/6`,
      ),
      step(
        "balance",
        "Keep three factions at 25+ standing",
        metrics.friendlyFactions >= 3,
        `${metrics.friendlyFactions}/3`,
      ),
    ],
  };
  return stepsByPath[pathId];
}

export function legacyReadyForCapstone(game) {
  return legacyChecklist(game).every((item) => item.done);
}

export function completeLegacyCapstone(game) {
  if (!LEGACY_PATHS[game?.legacy?.selected])
    return { ok: false, reason: "Choose a legacy first." };
  if (game.legacy.capstoneComplete)
    return { ok: false, reason: "This legacy is already complete." };
  if (!legacyReadyForCapstone(game))
    return { ok: false, reason: "Finish the legacy checklist first." };
  game.legacy.capstoneComplete = true;
  game.legacy.endingSeen = true;
  return { ok: true, path: LEGACY_PATHS[game.legacy.selected] };
}

export function continueLegacySandbox(game) {
  if (!game?.legacy?.capstoneComplete) return false;
  game.legacy.sandbox = true;
  return true;
}

export function legacyMetrics(game = {}) {
  const warehouses = Object.values(game.warehouses || {}).filter(
    (warehouse) => warehouse?.leased,
  ).length;
  const industries = Object.values(game.regionalEconomy || {}).reduce(
    (total, regional) =>
      total +
      Object.values(regional?.industries || {}).reduce(
        (sum, industry) => sum + (Number(industry?.investment) || 0),
        0,
      ),
    0,
  );
  const upgrades = Object.values(game.shipUpgrades?.equipped || {}).filter(
    Boolean,
  ).length;
  const fleetShips = Array.isArray(game.fleet?.ships) ? game.fleet.ships : [];
  return {
    leasedWarehouses: warehouses,
    industryInvestment: industries,
    coins: Math.floor(Number(game.coins) || 0),
    charterStanding: game.factionCharter
      ? Number(game.factionStanding?.[game.factionCharter]) || 0
      : 0,
    discoveries: Object.keys(game.discoveries?.found || {}).length,
    publicDiscoveries: Object.values(game.discoveries?.found || {}).filter(
      (record) => record?.disposition && record.disposition !== "secret",
    ).length,
    hazards: Number(game.maritimeHazards?.resolvedEncounters) || 0,
    vesselClasses: new Set(
      [
        game.shipUpgrades?.activeClass,
        ...(game.shipUpgrades?.ownedClasses || []),
      ].filter(Boolean),
    ).size,
    upgrades,
    piratesRepelled: Number(game.legacyProgress?.piratesRepelled) || 0,
    intelligence: Array.isArray(game.intelligence)
      ? game.intelligence.length
      : 0,
    concealedHold: game.shipUpgrades?.equipped?.cargo === "smugglers-lockers",
    permits: Object.values(game.legal?.permits || {}).filter(
      (permit) => Number(permit?.expiresDay) >= Number(game.day || 0),
    ).length,
    friendlyFactions: Object.values(game.factionStanding || {}).filter(
      (standing) => standing >= 25,
    ).length,
    fleetShips: fleetShips.length,
    fleetActiveRoutes: fleetShips.filter(
      (ship) => ship?.route && ship.status === "sailing",
    ).length,
    fleetClasses: new Set(
      fleetShips.map((ship) => ship?.classId).filter(Boolean),
    ).size,
    fleetDeliveries: Number(game.legacyProgress?.fleetDeliveries) || 0,
    fleetRevenue: Number(game.legacyProgress?.fleetRevenue) || 0,
  };
}

function legacyPath(id, name, description, crisisTitle, crisis, ending) {
  return { id, name, description, crisisTitle, crisis, ending };
}

function step(id, title, done, detail = done ? "Complete" : "Pending") {
  return { id, title, done: Boolean(done), detail };
}
