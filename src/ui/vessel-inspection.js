import { SHIP_COMPONENTS, repairShipComponent } from "../core/operations.js";
import { getShipModelProfile } from "../core/ship-models.js";
import { CARGO_COMPARTMENTS } from "../core/cargo.js";

const formatValue = (value) => Number(value.toFixed(2)).toString();

const SYSTEM_NOTES = {
  hull: "Sound planking keeps the vessel seaworthy and helps it survive rough passages.",
  rigging:
    "Masts, ropes, and sails carry your vessel through the wind. Repair wear before a long voyage.",
  rudder:
    "Steering gear controls your response at sea. Keep it sound for difficult approaches.",
  fittings:
    "Cargo fittings protect the hold. Inspect your stowage before sailing with fragile or perishable goods.",
  weapons:
    "Maintain the ship’s armament before taking a passage through hostile waters.",
};

let selectedPort = null;
let selectedComponent = "hull";

function shipSchematic(vesselClass) {
  const profile = getShipModelProfile(vesselClass);
  const masts = profile.masts
    .map((mast) => {
      const x = Math.round(340 - (mast.y / profile.length) * 360);
      const top = Math.round(207 - mast.height * 3.7);
      const sail =
        profile.rig === "lateen"
          ? `<path class="part-surface" d="M${x - 65} ${top + 5} L${x + 55} ${top + 80} L${x + 45} ${top + 9} Z" fill="#f5e8c5"/>`
          : `<path class="part-surface" d="M${x - 40} ${top + 18} Q${x + 8} ${top + 13} ${x + 48} ${top + 20} L${x + 37} ${top + 88} Q${x} ${top + 79} ${x - 38} ${top + 89} Z" fill="#f5e8c5"/>`;
      return `<path d="M${x} 216 V${top}" stroke-width="5"/><path d="M${x} ${top + 8} L${x - 85} 218 M${x} ${top + 8} L${x + 85} 218" stroke-width="1"/>${sail}<path d="M${x} ${top} l30 6 -30 7 Z" fill="#985238"/>`;
    })
    .join("");
  return `<svg class="inspection-diagram" viewBox="0 0 640 335" aria-hidden="true"><defs><pattern id="inspection-planks" width="20" height="13" patternUnits="userSpaceOnUse"><path d="M0 13H20" stroke="#93724c" opacity=".35"/></pattern></defs><path class="inspection-guide" d="M36 300H606 M36 48H606 M320 27V316"/><text x="38" y="40" class="inspection-annotation">SHIPWRIGHT’S SECTION</text><text x="38" y="320" class="inspection-annotation">SCHEMATIC · NOT TO SCALE</text><g class="ship-section" data-part="hull"><path class="part-surface" d="M92 207 Q126 207 142 214 H510 L561 196 L542 252 Q507 285 440 290 H175 Q110 282 92 207Z" fill="#c6a278"/><path d="M92 207 Q126 207 142 214 H510 L561 196 L542 252 Q507 285 440 290 H175 Q110 282 92 207Z" fill="url(#inspection-planks)"/><path d="M122 239H533 M140 262H519 M183 218V282 M241 218V290 M299 218V290 M357 218V290 M415 218V290 M473 218V282" opacity=".45"/><path d="M96 207V176H166V213" fill="#a78966"/><path d="M105 180h49v18h-49Z" fill="#e4cf9f"/></g><g class="ship-section" data-part="rigging">${masts}<path d="M510 215L599 179" stroke-width="4"/></g><g class="ship-section" data-part="fittings"><path class="part-surface" d="M276 238h34v29h-34Z M316 231h36v36h-36Z M358 241h32v26h-32Z M396 235h34v32h-34Z" fill="#b39163"/><path d="M284 238v29 M302 238v29 M324 231v36 M344 231v36 M366 241v26 M382 241v26 M404 235v32 M422 235v32"/></g><g class="ship-section" data-part="weapons"><path class="part-surface" d="M178 223h25v10h-25Z M220 223h25v10h-25Z" fill="#807766"/><circle cx="190" cy="236" r="5" fill="#5c4b38"/><circle cx="232" cy="236" r="5" fill="#5c4b38"/></g><g class="ship-section" data-part="rudder"><path class="part-surface" d="M101 242L84 243V278L110 272Z" fill="#9c7953"/></g><path d="M82 302q16-7 32 0t32 0 M481 302q16-7 32 0t32 0" fill="none" stroke="#759183" stroke-width="2"/></svg>`;
}

export function renderVesselInspection(
  root,
  { game, portName, vessel, capacities, onRepair, onCargo, onRefit },
) {
  if (selectedPort !== portName) {
    selectedPort = portName;
    selectedComponent = Object.keys(SHIP_COMPONENTS).sort(
      (a, b) => game.operations.components[a] - game.operations.components[b],
    )[0];
  }
  root.innerHTML = `<div class="inspection-heading"><div><div class="town-kicker">Shipwright’s inspection</div><h4>${vessel.vesselName}</h4></div><span>${vessel.name} · ${Math.round(game.operations.condition)}% condition</span></div><div class="inspection-workspace"><div class="inspection-blueprint">${shipSchematic(vessel.id)}<div class="inspection-selectors" role="group" aria-label="Inspect ship systems"></div><p class="small">Select a system in the schematic or below to inspect its condition.</p></div><section class="inspection-detail" aria-label="Selected ship system"></section></div><div class="inspection-cargo"><div class="inspection-cargo-heading"><b>Cargo stowage</b><button type="button" class="parchment" data-inspection-cargo>Arrange cargo →</button></div><div class="inspection-compartments"></div></div>`;
  const doc = root.ownerDocument;
  const selectors = root.querySelector(".inspection-selectors");
  for (const [key, definition] of Object.entries(SHIP_COMPONENTS)) {
    const button = doc.createElement("button");
    button.type = "button";
    button.dataset.component = key;
    const condition = Math.round(game.operations.components[key]);
    button.className = `inspection-system ${condition < 40 ? "damaged" : condition < 80 ? "worn" : "sound"}`;
    button.innerHTML = `<span>${definition.label}</span><b>${condition}%</b><span class="inspection-condition-track" aria-hidden="true"><span style="width:${condition}%"></span></span>`;
    button.onclick = () => select(key);
    selectors.append(button);
  }
  root.querySelectorAll("[data-part]").forEach((part) => {
    part.onclick = () => {
      select(part.dataset.part);
      root.querySelector(`[data-component="${part.dataset.part}"]`).focus();
    };
  });
  root.querySelector("[data-inspection-cargo]").onclick = onCargo;
  const compartments = root.querySelector(".inspection-compartments");
  for (const [key, compartment] of Object.entries(CARGO_COMPARTMENTS)) {
    const used = game.cargoLots.filter((lot) => lot.compartment === key).length;
    const capacity = capacities[key];
    const card = doc.createElement("div");
    card.className = "inspection-compartment";
    card.innerHTML = `<span>${compartment.label}</span><b>${capacity ? `${used} / ${capacity}` : "Not fitted"}</b><small>${compartment.description}</small>`;
    compartments.append(card);
  }
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
    detail.innerHTML = `<div class="town-kicker">${condition < 40 ? "Needs urgent attention" : condition < 100 ? "Maintenance available" : "Shipwright’s clearance"}</div><h4>${definition.label}</h4><strong class="inspection-percent">${formatValue(condition)}<small>% condition</small></strong><p>${SYSTEM_NOTES[key]}</p><div class="inspection-repair-preview" aria-live="polite"><span>Condition after repair <b>${formatValue(preview.operations.components[key])}%</b></span><span>Repair cost <b>${formatValue(cost)} crowns</b></span><span>Purse after <b>${formatValue(preview.coins)} crowns</b></span></div><button type="button" class="parchment" id="repairSelectedComponent">${condition >= 100 ? "Fully repaired" : preview.repaired ? `Repair ${formatValue(preview.repaired)} points · ${formatValue(cost)} crowns` : "Repairs unavailable"}</button><span class="inspection-repair-note">${condition >= 100 ? "This system is fully repaired." : !preview.repaired ? `Need at least ${definition.repairCost} crowns to begin repairs.` : preview.operations.components[key] < 100 ? "Your purse covers a partial repair." : "Your purse covers a complete repair."}</span><button type="button" class="inspection-refit">Browse vessels & fittings →</button>`;
    const repair = detail.querySelector("#repairSelectedComponent");
    repair.disabled = !preview.repaired;
    repair.onclick = () => onRepair(key);
    detail.querySelector(".inspection-refit").onclick = onRefit;
  }
  select(selectedComponent);
}
