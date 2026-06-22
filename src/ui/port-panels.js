import {
  CARGO_COMPARTMENTS,
  cargoLotDescription,
  bestCargoCompartment,
  syncCargoCounts,
  normalizeCargoCompartments,
  moveCargoLot,
} from "../core/cargo.js";
import {
  warehouseAt,
  warehouseLeaseCost,
  leaseWarehouse,
  depositCargo,
  withdrawCargo,
} from "../core/warehouses.js";
import { cultivateOfficial } from "../core/jurisdictions.js";
import {
  factionPrivilege,
  routePlanEffects,
  estimateVoyageReadiness,
  ROUTE_PLANS,
  buyProvisions,
  repairOperations,
  repairShipComponent,
  SHIP_COMPONENTS,
  adjustedIntelCost,
} from "../core/operations.js";
import {
  crewVoyageModifiers,
  crewWeeklyWage,
  portRecruitmentPool,
  recruitCrew,
  CREW_ROLES,
  takeShoreLeave,
} from "../core/crew.js";
import {
  calculateShipIdentity,
  SHIP_CLASSES,
  SHIP_UPGRADES,
  UPGRADE_SLOTS,
  SHIP_IDENTITIES,
  buyOrSelectShipClass,
  buyOrEquipUpgrade,
} from "../core/upgrades.js";
import {
  regionalSummary,
  investmentCost,
  investInIndustry,
} from "../core/regional.js";
import { pathLength } from "../core/routes.js";
import { shipSpeedKnots } from "../core/sailing.js";
import {
  crisisAtPort,
  interveneInCrisis,
  interveneInCrisisWithCargo,
  cargoInterventionStatus,
} from "../core/crises.js";
import { intelEffectText } from "../core/intelligence.js";
import { voyageWarnings } from "../core/guidance.js";
import { clamp as clampNumber } from "../core/math.js";
import { RUMOR_COST } from "../core/rumors.js";
import { goods, productionChains } from "../world-data.js";
import { PORT_NAMES } from "../names.js";
import { activateSectionTabs } from "./tabs.js";

let panelContext;
let game,
  currentPort,
  eventTemplates,
  worldEvents,
  showMessage,
  addNews,
  saveGameState;
let resolveCrisisIntervention, describeCargoRequirements, activeEventsAt;
let currentLawText, canPassConvoyLaw, passConvoyLaw;
let ensureContractOffers, bestTradeOpportunity, buyRumorLead;
let renderPortSystems, updateHud;
let cargoCapacities, activeShipClass, cargoCount, operationalShipStats;
let routesFrom,
  orientRoute,
  applyShipUpgrades,
  advanceDays,
  currentVisibilityKm;
let ensureIntelOffers, buyIntel, showIntelReport;

export function configurePortPanels(context) {
  panelContext = context;
  syncPortPanelContext();
}

function syncPortPanelContext() {
  ({
    game,
    currentPort,
    eventTemplates,
    worldEvents,
    showMessage,
    addNews,
    saveGameState,
    resolveCrisisIntervention,
    describeCargoRequirements,
    activeEventsAt,
    currentLawText,
    canPassConvoyLaw,
    passConvoyLaw,
    ensureContractOffers,
    bestTradeOpportunity,
    buyRumorLead,
    renderPortSystems,
    updateHud,
    cargoCapacities,
    activeShipClass,
    cargoCount,
    operationalShipStats,
    routesFrom,
    orientRoute,
    applyShipUpgrades,
    advanceDays,
    currentVisibilityKm,
    ensureIntelOffers,
    buyIntel,
    showIntelReport,
  } = panelContext);
}

function signed(value) {
  return value > 0 ? "+" + value : String(value);
}
export function upgradeEffects(item) {
  const labels = {
    holdMax: "hold",
    maxSpeed: "top speed",
    accel: "acceleration",
    turnRate: "turning",
    visibilityHeightM: "lookout height",
    windDrift: "wind drift",
    inspectionRisk: "inspection risk",
    stormResistance: "storm resistance",
    crewComfort: "crew comfort",
    defense: "defense",
  };
  const effects = Object.entries(item.modifiers).map(
    ([key, value]) => signed(value) + " " + labels[key],
  );
  return effects.length ? effects.join(" · ") : "Balanced baseline";
}
function upgradeAffinities(item) {
  if (!item.affinities.length) return "No specialist alignment";
  return item.affinities.map((id) => SHIP_IDENTITIES[id].name).join(" · ");
}
function formatChainGoods(entries) {
  return Object.entries(entries)
    .map(([key, units]) => units + " " + goods[key].name)
    .join(" + ");
}
function localWarehouseStanding() {
  return Math.max(
    0,
    ...currentPort.factions.map(
      (faction) => game.factionStanding[faction.name] || 0,
    ),
  );
}

export function renderIntelOffice() {
  syncPortPanelContext();
  const root = document.getElementById("intelOffice");
  root.innerHTML = "";
  const offers = ensureIntelOffers(currentPort);
  if (!offers.length)
    root.innerHTML =
      '<p class="empty-note">Your informants have nothing new until their network refreshes.</p>';
  for (const offer of offers) {
    const localStanding = Math.max(
      0,
      ...currentPort.factions.map(
        (faction) => game.factionStanding[faction.name] || 0,
      ),
    );
    const cost = adjustedIntelCost(offer.cost, localStanding);
    const card = document.createElement("div");
    card.className = "intel-card";
    card.innerHTML =
      '<div class="intel-head"><h4>' +
      offer.title +
      '</h4><span class="contract-tag">' +
      cost +
      ' crowns</span></div><div class="intel-meta">Source confidence: ' +
      offer.confidence +
      "% · useful through Day " +
      offer.expiresDay +
      '</div><p class="small">The source will disclose the full report after payment.</p><div class="confidence"><span style="width:' +
      offer.confidence +
      '%"></span></div>';
    const b = document.createElement("button");
    b.className = "parchment";
    b.textContent = "Buy & Reveal Report";
    b.onclick = () => buyIntel(offer.id);
    card.append(b);
    root.append(card);
  }
  const purchased = game.intelligence.filter(
    (report) =>
      report.origin === currentPort.name && game.day <= report.expiresDay,
  );
  if (purchased.length) {
    const heading = document.createElement("h4");
    heading.className = "intel-purchased-heading";
    heading.textContent = "Purchased reports";
    root.append(heading);
    purchased.forEach((report) => {
      const card = document.createElement("div");
      card.className = "intel-card intel-known";
      card.innerHTML =
        '<div class="intel-head"><h4>' +
        report.title +
        '</h4><span class="contract-tag">Valid to Day ' +
        report.expiresDay +
        '</span></div><p class="small">' +
        report.body +
        '</p><div class="intel-result"><b>Active effect:</b> ' +
        intelEffectText(report) +
        "</div>";
      const b = document.createElement("button");
      b.className = "parchment";
      b.textContent = "View Full Report";
      b.onclick = () => showIntelReport(report);
      card.append(b);
      root.append(card);
    });
  }
}

export function renderPortEvent() {
  syncPortPanelContext();
  const root = document.getElementById("portEvent");
  root.innerHTML = "";
  const e = worldEvents.ironShortage;
  if (currentPort)
    for (const arc of crisisAtPort(
      game.regionalCrises,
      currentPort.name,
    ).reverse()) {
      const box = document.createElement("div");
      box.className =
        "event-banner " + (arc.phase === "active" ? "event-live" : "");
      const heading =
        arc.phase === "warning"
          ? "WARNING"
          : arc.phase === "active"
            ? `CRISIS · through Day ${arc.endDay}`
            : arc.outcome === "resolved"
              ? "RECOVERY"
              : "LASTING AFTERMATH";
      const body =
        arc.phase === "warning"
          ? arc.template.warning
          : arc.phase === "active"
            ? arc.template.active
            : arc.outcome === "resolved"
              ? arc.template.intervention.result
              : arc.template.ignored;
      box.innerHTML = `<b>${arc.template.title} · ${heading}</b>${body}`;
      if (arc.phase === "active") {
        const moneyAction = document.createElement("button");
        moneyAction.className = "parchment crisis-action";
        moneyAction.textContent = arc.template.intervention.label;
        moneyAction.disabled = game.coins < arc.template.intervention.cost;
        moneyAction.onclick = () => {
          const result = interveneInCrisis(
            game.regionalCrises,
            arc.id,
            game.coins,
            game.day,
          );
          if (!result.ok) return showMessage(result.reason);
          resolveCrisisIntervention(
            result,
            result.template.intervention.result,
            6,
          );
        };
        box.append(moneyAction);
        if (arc.template.cargoIntervention) {
          const status = cargoInterventionStatus(arc.template, game.cargoLots);
          const cargoAction = document.createElement("button");
          cargoAction.className = "parchment crisis-action";
          cargoAction.textContent = `${arc.template.cargoIntervention.label} · ${describeCargoRequirements(arc.template.cargoIntervention.requirements)}`;
          cargoAction.disabled = !status.ready;
          if (!status.ready)
            cargoAction.title = `Missing ${describeCargoRequirements(status.missing)}`;
          cargoAction.onclick = () => {
            const result = interveneInCrisisWithCargo(
              game.regionalCrises,
              arc.id,
              game.cargoLots,
              game.day,
            );
            if (!result.ok) return showMessage(result.reason);
            game.cargoLots = result.cargoLots;
            syncCargoCounts(game, goods);
            resolveCrisisIntervention(
              result,
              result.template.cargoIntervention.result,
              8,
            );
          };
          box.append(cargoAction);
        }
      }
      root.append(box);
    }
  if (currentPort)
    for (const event of activeEventsAt(currentPort.name)) {
      const t = eventTemplates[event.templateId],
        box = document.createElement("div");
      box.className = "event-banner event-live";
      box.innerHTML =
        "<b>" +
        t.title +
        " · through Day " +
        event.endDay +
        "</b>" +
        t.description;
      root.append(box);
    }
  if (e.active && currentPort && currentPort.name === e.port) {
    const box = document.createElement("div");
    box.className = "event-banner";
    box.innerHTML = "<b>" + e.title + "</b>" + e.description;
    root.append(box);
  } else if (
    game.laws.amberConvoy &&
    currentPort &&
    (currentPort.name === PORT_NAMES.orvessaQuay ||
      currentPort.name === PORT_NAMES.drazhOvek)
  ) {
    const box = document.createElement("div");
    box.className = "event-banner";
    box.innerHTML = `<b>Protected Amber Run</b>Crown escorts are moving iron between ${PORT_NAMES.drazhOvek} and ${PORT_NAMES.orvessaQuay} each day. Route risk and ${PORT_NAMES.orvessaQuay} prices have fallen.`;
    root.append(box);
  }
}

export function renderPolitics() {
  syncPortPanelContext();
  const standings = document.getElementById("portStanding");
  standings.innerHTML = "";
  currentPort.factions.forEach((f) => {
    const row = document.createElement("div");
    row.className = "standing-row";
    row.innerHTML =
      "<span>" +
      f.name +
      '<span class="small">' +
      factionPrivilege(game.factionStanding[f.name] || 0).label +
      " · " +
      factionPrivilege(game.factionStanding[f.name] || 0).privilege +
      "</span></span><b>" +
      (game.factionStanding[f.name] || 0) +
      "</b>";
    standings.append(row);
  });
  const law = document.getElementById("localLaw");
  law.innerHTML =
    '<div class="law-head"><b>Current law</b><span class="contract-tag">' +
    (currentPort.name === PORT_NAMES.orvessaQuay
      ? game.laws.amberConvoy
        ? "Chartered"
        : "Unprotected"
      : "Local") +
    '</span></div><div class="law-effect">' +
    currentLawText(currentPort) +
    "</div>";
  const button = document.getElementById("politicsAction");
  if (currentPort.name === PORT_NAMES.orvessaQuay && !game.laws.amberConvoy) {
    button.style.display = "block";
    button.textContent = "Charter the Royal Amber Convoy · 20 influence";
    button.disabled = !canPassConvoyLaw();
    button.onclick = passConvoyLaw;
  } else {
    button.style.display = "none";
    button.onclick = null;
  }
}

export function renderPortOpportunities() {
  syncPortPanelContext();
  const root = document.getElementById("portOpportunities");
  const offers = ensureContractOffers(currentPort);
  const opportunity = bestTradeOpportunity();
  const damaged = Math.round(game.operations.condition) < 100;
  const rows = [
    {
      title: `${offers.length} contract${offers.length === 1 ? "" : "s"} available`,
      detail: "Open Trade to review pay, deadlines, and faction consequences.",
      tab: "trade",
    },
    {
      title:
        opportunity.buy === currentPort.name
          ? `Buy ${goods[opportunity.key].name} for a known trade`
          : opportunity.sell === currentPort.name
            ? `${goods[opportunity.key].name} is in demand here`
            : "Review today’s market",
      detail:
        opportunity.buy === currentPort.name
          ? `Known destination: ${opportunity.sell}, about ${opportunity.margin} crowns margin per unit.`
          : opportunity.sell === currentPort.name
            ? `Best known source: ${opportunity.buy}, about ${opportunity.margin} crowns margin per unit.`
            : "Buy local surpluses and compare known prices before sailing.",
      tab: "market",
    },
    {
      title: "Buy a rumor lead",
      detail: `${RUMOR_COST} crowns for a broad chart circle pointing to a hidden discovery or expedition site.`,
      action: buyRumorLead,
    },
    {
      title: damaged
        ? "Your vessel needs attention"
        : "Prepare the next voyage",
      detail: damaged
        ? `${Math.round(game.operations.condition)}% condition. Repair damaged systems before a long route.`
        : `${game.operations.provisions}/30 provisions aboard; inspect route estimates before casting off.`,
      tab: "vessel",
    },
  ];
  root.innerHTML = "";
  for (const row of rows) {
    const item = document.createElement("div");
    item.className = "port-opportunity";
    item.innerHTML = `<div><b>${row.title}</b><span class="small">${row.detail}</span></div>`;
    const button = document.createElement("button");
    button.className = "parchment";
    button.textContent = row.action ? "Buy" : "Open";
    button.onclick = row.action
      ? row.action
      : () =>
          activateSectionTabs(document.getElementById("portPanel"), row.tab);
    item.append(button);
    root.append(item);
  }
}

export function renderCustomsOffice() {
  syncPortPanelContext();
  const root = document.getElementById("customsOffice");
  root.innerHTML = "";
  const inspection = game.legal.lastInspection;
  const summary = document.createElement("div");
  summary.className = "politics-box";
  summary.innerHTML =
    `<div class="law-head"><b>${currentPort.realm} jurisdiction</b><span class="contract-tag">${game.legal.offenses[currentPort.name] || 0} offenses</span></div>` +
    `<div class="law-effect">${inspection?.portName === currentPort.name ? `Last arrival: ${inspection.inspected ? "inspected" : "cleared"} at ${Math.round(inspection.scrutiny * 100)}% scrutiny${inspection.fine ? ` · ${inspection.fine} crowns assessed` : ""}.` : "No recent customs record at this port."}</div>`;
  root.append(summary);
  const actions = document.createElement("div");
  actions.className = "customs-actions";
  const forgery = document.createElement("button");
  forgery.className = "parchment";
  forgery.textContent = game.legal.forgedManifest
    ? "Forged manifest prepared"
    : "Forge next manifest · 18 crowns";
  forgery.disabled = game.legal.forgedManifest || game.coins < 18;
  forgery.onclick = () => {
    game.coins -= 18;
    game.legal.forgedManifest = true;
    renderPortSystems();
    updateHud();
  };
  const remote = document.createElement("button");
  remote.className = "parchment";
  remote.textContent = game.legal.remoteAnchorage
    ? "Remote landing arranged"
    : "Arrange remote landing · 12 crowns";
  remote.disabled = game.legal.remoteAnchorage || game.coins < 12;
  remote.onclick = () => {
    game.coins -= 12;
    game.legal.remoteAnchorage = true;
    renderPortSystems();
    updateHud();
  };
  const cultivate = document.createElement("button");
  cultivate.className = "parchment";
  cultivate.textContent = game.legal.cultivatedOfficials[currentPort.name]
    ? "Customs contact cultivated"
    : "Cultivate an official · 55 crowns";
  cultivate.disabled =
    game.legal.cultivatedOfficials[currentPort.name] || game.coins < 55;
  cultivate.onclick = () => {
    const result = cultivateOfficial(game.legal, currentPort.name, game.coins);
    if (!result.ok) return showMessage(result.reason);
    game.coins = result.coins;
    renderPortSystems();
    updateHud();
  };
  actions.append(forgery, remote, cultivate);
  root.append(actions);
}

export function renderCargoPlan() {
  syncPortPanelContext();
  const root = document.getElementById("cargoPlan");
  root.innerHTML = "";
  const capacities = cargoCapacities();
  normalizeCargoCompartments(game.cargoLots, capacities);
  for (const [key, compartment] of Object.entries(CARGO_COMPARTMENTS)) {
    const lots = game.cargoLots.filter((lot) => lot.compartment === key);
    const section = document.createElement("section");
    section.className = "cargo-compartment";
    section.innerHTML =
      `<div class="cargo-compartment-head"><b>${compartment.label}</b><span>${lots.length}/${capacities[key]}</span></div>` +
      `<p class="small">${compartment.description}</p>`;
    if (!capacities[key]) section.classList.add("locked");
    if (!lots.length) {
      const empty = document.createElement("div");
      empty.className = "empty-note";
      empty.textContent = capacities[key]
        ? "Empty"
        : key === "concealed"
          ? "Fit smuggler’s lockers to unlock."
          : "No space available.";
      section.append(empty);
    }
    for (const lot of lots) {
      const row = document.createElement("div");
      row.className = "cargo-lot-row";
      const details = document.createElement("span");
      details.innerHTML = `<b>${goods[lot.key].name}</b><span class="small">${cargoLotDescription(lot)}</span>`;
      const select = document.createElement("select");
      select.setAttribute("aria-label", `Move ${goods[lot.key].name}`);
      for (const [destination, data] of Object.entries(CARGO_COMPARTMENTS)) {
        const option = document.createElement("option");
        option.value = destination;
        option.textContent = data.label;
        option.selected = destination === key;
        option.disabled =
          destination !== key &&
          game.cargoLots.filter((item) => item.compartment === destination)
            .length >= capacities[destination];
        select.append(option);
      }
      select.onchange = () => {
        const result = moveCargoLot(
          game.cargoLots,
          lot.id,
          select.value,
          capacities,
        );
        if (!result.ok) showMessage(result.reason);
        renderCargoPlan();
      };
      row.append(details, select);
      section.append(row);
    }
    root.append(section);
  }
}

export function renderWarehouse() {
  syncPortPanelContext();
  const root = document.getElementById("warehouse");
  root.innerHTML = "";
  const warehouse = warehouseAt(game.warehouses, currentPort.name);
  if (!warehouse?.leased) {
    const standing = localWarehouseStanding();
    const cost = warehouseLeaseCost(standing);
    const note = document.createElement("p");
    note.className = "empty-note";
    note.textContent =
      standing >= 10
        ? "Trusted local factors offer you a reduced permanent lease."
        : "A permanent lease stores up to 24 cargo lots at this port.";
    const lease = document.createElement("button");
    lease.className = "parchment";
    lease.textContent = `Lease warehouse · ${cost} crowns`;
    lease.disabled = game.coins < cost;
    lease.onclick = () => {
      const result = leaseWarehouse(
        game.warehouses,
        currentPort.name,
        game.coins,
        localWarehouseStanding(),
      );
      if (!result.ok) return showMessage(result.reason);
      game.coins = result.coins;
      addNews(
        `Warehouse leased at ${currentPort.name}`,
        `${result.cost} crowns secured permanent storage for 24 cargo lots.`,
      );
      renderPortSystems();
      updateHud();
    };
    root.append(note, lease);
    return;
  }

  const summary = document.createElement("div");
  summary.className = "warehouse-summary";
  summary.innerHTML = `<b>${warehouse.lots.length}/${warehouse.capacity} lots stored</b><span>Permanent local inventory · sheltered aging</span>`;
  root.append(summary);

  const grid = document.createElement("div");
  grid.className = "warehouse-grid";
  const aboard = document.createElement("section");
  const stored = document.createElement("section");
  aboard.className = "warehouse-column";
  stored.className = "warehouse-column";
  aboard.innerHTML = `<h4>Aboard ${activeShipClass().vesselName}</h4>`;
  stored.innerHTML = `<h4>${currentPort.name} warehouse</h4>`;

  if (!game.cargoLots.length)
    aboard.insertAdjacentHTML(
      "beforeend",
      '<p class="empty-note">No trade cargo aboard.</p>',
    );
  for (const lot of game.cargoLots) {
    const row = document.createElement("div");
    row.className = "warehouse-lot-row";
    const details = document.createElement("span");
    details.innerHTML = `<b>${goods[lot.key].name}</b><small>${cargoLotDescription(lot)}</small>`;
    const button = document.createElement("button");
    button.textContent = "Store";
    button.disabled = warehouse.lots.length >= warehouse.capacity;
    button.onclick = () => {
      const result = depositCargo(
        game.warehouses,
        currentPort.name,
        game.cargoLots,
        lot.id,
      );
      if (!result.ok) return showMessage(result.reason);
      syncCargoCounts(game, goods);
      renderPortSystems();
      updateHud();
    };
    row.append(details, button);
    aboard.append(row);
  }

  if (!warehouse.lots.length)
    stored.insertAdjacentHTML(
      "beforeend",
      '<p class="empty-note">The warehouse is empty.</p>',
    );
  for (const lot of warehouse.lots) {
    const row = document.createElement("div");
    row.className = "warehouse-lot-row";
    const details = document.createElement("span");
    details.innerHTML = `<b>${goods[lot.key].name}</b><small>${cargoLotDescription(lot)}</small>`;
    const button = document.createElement("button");
    button.textContent = "Load";
    button.disabled = cargoCount() >= game.holdMax;
    button.onclick = () => {
      const result = withdrawCargo(
        game.warehouses,
        currentPort.name,
        game.cargoLots,
        lot.id,
        game.holdMax - cargoCount(),
      );
      if (!result.ok) return showMessage(result.reason);
      result.lot.compartment = bestCargoCompartment(
        result.lot,
        cargoCapacities(),
        game.cargoLots.filter((item) => item.id !== result.lot.id),
      );
      syncCargoCounts(game, goods);
      renderPortSystems();
      updateHud();
    };
    row.append(details, button);
    stored.append(row);
  }
  grid.append(aboard, stored);
  root.append(grid);
}

export function renderReadiness() {
  syncPortPanelContext();
  const root = document.getElementById("voyageReadiness");
  const ops = game.operations;
  const stats = operationalShipStats();
  const crewModifiers = crewVoyageModifiers(ops.crew);
  const routePlan = routePlanEffects(ops.routePlan);
  const readinessStats = {
    ...stats,
    routePlan: routePlan.id,
    stormResistance: stats.stormResistance * crewModifiers.stormResistance,
    crewProvisionMultiplier: crewModifiers.provisionMultiplier,
  };
  const nearbyRoutes = routesFrom(currentPort.name);
  const estimates = nearbyRoutes.map((route) => {
    const destination = route.a === currentPort.name ? route.b : route.a;
    const distance = pathLength(
      orientRoute(route, currentPort.name, destination),
    );
    const estimate = estimateVoyageReadiness(
      distance,
      readinessStats,
      routePlan.id,
    );
    return {
      destination,
      ...estimate,
      arrivalDay: game.day + estimate.days,
    };
  });
  root.innerHTML =
    `<div class="ship-stats">Plan: ${routePlan.label} · ${ops.provisions}/30 provisions · ${Math.round(ops.condition)}% overall condition · ${Math.round(ops.morale)} morale · ${Math.round(ops.crew.mutinyPressure)}% mutiny pressure · ${crewWeeklyWage(ops.crew)} crowns/week</div>` +
    `<div class="crew-grid">${Object.entries(ops.crew.groups)
      .map(
        ([role, group]) =>
          `<article class="crew-card"><header><b>${CREW_ROLES[role].label}</b><strong>${group.count}</strong></header><span>${Math.round(group.experience)} exp · ${Math.round(group.fatigue)} fatigue</span><span>${group.injuries} injured · ${Math.round(group.loyalty)} loyalty</span></article>`,
      )
      .join("")}</div>` +
    `<div class="component-grid">${Object.entries(SHIP_COMPONENTS)
      .map(
        ([key, component]) =>
          `<div class="component-condition ${ops.components[key] < 40 ? "critical" : ""}"><span>${component.label}</span><b>${Math.round(ops.components[key])}%</b></div>`,
      )
      .join("")}</div>` +
    estimates
      .slice(0, 3)
      .map((estimate) => {
        const warnings = voyageWarnings(ops, estimate);
        return `<div class="standing-row"><span><b>${estimate.destination}</b><span class="small">${estimate.days}d · arrive Day ${estimate.arrivalDay} · ${estimate.provisionsNeeded} provisions · ~${estimate.conditionRisk}% wear</span>${warnings.length ? warnings.map((warning) => `<span class="readiness-warning">⚠ ${warning}</span>`).join("") : '<span class="readiness-ready">✓ Ready to sail</span>'}</span></div>`;
      })
      .join("");
  const planner = document.createElement("div");
  planner.className = "route-plan-grid";
  for (const plan of Object.values(ROUTE_PLANS)) {
    const button = document.createElement("button");
    button.className =
      "route-plan" + (plan.id === routePlan.id ? " selected" : "");
    button.type = "button";
    button.innerHTML =
      `<b>${plan.label}</b><span>${plan.description}</span>` +
      `<small>${Math.round(plan.daysMultiplier * 100)}% days · ${Math.round(plan.provisionMultiplier * 100)}% stores · ${Math.round(plan.damageMultiplier * plan.roughnessMultiplier * 100)}% wear · ${Math.round(plan.hostileRiskMultiplier * 100)}% raider risk</small>`;
    button.onclick = () => {
      game.operations.routePlan = plan.id;
      showMessage(`${plan.label} set for the next passage.`);
      renderReadiness();
      saveGameState();
    };
    planner.append(button);
  }
  root.append(planner);

  const actions = document.createElement("div");
  actions.className = "town-actions";
  const provision = document.createElement("button");
  provision.className = "parchment";
  provision.textContent = "Buy provisions · 3 each";
  provision.disabled = game.coins < 3 || ops.provisions >= 30;
  provision.onclick = () => {
    const result = buyProvisions(game.operations, game.coins);
    game.operations = result.operations;
    game.coins = result.coins;
    showMessage(`Loaded ${result.purchased} provisions.`);
    renderPortSystems();
    updateHud();
  };
  const repairAll = document.createElement("button");
  repairAll.className = "parchment";
  repairAll.textContent = "Repair weakest systems · 2 per point";
  repairAll.disabled = game.coins < 2 || ops.condition >= 100;
  repairAll.onclick = () => {
    const result = repairOperations(game.operations, game.coins);
    game.operations = result.operations;
    game.coins = result.coins;
    applyShipUpgrades();
    showMessage(
      `Repaired ${result.repaired} component point${result.repaired === 1 ? "" : "s"}.`,
    );
    renderPortSystems();
    updateHud();
  };
  actions.append(provision, repairAll);
  const leave = document.createElement("button");
  leave.className = "parchment";
  leave.textContent = "Grant shore leave";
  leave.onclick = () => {
    const result = takeShoreLeave(game.operations.crew, game.coins);
    if (!result.ok) return showMessage(result.reason);
    game.operations.crew = result.crew;
    game.coins = result.coins;
    game.operations.morale = clampNumber(game.operations.morale + 8, 0, 100);
    advanceDays(result.days);
    showMessage(`Shore leave restored the crew · ${result.cost} crowns.`);
    renderPortSystems();
    updateHud();
  };
  actions.append(leave);
  root.append(actions);
  const recruiting = document.createElement("div");
  recruiting.className = "crew-recruiting";
  for (const offer of portRecruitmentPool(
    currentPort.name,
    currentPort.population,
  )) {
    const button = document.createElement("button");
    button.className = "parchment";
    button.textContent = `Recruit ${CREW_ROLES[offer.role].label} · ${offer.cost}`;
    button.title = `${offer.available} available · ${offer.experience} experience`;
    button.disabled = game.coins < offer.cost || offer.available <= 0;
    button.onclick = () => {
      const result = recruitCrew(game.operations.crew, offer, game.coins);
      if (!result.ok) return showMessage(result.reason);
      game.operations.crew = result.crew;
      game.coins = result.coins;
      offer.available -= 1;
      showMessage(
        `Recruited one ${CREW_ROLES[offer.role].label.toLowerCase()}.`,
      );
      renderPortSystems();
      updateHud();
    };
    recruiting.append(button);
  }
  root.append(recruiting);
  const componentActions = document.createElement("div");
  componentActions.className = "component-repairs";
  for (const [key, component] of Object.entries(SHIP_COMPONENTS)) {
    const button = document.createElement("button");
    button.className = "parchment";
    button.textContent = `Repair ${component.label}`;
    button.disabled =
      game.coins < component.repairCost || ops.components[key] >= 100;
    button.onclick = () => {
      const result = repairShipComponent(game.operations, game.coins, key);
      game.operations = result.operations;
      game.coins = result.coins;
      applyShipUpgrades();
      showMessage(
        `Repaired ${component.label.toLowerCase()} by ${result.repaired} point${result.repaired === 1 ? "" : "s"}.`,
      );
      renderPortSystems();
      updateHud();
    };
    componentActions.append(button);
  }
  root.append(componentActions);
}

export function renderProductionChains() {
  syncPortPanelContext();
  const root = document.getElementById("productionChains");
  root.innerHTML = "";
  const regional = game.regionalEconomy[currentPort.name];
  const summary = regionalSummary(regional);
  const overview = document.createElement("div");
  overview.className = "ship-stats";
  overview.textContent = `${summary.infrastructure} infrastructure · ${summary.population.toLocaleString()} people · ${summary.laborPercent}% labor · ${summary.resourcePercent}% resources · ${summary.unrest}% unrest · ${summary.dockingFee} crown docking fee`;
  root.append(overview);
  const reports = Object.fromEntries(
    (game.productionReports[currentPort.name] || []).map((report) => [
      report.id,
      report,
    ]),
  );
  for (const chain of productionChains) {
    const efficiency = currentPort.industries[chain.id];
    const report = reports[chain.id];
    const industry = regional.industries[chain.id];
    const card = document.createElement("div");
    card.className = "production-chain";
    const status = industry.collapsed
      ? "COLLAPSED"
      : report
        ? report.utilization < 0.5
          ? "Input-starved"
          : "Operating"
        : "Awaiting daily cycle";
    const recipe =
      report?.recipeId === "standard"
        ? "standard recipe"
        : chain.alternatives?.find(
            (alternative) => alternative.id === report?.recipeId,
          )?.label || "standard recipe";
    card.innerHTML =
      "<div><b>" +
      chain.name +
      '</b><span class="small">' +
      formatChainGoods(chain.inputs) +
      " → " +
      formatChainGoods(chain.outputs) +
      `</span><span class="small">${recipe} · quality ${Math.round((report?.quality || 1) * 100)}%${report?.fuelLimited ? " · fuel-starved" : ""}</span></div><span class="contract-tag">` +
      status +
      " · " +
      Math.round(efficiency * 100) +
      `%</span>${industry.magnate ? `<span class="small magnate">Local power: ${industry.magnate}, ${industry.investment >= 2 ? "rival magnate" : "rising proprietor"}</span>` : ""}`;
    const invest = document.createElement("button");
    const cost = investmentCost(industry);
    invest.className = "parchment";
    invest.textContent = industry.collapsed
      ? `Restore industry · ${cost}`
      : industry.investment >= 3
        ? "Fully developed"
        : `Invest ${cost} · level ${industry.investment}/3`;
    invest.disabled =
      (industry.investment >= 3 && !industry.collapsed) || game.coins < cost;
    invest.onclick = () => {
      const result = investInIndustry(
        regional,
        chain.id,
        game.coins,
        currentPort.name,
      );
      if (!result.ok) return showMessage(result.reason);
      game.coins = result.coins;
      addNews(
        `Investment in ${chain.name}`,
        result.restored
          ? `Your capital reopened ${currentPort.name}'s ruined ${chain.name.toLowerCase()} under ${result.magnate}.`
          : `Your capital raised ${currentPort.name}'s ${chain.name.toLowerCase()} industry to level ${result.level}, creating a new local power in ${result.magnate}.`,
      );
      showMessage(
        `${chain.name} expanded to investment level ${result.level}.`,
      );
      renderPortSystems();
      updateHud();
    };
    card.append(invest);
    root.append(card);
  }
}

export function renderShipyard() {
  syncPortPanelContext();
  const root = document.getElementById("shipyard");
  root.innerHTML = "";
  const stats = applyShipUpgrades();
  const identity = calculateShipIdentity(game.shipUpgrades);
  const activeClass = SHIP_CLASSES[game.shipUpgrades.activeClass];
  const shipStats = document.getElementById("shipStats");
  shipStats.innerHTML =
    "<strong>" +
    activeClass.vesselName +
    " · " +
    activeClass.name +
    "</strong><span>" +
    activeClass.description +
    "</span><span>Fitting identity: <b>" +
    identity.name +
    "</b> · " +
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
    stats.defense +
    "</span>";
  const classSection = document.createElement("div");
  classSection.className = "ship-class-section";
  classSection.innerHTML =
    '<h4>Vessels</h4><p class="small">Purchase ships once, then change vessels freely while docked. Fittings transfer between your owned ships.</p>';
  const classGrid = document.createElement("div");
  classGrid.className = "ship-class-grid";
  for (const item of Object.values(SHIP_CLASSES)) {
    const active = game.shipUpgrades.activeClass === item.id;
    const owned = game.shipUpgrades.ownedClasses.includes(item.id);
    const row = document.createElement("div");
    row.className = "ship-class-option" + (active ? " active" : "");
    const details = document.createElement("div");
    details.innerHTML =
      `<b>${item.name}</b><span class="ship-name">${item.vesselName}</span>` +
      `<span class="small">${item.description}</span>` +
      `<span class="upgrade-effects">${upgradeEffects(item)}</span>`;
    const button = document.createElement("button");
    button.textContent = active
      ? "Active"
      : owned
        ? "Select"
        : `Buy ${item.cost}`;
    button.disabled = active || (!owned && game.coins < item.cost);
    button.onclick = () => {
      const result = buyOrSelectShipClass(game, item.id, cargoCount());
      if (!result.ok) return showMessage(result.reason);
      applyShipUpgrades();
      normalizeCargoCompartments(game.cargoLots, cargoCapacities());
      showMessage(
        result.purchased
          ? `Purchased ${item.vesselName}, a ${item.name.toLowerCase()}.`
          : `${item.vesselName} is now your active vessel.`,
      );
      renderPortSystems();
      updateHud();
    };
    row.append(details, button);
    classGrid.append(row);
  }
  classSection.append(classGrid);
  root.append(classSection);
  for (const slot of UPGRADE_SLOTS) {
    const section = document.createElement("div");
    section.className = "upgrade-slot";
    section.innerHTML = "<h4>" + slot.name + "</h4>";
    for (const item of SHIP_UPGRADES[slot.id]) {
      const equipped = game.shipUpgrades.equipped[slot.id] === item.id;
      const owned = game.shipUpgrades.owned.includes(item.id);
      const row = document.createElement("div");
      row.className = "upgrade-option" + (equipped ? " equipped" : "");
      const details = document.createElement("div");
      details.innerHTML =
        "<b>" +
        item.name +
        '</b><span class="small">' +
        item.description +
        '</span><span class="upgrade-effects">' +
        upgradeEffects(item) +
        '</span><span class="upgrade-affinities">Identity: ' +
        upgradeAffinities(item) +
        "</span>";
      const button = document.createElement("button");
      button.textContent = equipped
        ? "Fitted"
        : owned
          ? "Equip"
          : "Buy " + item.cost;
      button.disabled = equipped || (!owned && game.coins < item.cost);
      button.onclick = () => {
        const result = buyOrEquipUpgrade(game, slot.id, item.id, cargoCount());
        if (!result.ok) return showMessage(result.reason);
        applyShipUpgrades();
        normalizeCargoCompartments(game.cargoLots, cargoCapacities());
        showMessage(
          (result.purchased ? "Purchased and fitted " : "Fitted ") +
            item.name +
            ".",
        );
        renderPortSystems();
        updateHud();
      };
      row.append(details, button);
      section.append(row);
    }
    root.append(section);
  }
}
