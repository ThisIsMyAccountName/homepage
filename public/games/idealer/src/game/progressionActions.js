import { BALANCE } from "../config/gameBalance.js";
import { ascendCost, ascendShardGainFromResources } from "../engine/formulas.js";

export function createProgressionActions({ state, resourceManager, eventBus, recompute, expeditionSystem }) {
  function manualTransmute() {
    const base = BALANCE.baseClickMatter + state.perks.clickMatterBonus;
    let amount = base * state.perks.clickMultiplier;
    if (state.perks.clickCritChance > 0 && Math.random() < state.perks.clickCritChance) {
      amount *= state.perks.clickCritMultiplier;
    }
    resourceManager.add("matter", amount);
    if (state.perks.clickFireBonus > 0) {
      resourceManager.add("fire", state.perks.clickFireBonus);
    }
    state.lifetime.totalClicks += 1;
    eventBus.emit("action:transmute", { amount });
  }

  function convertMatterToFire() {
    const costBase = BALANCE.elementConversionCost * state.perks.conversionCostMultiplier;
    const cost = Math.max(1, Math.floor(costBase - state.perks.conversionCostFlatReduction));
    if (!resourceManager.spend("matter", cost)) {
      return { ok: false, reason: `Need ${cost} Matter.` };
    }
    const out = (1 + state.perks.conversionFireBonus) * state.perks.conversionYieldMultiplier;
    resourceManager.add("fire", out);
    if (state.perks.conversionRefundFraction > 0) {
      const refund = Math.floor(cost * state.perks.conversionRefundFraction);
      if (refund > 0) {
        resourceManager.add("matter", refund);
      }
    }
    eventBus.emit("action:convert", { cost, out });
    return { ok: true };
  }

  function ascend() {
    const cost = ascendCost(state);
    if (state.resources.matter < cost.matterCost || state.resources.fire < cost.fireCost) {
      return { ok: false, reason: "Need more Matter and Fire." };
    }
    const gain = Math.max(1, ascendShardGainFromResources(state));

    state.resources.shards += gain;
    state.lifetime.totalAscensions += 1;

    state.resources.matter = 0;
    state.resources.fire = 0;
    Object.keys(state.generators).forEach((key) => {
      state.generators[key] = 0;
    });

    state.upgrades = {};
    state.research = {};
    if (expeditionSystem?.handleAscendReset) {
      expeditionSystem.handleAscendReset();
    }
    if (typeof recompute === "function") {
      recompute();
    }

    eventBus.emit("action:ascend", { gain, total: state.resources.shards, cost });
    return { ok: true, gain };
  }

  return { manualTransmute, convertMatterToFire, ascend };
}
