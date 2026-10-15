import { OFFICER_AMBITIONS, SPECIALIST_ROSTER } from "../core/specialists.js";

export function renderOfficerCards(
  root,
  { specialists, day, coins, portName, contracts, onChoose, onPlotCourse },
) {
  const document = root.ownerDocument;
  root.replaceChildren();
  const commission = contracts
    .slice()
    .sort((a, b) => a.deadline - b.deadline)[0];
  const pendingOfficer = specialists.officers.find((officer) =>
    ["offered", "accepted"].includes(officer.ambition.status),
  );
  const roster = SPECIALIST_ROSTER.slice().sort(
    (a, b) =>
      Number(b.id === pendingOfficer?.id) - Number(a.id === pendingOfficer?.id),
  );
  for (const definition of roster) {
    const officer = specialists.officers.find(
      (item) => item.id === definition.id,
    );
    const ambition = OFFICER_AMBITIONS[definition.id];
    const request = officer.ambition;
    const card = document.createElement("article");
    card.className = "specialist-card";
    card.dataset.officerId = officer.id;
    // All markup here comes from the fixed roster; saved state is rendered as text.
    card.innerHTML = `<header><span class="specialist-emblem">${definition.emblem}</span><span><h4>${definition.name}</h4><span class="small">${definition.role} · ${definition.origin}</span></span><b>${Math.round(officer.loyalty)} ♥</b></header><p><b>Benefit:</b> ${definition.benefit}</p><p><b>Flaw:</b> ${definition.flaw}</p><p class="small"><b>Ambition:</b> ${definition.ambition}<br><b>Ties:</b> ${definition.relationship} · ${officer.events} event${officer.events === 1 ? "" : "s"}</p>`;
    const section = document.createElement("section");
    section.className = "officer-request";
    section.setAttribute("aria-label", `${definition.name}’s personal request`);
    const text = (tag, value, className = "") => {
      const element = document.createElement(tag);
      element.textContent = value;
      element.className = className;
      section.append(element);
      return element;
    };
    const pending = ["offered", "accepted"].includes(request.status);
    if (pending) card.classList.add("officer-has-request");
    const labels = {
      unoffered: "No personal request yet",
      offered: "A personal request",
      accepted: "Your promise",
      completed: "Promise kept · +15 loyalty",
      refused: "Request declined · −8 loyalty",
      failed: "Opportunity lost",
    };
    const status = text("p", labels[request.status], "officer-request-status");
    status.tabIndex = -1;
    if (request.status !== "unoffered") {
      text("h5", ambition.title);
      if (pending) {
        text("p", `“${ambition.request}”`);
        text(
          "p",
          `${ambition.destination} · ${ambition.cost} crowns · due Day ${request.deadline} (${Math.max(0, request.deadline - day)} days left)`,
          "officer-request-terms",
        );
        text("p", ambition.task, "small");
        if (commission)
          text(
            "p",
            `Commission competing for your time: ${commission.destination} by Day ${commission.deadline}, worth ${commission.reward} crowns.`,
            "small",
          );
      }
      text(
        "p",
        `${request.status === "completed" ? "Ability learned" : "Reward"}: ${ambition.ability} — ${ambition.reward}`,
        "officer-ability",
      );
    }
    const actions = document.createElement("div");
    actions.className = "officer-request-actions";
    const button = (label, action, disabled = false) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = "parchment";
      element.textContent = label;
      element.disabled = disabled;
      element.onclick = action;
      actions.append(element);
    };
    if (request.status === "offered") {
      text(
        "p",
        "Refuse: −8 loyalty. Leave unanswered: −4. Break an accepted promise: −12. The deadline starts now.",
        "small",
      );
      button("Promise to help", () => onChoose(officer.id, "accept"));
      button("Refuse · −8 loyalty", () => onChoose(officer.id, "refuse"));
    } else if (request.status === "accepted") {
      if (portName === ambition.destination) {
        button(
          `Fulfill promise · ${ambition.cost} crowns`,
          () => onChoose(officer.id, "complete"),
          coins < ambition.cost,
        );
        if (coins < ambition.cost)
          text(
            "p",
            `Need ${ambition.cost - coins} more crown${ambition.cost - coins === 1 ? "" : "s"}. Trade here or return before the deadline.`,
            "small",
          );
      } else
        text(
          "p",
          "Dock at the destination, then return here to fulfill your promise. Missing the deadline costs 12 loyalty.",
          "small",
        );
      button(`Plot course · ${ambition.destination}`, () =>
        onPlotCourse(officer.id),
      );
    }
    section.append(actions);
    if (pending) card.insertBefore(section, card.querySelector("p"));
    else card.append(section);
    root.append(card);
  }
}
