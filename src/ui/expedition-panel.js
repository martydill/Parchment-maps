const CARD_ART = {
  recon: { label: "Scout", image: "./assets/expeditions/scout.webp" },
  standard: {
    label: "Expedition",
    image: "./assets/expeditions/expedition.webp",
  },
  deep: { label: "Deep", image: "./assets/expeditions/deep.webp" },
};

let activePanel;

export function closeExpeditionPanel() {
  if (!activePanel) return;
  const { panel, returnFocus } = activePanel;
  panel.style.display = "none";
  activePanel = null;
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
}

export function openExpeditionPanel({
  document,
  site,
  game,
  ship,
  approaches,
  onLaunch,
  returnFocus = document.activeElement,
}) {
  if (!site) return;
  const panel = document.getElementById("explorationPanel");
  const options = document.getElementById("explorationApproaches");
  const launch = document.getElementById("launchExploration");
  const close = document.getElementById("closeExploration");
  const progress = game.exploration.sites[site.id];
  let selected;
  let launching = false;

  activePanel = { panel, returnFocus };
  ship.anchored = true;
  ship.speed = 0;
  document.getElementById("explorationName").textContent = site.name;
  document.getElementById("explorationStatus").textContent = progress
    ? progress.status === "surveyed"
      ? "Survey complete · expedition concluded"
      : "Landing charted · expedition concluded"
    : "Uncharted coast";
  document.getElementById("explorationSupplies").textContent =
    `${game.operations.provisions} provisions aboard`;
  const hazards = document.getElementById("explorationHazards");
  hazards.replaceChildren();
  for (const hazard of String(site.hazards || "")
    .split(/[,;]/)
    .map((text) => text.trim())
    .filter(Boolean)) {
    const badge = document.createElement("span");
    badge.className = "expedition-hazard";
    badge.textContent = hazard;
    hazards.append(badge);
  }

  options.replaceChildren();
  const cards = [];
  function select(approach) {
    selected = approach;
    for (const card of cards)
      card.setAttribute(
        "aria-pressed",
        String(card.dataset.approach === selected),
      );
    launch.disabled = !selected;
  }
  for (const [approach, plan] of Object.entries(approaches)) {
    const art = CARD_ART[approach];
    const card = document.createElement("button");
    card.type = "button";
    card.className = "expedition-option";
    card.dataset.approach = approach;
    card.setAttribute("aria-pressed", "false");
    const shortage = Math.max(0, plan.provisions - game.operations.provisions);
    card.disabled = Boolean(progress) || shortage > 0;
    const unavailable = progress
      ? "Expedition concluded"
      : shortage
        ? `Need ${shortage} more provisions`
        : "";
    // Artwork is decorative; the button's native text supplies its accessible name.
    card.innerHTML =
      `<span class="expedition-art"><img src="${art.image}" alt="" width="960" height="720" draggable="false" /></span>` +
      `<span class="expedition-selection" aria-hidden="true">✓</span>` +
      `<span class="expedition-card-body"><b>${art.label}</b>` +
      `<span class="expedition-cost">${plan.days} day${plan.days === 1 ? "" : "s"} · ${plan.provisions} provisions</span>` +
      `<span class="expedition-reward">${Math.round(plan.rewardScale * 100)}% reward potential</span>` +
      `<span class="expedition-shortage">${unavailable}</span></span>`;
    card.onclick = () => select(approach);
    cards.push(card);
    options.append(card);
  }

  const available = cards.filter((card) => !card.disabled);
  select(
    available.find((card) => card.dataset.approach === "standard")?.dataset
      .approach ?? available[0]?.dataset.approach,
  );
  launch.hidden = Boolean(progress);
  launch.textContent = available.length
    ? "Launch Expedition →"
    : "More provisions needed";
  launch.onclick = () => {
    // Recheck current supplies and site progress at confirmation, not just at opening.
    if (launching || !selected) return;
    if (
      game.exploration.sites[site.id] ||
      game.operations.provisions < approaches[selected].provisions
    ) {
      openExpeditionPanel({
        document,
        site,
        game,
        ship,
        approaches,
        onLaunch,
        returnFocus,
      });
      return;
    }
    launching = true;
    try {
      onLaunch(site, selected);
    } finally {
      launching = false;
    }
  };
  close.onclick = closeExpeditionPanel;
  panel.onclick = (event) => {
    if (event.target === panel) closeExpeditionPanel();
  };
  panel.onkeydown = (event) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      closeExpeditionPanel();
    } else if (event.key === "Tab") {
      const controls = [
        ...panel.querySelectorAll("button:not(:disabled)"),
      ].filter((control) => !control.hidden);
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    } else if (
      [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ].includes(event.key) &&
      available.includes(document.activeElement)
    ) {
      event.preventDefault();
      const index = available.indexOf(document.activeElement);
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? available.length - 1
            : (index +
                (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) +
                available.length) %
              available.length;
      select(available[next].dataset.approach);
      available[next].focus();
    }
  };
  panel.style.display = "grid";
  (cards.find((card) => card.dataset.approach === selected) || close).focus({
    preventScroll: true,
  });
}
