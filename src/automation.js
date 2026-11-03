import {
  chooseAutomationVoyage,
  createAutomationPilot,
  createAutomationSession,
} from "./core/automation.js";
import { planMarketOrder } from "./core/market-order.js";
import { canTrade, tradeQuote } from "./core/jurisdictions.js";
import { buyProvisions, repairOperations } from "./core/operations.js";

// Browser integration for the merchant policy. Every action goes through the
// same game functions as a player; the policy gets no money or physics boosts.
export function createGameAutomation(options, context) {
  const { game, ship, ports, world } = context;
  const pilot = createAutomationPilot(context.seaField);
  const visits = {};
  let destination = null;
  let voyage = null;
  let prepared = false;
  let bought = false;
  let nextPortAction = 0;
  let lastProgress = 0;
  let bestDistance = Infinity;
  let totalDistance = 0;
  let simulationSeconds = 0;
  let lastSteering = null;

  function quote(origin, port) {
    let best = { profit: 0, quantity: 0, key: null };
    for (const key of context.marketGoods(origin)) {
      const access = canTrade({
        state: game.legal,
        portName: port.name,
        good: key,
        status: context.legalStatus(port, key),
        day: game.day,
        units: 0,
      });
      if (!access.ok) continue;
      const sell = tradeQuote(
        context.sellPrice(port, key),
        context.legalStatus(port, key),
        "sell",
      );
      for (let quantity = 1; quantity <= game.holdMax; quantity++) {
        const order = planMarketOrder({
          direction: "buy",
          quantity,
          pricing: context.pricing(origin, key),
          legal: game.legal,
          status: context.legalStatus(origin, key),
          lots: game.cargoLots,
          coins: Math.max(0, game.coins - 40),
          holdUsed: context.cargoCount() + 4,
          holdMax: game.holdMax,
        });
        if (!order.ok) break;
        const profit = sell * quantity - order.total;
        if (profit > best.profit) best = { profit, key, quantity };
      }
    }
    return best;
  }

  function chooseVoyage(origin) {
    const offers = context.offers(origin);
    const candidates = ports.map((port) => {
      const offer = offers
        .filter((offer) => offer.destination === port.name)
        .sort((a, b) => b.reward - a.reward)[0];
      const active = game.activeContracts.filter(
        (contract) => contract.destination === port.name,
      );
      return {
        port,
        ...quote(origin, port),
        offer,
        reward:
          (offer?.reward || 0) + active.reduce((sum, c) => sum + c.reward, 0),
      };
    });
    while (candidates.length) {
      const candidate = chooseAutomationVoyage(
        origin,
        candidates,
        world.w,
        visits,
      );
      if (!candidate) break;
      if (pilot.plan(ship, candidate.port)) return candidate;
      candidates.splice(
        candidates.findIndex((c) => c.port === candidate.port),
        1,
      );
    }
    throw new Error(`No sea route available from ${origin.name}`);
  }

  function act(action) {
    if (!action || typeof action.type !== "string")
      return { ok: false, reason: "An action type is required." };
    const port = context.currentPort();
    switch (action.type) {
      case "steer":
        if (
          !Number.isFinite(action.angle) ||
          !Number.isFinite(action.power) ||
          action.power < 0 ||
          action.power > 1
        )
          return {
            ok: false,
            reason: "Use a finite angle and power from 0 to 1.",
          };
        context.steer(action.angle, action.power);
        return { ok: true };
      case "dock":
        if (
          port ||
          !context.nearPort() ||
          context.inCombat() ||
          context.inEncounter()
        )
          return { ok: false, reason: "No harbor in docking range." };
        context.dock();
        visits[context.currentPort().name] =
          (visits[context.currentPort().name] || 0) + 1;
        prepared = false;
        bought = false;
        voyage = null;
        destination = null;
        return { ok: true, port: context.currentPort().name };
      case "depart":
        if (!port) return { ok: false, reason: "Not docked." };
        context.depart();
        return { ok: true, port: port.name };
      case "trade":
        return context.trade(action.key, action.direction, action.quantity);
      case "contract": {
        if (
          !port ||
          !context.offers(port).some((offer) => offer.id === action.id)
        )
          return { ok: false, reason: "Commission unavailable." };
        context.accept(action.id);
        return { ok: true, id: action.id };
      }
      case "supply": {
        if (!port) return { ok: false, reason: "Dock before buying supplies." };
        const provisions = buyProvisions(
          game.operations,
          game.coins,
          Math.max(0, 18 - game.operations.provisions),
        );
        const repair = repairOperations(
          provisions.operations,
          Math.max(0, provisions.coins - 40),
        );
        game.operations = repair.operations;
        game.coins = repair.coins + Math.min(40, provisions.coins);
        if (repair.repaired > 0) game.operations.patchedDay = game.day;
        context.refresh();
        return {
          ok: true,
          purchased: provisions.purchased,
          repaired: repair.repaired,
        };
      }
      case "combat":
        if (
          !context.inCombat() ||
          !["fight", "flee", "parley", "surrender"].includes(action.action)
        )
          return {
            ok: false,
            reason: "Choose fight, flee, parley, or surrender during combat.",
          };
        context.combat(action.action);
        return { ok: true, action: action.action };
      case "course": {
        const port = ports.find((port) => port.name === action.port);
        if (!port || !pilot.plan(ship, port))
          return { ok: false, reason: "No sea route to that port." };
        destination = port;
        bestDistance = Infinity;
        lastProgress = simulationSeconds;
        context.course(port.name);
        return { ok: true, port: port.name };
      }
      default:
        return { ok: false, reason: `Unknown action: ${action.type}` };
    }
  }

  function decide(seconds) {
    if (context.inEncounter()) return null;
    if (context.inCombat()) return { type: "combat", action: "flee" };
    const port = context.currentPort();
    if (port) {
      if (seconds < nextPortAction) return null;
      nextPortAction = seconds + 0.5;
      // Sell each legal holding before making the next voyage's budget.
      for (const [key, quantity] of Object.entries(voyage ? {} : game.cargo)) {
        if (
          quantity &&
          canTrade({
            state: game.legal,
            portName: port.name,
            good: key,
            status: context.legalStatus(port, key),
            day: game.day,
            units: quantity,
          }).ok
        )
          return { type: "trade", key, quantity, direction: "sell" };
      }
      if (!prepared) {
        prepared = true;
        return { type: "supply" };
      }
      if (!voyage) {
        voyage = chooseVoyage(port);
        destination = voyage.port;
        bestDistance = Infinity;
        lastProgress = seconds;
        context.course(destination.name);
        if (voyage.offer) return { type: "contract", id: voyage.offer.id };
      }
      if (!bought && voyage.quantity) {
        bought = true;
        return {
          type: "trade",
          key: voyage.key,
          quantity: voyage.quantity,
          direction: "buy",
        };
      }
      return { type: "depart" };
    }
    if (
      (!destination && context.nearPort()) ||
      context.nearPort()?.name === destination?.name
    )
      return { type: "dock" };
    if (!destination) {
      const nearest = [...ports].sort(
        (a, b) => context.distance(ship, a) - context.distance(ship, b),
      )[0];
      return { type: "course", port: nearest.name };
    }
    const distance = context.distance(ship, destination);
    if (distance < bestDistance - 10) {
      bestDistance = distance;
      lastProgress = seconds;
    }
    if (seconds - lastProgress > 90)
      throw new Error(`Autopilot stalled en route to ${destination.name}`);
    const steering = pilot.steer(ship);
    if (!steering) throw new Error(`No pilot course to ${destination.name}`);
    // Steering is an input, sampled each tick, rather than thousands of events.
    lastSteering = steering;
    context.steer(steering.angle, steering.power);
    return null;
  }

  return createAutomationSession(options, {
    act,
    decide,
    advance(dt, seconds) {
      simulationSeconds = seconds + dt;
      const before = { x: ship.x, y: ship.y };
      context.advance(dt, seconds);
      totalDistance += context.distance(before, ship);
    },
    observe: () => ({
      policy: "merchant",
      destination: destination?.name || null,
      steering: lastSteering,
      metrics: {
        distance: totalDistance,
        visits,
        coins: game.coins,
        day: game.day,
        completedContracts: game.completedContracts,
        failedContracts: game.failedContracts,
        condition: game.operations.condition,
        provisions: game.operations.provisions,
      },
      game,
      ship,
      currentPort: context.currentPort()?.name || null,
      nearPort: context.nearPort()?.name || null,
      inCombat: context.inCombat(),
      ports: ports.map((port) => ({ name: port.name, x: port.x, y: port.y })),
      world,
    }),
    render: context.render,
  });
}
