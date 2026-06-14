import { clamp } from "./math.js";

export const CRISIS_TEMPLATES = Object.freeze({
  loomUnrest: crisis({
    title: "The Starweave Compact",
    port: "Lethariel",
    good: "silk",
    startDay: 12,
    activeDays: 7,
    warning:
      "Loom workers and silk factors are deadlocked over wages. Both sides are quietly gathering allies.",
    active:
      "The starweave houses have closed. Silk production is failing while demonstrations fill the quays.",
    ignored:
      "The strike broke without agreement. Skilled weavers are leaving Lethariel and output remains weakened.",
    intervention: {
      label: "Broker a relief compact · 90 crowns",
      cost: 90,
      result:
        "Your relief fund secured an accord. The looms reopen under safer terms and the workforce rallies.",
    },
    activeModifiers: { price: 1.5, production: -1.8, consumption: 0.2 },
    resolvedModifiers: { price: 0.94, production: 0.35, consumption: 0 },
    ignoredModifiers: { price: 1.16, production: -0.3, consumption: 0 },
    resolvedRegional: { unrest: -18, labor: 0.08 },
    ignoredRegional: { unrest: 14, labor: -0.08 },
  }),
  fenFever: crisis({
    title: "The Mallowfen Fever",
    port: "Mallowfen",
    good: "medicine",
    startDay: 25,
    activeDays: 8,
    warning:
      "Reedboat healers report a spreading marsh fever and warn that local tincture stores will not last.",
    active:
      "Marsh fever has reached the crowded canals. Medicine is scarce, labor is failing, and families are fleeing.",
    ignored:
      "The fever burned itself out after a bitter season. Mallowfen lost workers and confidence in its harbor council.",
    intervention: {
      label: "Fund quarantine barges · 110 crowns",
      cost: 110,
      result:
        "Quarantine barges and paid healers contained the fever. Trade resumes under new public-health rules.",
    },
    activeModifiers: { price: 1.65, production: -0.4, consumption: 1.6 },
    resolvedModifiers: { price: 0.9, production: 0.2, consumption: 0.15 },
    ignoredModifiers: { price: 1.12, production: -0.15, consumption: 0.2 },
    resolvedRegional: { unrest: -12, labor: 0.05 },
    ignoredRegional: { unrest: 18, labor: -0.12, populationRate: -0.025 },
  }),
  delversCollapse: crisis({
    title: "The Delvers’ Reckoning",
    port: "Khaz Vhar",
    good: "iron",
    startDay: 39,
    activeDays: 9,
    warning:
      "Surveyors have condemned the oldest galleries, but foundry syndicates continue demanding record extraction.",
    active:
      "Three deep galleries have collapsed. Rescue crews need capital while iron production and the Amber Run seize up.",
    ignored:
      "The sealed galleries remain abandoned. Khaz Vhar survives, but its iron trade is permanently diminished.",
    intervention: {
      label: "Finance rescue and new supports · 140 crowns",
      cost: 140,
      result:
        "Your engineers reached the trapped delvers and installed safer supports. A modernized mine emerges from the disaster.",
    },
    activeModifiers: { price: 1.58, production: -2, consumption: 0.3 },
    resolvedModifiers: { price: 0.93, production: 0.45, consumption: 0 },
    ignoredModifiers: { price: 1.2, production: -0.4, consumption: 0 },
    resolvedRegional: { unrest: -16, infrastructure: 1 },
    ignoredRegional: { unrest: 20, labor: -0.1 },
  }),
});

function crisis(data) {
  return Object.freeze({
    ...data,
    intervention: Object.freeze(data.intervention),
    activeModifiers: Object.freeze(data.activeModifiers),
    resolvedModifiers: Object.freeze(data.resolvedModifiers),
    ignoredModifiers: Object.freeze(data.ignoredModifiers),
    resolvedRegional: Object.freeze(data.resolvedRegional),
    ignoredRegional: Object.freeze(data.ignoredRegional),
  });
}

export function createCrisisState() {
  return {
    arcs: Object.fromEntries(
      Object.entries(CRISIS_TEMPLATES).map(([id, template]) => [
        id,
        {
          id,
          phase: "dormant",
          startDay: template.startDay,
          activeDay: null,
          endDay: null,
          outcome: null,
        },
      ]),
    ),
  };
}

export function normalizeCrisisState(value) {
  const normalized = createCrisisState();
  if (!value || typeof value !== "object") return normalized;
  for (const [id, fresh] of Object.entries(normalized.arcs)) {
    const saved = value.arcs?.[id];
    if (!saved || typeof saved !== "object") continue;
    const phase = ["dormant", "warning", "active", "aftermath"].includes(
      saved.phase,
    )
      ? saved.phase
      : fresh.phase;
    fresh.phase = phase;
    fresh.startDay = Math.max(
      1,
      Math.floor(Number(saved.startDay ?? fresh.startDay)),
    );
    fresh.activeDay = finiteDay(saved.activeDay);
    fresh.endDay = finiteDay(saved.endDay);
    fresh.outcome =
      phase === "aftermath" && ["resolved", "ignored"].includes(saved.outcome)
        ? saved.outcome
        : null;
  }
  return normalized;
}

function finiteDay(value) {
  return Number.isFinite(Number(value))
    ? Math.max(1, Math.floor(Number(value)))
    : null;
}

export function advanceCrises(state, day) {
  const normalized = normalizeCrisisState(state);
  const transitions = [];
  for (const [id, arc] of Object.entries(normalized.arcs)) {
    const template = CRISIS_TEMPLATES[id];
    if (arc.phase === "dormant" && day >= arc.startDay) {
      arc.phase = "warning";
      arc.activeDay = arc.startDay + 3;
      transitions.push({ id, phase: "warning" });
    }
    if (arc.phase === "warning" && day >= arc.activeDay) {
      arc.phase = "active";
      arc.endDay = arc.activeDay + template.activeDays - 1;
      transitions.push({ id, phase: "active" });
    }
    if (arc.phase === "active" && day > arc.endDay) {
      arc.phase = "aftermath";
      arc.outcome = "ignored";
      transitions.push({ id, phase: "aftermath", outcome: "ignored" });
    }
  }
  return { state: normalized, transitions };
}

export function interveneInCrisis(state, id, coins, day) {
  const normalized = normalizeCrisisState(state);
  const arc = normalized.arcs[id];
  const template = CRISIS_TEMPLATES[id];
  if (!arc || !template)
    return { ok: false, reason: "Unknown regional crisis.", state: normalized };
  if (arc.phase !== "active")
    return {
      ok: false,
      reason: "This crisis cannot be influenced at present.",
      state: normalized,
    };
  if (coins < template.intervention.cost)
    return {
      ok: false,
      reason: "Not enough crowns to fund this intervention.",
      state: normalized,
    };
  arc.phase = "aftermath";
  arc.outcome = "resolved";
  arc.endDay = Math.max(arc.activeDay, Math.floor(day));
  return {
    ok: true,
    cost: template.intervention.cost,
    coins: coins - template.intervention.cost,
    state: normalized,
    arc,
    template,
  };
}

export function crisisAtPort(state, portName) {
  const normalized = normalizeCrisisState(state);
  return Object.values(normalized.arcs)
    .filter(
      (arc) =>
        arc.phase !== "dormant" && CRISIS_TEMPLATES[arc.id].port === portName,
    )
    .map((arc) => ({ ...arc, template: CRISIS_TEMPLATES[arc.id] }));
}

export function crisisEconomyModifiers(state, portName, good) {
  const modifiers = { price: 1, production: 0, consumption: 0 };
  for (const arc of crisisAtPort(state, portName)) {
    if (arc.template.good !== good || arc.phase === "warning") continue;
    const effect =
      arc.phase === "active"
        ? arc.template.activeModifiers
        : arc.outcome === "resolved"
          ? arc.template.resolvedModifiers
          : arc.template.ignoredModifiers;
    modifiers.price *= effect.price;
    modifiers.production += effect.production;
    modifiers.consumption += effect.consumption;
  }
  return modifiers;
}

export function applyCrisisAftermath(regionalState, template, outcome) {
  const effects =
    outcome === "resolved"
      ? template.resolvedRegional
      : template.ignoredRegional;
  regionalState.unrest = clamp(regionalState.unrest + effects.unrest, 0, 100);
  regionalState.labor = clamp(
    regionalState.labor + (effects.labor || 0),
    0.35,
    1.5,
  );
  regionalState.infrastructure = clamp(
    regionalState.infrastructure + (effects.infrastructure || 0),
    0,
    3,
  );
  regionalState.population = Math.max(
    1000,
    Math.round(regionalState.population * (1 + (effects.populationRate || 0))),
  );
  return regionalState;
}
