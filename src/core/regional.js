import { clamp } from "./math.js";

export const INFRASTRUCTURE_NAMES = Object.freeze([
  "Subsistence",
  "Established",
  "Industrial",
  "Renowned",
]);

export function createRegionalState(ports, chains) {
  return Object.fromEntries(
    ports.map((port) => [
      port.name,
      {
        infrastructure: port.infrastructure ?? 1,
        labor: port.labor ?? 1,
        resourceHealth: Object.fromEntries(
          (port.extractiveGoods || []).map((key) => [key, 1]),
        ),
        industries: Object.fromEntries(
          chains.map((chain) => [chain.id, { investment: 0 }]),
        ),
      },
    ]),
  );
}

export function normalizeRegionalState(value, ports, chains) {
  const fresh = createRegionalState(ports, chains);
  if (!value || typeof value !== "object") return fresh;
  for (const port of ports) {
    const saved = value[port.name];
    if (!saved || typeof saved !== "object") continue;
    const state = fresh[port.name];
    state.infrastructure = clamp(
      Math.floor(saved.infrastructure ?? state.infrastructure),
      0,
      3,
    );
    state.labor = clamp(Number(saved.labor ?? state.labor), 0.35, 1.5);
    for (const key of Object.keys(state.resourceHealth))
      state.resourceHealth[key] = clamp(
        Number(saved.resourceHealth?.[key] ?? 1),
        0.2,
        1,
      );
    for (const chain of chains)
      state.industries[chain.id].investment = clamp(
        Math.floor(saved.industries?.[chain.id]?.investment ?? 0),
        0,
        3,
      );
  }
  return fresh;
}

export function infrastructureCapacity(level) {
  return [0.55, 1, 1.35, 1.7][clamp(Math.floor(level), 0, 3)];
}

export function investmentCost(industry) {
  return 90 + industry.investment * 70;
}

export function investInIndustry(regionalState, chainId, coins) {
  const industry = regionalState.industries[chainId];
  if (!industry) return { ok: false, reason: "Unknown local industry." };
  if (industry.investment >= 3)
    return { ok: false, reason: "This industry is fully developed." };
  const cost = investmentCost(industry);
  if (coins < cost) return { ok: false, reason: "Not enough crowns." };
  industry.investment += 1;
  regionalState.infrastructure = clamp(
    regionalState.infrastructure + (industry.investment === 3 ? 1 : 0),
    0,
    3,
  );
  return { ok: true, cost, coins: coins - cost, level: industry.investment };
}

function recipeAvailability(states, recipe) {
  let availability = Infinity;
  for (const [key, units] of Object.entries(recipe.inputs)) {
    const state = states[key];
    availability = Math.min(
      availability,
      state ? state.stock / Math.max(0.01, units) : 0,
    );
  }
  return Number.isFinite(availability) ? availability : 0;
}

export function chooseRecipe(states, chain) {
  const recipes = [
    { id: "standard", inputs: chain.inputs, outputScale: 1 },
    ...(chain.alternatives || []),
  ];
  return recipes
    .map((recipe) => ({
      ...recipe,
      outputScale: recipe.outputScale ?? 1,
      availability: recipeAvailability(states, recipe),
    }))
    .sort(
      (left, right) =>
        right.availability * right.outputScale -
        left.availability * left.outputScale,
    )[0];
}

export function inputQuality(states, recipe) {
  const ratios = Object.keys(recipe.inputs).map((key) => {
    const state = states[key];
    return state ? state.stock / Math.max(1, state.target || 26) : 0;
  });
  const average = ratios.length
    ? ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length
    : 0;
  return clamp(0.8 + average * 0.25, 0.72, 1.18);
}

export function runRegionalIndustries(
  states,
  chains,
  baseEfficiencies,
  regionalState,
) {
  const reports = [];
  for (const chain of chains) {
    const local = regionalState.industries[chain.id] || { investment: 0 };
    const recipe = chooseRecipe(states, chain);
    const fuelNeed = chain.fuel || 0;
    const fuelAvailable = fuelNeed
      ? Math.min(1, (states.timber?.stock || 0) / fuelNeed)
      : 1;
    const capacity =
      (baseEfficiencies[chain.id] || 0) *
      infrastructureCapacity(regionalState.infrastructure) *
      regionalState.labor *
      (1 + local.investment * 0.18) *
      fuelAvailable;
    const desiredBatches = chain.rate * capacity;
    const batches = Math.max(0, Math.min(desiredBatches, recipe.availability));
    for (const [key, units] of Object.entries(recipe.inputs))
      if (states[key])
        states[key].stock = clamp(states[key].stock - units * batches, 0, 70);
    if (fuelNeed && states.timber)
      states.timber.stock = clamp(
        states.timber.stock - fuelNeed * batches,
        0,
        70,
      );
    const quality = inputQuality(states, recipe);
    const outputScale = recipe.outputScale;
    for (const [key, units] of Object.entries(chain.outputs))
      if (states[key])
        states[key].stock = clamp(
          states[key].stock + units * batches * outputScale * quality,
          0,
          70,
        );
    reports.push({
      id: chain.id,
      batches,
      utilization: desiredBatches ? batches / desiredBatches : 0,
      recipeId: recipe.id,
      quality,
      capacity,
      fuelLimited: fuelAvailable < 1,
      investment: local.investment,
    });
  }
  return reports;
}

export function advanceRegionalResources(regionalState, economyStates) {
  const modifiers = {};
  for (const [key, health] of Object.entries(regionalState.resourceHealth)) {
    const state = economyStates[key];
    const pressure = state
      ? clamp(state.production / Math.max(0.1, state.target / 20), 0, 2)
      : 0;
    const nextHealth = clamp(
      health + (pressure > 0.75 ? -0.008 * pressure : 0.006),
      0.2,
      1,
    );
    regionalState.resourceHealth[key] = nextHealth;
    modifiers[key] = {
      production: state ? state.production * (nextHealth - 1) : 0,
    };
  }
  regionalState.labor = clamp(
    regionalState.labor +
      (Object.values(economyStates).some(
        (state) => state.stock / state.target < 0.35,
      )
        ? -0.01
        : 0.004),
    0.35,
    1.5,
  );
  return modifiers;
}

export function regionalSummary(regionalState) {
  const health = Object.values(regionalState.resourceHealth);
  const averageHealth = health.length
    ? health.reduce((sum, value) => sum + value, 0) / health.length
    : 1;
  return {
    infrastructure:
      INFRASTRUCTURE_NAMES[
        clamp(Math.floor(regionalState.infrastructure), 0, 3)
      ],
    laborPercent: Math.round(regionalState.labor * 100),
    resourcePercent: Math.round(averageHealth * 100),
  };
}
