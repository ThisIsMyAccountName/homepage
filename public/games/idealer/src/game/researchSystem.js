export function researchCost(def, currentLevel, costMultiplier = 1, costDefaults, baseCostOverride) {
  const baseCost = baseCostOverride ?? def.baseCost ?? 1;
  const defaults = costDefaults || {};
  const defCurve = def.costCurve || {};
  const curve = {
    quadCap: defaults.quadCap ?? 2,
    quadScale: defaults.quadScale ?? 0.05,
    targetEnd: defaults.targetEnd ?? 240,
    ...defCurve
  };
  const maxLevel = Math.max(1, def.maxLevel ?? 1);
  const lastIndex = Math.max(0, maxLevel - 1);
  const quadCap = Math.min(curve.quadCap, lastIndex);
  const quadMultiplier = 1 + curve.quadScale * Math.pow(currentLevel + 1, 2);
  const quadMultiplierCap = 1 + curve.quadScale * Math.pow(quadCap + 1, 2);

  let cost;
  if (currentLevel <= quadCap) {
    cost = baseCost * quadMultiplier;
  } else {
    const expSteps = Math.max(1, lastIndex - quadCap);
    const targetEnd = Math.max(baseCost * quadMultiplierCap, curve.targetEnd);
    const expBaseRaw = Math.pow(targetEnd / (baseCost * quadMultiplierCap), 1 / expSteps);
    const expBase = Math.max(1.05, expBaseRaw);
    const expTier = currentLevel - quadCap;
    cost = baseCost * quadMultiplierCap * Math.pow(expBase, expTier);
  }

  return Math.floor(cost * costMultiplier);
}

export function createResearchSystem({ state, researchDefs, researchOrder, costDefaults, resourceManager, eventBus, recompute }) {
  const researchCostDefaults = costDefaults || {};
  const order = Array.isArray(researchOrder) && researchOrder.length
    ? researchOrder
    : Object.keys(researchDefs);
  const orderIndex = new Map(order.map((id, index) => [id, index]));
  const baseCosts = computeBaseCosts();

  function hasPriorLevels(researchId) {
    const index = orderIndex.get(researchId);
    if (index === undefined) {
      return false;
    }
    for (let i = 0; i < index; i += 1) {
      const priorId = order[i];
      const level = state.research[priorId] || 0;
      if (level < 1) {
        return false;
      }
    }
    return true;
  }

  function getUnlockInfo(researchId) {
    const index = orderIndex.get(researchId);
    if (index === undefined) {
      return { requiredTotal: 0, currentTotal: 0 };
    }
    let currentTotal = 0;
    for (let i = 0; i < index; i += 1) {
      const priorId = order[i];
      const level = state.research[priorId] || 0;
      if (level >= 1) {
        currentTotal += 1;
      }
    }
    return {
      requiredTotal: index,
      currentTotal
    };
  }

  function isUnlocked(researchId) {
    const def = researchDefs[researchId];
    if (!def) {
      return false;
    }
    return hasPriorLevels(researchId);
  }

  function levelUp(researchId) {
    const def = researchDefs[researchId];
    if (!def) {
      return { ok: false, reason: "Unknown research." };
    }

    const currentLevel = state.research[researchId] || 0;
    if (currentLevel >= def.maxLevel) {
      return { ok: false, reason: "Research at max level." };
    }
    if (!isUnlocked(researchId)) {
      return { ok: false, reason: "Research not unlocked yet." };
    }

    const cost = researchCost(
      def,
      currentLevel,
      state.perks.researchCostMultiplier,
      researchCostDefaults,
      baseCosts[researchId]
    );
    if (!resourceManager.spend(def.costResource, cost)) {
      return { ok: false, reason: `Need ${cost} ${def.costResource}.` };
    }

    state.research[researchId] = currentLevel + 1;
    recompute();
    eventBus.emit("research:leveled", { researchId, level: currentLevel + 1 });
    return { ok: true };
  }

  function getCost(researchId) {
    const def = researchDefs[researchId];
    if (!def) {
      return 0;
    }
    const currentLevel = state.research[researchId] || 0;
    return researchCost(
      def,
      currentLevel,
      state.perks.researchCostMultiplier,
      researchCostDefaults,
      baseCosts[researchId]
    );
  }

  function computeBaseCosts() {
    const result = {};
    const baseScalePerIndex = researchCostDefaults.baseScalePerIndex ?? 0.25;
    const baseScaleExponent = researchCostDefaults.baseScaleExponent ?? 1;
    order.forEach((id, index) => {
      const def = researchDefs[id];
      if (!def) {
        return;
      }
      const defCurve = def.costCurve || {};
      const autoBalance = defCurve.autoBalance ?? researchCostDefaults.autoBalance ?? true;
      const scalePerIndex = defCurve.baseScalePerIndex ?? baseScalePerIndex;
      const scaleExponent = defCurve.baseScaleExponent ?? baseScaleExponent;
      const rawBase = def.baseCost ?? 1;
      if (!autoBalance || index === 0) {
        result[id] = rawBase;
        return;
      }
      const multiplier = Math.pow(1 + index * scalePerIndex, scaleExponent);
      result[id] = Math.max(1, Math.floor(rawBase * multiplier));
    });
    return result;
  }

  return { levelUp, isUnlocked, getUnlockInfo, getCost };
}
