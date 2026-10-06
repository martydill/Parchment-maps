import { illustrationMarkup, menuGlyph, heraldry } from "./port-art.js?v=4";
// Presentation state belongs to the port visit, never to the persisted voyage.
const collections = new Map();
const activities = new Map();
const readers = new Set();
const readingObserver = new ResizeObserver(() => refreshReaders());
let visit = null;
let cityTopic = "brief";

const byId = (id) => document.getElementById(id);
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const button = (label, action) => {
  const node = element("button", "", label);
  node.type = "button";
  node.onclick = action;
  return node;
};

export function activatePortActivity(section, name) {
  if (!section) return;
  const tabs = [...section.querySelectorAll(".activity-tab")];
  if (!tabs.some((tab) => tab.dataset.activity === name))
    name = tabs[0]?.dataset.activity;
  activities.set(section.dataset.tab, name);
  tabs.forEach((tab) => {
    const selected = tab.dataset.activity === name;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    tab.id = `activity-${section.dataset.tab}-${tab.dataset.activity}`;
    tab.setAttribute("aria-controls", `workspace-${tab.dataset.activity}`);
  });
  section.querySelectorAll(".port-activity").forEach((pane) => {
    pane.hidden = pane.dataset.activity !== name;
    pane.id = `workspace-${pane.dataset.activity}`;
    pane.setAttribute(
      "aria-labelledby",
      `activity-${section.dataset.tab}-${pane.dataset.activity}`,
    );
  });
  requestAnimationFrame(refreshReaders);
}

export function openPortWorkspace(tab, target) {
  const names = {
    vesselInspection: "systems",
    cargoPlan: "cargo",
    crewWorkspace: "crew",
    warehouse: "warehouse",
    voyageReadiness: "passage",
    market: "goods",
    productionChains: "workshops",
    contractBoard: "contracts",
    intelOffice: "rumors",
    shipyard: "vessels",
    localLaw: "factions",
    milestonePort: "milestone",
    portEvent: "events",
  };
  const section = document.querySelector(
    `#portPanel .port-panel[data-tab="${tab}"]`,
  );
  activatePortActivity(section, names[target] || activities.get(tab));
  section
    ?.querySelector('.activity-tab[aria-selected="true"]')
    ?.focus({ preventScroll: true });
}

function refreshReaders() {
  for (const reader of readers) {
    if (!reader.root.isConnected) {
      readingObserver.unobserve(reader.body);
      readers.delete(reader);
    } else if (reader.body.clientHeight > 0) reader.layout();
  }
}

// Read complete text in measured pages. Actions stay outside the reading area.
export function readingPages(root, blocks) {
  root.replaceChildren();
  root.classList.add("reading-pages");
  const body = element("div", "reading-body");
  const pager = element("nav", "reading-pager");
  pager.setAttribute("aria-label", "Reading pages");
  const previous = button("←", () => show(page - 1));
  previous.setAttribute("aria-label", "Previous reading page");
  const next = button("→", () => show(page + 1));
  next.setAttribute("aria-label", "Next reading page");
  const label = element("span");
  pager.append(previous, label, next);
  root.append(body, pager);
  const nodes = blocks.flatMap((block) => {
    if (typeof block !== "string") return [block];
    const words = block.trim().split(/\s+/);
    const chunks = [];
    for (let i = 0; i < words.length; i += 35)
      chunks.push(element("p", "", words.slice(i, i + 35).join(" ")));
    return chunks;
  });
  let pages = [nodes];
  let page = 0;
  let dimensions = "";
  function show(index) {
    page = Math.max(0, Math.min(pages.length - 1, index));
    body.replaceChildren(...pages[page]);
    label.textContent = `${page + 1} / ${pages.length}`;
    previous.disabled = page === 0;
    next.disabled = page === pages.length - 1;
  }
  const reader = {
    root,
    body,
    layout() {
      const size = `${body.clientWidth}:${body.clientHeight}`;
      if (size === dimensions || !body.clientHeight) return;
      dimensions = size;
      pages = [];
      let current = [];
      body.replaceChildren();
      for (const node of nodes) {
        body.append(node);
        if (body.scrollHeight > body.clientHeight + 1 && current.length) {
          pages.push(current);
          current = [];
          body.replaceChildren(node);
        }
        if (body.scrollHeight > body.clientHeight + 1 && node.matches?.("p")) {
          const words = node.textContent.split(/\s+/);
          let start = 0;
          while (start < words.length) {
            let low = 1;
            let high = words.length - start;
            const fragment = element("p");
            body.replaceChildren(fragment);
            while (low < high) {
              const count = Math.ceil((low + high) / 2);
              fragment.textContent = words
                .slice(start, start + count)
                .join(" ");
              if (body.scrollHeight <= body.clientHeight + 1) low = count;
              else high = count - 1;
            }
            fragment.textContent = words.slice(start, start + low).join(" ");
            start += low;
            if (start < words.length) pages.push([fragment]);
            else current = [fragment];
          }
        } else current.push(node);
      }
      pages.push(current);
      show(page);
    },
  };
  readers.add(reader);
  readingObserver.observe(body);
  show(0);
  requestAnimationFrame(refreshReaders);
}

function cardText(card, heading) {
  const blocks = [];
  function walk(node) {
    if (
      node === heading ||
      (node.nodeType === 1 &&
        node.matches("button,select,svg,.confidence,.ship-name"))
    )
      return;
    if (node.nodeType === 3) {
      if (node.textContent.trim()) blocks.push(node.textContent.trim());
    } else if (!node.children.length) {
      if (node.textContent.trim()) blocks.push(node.textContent.trim());
    } else {
      [...node.childNodes].forEach(walk);
    }
  }
  [...card.childNodes].forEach(walk);
  return blocks;
}

function vesselMetrics(art) {
  const metrics = element("div", "vessel-metrics");
  metrics.append(
    element("span", "", `${art.hold} hold`),
    element("span", "", `${art.speed} kn`),
  );
  return metrics;
}

function cardDetail(root, card, name, art) {
  root.replaceChildren();
  const heading = card.querySelector("h4,h3,b");
  root.append(
    element(
      "div",
      "town-kicker",
      {
        vessel: "Shipwright’s catalogue",
        crew: "Crew complement",
        goods: "Cargo manifest",
        guild: "Sealed commission",
        rumors: "Whisper network",
        workshops: "Local industry",
      }[art.kind] || "Captain’s register",
    ),
    element("h3", "", name),
  );
  root.dataset.artKind = art.kind;
  const vesselName =
    art.kind === "vessel" && card.querySelector(".ship-name")?.textContent;
  if (vesselName) root.append(element("div", "vessel-caption", vesselName));
  const visual = element("div", "detail-illustration");
  visual.innerHTML = illustrationMarkup(art.kind, art.key);
  root.append(visual);
  if (art.kind === "vessel") {
    const metrics = vesselMetrics(art);
    metrics.title = root.closest("#fleetCatalog")
      ? "Commissioned with standard fittings"
      : "Capacity and speed with your current fittings";
    root.append(metrics);
  }
  const blocks = cardText(card, heading);
  const recipe = [...card.querySelectorAll(".production-good")];
  if (recipe.length) blocks.unshift(...recipe);
  const text = element("div", "workspace-reading");
  readingPages(
    text,
    blocks.length ? blocks : ["Select an action below to continue."],
  );
  root.append(text);
  const actions = element("div", "workspace-actions");
  card
    .querySelectorAll("button:not(.production-good),select")
    .forEach((control) => actions.append(control));
  root.append(actions);
  // Retain the remaining card so switching selections can rebuild its text.
  const cache = element("div");
  cache.hidden = true;
  cache.append(card);
  root.append(cache);
  // Keep moved controls with their source card when this detail is replaced.
  root._restoreCard = () => {
    card.append(...recipe, ...actions.children);
  };
}

export function pagedCollection(
  root,
  cards,
  {
    key = root.id,
    toolbar = null,
    empty = "No entries here yet.",
    names = null,
    metadata = null,
    pageSize = 6,
  } = {},
) {
  const state = collections.get(key) || { page: 0, selected: null };
  collections.set(key, state);
  const records = cards.map((card, i) => ({
    card,
    art: {
      kind:
        card.dataset.artKind ||
        {
          contractBoard: "guild",
          intelOffice: "rumors",
          milestonePort: "milestone",
          portEvent: "guild",
        }[root.id] ||
        "cargo",
      key: card.dataset.artKey,
      hold: card.dataset.hold,
      speed: card.dataset.speed,
      availability: card.dataset.availability,
    },
    name:
      names?.[i] ||
      card.querySelector("h4,h3,b")?.textContent ||
      `Entry ${i + 1}`,
    id:
      card.dataset.entry ||
      `${names?.[i] || card.querySelector("h4,h3,b")?.textContent}:${i}`,
    meta:
      (card.dataset.artKind === "vessel"
        ? card.querySelector(".ship-name")?.textContent ||
          "Autonomous merchant vessel"
        : null) ||
      metadata?.[i] ||
      card.querySelector(
        ".small,small,.intel-meta,.contract-meta,.upgrade-effects",
      )?.textContent ||
      "View details and available actions",
  }));
  const selectedIndex = records.findIndex(
    (record) => record.id === state.selected,
  );
  if (selectedIndex >= 0) state.page = Math.floor(selectedIndex / pageSize);
  state.page = Math.max(
    0,
    Math.min(Math.ceil(records.length / pageSize) - 1, state.page),
  );
  if (selectedIndex < 0) state.selected = records[state.page * pageSize]?.id;
  root.querySelector(".collection-detail")?._restoreCard?.();
  root.replaceChildren();
  root.classList.add("collection-layout");
  const catalog = element("div", "workspace-catalog");
  if (toolbar) catalog.append(toolbar);
  const list = element("div", "collection-rows");
  const pager = element("nav", "collection-pager");
  pager.setAttribute("aria-label", "Collection pages");
  const detail = element("section", "collection-detail");
  detail.setAttribute("aria-label", "Selected entry details");
  const count = element("span", "", `${records.length} entries`);
  const controls = element("div");
  const previous = button("←", () => changePage(-1));
  previous.setAttribute("aria-label", "Previous collection page");
  const next = button("→", () => changePage(1));
  next.setAttribute("aria-label", "Next collection page");
  const label = element("span");
  controls.append(previous, label, next);
  pager.append(count, controls);
  catalog.append(list, pager);
  root.append(catalog, detail);
  function show() {
    detail._restoreCard?.();
    detail._restoreCard = null;
    list.replaceChildren();
    const slice = records.slice(
      state.page * pageSize,
      (state.page + 1) * pageSize,
    );
    for (const record of slice) {
      const row = button("", () => {
        state.selected = record.id;
        show();
        list
          .querySelector('[aria-pressed="true"]')
          ?.focus({ preventScroll: true });
      });
      row.className = "collection-row";
      row.setAttribute("aria-pressed", String(state.selected === record.id));
      const visual = element("span", "row-illustration");
      visual.innerHTML = illustrationMarkup(record.art.kind, record.art.key);
      row.dataset.artKind = record.art.kind;
      row.append(
        visual,
        element("b", "", record.name),
        element(
          "small",
          "",
          record.meta.length > 80
            ? record.meta.slice(0, 77).replace(/\s+\S*$/, "") + "…"
            : record.meta,
        ),
      );
      if (record.art.kind === "vessel") {
        row.append(vesselMetrics(record.art));
        row.append(
          element("span", "vessel-availability", record.art.availability),
        );
      }
      if (record.card.classList.contains("crew-card"))
        row.append(
          element(
            "strong",
            "crew-count",
            record.card.querySelector("header strong").textContent,
          ),
        );
      list.append(row);
    }
    label.textContent = `${state.page + 1} / ${Math.max(1, Math.ceil(records.length / pageSize))}`;
    previous.disabled = state.page === 0;
    next.disabled = (state.page + 1) * pageSize >= records.length;
    const selected = records.find((record) => record.id === state.selected);
    if (selected)
      cardDetail(detail, selected.card, selected.name, selected.art);
    else {
      list.append(element("p", "empty-note", empty));
      detail.replaceChildren(
        element("div", "town-kicker", "Captain’s register"),
        element("h3", "", "Nothing to select"),
        element("p", "small", empty),
      );
    }
  }
  function changePage(delta) {
    state.page += delta;
    state.selected = records[state.page * pageSize]?.id;
    show();
    (delta > 0 ? next : previous).focus({ preventScroll: true });
  }
  show();
}

export function paginateMarket(root, selected, scope) {
  const rows = [...root.querySelectorAll(".exchange-row")];
  const key = `market:${scope}`;
  const state = collections.get(key) || { page: 0, selected: null };
  collections.set(key, state);
  if (state.selected !== selected) {
    const index = rows.findIndex((row) => row.dataset.good === selected);
    if (index >= 0) state.page = Math.floor(index / 6);
    state.selected = selected;
  }
  const pager = byId("marketPager");
  pager.className = "collection-pager";
  function show() {
    state.page = Math.max(
      0,
      Math.min(Math.ceil(rows.length / 6) - 1, state.page),
    );
    rows.forEach((row, i) => {
      row.hidden = Math.floor(i / 6) !== state.page;
    });
    const previous = button("←", () => {
      state.page--;
      show();
      pager.querySelector("button")?.focus();
    });
    previous.setAttribute("aria-label", "Previous goods page");
    const next = button("→", () => {
      state.page++;
      show();
      pager.querySelector("button:last-child")?.focus();
    });
    next.setAttribute("aria-label", "Next goods page");
    previous.disabled = state.page === 0;
    next.disabled = (state.page + 1) * 6 >= rows.length;
    const controls = element("div");
    controls.append(
      previous,
      element(
        "span",
        "",
        `${state.page + 1} / ${Math.max(1, Math.ceil(rows.length / 6))}`,
      ),
      next,
    );
    pager.replaceChildren(
      element("span", "", `${rows.length} goods`),
      controls,
    );
  }
  show();
}

export function refreshPortWorkspaces({
  game,
  port,
  factionLore,
  openFleetLedger,
}) {
  if (visit !== port.name) {
    visit = port.name;
    collections.clear();
    activities.clear();
    cityTopic = "brief";
  }
  document.querySelectorAll("#portPanel .port-panel").forEach((section) => {
    section.querySelectorAll(".activity-tab").forEach((tab) => {
      tab.onclick = () => activatePortActivity(section, tab.dataset.activity);
      tab.onkeydown = (event) => {
        const tabs = [...section.querySelectorAll(".activity-tab")];
        let index = tabs.indexOf(tab);
        if (event.key === "ArrowRight") index = (index + 1) % tabs.length;
        else if (event.key === "ArrowLeft")
          index = (index + tabs.length - 1) % tabs.length;
        else if (event.key === "Home") index = 0;
        else if (event.key === "End") index = tabs.length - 1;
        else return;
        event.preventDefault();
        tabs[index].click();
        tabs[index].focus();
      };
    });
    activatePortActivity(section, activities.get(section.dataset.tab));
  });

  const city = byId("portCityDetails");
  [...city.children].forEach((card, i) => {
    card.className = "city-topic";
    card.dataset.topic = ["trade", "factions", "routes"][i];
    // Keep route and service buttons live, while reading the full civic register.
    const title = card.querySelector("h3");
    const heading = title?.textContent;
    const blocks = cardText(card, title);
    if (i === 0) blocks.push(byId("portEvolution").textContent);
    const actions = [...card.querySelectorAll("button")];
    card.replaceChildren(element("h3", "", heading));
    const reading = element("div", "workspace-reading");
    readingPages(reading, [...blocks, ...actions]);
    card.append(reading);
  });
  function showTopic(topic) {
    cityTopic = topic;
    document.querySelectorAll("#portPanel .city-topic").forEach((card) => {
      card.hidden = card.dataset.topic !== topic;
    });
    document
      .querySelectorAll(".city-topics button")
      .forEach((tab) =>
        tab.setAttribute("aria-pressed", String(tab.dataset.topic === topic)),
      );
    requestAnimationFrame(refreshReaders);
  }
  document.querySelectorAll(".city-topics button").forEach((tab) => {
    tab.onclick = () => showTopic(tab.dataset.topic);
  });
  showTopic(cityTopic);

  const priorities = byId("portOpportunities");
  const rumorLead = [...priorities.children].find((card) =>
    card.textContent.includes("Buy a rumor lead"),
  );
  rumorLead?.remove();
  [...priorities.children].forEach((item) => {
    const action = item.querySelector("button");
    const content = item.querySelector("div");
    action.className = "priority-link";
    action.textContent = "";
    action.append(content);
    item.replaceChildren(action);
  });
  const intel = byId("intelOffice");
  if (rumorLead) intel.prepend(rumorLead);
  pagedCollection(intel, [
    ...intel.querySelectorAll(".intel-card,.port-opportunity"),
  ]);
  pagedCollection(
    byId("contractBoard"),
    [...byId("contractBoard").querySelectorAll(".contract-card")],
    {
      empty:
        "No commissions available. Return after the Guild refreshes its offers.",
    },
  );
  const cargo = byId("cargoPlan");
  const compartments = element("div", "workspace-toolbar");
  compartments.textContent = [
    ...cargo.querySelectorAll(".cargo-compartment-head"),
  ]
    .map((node) => node.textContent)
    .join(" · ");
  pagedCollection(cargo, [...cargo.querySelectorAll(".cargo-lot-row")], {
    toolbar: compartments,
    empty:
      "No trade cargo aboard. Sealed commissions are recorded in the captain’s ledger.",
  });

  const warehouse = byId("warehouse");
  const columns = [...warehouse.querySelectorAll(".warehouse-column")];
  if (columns.length) {
    const rows = columns.map((column) => [
      ...column.querySelectorAll(".warehouse-lot-row"),
    ]);
    const toolbar = element("nav", "workspace-toolbar");
    let side = collections.get("warehouse-side") || 0;
    const controls = ["Aboard", "Stored"].map((label, i) =>
      button(label, () => {
        side = i;
        collections.set("warehouse-side", i);
        renderWarehouseSide();
      }),
    );
    toolbar.append(...controls);
    function renderWarehouseSide() {
      controls.forEach((control, i) =>
        control.setAttribute("aria-pressed", String(i === side)),
      );
      pagedCollection(warehouse, rows[side], {
        key: `warehouse-${side}`,
        toolbar,
        empty: side
          ? "The warehouse is empty. Store cargo from the Aboard inventory."
          : "No trade cargo aboard. Load goods from the Stored inventory.",
      });
    }
    renderWarehouseSide();
  } else {
    const card = element("article");
    card.append(element("b", "", "Lease a warehouse"), ...warehouse.childNodes);
    pagedCollection(warehouse, [card]);
  }

  const readiness = byId("voyageReadiness");
  const crew = [...readiness.querySelectorAll(".crew-card")];
  const recruits = [...readiness.querySelectorAll(".crew-recruiting button")];
  const passageActions = [
    ...readiness.querySelectorAll(".town-actions button"),
  ];
  const status = readiness.querySelector(".ship-stats")?.textContent;
  crew.forEach((card, i) => {
    card.append(element("p", "small", status), recruits[i]);
    const leave = button(
      passageActions[2].textContent,
      passageActions[2].onclick,
    );
    leave.className = "parchment";
    card.append(leave);
  });
  pagedCollection(byId("crewWorkspace"), crew, {
    metadata: crew.map((card) => card.querySelector("span")?.textContent),
  });
  const passage = byId("passageWorkspace");
  passage.className = "passage-layout";
  const plans = readiness.querySelector(".route-plan-grid");
  const detail = element("section", "collection-detail");
  detail.append(
    element("div", "town-kicker", "Voyage preparation"),
    element("h3", "", "Stores & passage"),
  );
  const reading = element("div", "workspace-reading");
  readingPages(reading, [
    status,
    ...[...readiness.querySelectorAll(".standing-row")].map(
      (node) => node.textContent,
    ),
  ]);
  const actions = element("div", "workspace-actions");
  actions.append(...passageActions.slice(0, 2));
  detail.append(reading, actions);
  passage.replaceChildren(plans, detail);

  const customs = byId("customsOffice");
  const customsWorkspace = byId("customsWorkspace");
  customsWorkspace.className = "customs-layout";
  const manifest = element("article", "customs-manifest");
  manifest.innerHTML = `<div class="town-kicker">Harbor master’s register</div><h3>Cargo declaration</h3><div><span>Port of arrival</span><b>${port.name}</b></div><div><span>Trade cargo</span><b>${game.cargoLots.length} lots</b></div><div><span>Hold capacity</span><b>${game.holdMax}</b></div><div><span>Manifest</span><b>${game.legal.forgedManifest ? "Forged papers" : "Ship’s register"}</b></div><div><span>Landing</span><b>${game.legal.remoteAnchorage ? "Remote anchorage" : "Public quay"}</b></div>`;
  const customsDetail = element("section", "collection-detail");
  customsDetail.append(
    element("div", "town-kicker", "Customs & jurisdiction"),
    element("h3", "", "Arrival arrangements"),
  );
  const customsReading = element("div", "workspace-reading");
  readingPages(customsReading, [
    customs.querySelector(".politics-box").textContent,
  ]);
  const customsActions = customs.querySelector(".customs-actions");
  customsActions.classList.add("workspace-actions");
  customsDetail.append(customsReading, customsActions);
  customsWorkspace.replaceChildren(manifest, customsDetail);

  const production = byId("productionChains");
  const overview = production.querySelector(".ship-stats");
  const workshops = [...production.querySelectorAll(".production-chain")];
  workshops.forEach((card) =>
    card.append(element("p", "small", overview.textContent)),
  );
  pagedCollection(production, workshops);
  const yard = byId("shipyard");
  const sections = [...yard.querySelectorAll(".ship-class-section")];
  const activeStats = [...byId("shipStats").children]
    .map((node) => node.textContent)
    .join(" · ");
  sections[0]
    .querySelectorAll(".ship-class-option")
    .forEach((card) =>
      card.append(element("p", "small", `Current vessel: ${activeStats}`)),
    );
  pagedCollection(
    byId("vesselCatalog"),
    [...sections[0].querySelectorAll(".ship-class-option")],
    { pageSize: 3 },
  );
  pagedCollection(
    byId("fleetCatalog"),
    [...sections[1].querySelectorAll(".ship-class-option")],
    { pageSize: 3 },
  );
  const slots = [...yard.querySelectorAll(".upgrade-slot")];
  const fittingRows = slots.map((slot) => [
    ...slot.querySelectorAll(".upgrade-option"),
  ]);
  let slot = collections.get("fitting-slot") || 0;
  const toolbar = element("label", "workspace-toolbar", "Fitting slot ");
  const select = element("select");
  select.setAttribute("aria-label", "Choose fitting slot");
  slots.forEach((section, i) => {
    const option = element(
      "option",
      "",
      section.querySelector("h4").textContent,
    );
    option.value = i;
    select.append(option);
  });
  select.value = slot;
  toolbar.append(select);
  function showFittings() {
    pagedCollection(byId("fittingCatalog"), fittingRows[slot], {
      key: `fittings-${slot}`,
      toolbar,
    });
  }
  select.onchange = () => {
    slot = Number(select.value);
    collections.set("fitting-slot", slot);
    showFittings();
    select.focus();
  };
  showFittings();
  const standings = byId("portStanding");
  const rows = [...standings.children];
  let factionIndex = collections.get("council-faction") || 0;
  const law = byId("localLaw");
  const lawText = `${law.querySelector(".law-head b").textContent} · ${law.querySelector(".contract-tag").textContent}. ${law.querySelector(".law-effect").textContent}`;
  const lawPane = law.parentElement;
  lawPane.querySelector(".selected-faction-heading")?.remove();
  const factionHeading = element("h3", "selected-faction-heading");
  law.before(factionHeading);
  const factionButtons = rows.map((row, i) => {
    const control = button("", () => {
      factionIndex = i;
      collections.set("council-faction", i);
      showFaction();
    });
    control.className = "council-faction";
    const faction = port.factions[i];
    const crest = element("span", "faction-crest");
    crest.innerHTML = heraldry(i);
    control.append(
      crest,
      element("b", "", faction.name),
      element(
        "span",
        "",
        `${faction.influence}% local influence · ${game.factionStanding[faction.name] || 0} standing`,
      ),
    );
    const meter = element("span", "faction-influence");
    meter.setAttribute("aria-hidden", "true");
    const fill = element("span");
    fill.style.width = `${Math.max(0, Math.min(100, faction.influence))}%`;
    meter.append(fill);
    control.append(meter);
    return control;
  });
  standings.replaceChildren(
    element("div", "town-kicker", "Local factions"),
    ...factionButtons,
  );
  function showFaction() {
    const faction = port.factions[factionIndex];
    const lore = factionLore(faction, port);
    factionHeading.textContent = faction.name;
    lawPane.querySelector(".council-crest")?.remove();
    const crest = element("div", "council-crest");
    crest.innerHTML = heraldry(factionIndex);
    lawPane.prepend(crest);
    factionButtons.forEach((control, i) =>
      control.setAttribute("aria-pressed", String(i === factionIndex)),
    );
    readingPages(law, [
      lawText,
      rows[factionIndex].querySelector(".small").textContent,
      faction.note,
      lore.backstory,
      lore.history,
      lore.motivations,
    ]);
  }
  showFaction();
  const fleetAction = button(
    "Assign fleet routes & officers →",
    openFleetLedger,
  );
  fleetAction.className = "parchment";
  byId("fleetCatalog").querySelector(".workspace-catalog").prepend(fleetAction);

  decoratePortNavigation();
  const events = byId("portEvent");
  pagedCollection(events, [...events.querySelectorAll(".event-banner")], {
    empty: "No public notices or active crises at this harbor.",
  });
  const milestone = byId("milestonePort");
  pagedCollection(milestone, [...milestone.children]);
  requestAnimationFrame(refreshReaders);
}

addEventListener("resize", () => requestAnimationFrame(refreshReaders));
document.addEventListener("click", (event) => {
  if (event.target.closest("#portPanel .port-tab"))
    requestAnimationFrame(refreshReaders);
});

function decoratePortNavigation() {
  const sections = {
    city: "city",
    harbor: "systems",
    market: "market",
    trade: "guild",
    vessel: "fittings",
    politics: "council",
  };
  document
    .querySelectorAll("#portPanel .port-tab, #portPanel .activity-tab")
    .forEach((tab) => {
      if (tab.dataset.decorated) return;
      const glyph =
        sections[tab.dataset.tab] ||
        {
          goods: "market",
          contracts: "guild",
          vessels: "systems",
          factions: "council",
          events: "guild",
        }[tab.dataset.activity] ||
        tab.dataset.activity;
      tab.querySelector("svg")?.remove();
      tab.insertAdjacentHTML("afterbegin", menuGlyph(glyph));
      tab.dataset.decorated = "true";
    });
  const identity = document.querySelector("#portPanel .port-identity");
  if (!identity.querySelector(".port-crest")) {
    const crest = element("div", "port-crest");
    crest.innerHTML = menuGlyph("passage");
    identity.prepend(crest);
  }
}
