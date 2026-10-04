import { buyPrice, sellPrice } from "./economy.js";
import { canTrade, tradeQuote } from "./jurisdictions.js";
import { cargoValueMultiplier } from "./cargo.js";

// Quote every unit against the stock left by the previous unit. Previewing an
// order never changes the economy, legal state, or cargo lots.
export function planMarketOrder({
  direction,
  quantity,
  pricing,
  legal,
  status,
  lots,
  coins,
  holdUsed,
  holdMax,
}) {
  if (!["buy", "sell"].includes(direction))
    return { ok: false, reason: "Choose buy or sell." };
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 70)
    return { ok: false, reason: "Choose a quantity from 1 to 70." };
  const buying = direction === "buy";
  const cargo = lots.filter((lot) => lot.key === pricing.good.key);
  if (!buying && cargo.length < quantity)
    return { ok: false, reason: "Not enough of this good aboard." };
  if (buying && holdUsed + quantity > holdMax)
    return { ok: false, reason: "Not enough room in the hold." };
  if (buying && pricing.state.stock < quantity)
    return { ok: false, reason: "Not enough stock in this market." };
  const state = { ...pricing.state };
  const prices = [];
  for (let index = 0; index < quantity; index++) {
    const access = canTrade({
      state: legal,
      portName: pricing.portName,
      good: pricing.good.key,
      status,
      day: pricing.day,
      units: buying ? cargo.length + index : cargo.length - index,
    });
    if (!access.ok) return access;
    const options = { ...pricing, state };
    const base = tradeQuote(
      buying ? buyPrice(options) : sellPrice(options),
      status,
      direction,
    );
    prices.push(
      buying
        ? base
        : Math.max(
            1,
            Math.round(
              base *
                cargoValueMultiplier(
                  cargo[index],
                  pricing.portName,
                  pricing.good,
                ),
            ),
          ),
    );
    state.stock += buying ? -1 : 1;
  }
  const total = prices.reduce((sum, price) => sum + price, 0);
  if (buying && total > coins)
    return { ok: false, reason: `Need ${total - coins} more crowns.`, total };
  return {
    ok: true,
    total,
    prices,
    coinsAfter: coins + (buying ? -total : total),
    holdAfter: holdUsed + (buying ? quantity : -quantity),
    stockAfter: state.stock,
    soldLots: buying ? [] : cargo.slice(0, quantity),
  };
}
