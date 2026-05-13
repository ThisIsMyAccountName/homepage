import { generatorCost } from "../engine/formulas.js";

export function createGeneratorSystem({ state, generatorDefs, resourceManager, eventBus }) {
  function buy(generatorId) {
    const def = generatorDefs[generatorId];
    if (!def) {
      return { ok: false, reason: "Unknown generator." };
    }

    const level = state.generators[generatorId] || 0;
    const cost = generatorCost(def, level, state.perks.generatorCostGrowthMultiplier);

    if (!resourceManager.spend(def.costResource, cost)) {
      return { ok: false, reason: `Not enough ${def.costResource}.` };
    }

    state.generators[generatorId] = level + 1;
    eventBus.emit("generator:purchased", { generatorId, newLevel: level + 1, cost });
    return { ok: true };
  }

  return { buy };
}
