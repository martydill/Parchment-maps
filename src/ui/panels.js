import { updateElementProperty } from "./dom.js";
import {
  renderCargoPlan,
  renderCustomsOffice,
  renderIntelOffice,
  renderPolitics,
  renderPortEvent,
  renderPortOpportunities,
  renderProductionChains,
  renderReadiness,
  renderShipyard,
  renderWarehouse,
  upgradeEffects,
} from "./port-panels.js";
import {
  assignCaptain,
  clearFleetRoute,
  decommissionFleetShip,
} from "../core/fleet.js";
import { drawShip } from "../rendering.js?v=4";

let panelContext;
let acceptContract,
  clearCourse,
  courseBearing,
  bestCargoCompartment,
  syncCargoCounts,
  RIVAL_CAPTAINS,
  updateMilestoneCompletion,
  rivalRelationshipLabel,
  crewVoyageModifiers,
  UPGRADE_SLOTS,
  CREW_ROLES,
  contractCargoCount,
  CARGO_COMPARTMENTS,
  createCargoLot,
  EXPLORATION_APPROACHES,
  chooseFactionCharter,
  factionRivals,
  SPECIALIST_ROSTER,
  recordPlayerCompetition,
  handleDiscoveryDisposition,
  undertakeExpedition,
  addNews,
  availableMarketGoods,
  buyPermit,
  buyPriceFor,
  calculateShipIdentity,
  canTrade,
  cargoCapacities,
  cargoCondition,
  cargoCount,
  cargoLotDescription,
  cargoValueMultiplier,
  closeDiscoveryDetails,
  compassDirection,
  completeLegacyCapstone,
  contractConflict,
  continueLegacySandbox,
  currentObjective,
  currentVisibilityKm,
  DISCOVERY_DISPOSITIONS,
  discoverySites,
  document,
  economyCondition,
  economyState,
  ensureContractOffers,
  FACTION_NAMES,
  factionPrivilege,
  game,
  getPortByName,
  goods,
  guildStanding,
  HOME_PORT,
  intelligenceFreshness,
  lawDetails,
  LEGACY_PATHS,
  legacyChecklist,
  legacyReadyForCapstone,
  legalStatusAt,
  localCurrent,
  operationalShipStats,
  PORT_NAMES,
  portEvolution,
  productionChains,
  regionalSummary,
  saveGameState,
  sellPriceFor,
  seasonalSiteActive,
  SHIP_CLASSES,
  SHIP_COMPONENTS,
  SHIP_UPGRADES,
  shipSpeedKnots,
  showMessage,
  tradeQuote,
  ui,
  worldEvents,
  WORLD,
  wrapX,
  ship,
  currentPort,
  nearExplorationSite,
  nearPort,
  startFleetRoute,
  fleetRouteSuggestions,
  ports;

export function configureUiPanels(context) {
  panelContext = context;
  syncPanelContext();
}

function syncPanelContext() {
  ({
    acceptContract,
    clearCourse,
    courseBearing,
    bestCargoCompartment,
    syncCargoCounts,
    RIVAL_CAPTAINS,
    updateMilestoneCompletion,
    rivalRelationshipLabel,
    crewVoyageModifiers,
    UPGRADE_SLOTS,
    CREW_ROLES,
    contractCargoCount,
    CARGO_COMPARTMENTS,
    createCargoLot,
    EXPLORATION_APPROACHES,
    chooseFactionCharter,
    factionRivals,
    SPECIALIST_ROSTER,
    recordPlayerCompetition,
    handleDiscoveryDisposition,
    undertakeExpedition,
    addNews,
    availableMarketGoods,
    buyPermit,
    buyPriceFor,
    calculateShipIdentity,
    canTrade,
    cargoCapacities,
    cargoCondition,
    cargoCount,
    cargoLotDescription,
    cargoValueMultiplier,
    closeDiscoveryDetails,
    compassDirection,
    completeLegacyCapstone,
    contractConflict,
    continueLegacySandbox,
    currentObjective,
    currentVisibilityKm,
    DISCOVERY_DISPOSITIONS,
    discoverySites,
    document,
    economyCondition,
    economyState,
    ensureContractOffers,
    FACTION_NAMES,
    factionPrivilege,
    game,
    getPortByName,
    goods,
    guildStanding,
    HOME_PORT,
    intelligenceFreshness,
    lawDetails,
    LEGACY_PATHS,
    legacyChecklist,
    legacyReadyForCapstone,
    legalStatusAt,
    localCurrent,
    operationalShipStats,
    PORT_NAMES,
    portEvolution,
    productionChains,
    regionalSummary,
    saveGameState,
    sellPriceFor,
    seasonalSiteActive,
    SHIP_CLASSES,
    SHIP_COMPONENTS,
    SHIP_UPGRADES,
    shipSpeedKnots,
    showMessage,
    tradeQuote,
    ui,
    worldEvents,
    WORLD,
    wrapX,
    startFleetRoute,
    fleetRouteSuggestions,
    ports,
  } = panelContext);
  ship = panelContext.inventory.ship;
  currentPort = panelContext.currentPort;
  nearExplorationSite = panelContext.nearExplorationSite;
  nearPort = panelContext.nearPort;
}

export function updateHud() {
  syncPanelContext();

  const stats = operationalShipStats();
  updateElementProperty(
    ui.speed,
    "textContent",
    shipSpeedKnots(ship.speed, stats.waterlineLengthFt).toFixed(1) + " knots",
  );
  const dirs = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
  const idx =
    Math.round(
      ((((game.windAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) /
        (Math.PI * 2)) *
        8,
    ) % 8;
  const currentInfo = localCurrent();
  updateElementProperty(
    ui.wind,
    "textContent",
    "Wind " +
      dirs[idx] +
      " · " +
      Math.round(game.windStrength * 100) +
      " knots" +
      (currentInfo.label ? " · " + currentInfo.label : ""),
  );
  const km = currentVisibilityKm();
  updateElementProperty(
    ui.visibility,
    "textContent",
    game.weatherName +
      " · " +
      (km < 10 ? km.toFixed(1) : Math.round(km)) +
      " km sight · " +
      Math.round((wrapX(ship.x) / WORLD.w) * 360) +
      "° longitude",
  );
  updateElementProperty(ui.coins, "textContent", game.coins + " crowns");
  updateElementProperty(ui.day, "textContent", "Day " + game.day);
  updateElementProperty(
    ui.hold,
    "textContent",
    cargoCount() + "/" + game.holdMax,
  );
  updateElementProperty(
    ui.objective,
    "textContent",
    game.milestone.complete
      ? `Merchant Prince · ${game.activeWorldEvents.length} active crises`
      : `${game.completedContracts}/3 contracts · Guild ${guildStanding()}/20`,
  );
  updateElementProperty(
    ui.objective,
    "title",
    game.milestone.complete
      ? ui.objective.textContent
      : `${ui.objective.textContent} · shortage ${game.milestone.shortageExploited ? "exploited" : worldEvents.ironShortage.active ? "active" : "pending"}`,
  );
  const objective = currentObjective({
    game,
    currentPortName: currentPort?.name || null,
    nearPortName: nearPort?.name || null,
    homePortName: HOME_PORT.name,
  });
  updateElementProperty(ui.course, "className", objective.urgency);
  updateElementProperty(ui.courseTitle, "textContent", objective.title);
  updateElementProperty(ui.courseDetail, "textContent", objective.detail);
  updateElementProperty(
    ui.courseAction,
    "textContent",
    objective.action === "dock"
      ? "Dock now →"
      : objective.action === "trade"
        ? "Open contract board →"
        : objective.action === "vessel"
          ? "Prepare vessel →"
          : objective.action === "politics"
            ? "Open politics →"
            : objective.action === "ledger"
              ? "Open ledger →"
              : "Open chart →",
  );
  let destination = getPortByName(game.navigation.destination);
  if (destination && nearPort?.name === destination.name) {
    clearCourse(game.navigation);
    showMessage(`Course complete · ${destination.name} reached.`);
    saveGameState();
    destination = null;
  }
  updateElementProperty(ui.plottedCourse, "hidden", !destination);
  if (destination) {
    const bearing = courseBearing(ship, destination, WORLD.w);
    const direction = compassDirection(bearing.angle);
    updateElementProperty(
      ui.plottedCourseTitle,
      "textContent",
      `${direction} · ${destination.name}`,
    );
    updateElementProperty(
      ui.plottedCourseDetail,
      "textContent",
      `${Math.round(bearing.distance)} leagues remaining · ` +
        `bearing ${Math.round(((bearing.angle * 180) / Math.PI + 360) % 360)}°`,
    );
  }
  if (ship.anchored)
    updateElementProperty(
      ui.steeringStatus,
      "textContent",
      "AT ANCHOR · DRAG THE WHEEL TO SAIL",
    );
  else if (Math.abs(ship.speed) < 5)
    updateElementProperty(
      ui.steeringStatus,
      "textContent",
      "DRAG TOWARD YOUR DESTINATION",
    );
  else
    updateElementProperty(
      ui.steeringStatus,
      "textContent",
      "SAILING · RELEASE TO COAST",
    );
}

export function renderMilestone(root) {
  syncPanelContext();

  root.innerHTML = "";
  const steps = [
    {
      done: game.completedContracts >= 3,
      title: "Complete three contracts",
      detail: game.completedContracts + "/3 fulfilled on time",
    },
    {
      done: game.milestone.shortageExploited,
      title: `Exploit ${PORT_NAMES.orvessaQuay}’s iron shortage`,
      detail: game.milestone.shortageExploited
        ? Math.round(game.milestone.shortageProfit) +
          " crowns of shortage profit"
        : worldEvents.ironShortage.active
          ? `Buy cheap iron in ${PORT_NAMES.narthkel} or ${PORT_NAMES.drazhOvek}, then sell it in ${PORT_NAMES.orvessaQuay} · ` +
            Math.round(game.milestone.shortageProfit) +
            "/50 profit"
          : "Complete two contracts to trigger a regional market event",
    },
    {
      done: guildStanding() >= 20 || game.laws.amberConvoy,
      title: "Build Guild influence",
      detail: game.laws.amberConvoy
        ? "Influence spent to pass the charter"
        : guildStanding() +
          `/20 with the ${FACTION_NAMES.syrrelwakeOarwrightPact}`,
    },
    {
      done: game.milestone.lawChanged,
      title: "Change regional trade law",
      detail: game.milestone.lawChanged
        ? "Royal Amber Convoy is active"
        : `Petition available in ${PORT_NAMES.orvessaQuay} when prior steps are complete`,
    },
  ];
  steps.forEach((step, i) => {
    const d = document.createElement("div");
    const unlocked = i === 0 || steps.slice(0, i).every((x) => x.done);
    d.className =
      "milestone-step " +
      (step.done ? "done" : unlocked ? "pending" : "locked");
    d.innerHTML =
      "<b>" +
      (step.done ? "✓ " : "") +
      step.title +
      '</b><div class="small">' +
      step.detail +
      "</div>";
    root.append(d);
  });
  if (game.milestone.complete) {
    const done = document.createElement("div");
    done.className = "event-banner";
    done.innerHTML =
      "<b>Merchant Prince recognized</b>Your chartered seat grants a 250-crown completion bonus.";
    root.append(done);
  }
}

export function renderLegacies(root) {
  syncPanelContext();

  if (!root) return;
  root.innerHTML = "";
  if (!game.milestone.complete) {
    root.innerHTML =
      '<p class="empty-note">Reach Merchant Prince to choose a lasting legacy.</p>';
    return;
  }
  if (!game.legacy.selected) {
    const intro = document.createElement("p");
    intro.className = "small";
    intro.textContent =
      "Choose one long-term identity. The choice is permanent for this save and unlocks a checklist, final crisis, ending summary, and sandbox continuation.";
    root.append(intro);
    const grid = document.createElement("div");
    grid.className = "legacy-grid";
    for (const path of Object.values(LEGACY_PATHS)) {
      const card = document.createElement("div");
      card.className = "legacy-card";
      card.innerHTML = `<b>${path.name}</b><span>${path.description}</span><span class="small">Final crisis: ${path.crisisTitle}</span>`;
      const button = document.createElement("button");
      button.className = "parchment";
      button.textContent = `Pursue ${path.name}`;
      button.onclick = () => {
        game.legacy.selected = path.id;
        addNews("Legacy chosen", `You will pursue the ${path.name} legacy.`);
        renderLegacies(root);
        saveGameState();
      };
      card.append(button);
      grid.append(card);
    }
    root.append(grid);
    return;
  }
  const path = LEGACY_PATHS[game.legacy.selected];
  const heading = document.createElement("div");
  heading.className = "event-banner";
  heading.innerHTML = `<b>${path.name}</b>${path.description}`;
  root.append(heading);
  for (const item of legacyChecklist(game)) {
    const row = document.createElement("div");
    row.className = "milestone-step " + (item.done ? "done" : "pending");
    row.innerHTML = `<b>${item.done ? "✓ " : ""}${item.title}</b><div class="small">${item.detail}</div>`;
    root.append(row);
  }
  const crisis = document.createElement("div");
  crisis.className = "legacy-crisis";
  crisis.innerHTML = `<b>${path.crisisTitle}</b><span>${path.crisis}</span>`;
  const ready = legacyReadyForCapstone(game);
  if (!game.legacy.capstoneComplete) {
    const button = document.createElement("button");
    button.className = "parchment";
    button.textContent = ready
      ? "Complete capstone voyage"
      : "Checklist incomplete";
    button.disabled = !ready;
    button.onclick = () => {
      const result = completeLegacyCapstone(game);
      if (!result.ok) return showMessage(result.reason);
      addNews(`${result.path.name} legacy fulfilled`, result.path.ending);
      showMessage(`${result.path.name.toUpperCase()} · Legacy fulfilled`, 6);
      renderLegacies(root);
      saveGameState();
    };
    crisis.append(button);
  }
  root.append(crisis);
  if (game.legacy.capstoneComplete) {
    const ending = document.createElement("div");
    ending.className = "event-banner legacy-ending";
    ending.innerHTML = `<b>Ending: ${path.name}</b>${path.ending}`;
    const sandbox = document.createElement("button");
    sandbox.className = "parchment";
    sandbox.textContent = game.legacy.sandbox
      ? "Sandbox mode active"
      : "Continue in sandbox mode";
    sandbox.disabled = game.legacy.sandbox;
    sandbox.onclick = () => {
      continueLegacySandbox(game);
      showMessage("Sandbox mode active · Continue trading freely.", 5);
      renderLegacies(root);
      saveGameState();
    };
    ending.append(sandbox);
    root.append(ending);
  }
}

export function renderContractList(root, contracts, active = false) {
  syncPanelContext();

  root.innerHTML = "";
  if (!contracts.length) {
    root.innerHTML =
      '<p class="empty-note">' +
      (active
        ? "No active contracts. Visit a port contract board."
        : "No commissions remain on this board until it refreshes.") +
      "</p>";
    return;
  }
  contracts.forEach((contract) => {
    const card = document.createElement("div");
    card.className = "contract-card" + (active ? " active" : "");
    const head = document.createElement("div");
    head.className = "contract-head";
    head.innerHTML =
      "<b>" +
      contract.title +
      '</b><span class="contract-tag">' +
      contract.cargoUnits +
      " hold</span>";
    const desc = document.createElement("div");
    desc.className = "small";
    desc.textContent =
      contract.cargoName + " · Sponsored by " + contract.faction;
    const meta = document.createElement("div");
    meta.className = "contract-meta";
    if (active)
      meta.innerHTML =
        "<span>Due Day " +
        contract.deadline +
        "</span><span>" +
        (contract.deadline - game.day) +
        " days remain</span><span>" +
        contract.reward +
        " crowns · +" +
        contract.influence +
        " influence</span>";
    else
      meta.innerHTML =
        "<span>Est. " +
        contract.estimatedDays +
        " days</span><span>" +
        contract.reward +
        " crowns</span><span>+" +
        contract.influence +
        " influence</span>";
    card.append(head, desc, meta);
    if (!active) {
      const conflict = contractConflict(
        contract,
        game.activeContracts,
        game.factionCharter,
      );
      const button = document.createElement("button");
      button.className = "parchment";
      button.textContent = conflict
        ? "Conflicting Allegiance"
        : "Accept Commission";
      button.disabled = Boolean(conflict);
      if (conflict) button.title = conflict;
      button.onclick = () => acceptContract(contract.id);
      card.append(button);
    }
    root.append(card);
  });
}

export function renderPortSystems() {
  syncPanelContext();

  if (!currentPort) return;
  const regional = game.regionalEconomy[currentPort.name];
  const summary = regionalSummary(regional);
  const evolution = portEvolution(regional);
  const features = [
    evolution.cranes && "towering cargo cranes",
    evolution.foundries && "smoking foundries",
    evolution.warehouses && "new warehouses",
    evolution.fortifications && "harbor fortifications",
  ].filter(Boolean);
  const collapsed = Object.entries(regional.industries)
    .filter(([, industry]) => industry.collapsed)
    .map(([id]) => productionChains.find((chain) => chain.id === id)?.name)
    .filter(Boolean);
  document.getElementById("portEvolution").innerHTML =
    `<b>${features.length ? features.join(" · ") : "A modest working harbor"}</b>` +
    `<span>${summary.pirateAttention >= 50 ? "Pirates are watching this wealthy harbor. " : ""}${summary.politicalAttention >= 50 ? "Courts and factions contest its growing influence. " : ""}${summary.unrest >= 45 ? "Protests and outward migration trouble the streets. " : ""}${collapsed.length ? `Collapsed: ${collapsed.join(", ")}. Restoration capital is required.` : ""}</span>`;
  renderPortOpportunities();
  renderMarket();
  renderCustomsOffice();
  renderCargoPlan();
  renderWarehouse();
  renderProductionChains();
  renderPortEvent();
  renderIntelOffice();
  renderContractList(
    document.getElementById("contractBoard"),
    ensureContractOffers(currentPort),
    false,
  );
  renderPolitics();
  renderShipyard();
  renderReadiness();
  renderMilestone(document.getElementById("milestonePort"));
}

export function renderMarket() {
  syncPanelContext();

  document.getElementById("portCoins").textContent = game.coins + " crowns";
  document.getElementById("portHold").textContent =
    cargoCount() + "/" + game.holdMax;
  const market = document.getElementById("market");
  market.innerHTML = "";
  const regional = game.regionalEconomy[currentPort.name];
  const available = availableMarketGoods(
    regional,
    productionChains,
    Object.keys(goods),
  );
  Object.keys(goods).forEach((key) => {
    if (!available.has(key)) return;
    const state = economyState(currentPort, key),
      legalStatus = legalStatusAt(currentPort, key),
      law = lawDetails(legalStatus),
      buyQuote = tradeQuote(buyPriceFor(currentPort, key), legalStatus, "buy"),
      baseSellQuote = tradeQuote(
        sellPriceFor(currentPort, key),
        legalStatus,
        "sell",
      ),
      lots = game.cargoLots.filter((lot) => lot.key === key),
      nextLot = lots[0],
      sellQuote = nextLot
        ? Math.max(
            1,
            Math.round(
              baseSellQuote *
                cargoValueMultiplier(nextLot, currentPort.name, goods[key]),
            ),
          )
        : baseSellQuote,
      condition = economyCondition(currentPort, key);
    const tradeAccess = canTrade({
      state: game.legal,
      portName: currentPort.name,
      good: key,
      status: legalStatus,
      day: game.day,
      units: game.cargo[key],
    });
    const row = document.createElement("div");
    row.className = "trade-row";
    const klass =
      condition === "Shortage"
        ? "condition-shortage"
        : condition === "Surplus" || condition === "Glut"
          ? "condition-surplus"
          : "";
    const label = document.createElement("div");
    label.className = "trade-good";
    label.innerHTML =
      `<span class="resource-icon-frame" title="${goods[key].name}">` +
      `<svg class="resource-icon" aria-hidden="true"><use href="#resource-${key}"></use></svg>` +
      "</span>" +
      '<span class="trade-good-details"><b>' +
      goods[key].name +
      '</b><span class="small">Buy ' +
      buyQuote +
      " · Sell " +
      sellQuote +
      " crowns · aboard " +
      game.cargo[key] +
      '</span><span class="market-stock"><span class="market-condition ' +
      klass +
      '">' +
      condition +
      `</span> · <span class="legal-status legal-${legalStatus}">${law.label}</span> · ` +
      Math.floor(state.stock) +
      " units in market</span>" +
      (lots.length
        ? '<span class="cargo-manifest">' +
          lots
            .map((lot, index) => {
              const value = Math.round(
                cargoValueMultiplier(lot, currentPort.name, goods[key]) * 100,
              );
              const condition = cargoCondition(lot, goods[key]);
              return `<span class="cargo-quality quality-${lot.quality} condition-${condition.id}"><b>#${index + 1}</b> ${cargoLotDescription(lot)} · ${value}% market value</span>`;
            })
            .join("") +
          "</span>"
        : "") +
      "</span>";
    const buy = document.createElement("button");
    buy.textContent = "Buy " + buyQuote;
    buy.title = "Buy one for " + buyQuote + " crowns";
    buy.disabled =
      !tradeAccess.ok ||
      game.coins < buyQuote ||
      cargoCount() >= game.holdMax ||
      state.stock < 1;
    buy.onclick = () => {
      const access = canTrade({
        state: game.legal,
        portName: currentPort.name,
        good: key,
        status: legalStatus,
        day: game.day,
        units: game.cargo[key],
      });
      if (!access.ok) return showMessage(access.reason);
      const livePrice = tradeQuote(
        buyPriceFor(currentPort, key),
        legalStatus,
        "buy",
      );
      if (game.coins < livePrice) return showMessage("Not enough crowns.");
      if (cargoCount() >= game.holdMax) return showMessage("The hold is full.");
      if (state.stock < 1)
        return showMessage("The market has no more " + goods[key].name + ".");
      game.coins -= livePrice;
      const lot = createCargoLot({
        key,
        cost: livePrice,
        origin: currentPort.name,
        day: game.day,
        sequence: game.cargoLots.length,
        good: goods[key],
      });
      lot.compartment = bestCargoCompartment(
        lot,
        cargoCapacities(),
        game.cargoLots,
      );
      game.cargoLots.push(lot);
      syncCargoCounts(game, goods);
      state.stock -= 1;
      renderPortSystems();
      updateHud();
    };
    const sell = document.createElement("button");
    sell.textContent = "Sell " + sellQuote;
    sell.title = "Sell one for " + sellQuote + " crowns";
    sell.disabled = game.cargo[key] <= 0 || !tradeAccess.ok;
    sell.onclick = () => {
      if (game.cargo[key] <= 0) return showMessage("None aboard.");
      const lotIndex = game.cargoLots.findIndex((lot) => lot.key === key);
      const lot = game.cargoLots[lotIndex];
      const livePrice = Math.max(
          1,
          Math.round(
            tradeQuote(sellPriceFor(currentPort, key), legalStatus, "sell") *
              cargoValueMultiplier(lot, currentPort.name, goods[key]),
          ),
        ),
        cost = lot.cost ?? goods[key].base;
      game.cargoLots.splice(lotIndex, 1);
      syncCargoCounts(game, goods);
      game.coins += livePrice;
      state.stock += 1;
      const competition = recordPlayerCompetition(game.rivals, {
        port: currentPort.name,
        goodKey: key,
        day: game.day,
      });
      game.rivals = competition.state;
      if (competition.rivalId) {
        const rival = RIVAL_CAPTAINS.find(
          (entry) => entry.id === competition.rivalId,
        );
        addNews(
          `Market contested with ${rival.house}`,
          `Your ${goods[key].name} sale in ${currentPort.name} undercut a recent delivery by ${rival.captain}.`,
        );
      }
      const e = worldEvents.ironShortage;
      if (e.active && currentPort.name === e.port && key === e.good) {
        game.milestone.shortageProfit += Math.max(0, livePrice - cost);
        if (
          game.milestone.shortageProfit >= 50 &&
          !game.milestone.shortageExploited
        ) {
          game.milestone.shortageExploited = true;
          addNews(
            "A timely market coup",
            `Your iron sales into ${PORT_NAMES.orvessaQuay}’s emergency earned enough profit to prove the value of a protected route.`,
          );
          showMessage(
            "SHORTAGE EXPLOITED · Your iron sales have strengthened the Guild’s petition.",
            4,
          );
        }
      }
      updateMilestoneCompletion();
      renderPortSystems();
      updateHud();
    };
    row.append(label, buy, sell);
    if (
      legalStatus === "licensed" &&
      !tradeAccess.ok &&
      !game.legal.portBans[currentPort.name]
    ) {
      const permit = document.createElement("button");
      permit.textContent = "Permit 35";
      permit.disabled = game.coins < 35;
      permit.onclick = () => {
        const result = buyPermit(
          game.legal,
          currentPort.name,
          key,
          game.day,
          game.coins,
        );
        if (!result.ok) return showMessage(result.reason);
        game.coins = result.coins;
        showMessage(`Permit issued through Day ${result.expiresDay}.`);
        renderPortSystems();
        updateHud();
      };
      row.append(permit);
    }
    market.append(row);
  });
}

export function renderLedger() {
  syncPanelContext();

  renderMilestone(document.getElementById("milestoneLedger"));
  renderLegacies(document.getElementById("legacyLedger"));
  renderContractList(
    document.getElementById("activeContractsLedger"),
    game.activeContracts,
    true,
  );
  renderDiscoveries();
  const factions = document.getElementById("factionLedger");
  factions.innerHTML = "";
  const standings = Object.entries(game.factionStanding)
    .filter(([, v]) => v !== 0)
    .sort((a, b) => b[1] - a[1]);
  if (!standings.length)
    factions.innerHTML =
      '<p class="empty-note">Complete contracts to build political standing.</p>';
  else
    standings.forEach(([name, value]) => {
      const privilege = factionPrivilege(value);
      const row = document.createElement("div");
      row.className = "standing-row";
      row.innerHTML =
        "<span>" +
        name +
        '<span class="small">' +
        privilege.label +
        " · " +
        privilege.privilege +
        (factionRivals(name).length
          ? " · Rivals: " + factionRivals(name).join(", ")
          : "") +
        "</span></span><b>" +
        value +
        "</b>";
      factions.append(row);
      if (value >= 45 && !game.factionCharter) {
        const charter = document.createElement("button");
        charter.className = "parchment";
        charter.textContent = `Accept ${name} charter`;
        charter.onclick = () => {
          const result = chooseFactionCharter(game, name);
          if (!result.ok) return showMessage(result.reason);
          addNews(
            "Formal charter sworn",
            `You entered the service of ${name}. Its rivals have closed their doors.`,
          );
          renderLedger();
          updateHud();
        };
        factions.append(charter);
      }
    });
  if (game.factionCharter) {
    const charter = document.createElement("div");
    charter.className = "event-banner";
    charter.innerHTML = `<b>Formal charter</b>${game.factionCharter} · rival contracts unavailable`;
    factions.prepend(charter);
  }
  const obligations = game.operations.obligations.filter(
    (item) => !item.fulfilled && !item.failed,
  );
  if (obligations.length) {
    const heading = document.createElement("h4");
    heading.textContent = "Outstanding obligations";
    factions.append(heading);
    for (const obligation of obligations) {
      const row = document.createElement("div");
      row.className = "standing-row";
      row.innerHTML = `<span>Call on ${obligation.faction}</span><b>Day ${obligation.dueDay}</b>`;
      factions.append(row);
    }
  }
  const intel = document.getElementById("intelLedger");
  intel.innerHTML = "";
  if (!game.intelligence.length)
    intel.innerHTML =
      '<p class="empty-note">Buy reports from a port Whisper Network.</p>';
  else
    game.intelligence.forEach((report) => {
      const freshness = intelligenceFreshness(report, game.day),
        expired = freshness.label === "Expired",
        card = document.createElement("div");
      card.className =
        "intel-card intel-known" + (expired ? " intel-expired" : "");
      card.innerHTML =
        '<div class="intel-head"><h4>' +
        report.title +
        '</h4><span class="contract-tag">' +
        freshness.label +
        '</span></div><p class="small">' +
        report.body +
        '</p><div class="intel-meta">Purchased Day ' +
        report.boughtDay +
        " in " +
        report.origin +
        " · source confidence " +
        report.confidence +
        "%</div>";
      intel.append(card);
    });
  const traffic = document.getElementById("merchantLedger");
  traffic.innerHTML = "";
  const sightings = Object.values(game.merchantSightings).sort(
    (a, b) => b.day - a.day,
  );
  if (!sightings.length)
    traffic.innerHTML =
      '<p class="empty-note">No merchant vessels have been identified yet. Sail close enough to sight them or buy a shipping list.</p>';
  else
    sightings.forEach((s) => {
      const rival = RIVAL_CAPTAINS.find((entry) => entry.id === s.rivalId);
      const standing = rival ? game.rivals.captains[rival.id] : null;
      const row = document.createElement("div");
      row.className = "merchant-sighting";
      row.innerHTML =
        "<span><b>" +
        s.name +
        '</b><br><span class="small">' +
        (rival
          ? `${rival.captain} · ${rival.house} · ${rivalRelationshipLabel(standing.relationship)}<br>`
          : "") +
        s.origin +
        " → " +
        s.destination +
        " · " +
        s.cargoUnits +
        " " +
        goods[s.cargoKey].name +
        '</span></span><span class="contract-tag">Day ' +
        s.day +
        "</span>";
      traffic.append(row);
    });
  const news = document.getElementById("newsLedger");
  news.innerHTML = "";
  if (!game.news.length)
    news.innerHTML = '<p class="empty-note">No major port news yet.</p>';
  else
    game.news.forEach((item) => {
      const card = document.createElement("div");
      card.className = "news-card";
      card.innerHTML =
        "<h4>Day " +
        item.day +
        " · " +
        item.title +
        "</h4><p>" +
        item.body +
        "</p>";
      news.append(card);
    });
  renderFleet();
}

function renderFleet() {
  const root = document.getElementById("fleetLedger");
  if (!root) return;
  root.innerHTML = "";

  const fleet = game.fleet;
  const ships = Array.isArray(fleet?.ships) ? fleet.ships : [];
  if (!ships.length) {
    root.innerHTML =
      '<p class="empty-note">Commission a fleet vessel at a port shipyard to begin automated trade.</p>';
    return;
  }

  const suggestions = fleetRouteSuggestions();
  const assignments = fleet.captainAssignments || {};
  for (const ship of ships) {
    root.append(renderFleetShipCard(ship, suggestions, assignments));
  }
}

function fleetStatusLabel(ship) {
  if (ship.status === "repairing")
    return `In repair · ${ship.repairDaysLeft} day${ship.repairDaysLeft === 1 ? "" : "s"}`;
  if (ship.status === "sailing" && ship.route) return "Under way";
  return "Laid up";
}

function renderFleetShipCard(ship, suggestions, assignments) {
  const card = document.createElement("div");
  card.className = "fleet-ship-card";

  const shipClass = SHIP_CLASSES[ship.classId] || { name: ship.classId };
  const condition = Math.round(ship.operations?.condition ?? 0);
  const morale = Math.round(ship.operations?.morale ?? 0);

  const header = document.createElement("div");
  header.className = "standing-row";
  const captainName = ship.captain
    ? SPECIALIST_ROSTER.find((officer) => officer.id === ship.captain)?.name ||
      "Officer"
    : "No officer";
  header.innerHTML =
    "<span><b>" +
    ship.name +
    '</b><br><span class="small">' +
    shipClass.name +
    " · " +
    captainName +
    " · " +
    fleetStatusLabel(ship) +
    "</span></span>" +
    '<span class="contract-tag">F' +
    (ship.id || "").replace(/^F/, "") +
    "</span>";
  card.append(header);

  const stats = document.createElement("div");
  stats.className = "ship-stats";
  stats.innerHTML =
    "<strong>" +
    condition +
    "% condition</strong><span>" +
    ship.cargoLots.length +
    "/" +
    ship.holdMax +
    " hold" +
    (ship.cargoKey
      ? " · " +
        ship.cargoUnits +
        " " +
        (goods[ship.cargoKey]?.name || ship.cargoKey)
      : "") +
    "</span><span>" +
    morale +
    " morale</span>";
  card.append(stats);

  card.append(renderFleetRouteSection(ship, suggestions));
  card.append(renderFleetCaptainRow(ship, assignments));
  card.append(renderFleetTally(ship));

  const actions = document.createElement("div");
  actions.className = "town-actions";
  const decommission = document.createElement("button");
  decommission.className = "parchment";
  decommission.textContent = "Decommission";
  decommission.onclick = () => {
    const refund = decommissionFleetShip(game, ship.id);
    if (!refund.ok) return showMessage(refund.reason);
    addNews(
      "Fleet vessel retired",
      `${ship.name} has been sold off for ${refund.refund} crowns.`,
    );
    showMessage(`${ship.name} decommissioned for ${refund.refund} crowns.`);
    saveGameState();
    renderFleet();
    updateHud();
  };
  actions.append(decommission);
  card.append(actions);

  return card;
}

function renderFleetRouteSection(ship, suggestions) {
  const section = document.createElement("div");
  section.className = "detail-block";

  if (ship.route) {
    const summary = document.createElement("p");
    summary.className = "small";
    const routeLine = ship.route.ports.join(" → ");
    const leg =
      ship.origin && ship.destination
        ? ship.origin + " → " + ship.destination
        : routeLine;
    summary.innerHTML =
      "<b>Route</b> " +
      routeLine +
      "<br>Now sailing " +
      leg +
      " · leg " +
      (ship.route.legIndex + 1) +
      "/" +
      ship.route.legs.length;
    section.append(summary);

    const layUp = document.createElement("button");
    layUp.className = "parchment";
    layUp.textContent = "Lay up";
    layUp.onclick = () => {
      clearFleetRoute(game, ship.id);
      saveGameState();
      renderFleet();
      updateHud();
    };
    section.append(layUp);
    return section;
  }

  const note = document.createElement("p");
  note.className = "small";
  note.textContent =
    ship.status === "repairing"
      ? "Awaiting repair before she can sail again."
      : "No route assigned. Choose a template below.";
  section.append(note);

  const select = document.createElement("select");
  select.className = "fleet-route-select";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose a route…";
  select.append(placeholder);
  for (const template of suggestions) {
    const option = document.createElement("option");
    option.value = template.id;
    option.textContent = template.name;
    select.append(option);
  }
  section.append(select);

  const assign = document.createElement("button");
  assign.className = "parchment";
  assign.textContent = "Assign route";
  assign.onclick = () => {
    if (!select.value) return showMessage("Pick a route to assign.");
    const result = startFleetRoute(ship.id, select.value);
    if (!result.ok) return showMessage(result.reason);
    saveGameState();
    renderFleet();
    updateHud();
  };
  section.append(assign);

  section.append(renderFleetCustomBuilder(ship));
  return section;
}

function renderFleetCustomBuilder(ship) {
  const builder = document.createElement("div");
  builder.className = "fleet-custom-route";
  const heading = document.createElement("p");
  heading.className = "small";
  heading.textContent = "Or plot a custom route:";
  builder.append(heading);

  const portNames = ports.map((port) => port.name);
  const stops = [ship.homePort || portNames[0] || "", ""];

  const stopWrap = document.createElement("div");
  stopWrap.className = "fleet-stops";

  const renderStops = () => {
    stopWrap.innerHTML = "";
    stops.forEach((value, index) => {
      const select = document.createElement("select");
      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = "Port…";
      select.append(blank);
      for (const name of portNames) {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        if (name === value) option.selected = true;
        select.append(option);
      }
      select.onchange = () => {
        stops[index] = select.value;
      };
      stopWrap.append(select);
      if (stops.length > 2) {
        const remove = document.createElement("button");
        remove.className = "parchment";
        remove.type = "button";
        remove.textContent = "✕";
        remove.title = "Remove stop";
        remove.onclick = () => {
          stops.splice(index, 1);
          renderStops();
        };
        stopWrap.append(remove);
      }
    });
  };
  renderStops();

  const addStop = document.createElement("button");
  addStop.type = "button";
  addStop.className = "parchment";
  addStop.textContent = "+ Stop";
  addStop.disabled = stops.length >= 5;
  addStop.onclick = () => {
    if (stops.length < 5) {
      stops.push("");
      renderStops();
      addStop.disabled = stops.length >= 5;
    }
  };

  const plot = document.createElement("button");
  plot.className = "parchment";
  plot.textContent = "Plot custom route";
  plot.onclick = () => {
    const chosen = stops.filter(Boolean);
    if (chosen.length < 2)
      return showMessage("A route needs at least two ports.");
    const result = startFleetRoute(ship.id, chosen);
    if (!result.ok) return showMessage(result.reason);
    saveGameState();
    renderFleet();
    updateHud();
  };

  builder.append(stopWrap, addStop, plot);
  return builder;
}

function renderFleetCaptainRow(ship, assignments) {
  const row = document.createElement("div");
  row.className = "detail-block";
  const label = document.createElement("span");
  label.className = "small";
  label.innerHTML = "<b>Officer</b> ";
  row.append(label);

  const select = document.createElement("select");
  const none = document.createElement("option");
  none.value = "";
  none.textContent = "— Uncommanded —";
  select.append(none);
  for (const officer of SPECIALIST_ROSTER) {
    const option = document.createElement("option");
    const assignedTo = assignments[officer.id];
    option.value = officer.id;
    option.textContent =
      officer.name +
      " · " +
      officer.role +
      (assignedTo && assignedTo !== ship.id
        ? " (commands another vessel)"
        : "");
    if (officer.id === ship.captain) option.selected = true;
    select.append(option);
  }
  select.onchange = () => {
    const result = assignCaptain(game, ship.id, select.value || null);
    if (!result.ok) return showMessage(result.reason);
    saveGameState();
    renderFleet();
    updateHud();
  };
  row.append(select);
  return row;
}

function renderFleetTally(ship) {
  const tally = document.createElement("div");
  tally.className = "ship-stats";
  const profit = ship.totalRevenue - ship.totalCosts;
  tally.innerHTML =
    "<strong>" +
    profit +
    " crowns net</strong><span>" +
    ship.totalRevenue +
    " earned · " +
    ship.totalCosts +
    " spent</span><span>" +
    ship.deliveries +
    " deliver" +
    (ship.deliveries === 1 ? "y" : "ies") +
    (ship.homePort ? " · home " + ship.homePort : "") +
    "</span>";
  return tally;
}

// Portrait of the vessel for the top of the ship's register: the same
// hand-inked drawing the chart uses, floated on the parchment with a pair of
// chart-style wave marks.
function drawShipRegisterArt(vesselClass) {
  const canvas = document.getElementById("shipRegisterArt");
  if (!canvas) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = 320;
  const height = 110;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const c = canvas.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, width, height);

  c.strokeStyle = "rgba(48,58,49,.4)";
  c.lineWidth = 1.3;
  c.lineCap = "round";
  for (const [x, flip] of [
    [width / 2 - 86, 1],
    [width / 2 + 86, -1],
  ]) {
    c.beginPath();
    c.arc(x - 7 * flip, height - 26, 7, Math.PI * 0.08, Math.PI * 0.92);
    c.arc(x + 7 * flip, height - 26, 7, Math.PI * 0.08, Math.PI * 0.92);
    c.stroke();
  }

  c.save();
  c.translate(width / 2, height / 2 + 4);
  c.scale(1.8, 1.8);
  drawShip(c, 0, 0, -Math.PI / 2, -Math.PI / 2 + 0.6, 0.42, vesselClass, 1.8);
  c.restore();
}

export function renderShipPanel() {
  syncPanelContext();

  const stats = operationalShipStats();
  const identity = calculateShipIdentity(game.shipUpgrades);
  const activeClass = SHIP_CLASSES[game.shipUpgrades.activeClass];
  const ops = game.operations;

  document.getElementById("shipRegisterName").textContent =
    activeClass.vesselName;
  document.getElementById("shipRegisterDescription").textContent =
    activeClass.name + " — " + activeClass.description;

  drawShipRegisterArt(activeClass.id);

  document.getElementById("shipRegisterStats").innerHTML =
    "<strong>Fitting identity: " +
    identity.name +
    "</strong><span>" +
    identity.description +
    "</span><span>" +
    stats.holdMax +
    " hold · " +
    shipSpeedKnots(stats.maxSpeed, stats.waterlineLengthFt).toFixed(1) +
    " knots · " +
    stats.turnRate.toFixed(2) +
    " turning · " +
    currentVisibilityKm().toFixed(1) +
    " km sight · defense " +
    (stats.defense + crewVoyageModifiers(ops.crew).defense).toFixed(1) +
    "</span>";

  const fittings = document.getElementById("shipRegisterFittings");
  fittings.innerHTML = "<h4>Fitted gear</h4>";
  const gearList = document.createElement("div");
  gearList.className = "fitted-gear-list";
  for (const slot of UPGRADE_SLOTS) {
    const equippedId = game.shipUpgrades.equipped[slot.id];
    const upgrade =
      SHIP_UPGRADES[slot.id].find((item) => item.id === equippedId) || null;
    const row = document.createElement("div");
    row.className = "fitted-gear-row";
    row.innerHTML =
      '<span class="fitted-gear-slot">' +
      slot.name +
      "</span>" +
      '<span class="fitted-gear-name">' +
      (upgrade ? upgrade.name : "—") +
      "</span>" +
      '<span class="fitted-gear-stats">' +
      (upgrade ? upgradeEffects(upgrade) : "Nothing fitted") +
      "</span>";
    gearList.append(row);
  }
  fittings.append(gearList);

  document.getElementById("shipRegisterCrew").innerHTML =
    ops.provisions +
    "/30 provisions · " +
    Math.round(ops.condition) +
    "% overall condition · " +
    Math.round(ops.morale) +
    " morale · wages Day " +
    ops.wagesDueDay +
    (ops.wageArrears ? " · " + ops.wageArrears + " crowns in arrears" : "");

  document.getElementById("shipRegisterCrewGroups").innerHTML = Object.entries(
    ops.crew.groups,
  )
    .map(
      ([role, group]) =>
        `<article class="crew-card"><header><b>${CREW_ROLES[role].label}</b><strong>${group.count}</strong></header><span>${Math.round(group.experience)} experience · ${Math.round(group.fatigue)} fatigue</span><span>${group.injuries} injured · ${Math.round(group.loyalty)} loyalty</span><p>${CREW_ROLES[role].description}</p></article>`,
    )
    .join("");

  document.getElementById("shipRegisterComponents").innerHTML = Object.entries(
    SHIP_COMPONENTS,
  )
    .map(
      ([key, component]) =>
        '<div class="component-condition ' +
        (ops.components[key] < 40 ? "critical" : "") +
        '"><span>' +
        component.label +
        "</span><b>" +
        Math.round(ops.components[key]) +
        "%</b></div>",
    )
    .join("");

  const specialistState = new Map(
    game.specialists.officers.map((officer) => [officer.id, officer]),
  );
  document.getElementById("shipRegisterSpecialists").innerHTML =
    SPECIALIST_ROSTER.map((definition) => {
      const officer = specialistState.get(definition.id);
      return `<article class="specialist-card"><header><span class="specialist-emblem">${definition.emblem}</span><span><h4>${definition.name}</h4><span class="small">${definition.role} · ${definition.origin}</span></span><b>${Math.round(officer.loyalty)} ♥</b></header><p><b>Benefit:</b> ${definition.benefit}</p><p><b>Flaw:</b> ${definition.flaw}</p><p class="small"><b>Ambition:</b> ${definition.ambition}<br><b>Ties:</b> ${definition.relationship} · ${officer.events} event${officer.events === 1 ? "" : "s"}</p></article>`;
    }).join("");

  const obligationsRoot = document.getElementById("shipRegisterObligations");
  const obligations = ops.obligations.filter(
    (item) => !item.fulfilled && !item.failed,
  );
  obligationsRoot.innerHTML = "";
  if (obligations.length) {
    const heading = document.createElement("h4");
    heading.textContent = "Outstanding obligations";
    obligationsRoot.append(heading);
    for (const obligation of obligations) {
      const row = document.createElement("div");
      row.className = "standing-row";
      row.innerHTML =
        "<span>Call on " +
        obligation.faction +
        "</span><b>Day " +
        obligation.dueDay +
        "</b>";
      obligationsRoot.append(row);
    }
  }

  const cargoRoot = document.getElementById("shipRegisterCargo");
  cargoRoot.innerHTML = "";
  const capacities = cargoCapacities();
  const aboard = cargoCount();
  const sealed = contractCargoCount();
  const summary = document.createElement("div");
  summary.className = "ship-stats";
  summary.innerHTML =
    "<strong>" +
    aboard +
    "/" +
    game.holdMax +
    " hold</strong>" +
    (sealed
      ? "<span>" +
        sealed +
        " unit" +
        (sealed === 1 ? "" : "s") +
        " sealed as contract cargo.</span>"
      : "");
  cargoRoot.append(summary);

  if (game.cargoLots.length) {
    const used = {};
    for (const lot of game.cargoLots)
      used[lot.compartment] = (used[lot.compartment] || 0) + 1;
    for (const [key, compartment] of Object.entries(CARGO_COMPARTMENTS)) {
      if (!used[key]) continue;
      const section = document.createElement("section");
      section.className = "cargo-compartment";
      section.innerHTML =
        '<div class="cargo-compartment-head"><b>' +
        compartment.label +
        "</b><span>" +
        used[key] +
        "/" +
        capacities[key] +
        "</span></div>";
      for (const lot of game.cargoLots.filter(
        (item) => item.compartment === key,
      )) {
        const row = document.createElement("div");
        row.className = "cargo-lot-row";
        row.innerHTML =
          "<b>" +
          goods[lot.key].name +
          '</b><span class="small">' +
          cargoLotDescription(lot) +
          "</span>";
        section.append(row);
      }
      cargoRoot.append(section);
    }
  } else {
    const empty = document.createElement("p");
    empty.className = "empty-note";
    empty.textContent = "The hold is empty.";
    cargoRoot.append(empty);
  }
}

export function renderDiscoveries() {
  syncPanelContext();

  const root = document.getElementById("discoveryLedger");
  root.innerHTML = "";
  const records = Object.values(game.discoveries.found).sort(
    (a, b) => b.foundDay - a.foundDay,
  );
  const visibleLeads = game.discoveries.rumorLeads.some(
    (lead) => !lead.resolvedDay,
  );
  if (!records.length && !visibleLeads) {
    root.innerHTML =
      '<p class="empty-note">No hidden places recorded. Sail beyond familiar coasts and investigate close sightings.</p>';
    return;
  }
  const leads = game.discoveries.rumorLeads
    .filter((lead) => !lead.resolvedDay)
    .slice(0, 8);
  for (const lead of leads) {
    const card = document.createElement("div");
    card.className = "discovery-card rumor-card";
    const status = lead.expiredDay
      ? `Expired Day ${lead.expiredDay}`
      : `Search by Day ${lead.expiresDay}`;
    card.innerHTML =
      `<div class="intel-head"><h4>🗺 ${lead.title || "Rumor lead"}</h4><span class="contract-tag">${status}</span></div>` +
      `<div class="town-kicker">${lead.source} · ${lead.origin}${lead.interpreted ? " · interpreted" : ""}</div>` +
      `<p class="small">“${lead.clue}”</p><p><b>Search zone:</b> broad circle on the chart, radius ${Math.round(lead.radius)} leagues.</p>`;
    root.append(card);
  }
  for (const record of records) {
    const site = discoverySites.find((entry) => entry.id === record.id);
    if (!site) continue;
    const card = document.createElement("div");
    card.className = "discovery-card";
    const season = site.season
      ? '<span class="contract-tag">' +
        (seasonalSiteActive(site, game.day) ? "In season" : "Out of season") +
        "</span>"
      : "";
    card.innerHTML =
      '<div class="intel-head"><h4>' +
      site.icon +
      " " +
      site.name +
      "</h4>" +
      season +
      '</div><div class="town-kicker">' +
      site.type +
      " · found Day " +
      record.foundDay +
      '</div><p class="small">' +
      site.description +
      "</p><p><b>Consequence:</b> " +
      site.benefit +
      "</p>";
    if (record.disposition) {
      const status = document.createElement("div");
      status.className = "discovery-status";
      status.textContent =
        DISCOVERY_DISPOSITIONS[record.disposition].label +
        " · resolved Day " +
        record.resolvedDay;
      card.append(status);
    } else {
      const actions = document.createElement("div");
      actions.className = "discovery-actions";
      for (const disposition of ["secret", "sell", "share"]) {
        const button = document.createElement("button");
        button.className = "mini-action";
        button.textContent =
          disposition === "sell"
            ? "Sell · " + site.saleValue + " crowns"
            : disposition === "share"
              ? "Share · +" + site.standingValue + " standing"
              : "Keep secret";
        button.addEventListener("click", () =>
          handleDiscoveryDisposition(site.id, disposition),
        );
        actions.append(button);
      }
      card.append(actions);
    }
    root.append(card);
  }
}

export function renderDiscoveryPanel(id) {
  syncPanelContext();

  const site = discoverySites.find((entry) => entry.id === id);
  const record = game.discoveries.found[id];
  if (!site || !record) {
    closeDiscoveryDetails();
    return;
  }
  document.getElementById("discoveryType").textContent = site.type;
  document.getElementById("discoveryName").textContent =
    site.icon + " " + site.name;
  document.getElementById("discoveryDescription").textContent =
    site.description;
  document.getElementById("discoveryBenefit").textContent = site.benefit;
  const meta = document.getElementById("discoveryMeta");
  meta.innerHTML = "";
  const metaRows = [
    ["Found", "Day " + record.foundDay],
    ["Recorded by", site.faction],
    ["Chart value", site.saleValue + " crowns"],
    ["Standing", "+" + site.standingValue + " if shared"],
  ];
  if (record.recovered) {
    const name = goods[record.recovered.good]?.name || record.recovered.good;
    metaRows.splice(1, 0, [
      "Recovered",
      record.recovered.units > 0
        ? `${record.recovered.units} ${name} in the hold`
        : `Hold full — ${name} left behind`,
    ]);
  }
  if (site.season)
    metaRows.push([
      "Season",
      seasonalSiteActive(site, game.day) ? "In season" : "Out of season",
    ]);
  if (site.route) {
    const perDay = Math.round(site.route.units);
    metaRows.push([
      "Opens route",
      `${goods[site.route.good]?.name || site.route.good}, ~${perDay}/day: ${site.route.origin} → ${site.route.destination}`,
    ]);
  }
  for (const [label, value] of metaRows) {
    const item = document.createElement("div");
    item.className = "summary-item";
    item.innerHTML = "<b>" + label + "</b><span>" + value + "</span>";
    meta.append(item);
  }
  const dispositionRoot = document.getElementById("discoveryDisposition");
  dispositionRoot.innerHTML = "";
  if (record.disposition) {
    const status = document.createElement("div");
    status.className = "discovery-status";
    status.textContent =
      DISCOVERY_DISPOSITIONS[record.disposition].label +
      " · resolved Day " +
      record.resolvedDay;
    dispositionRoot.append(status);
  } else {
    const actions = document.createElement("div");
    actions.className = "discovery-actions";
    for (const disposition of ["secret", "sell", "share"]) {
      const button = document.createElement("button");
      button.className = "parchment";
      button.textContent =
        disposition === "sell"
          ? "Sell · " + site.saleValue + " crowns"
          : disposition === "share"
            ? "Share · +" + site.standingValue + " standing"
            : "Keep secret";
      button.addEventListener("click", () => {
        handleDiscoveryDisposition(id, disposition);
        renderDiscoveryPanel(id);
      });
      actions.append(button);
    }
    dispositionRoot.append(actions);
  }
}

export function openExploration() {
  syncPanelContext();

  if (!nearExplorationSite) return;
  ship.anchored = true;
  ship.speed = 0;
  const site = nearExplorationSite;
  document.getElementById("explorationName").textContent = site.name;
  document.getElementById("explorationObjective").textContent = site.objective;
  document.getElementById("explorationHazards").textContent =
    "Hazards: " + site.hazards;
  const progress = game.exploration.sites[site.id];
  document.getElementById("explorationStatus").textContent = progress
    ? `${progress.status} · ${progress.visits} previous expedition${progress.visits === 1 ? "" : "s"}`
    : "This coast has not been surveyed. A successful expedition reveals this landmass on your chart.";
  const options = document.getElementById("explorationApproaches");
  options.innerHTML = "";
  if (progress) {
    const unavailable = document.createElement("p");
    unavailable.className = "small";
    unavailable.textContent =
      "This shore expedition has already sailed and cannot be repeated.";
    options.append(unavailable);
    document.getElementById("explorationPanel").style.display = "grid";
    return;
  }
  for (const [approach, plan] of Object.entries(EXPLORATION_APPROACHES)) {
    const button = document.createElement("button");
    button.className = "parchment expedition-option";
    const provisionShortage = Math.max(
      0,
      plan.provisions - game.operations.provisions,
    );
    button.disabled = provisionShortage > 0;
    if (button.disabled) {
      button.setAttribute(
        "aria-label",
        `${plan.label} unavailable; need ${provisionShortage} more provisions`,
      );
      button.title = `Need ${provisionShortage} more provisions`;
    }
    button.innerHTML =
      `<b>${plan.label}</b><span>${plan.days} day${plan.days === 1 ? "" : "s"}</span>` +
      `<span class="small">${plan.provisions} provisions${provisionShortage ? ` · need ${provisionShortage} more` : ""} · ${Math.round(plan.rewardScale * 100)}% reward potential</span>`;
    button.addEventListener("click", () => undertakeExpedition(site, approach));
    options.append(button);
  }
  document.getElementById("explorationPanel").style.display = "grid";
}
