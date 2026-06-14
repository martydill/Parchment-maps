import { clamp } from "./math.js";

export const MARKET_HALF_SPREAD = 0.06;

export function economyCondition(state) {
  const ratio = state.stock / state.target;
  if (ratio < 0.38) return "Shortage";
  if (ratio < 0.72) return "Tight";
  if (ratio > 1.45) return "Glut";
  if (ratio > 1.16) return "Surplus";
  return "Stable";
}

export function createEconomyState(ports, goods) {
  const economy = {};
  for (const port of ports) {
    economy[port.name] = {};
    for (const key of Object.keys(goods)) {
      const bias = port.bias[key];
      const target = 26;
      economy[port.name][key] = {
        stock: clamp(Math.round(target * (1.45 / bias)), 7, 52),
        target,
        production: clamp((1.18 - bias) * 2.2 + 0.55, 0.2, 2.7),
        consumption: clamp((bias - 0.72) * 1.6 + 0.45, 0.35, 2.5),
      };
    }
  }
  return economy;
}

export function marketReferenceValue({
  state,
  good,
  bias,
  day,
  portName,
  stock = state.stock,
  eventMultiplier = 1,
  lawMultiplier = 1,
}) {
  const scarcity = clamp(
    Math.pow(state.target / Math.max(2, stock), 0.52),
    0.62,
    2.05,
  );
  const dayWave =
    1 + Math.sin(day * 0.47 + good.key.charCodeAt(0) + portName.length) * 0.025;
  return (
    good.base * bias * scarcity * eventMultiplier * lawMultiplier * dayWave
  );
}

export function buyPrice(options) {
  const marginalStock = Math.max(0.5, options.state.stock - 0.5);
  return Math.max(
    4,
    Math.ceil(
      marketReferenceValue({ ...options, stock: marginalStock }) *
        (1 + MARKET_HALF_SPREAD),
    ),
  );
}

export function sellPrice(options) {
  const marginalStock = options.state.stock + 0.5;
  return Math.max(
    1,
    Math.floor(
      marketReferenceValue({ ...options, stock: marginalStock }) *
        (1 - MARKET_HALF_SPREAD),
    ),
  );
}

export function advanceEconomyState(state, modifiers = {}) {
  state.stock = clamp(
    state.stock +
      state.production +
      (modifiers.production || 0) -
      state.consumption -
      (modifiers.consumption || 0),
    0,
    70,
  );
  return state;
}
