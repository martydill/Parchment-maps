export function upcomingEvents(events, day, days = 9) {
  return events
    .filter(
      (event) =>
        !event.started && event.startDay > day && event.startDay <= day + days,
    )
    .sort((left, right) => left.startDay - right.startDay);
}

export function bestTradeOpportunity(goodKeys, ports, buyPrice, sellPrice) {
  let best = null;
  for (const key of goodKeys) {
    for (const buy of ports) {
      for (const sell of ports) {
        if (buy === sell) continue;
        const margin = sellPrice(sell, key) - buyPrice(buy, key);
        if (!best || margin > best.margin) {
          best = { key, buy: buy.name, sell: sell.name, margin };
        }
      }
    }
  }
  return best;
}

export function intelEffectText(report) {
  if (report.type === "forecast") {
    return `${report.affectedPort} has been marked on your chart, and the confidential forecast now appears in that town’s political record.`;
  }
  if (report.type === "market") {
    return `The recommended ${report.buyPort} → ${report.sellPort} trade is saved in your ledger. Both ports have been marked on your chart. Prices remain dynamic and can change as stock moves.`;
  }
  if (report.type === "shipping") {
    return `The named merchant vessel is now visible on your chart through Day ${report.expiresDay}, even when it is beyond normal sight range.`;
  }
  return "The report has been saved in your captain’s ledger.";
}

export function intelActionLabel(report) {
  if (report.type === "forecast") return `Inspect ${report.affectedPort}`;
  if (report.type === "market") return `Inspect ${report.sellPort}`;
  if (report.type === "shipping") return "Inspect Tracked Vessel";
  return "Open Ledger";
}
