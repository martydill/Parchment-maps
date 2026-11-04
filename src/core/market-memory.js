export function normalizeMarketNotes(value, portNames, goodKeys) {
  const notes = {};
  for (const port of portNames) {
    const entry = value?.[port];
    if (!entry || !Number.isFinite(entry.day) || entry.day < 1) continue;
    const prices = {};
    for (const key of goodKeys) {
      const price = entry.prices?.[key];
      if (Number.isFinite(price) && price > 0) prices[key] = price;
    }
    notes[port] = { day: entry.day, prices };
  }
  return notes;
}

// A remembered price is an estimate, never a fresh peek at a remote market.
export function rememberedSellPrice(notes, reports, port, key, day) {
  const entry = notes[port];
  let quote = entry?.prices?.[key];
  let observedDay = entry?.day ?? 0;
  for (const report of reports) {
    if (
      report.type === "market" &&
      report.sellPort === port &&
      report.goodKey === key &&
      report.expiresDay >= day &&
      report.boughtDay >= observedDay &&
      Number.isFinite(report.sellQuote)
    ) {
      quote = report.sellQuote;
      observedDay = report.boughtDay;
    }
  }
  const age = day - observedDay;
  if (!Number.isFinite(quote) || quote <= 0 || age < 0 || age > 7) return null;
  return quote * (1 - age * 0.025);
}
