import { seasonAtDay, SEASON_LENGTH } from "../core/seasons.js";
import { goodsIllustration } from "./port-art.js?v=4";
import { paginateMarket } from "./port-workspace.js?v=5";
import { planMarketOrder } from "../core/market-order.js";
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
} from "./port-panels.js?v=11";
import {
  assignCaptain,
  clearFleetRoute,
  decommissionFleetShip,
} from "../core/fleet.js";
import { drawShip } from "../rendering.js?v=5";

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
  pricingOptions,
  calculateShipIdentity,
  canTrade,
  cargoCapacities,
  cargoCount,
  cargoLotDescription,
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
    pricingOptions,
    calculateShipIdentity,
    canTrade,
    cargoCapacities,
    cargoCount,
    cargoLotDescription,
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
  // The hull condition modeled in the dockyard, surfaced while under way.
  const hullCondition = Math.round(
    Math.max(0, Math.min(100, Number(game.operations.components?.hull) || 0)),
  );
  updateElementProperty(ui.hull, "textContent", "Hull " + hullCondition + "%");
  updateElementProperty(
    ui.hull,
    "className",
    hullCondition < 25 ? "critical" : hullCondition < 60 ? "worn" : "",
  );
  updateElementProperty(ui.coins, "textContent", game.coins + " crowns");
  const calendar = seasonAtDay(game.day);
  updateElementProperty(
    ui.day,
    "textContent",
    `${calendar.label} · Day ${game.day}`,
  );
  updateElementProperty(
    ui.day,
    "title",
    `Year ${calendar.year} · ${calendar.label}, day ${calendar.dayOfSeason} of ${SEASON_LENGTH}. Seasons change as voyage days pass.`,
  );
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
          ? "Prepare at dock →"
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
  panelContext.renderHarborPresentation();
  renderMilestone(document.getElementById("milestonePort"));
  panelContext.refreshPortWorkspace();
}

let marketSelection = {
  port: null,
  key: null,
  direction: "buy",
  quantity: 1,
  filter: "all",
};

export function renderMarket() {
  syncPanelContext();
  if (marketSelection.port !== currentPort.name) {
    marketSelection = {
      port: currentPort.name,
      key: null,
      direction: "buy",
      quantity: 1,
      filter: "all",
    };
    document.getElementById("marketReceipt").textContent = "";
  }
  document.getElementById("portCoins").textContent = game.coins + " crowns";
  document.getElementById("portHold").textContent =
    cargoCount() + "/" + game.holdMax;
  const market = document.getElementById("market");
  market.replaceChildren();
  const available = availableMarketGoods(
    game.regionalEconomy[currentPort.name],
    productionChains,
    Object.keys(goods),
  );
  // Goods already aboard remain sellable even when local production collapses.
  const keys = Object.keys(goods).filter(
    (key) => available.has(key) || game.cargo[key] > 0,
  );
  if (!keys.includes(marketSelection.key)) marketSelection.key = keys[0];
  document.querySelectorAll(".market-filters button").forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.filter === marketSelection.filter),
    );
    button.onclick = () => {
      marketSelection.filter = button.dataset.filter;
      renderMarket();
      document
        .querySelector(
          `.market-filters [data-filter="${marketSelection.filter}"]`,
        )
        .focus();
    };
  });
  let visible = 0;
  for (const key of keys) {
    const state = economyState(currentPort, key);
    const status = legalStatusAt(currentPort, key);
    const condition = economyCondition(currentPort, key);
    if (marketSelection.filter === "aboard" && !game.cargo[key]) continue;
    if (
      marketSelection.filter === "demand" &&
      !["Shortage", "Tight"].includes(condition)
    )
      continue;
    if (marketSelection.filter === "restricted" && status === "legal") continue;
    visible++;
    const row = document.createElement("div");
    row.dataset.good = key;
    row.className =
      "exchange-row" + (marketSelection.key === key ? " selected" : "");
    const label = document.createElement("button");
    label.type = "button";
    label.className = "exchange-good";
    label.setAttribute("aria-pressed", String(marketSelection.key === key));
    label.innerHTML = `<span class="exchange-illustration">${goodsIllustration(key)}</span><span><b>${goods[key].name}</b><small>${Math.floor(state.stock)} local · ${game.cargo[key]} aboard · ${condition}${status === "legal" ? "" : " · " + lawDetails(status).label}</small></span>`;
    label.onclick = () => {
      marketSelection.key = key;
      marketSelection.quantity = 1;
      renderMarket();
      document.getElementById("orderQuantity").focus();
    };
    row.append(label);
    for (const direction of ["buy", "sell"]) {
      const plan = marketOrder(key, direction, 1);
      const price =
        plan.total ??
        tradeQuote(
          direction === "buy"
            ? buyPriceFor(currentPort, key)
            : sellPriceFor(currentPort, key),
          status,
          direction,
        );
      const button = document.createElement("button");
      button.type = "button";
      button.className = "exchange-price";
      button.innerHTML = `<small>${direction === "buy" ? "Buy" : "Sell"}</small><b>${price}</b>`;
      button.setAttribute(
        "aria-label",
        `Preview ${direction} ${goods[key].name}`,
      );
      button.onclick = () => {
        marketSelection.key = key;
        marketSelection.direction = direction;
        marketSelection.quantity = 1;
        renderMarket();
        document.getElementById("orderQuantity").focus();
      };
      row.append(button);
    }
    market.append(row);
  }
  if (!visible)
    market.innerHTML =
      '<p class="empty-note">No goods match this filter. Choose All goods to view the exchange.</p>';
  renderMarketOrder();
  paginateMarket(
    market,
    marketSelection.key,
    `${currentPort.name}:${marketSelection.filter}`,
  );
}

export function openMarketGood(key) {
  syncPanelContext();
  panelContext.openHarborService("market", "market");
  marketSelection.key = key;
  marketSelection.direction = "buy";
  marketSelection.quantity = 1;
  marketSelection.filter = "all";
  renderMarket();
  if (marketSelection.key !== key) {
    const root = document.getElementById("marketOrder");
    root.innerHTML = `<div class="town-kicker">Exchange listing</div><h3>${goods[key].name}</h3><p class="small">This manufactured good is not listed here yet. Invest in its workshop to unlock exchange listings.</p><button class="parchment" type="button">View local workshops →</button>`;
    const workshop = root.querySelector("button");
    workshop.onclick = () =>
      panelContext.openHarborService("market", "productionChains");
    workshop.focus();
    return;
  }
  document.getElementById("orderQuantity").focus();
}

function marketOrder(key, direction, quantity) {
  return planMarketOrder({
    direction,
    quantity,
    pricing: pricingOptions(currentPort, key),
    legal: game.legal,
    status: legalStatusAt(currentPort, key),
    lots: game.cargoLots,
    coins: game.coins,
    holdUsed: cargoCount(),
    holdMax: game.holdMax,
  });
}

function renderMarketOrder() {
  const root = document.getElementById("marketOrder");
  const { key, direction, quantity } = marketSelection;
  if (!key) {
    root.innerHTML =
      '<p class="empty-note">No goods are available at this exchange.</p>';
    return;
  }
  const status = legalStatusAt(currentPort, key);
  root.innerHTML = `<div class="town-kicker">Transaction preview</div><div class="order-good"><span class="exchange-illustration">${goodsIllustration(key)}</span><h3>${goods[key].name}</h3></div><div class="order-directions" role="group" aria-label="Transaction direction"><button type="button" data-direction="buy" aria-pressed="${direction === "buy"}">Buy</button><button type="button" data-direction="sell" aria-pressed="${direction === "sell"}">Sell</button></div><label class="quantity-label" for="orderQuantity">Quantity</label><div class="order-quantity"><button type="button" id="orderLess" aria-label="Decrease quantity">−</button><input id="orderQuantity" type="number" min="1" max="70" step="1" value="${quantity}" inputmode="numeric"><button type="button" id="orderMore" aria-label="Increase quantity">+</button><button type="button" id="orderMax">Max</button></div><div id="orderSummary" class="order-summary" aria-live="polite"></div><button class="parchment order-confirm" type="button" id="confirmOrder"></button><div id="orderReason" class="order-reason" role="status"></div><div class="order-manifest"></div>`;
  root.querySelectorAll("[data-direction]").forEach((button) => {
    button.onclick = () => {
      marketSelection.direction = button.dataset.direction;
      renderMarketOrder();
      root
        .querySelector(`[data-direction="${marketSelection.direction}"]`)
        .focus();
    };
  });
  const input = root.querySelector("input");
  const change = (value) => {
    marketSelection.quantity = value;
    input.value = value;
    updateOrderPreview();
  };
  input.oninput = () => {
    marketSelection.quantity = input.valueAsNumber;
    updateOrderPreview();
  };
  root.querySelector("#orderLess").onclick = () =>
    change(Math.max(1, (input.valueAsNumber || 1) - 1));
  root.querySelector("#orderMore").onclick = () =>
    change(Math.min(70, (input.valueAsNumber || 0) + 1));
  root.querySelector("#orderMax").onclick = () => {
    let maximum = 0;
    for (let count = 1; count <= 70; count++) {
      if (!marketOrder(key, marketSelection.direction, count).ok) break;
      maximum = count;
    }
    change(Math.max(1, maximum));
  };
  root.querySelector("#confirmOrder").onclick = executeMarketOrder;
  const access = canTrade({
    state: game.legal,
    portName: currentPort.name,
    good: key,
    status,
    day: game.day,
    units: game.cargo[key],
  });
  if (
    status === "licensed" &&
    !access.ok &&
    !game.legal.portBans[currentPort.name]
  ) {
    const permit = document.createElement("button");
    permit.type = "button";
    permit.className = "parchment";
    permit.textContent = "Obtain permit · 35 crowns";
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
      document.getElementById("marketReceipt").textContent =
        `Permit issued for ${goods[key].name} through Day ${result.expiresDay}.`;
      renderPortSystems();
      updateHud();
      saveGameState();
    };
    root.querySelector("#confirmOrder").hidden = true;
    root.querySelector("#confirmOrder").after(permit);
  }
  const manifest = root.querySelector(".order-manifest");
  const lots = game.cargoLots.filter((lot) => lot.key === key);
  if (lots.length) {
    const cargo = document.createElement("button");
    cargo.type = "button";
    cargo.textContent = `Inspect ${lots.length} cargo lots →`;
    cargo.onclick = () => panelContext.openHarborService("harbor", "cargoPlan");
    manifest.append(cargo);
  }
  updateOrderPreview();
}

function updateOrderPreview() {
  const { key, direction, quantity } = marketSelection;
  const plan = marketOrder(key, direction, quantity);
  document.getElementById("orderSummary").innerHTML =
    `<div><span>${direction === "buy" ? "Total cost" : "Sale proceeds"}</span><strong>${plan.total === undefined ? "—" : plan.total} <small>crowns</small></strong></div><div><span>Purse after</span><b>${plan.ok ? plan.coinsAfter : "—"}</b></div><div><span>Hold after</span><b>${plan.ok ? plan.holdAfter : "—"} / ${game.holdMax}</b></div>`;
  const confirm = document.getElementById("confirmOrder");
  confirm.disabled = !plan.ok;
  confirm.textContent = `${direction === "buy" ? "Buy" : "Sell"} ${Number.isInteger(quantity) ? quantity : ""} · ${plan.total === undefined ? "—" : plan.total} crowns`;
  document.getElementById("orderReason").textContent = plan.ok
    ? "Ready to confirm"
    : plan.reason;
  document.getElementById("orderReason").classList.toggle("blocked", !plan.ok);
}

function executeMarketOrder() {
  syncPanelContext();
  const { key, direction, quantity } = marketSelection;
  const plan = marketOrder(key, direction, quantity);
  if (!plan.ok) {
    updateOrderPreview();
    return;
  }
  if (direction === "buy") {
    plan.prices.forEach((cost) => {
      const lot = createCargoLot({
        key,
        cost,
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
    });
  } else {
    const sold = new Set(plan.soldLots);
    game.cargoLots = game.cargoLots.filter((lot) => !sold.has(lot));
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
    const event = worldEvents.ironShortage;
    if (event.active && currentPort.name === event.port && key === event.good) {
      game.milestone.shortageProfit += plan.soldLots.reduce(
        (sum, lot, index) =>
          sum + Math.max(0, plan.prices[index] - (lot.cost ?? goods[key].base)),
        0,
      );
      if (
        game.milestone.shortageProfit >= 50 &&
        !game.milestone.shortageExploited
      ) {
        game.milestone.shortageExploited = true;
        addNews(
          "A timely market coup",
          `Your iron sales into ${PORT_NAMES.orvessaQuay}’s emergency proved the value of a protected route.`,
        );
        showMessage(
          "SHORTAGE EXPLOITED · Your sales strengthened the Guild’s petition.",
          4,
        );
      }
    }
  }
  game.coins = plan.coinsAfter;
  economyState(currentPort, key).stock = plan.stockAfter;
  syncCargoCounts(game, goods);
  if (direction === "sell") updateMilestoneCompletion();
  document.getElementById("marketReceipt").textContent =
    `${direction === "buy" ? "Purchased" : "Sold"} ${quantity} ${goods[key].name} · ${plan.total} crowns · ${plan.holdAfter}/${game.holdMax} hold.`;
  marketSelection.quantity = 1;
  renderPortSystems();
  updateHud();
  saveGameState();
  document.getElementById("orderQuantity").focus();
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
