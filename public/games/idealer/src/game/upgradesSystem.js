import { normalizeUpgradeCostCurve, upgradeCost } from "../engine/formulas.js";

export function createUpgradesSystem({ state, upgradeDefs, upgradeOrder, resourceManager, eventBus, recompute }) {
  const order = Array.isArray(upgradeOrder) && upgradeOrder.length
    ? upgradeOrder
    : Object.keys(upgradeDefs);
  const orderIndex = new Map(order.map((id, index) => [id, index]));
  const baseCosts = computeBaseCosts();

  function getTier(upgradeId) {
    return Math.max(0, Math.floor(Number(state.upgrades[upgradeId]) || 0));
  }

  function getMaxTier(upgradeId) {
    const def = upgradeDefs[upgradeId];
    return Math.max(1, def?.maxTier ?? 1);
  }

  function totalTiersBeforeIndex(index) {
    let total = 0;
    for (let i = 0; i < index; i += 1) {
      total += getTier(order[i]);
    }
    return total;
  }

  function unlockRequirement(index) {
    return Math.floor((index * (index + 1)) / 2);
  }

  function getUnlockInfo(upgradeId) {
    const index = orderIndex.get(upgradeId);
    if (index === undefined) {
      return { requiredTotal: 0, currentTotal: 0 };
    }
    return {
      requiredTotal: unlockRequirement(index),
      currentTotal: totalTiersBeforeIndex(index)
    };
  }

  function isUnlocked(upgradeId) {
    const def = upgradeDefs[upgradeId];
    if (!def) {
      return false;
    }
    const index = orderIndex.get(upgradeId);
    if (index === undefined) {
      return false;
    }
    const { requiredTotal, currentTotal } = getUnlockInfo(upgradeId);
    return currentTotal >= requiredTotal;
  }

  function getCost(upgradeId) {
    const def = upgradeDefs[upgradeId];
    if (!def) {
      return 0;
    }
    const tier = getTier(upgradeId);
    return upgradeCost(def, tier, baseCosts[upgradeId]);
  }

  function buy(upgradeId) {
    const def = upgradeDefs[upgradeId];
    if (!def) {
      return { ok: false, reason: "Unknown upgrade." };
    }

    const tier = getTier(upgradeId);
    const maxTier = getMaxTier(upgradeId);
    if (tier >= maxTier) {
      return { ok: false, reason: "Upgrade at max tier." };
    }
    if (!isUnlocked(upgradeId)) {
      return { ok: false, reason: "Upgrade not unlocked yet." };
    }

    const cost = getCost(upgradeId);
    if (!resourceManager.spend(def.costResource, cost)) {
      return { ok: false, reason: `Not enough ${def.costResource}.` };
    }

    state.upgrades[upgradeId] = tier + 1;
    recompute();
    eventBus.emit("upgrade:purchased", { upgradeId, tier: tier + 1 });
    return { ok: true };
  }

  function computeBaseCosts() {
    const result = {};
    order.forEach((id, index) => {
      const def = upgradeDefs[id];
      if (!def) {
        return;
      }
      const curve = normalizeUpgradeCostCurve(def);
      const rawBase = def.baseCost ?? def.cost ?? 1;
      if (!curve.autoBalance || index === 0) {
        result[id] = Math.max(1, rawBase);
        return;
      }
      const requirement = unlockRequirement(index);
      const unlockCost = estimateUnlockCost(requirement, order.slice(0, index), result);
      const tuned = Math.max(1, Math.floor(unlockCost * curve.unlockCostFactor));
      result[id] = tuned;
    });
    return result;
  }

  function estimateUnlockCost(requirement, priorIds, baseCostMap) {
    if (requirement <= 0 || priorIds.length === 0) {
      return 1;
    }
    const tiers = {};
    priorIds.forEach((id) => {
      tiers[id] = 0;
    });

    let totalCost = 0;
    for (let i = 0; i < requirement; i += 1) {
      let cheapestId = priorIds[0];
      let cheapestCost = Number.POSITIVE_INFINITY;
      priorIds.forEach((id) => {
        const def = upgradeDefs[id];
        const tier = tiers[id] || 0;
        const cost = upgradeCost(def, tier, baseCostMap[id]);
        if (cost < cheapestCost) {
          cheapestCost = cost;
          cheapestId = id;
        }
      });
      totalCost += cheapestCost;
      tiers[cheapestId] = (tiers[cheapestId] || 0) + 1;
    }
    return totalCost;
  }

  return { buy, isUnlocked, getCost, getTier, getMaxTier, getUnlockInfo };
}
