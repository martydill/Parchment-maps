import { normalizeCrewState, takeShoreLeave } from "./crew.js";
import { processWages } from "./operations.js";
import { clamp } from "./math.js";

export function crewReadiness(operations) {
  const groups = Object.values(normalizeCrewState(operations.crew).groups);
  const count = groups.reduce((sum, group) => sum + group.count, 0);
  const fatigue = count
    ? groups.reduce((sum, group) => sum + group.fatigue * group.count, 0) /
      count
    : 0;
  const morale = clamp(Number(operations.morale) || 0, 0, 100);
  return { morale, fatigue, needsRest: morale < 35 || fatigue > 60 };
}

// Preview uses the same leave and wage rules as the eventual player action.
export function previewShoreLeave(operations, coins, day, contracts = []) {
  const leave = takeShoreLeave(operations.crew, Number.MAX_SAFE_INTEGER);
  const afterLeave = {
    ...operations,
    crew: leave.crew,
    morale: Math.min(100, operations.morale + 8),
  };
  const wages = processWages(
    afterLeave,
    day + leave.days,
    Math.max(0, coins - leave.cost),
  );
  return {
    ok: coins >= leave.cost,
    cost: leave.cost,
    days: leave.days,
    operations: afterLeave,
    coinsAfter: wages.coins,
    wages: wages.paid,
    unpaidWages: wages.missed,
    moraleAfter: wages.operations.morale,
    fatigueAfter: crewReadiness(afterLeave).fatigue,
    urgentContracts: contracts
      .filter((contract) => contract.deadline <= day + leave.days)
      .map((contract) => contract.title),
  };
}
