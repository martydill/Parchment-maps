import { VOYAGE_ENTRIES, voyageProfit } from "../core/voyage-ledger.js";

const node = (tag, text) => {
  const element = document.createElement(tag);
  element.textContent = text;
  return element;
};
export function renderVoyageLedger(root, ledger) {
  root.replaceChildren();
  if (!ledger.history.length) {
    root.append(node("p", "Complete a passage to see its receipt here."));
    return;
  }
  for (const [index, receipt] of ledger.history.entries()) {
    const details = document.createElement("details");
    details.className = "voyage-receipt";
    details.open = index === 0;
    const profit = Math.round(voyageProfit(receipt));
    details.append(
      node(
        "summary",
        `${receipt.origin} → ${receipt.destination} · ${profit >= 0 ? "+" : ""}${profit} crowns`,
      ),
    );
    details.append(
      node(
        "p",
        `Departed Day ${receipt.departedDay} · Arrived Day ${receipt.arrivedDay}`,
      ),
    );
    const table = document.createElement("dl");
    for (const [key, label] of Object.entries(VOYAGE_ENTRIES)) {
      if (!receipt.entries[key]) continue;
      const income = ["sales", "commissions", "salvage"].includes(key);
      table.append(
        node("dt", label),
        node("dd", `${income ? "+" : "−"}${Math.round(receipt.entries[key])}`),
      );
    }
    table.append(
      node("dt", "Realized profit"),
      node("dd", `${profit >= 0 ? "+" : ""}${profit} crowns`),
    );
    details.append(table);
    root.append(details);
  }
}

export function renderMarketNotes(root, notes, goods, day) {
  root.replaceChildren();
  for (const [port, entry] of Object.entries(notes)) {
    const details = document.createElement("details");
    details.className = "voyage-receipt";
    const age = Math.max(0, day - entry.day);
    details.append(
      node(
        "summary",
        `${port} · Day ${entry.day}${age > 7 ? " · Stale" : age ? ` · ${age} days old` : " · Today"}`,
      ),
    );
    const table = document.createElement("dl");
    for (const [key, price] of Object.entries(entry.prices))
      table.append(node("dt", goods[key].name), node("dd", `${price} crowns`));
    details.append(table);
    root.append(details);
  }
  if (!root.children.length)
    root.append(node("p", "Dock at a harbor to record local sell quotes."));
}
