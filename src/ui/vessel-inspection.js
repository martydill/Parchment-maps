import { SHIP_COMPONENTS, repairShipComponent } from "../core/operations.js";
import { vesselInspectionArtwork } from "./vessel-art.js?v=2";

const formatValue = (value) => Number(value.toFixed(2)).toString();

let selectedPort = null;
let selectedComponent = "hull";

export function renderVesselInspection(
  root,
  { game, portName, vessel, onRepair, onRefit },
) {
  if (selectedPort !== portName) {
    selectedPort = portName;
    selectedComponent = Object.keys(SHIP_COMPONENTS).sort(
      (a, b) => game.operations.components[a] - game.operations.components[b],
    )[0];
  }
  root.innerHTML = `<div class="inspection-workspace"><div class="inspection-blueprint"><div class="inspection-heading"><div class="town-kicker">Shipwright’s inspection</div><h4>${vessel.vesselName}</h4><span>${vessel.name} · ${Math.round(game.operations.condition)}% condition</span></div>${vesselInspectionArtwork(vessel.id)}<div class="inspection-selectors" role="group" aria-label="Inspect ship systems"></div></div><section class="inspection-detail" aria-label="Selected ship system"></section></div>`;
  const doc = root.ownerDocument;
  const selectors = root.querySelector(".inspection-selectors");
  for (const [index, [key, definition]] of Object.entries(
    SHIP_COMPONENTS,
  ).entries()) {
    const button = doc.createElement("button");
    button.type = "button";
    button.dataset.component = key;
    const condition = Math.round(game.operations.components[key]);
    button.className = `inspection-system ${condition < 40 ? "damaged" : condition < 80 ? "worn" : "sound"}`;
    button.innerHTML = `<span class="inspection-system-label"><span class="inspection-system-index" aria-hidden="true">${index + 1}</span>${definition.label}</span><b>${condition}%</b><span class="inspection-condition-track" aria-hidden="true"><span style="width:${condition}%"></span></span>`;
    button.onclick = () => select(key);
    selectors.append(button);
  }
  root.querySelectorAll("[data-part]").forEach((part) => {
    part.onclick = () => {
      select(part.dataset.part);
      root.querySelector(`[data-component="${part.dataset.part}"]`).focus();
    };
  });
  function select(key) {
    selectedComponent = key;
    const definition = SHIP_COMPONENTS[key];
    const condition = game.operations.components[key];
    const preview = repairShipComponent(game.operations, game.coins, key);
    const cost = game.coins - preview.coins;
    root
      .querySelectorAll("[data-component]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.component === key),
        ),
      );
    root.querySelectorAll("[data-part]").forEach((part) => {
      const partCondition = game.operations.components[part.dataset.part];
      part.classList.toggle("selected", part.dataset.part === key);
      part.classList.toggle("worn", partCondition >= 40 && partCondition < 80);
      part.classList.toggle("damaged", partCondition < 40);
    });
    const detail = root.querySelector(".inspection-detail");
    const repairNote =
      condition >= 100
        ? "This system is fully repaired."
        : !preview.repaired
          ? `Need at least ${definition.repairCost} crowns to begin repairs.`
          : "";
    detail.innerHTML = `<div class="town-kicker">${condition < 40 ? "Needs urgent attention" : condition < 100 ? "Maintenance available" : "Shipwright’s clearance"}</div><h4>${definition.label}</h4><strong class="inspection-percent">${formatValue(condition)}<small>% condition</small></strong><div class="inspection-repair-preview" aria-live="polite"><span>Condition after repair <b>${formatValue(preview.operations.components[key])}%</b></span><span>Repair cost <b>${formatValue(cost)} crowns</b></span></div><button type="button" class="parchment" id="repairSelectedComponent">${condition >= 100 ? "Fully repaired" : preview.repaired ? `Repair ${formatValue(preview.repaired)} points · ${formatValue(cost)} crowns` : "Repairs unavailable"}</button>${repairNote ? `<span class="inspection-repair-note">${repairNote}</span>` : ""}<button type="button" class="inspection-refit">Browse vessels & fittings →</button>`;
    const repair = detail.querySelector("#repairSelectedComponent");
    repair.disabled = !preview.repaired;
    repair.onclick = () => onRepair(key);
    detail.querySelector(".inspection-refit").onclick = onRefit;
  }
  select(selectedComponent);
}
