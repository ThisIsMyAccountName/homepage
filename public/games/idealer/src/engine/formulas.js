import { BALANCE } from "../config/gameBalance.js";

export function resolveGeneratorCostGrowth(costGrowthMultiplier = 1) {
  const parsedMultiplier = Number(costGrowthMultiplier);
  const safeMultiplier = Number.isFinite(parsedMultiplier) ? parsedMultiplier : 1;
  const normalizedMultiplier = Math.max(0, safeMultiplier);
  const growthDelta = Math.max(0, BALANCE.generatorCostGrowth - 1);
  const growth = 1 + growthDelta * normalizedMultiplier;
  return Math.max(1.01, growth);
}

export function generatorCost(generatorDef, level, costGrowthMultiplier = 1) {
  const growth = resolveGeneratorCostGrowth(costGrowthMultiplier);
  const rawCost = generatorDef.baseCost * (Math.pow(growth, level + 1) / BALANCE.generatorCostGrowth);
  return Math.max(0.01, Math.round(rawCost * 100) / 100);
}

export function normalizeUpgradeCostCurve(def, curveOverride) {
  const defaults = BALANCE.upgradeCostDefaults || {};
  const defCurve = def && def.costCurve ? def.costCurve : {};
  return {
    quadCap: defaults.quadCap ?? 35,
    quadScale: defaults.quadScale ?? 0.015,
    targetEnd: defaults.targetEnd ?? 1e31,
    unlockCostFactor: defaults.unlockCostFactor ?? 1,
    autoBalance: defaults.autoBalance ?? true,
    ...defCurve,
    ...(curveOverride || {})
  };
}

export function upgradeCost(def, tier, baseCostOverride, curveOverride) {
  const baseCost = baseCostOverride ?? def.baseCost ?? def.cost ?? 1;
  const curve = normalizeUpgradeCostCurve(def, curveOverride);
  const maxTier = Math.max(1, def.maxTier ?? 1);
  const lastTierIndex = Math.max(0, maxTier - 1);
  const quadCap = Math.min(curve.quadCap, lastTierIndex);
  const quadMultiplier = 1 + curve.quadScale * Math.pow(tier + 1, 2);
  const quadMultiplierCap = 1 + curve.quadScale * Math.pow(quadCap + 1, 2);

  if (tier <= quadCap) {
    return Math.floor(baseCost * quadMultiplier);
  }

  const expSteps = Math.max(1, lastTierIndex - quadCap);
  const targetEnd = Math.max(baseCost * quadMultiplierCap, curve.targetEnd);
  const expBaseRaw = Math.pow(targetEnd / (baseCost * quadMultiplierCap), 1 / expSteps);
  const expBase = Math.max(1.02, expBaseRaw);
  const expTier = tier - quadCap;
  return Math.floor(baseCost * quadMultiplierCap * Math.pow(expBase, expTier));
}

export function productionPerSecond(state, generatorDefs) {
  const rates = {
    matter: 0,
    fire: 0
  };

  Object.values(generatorDefs).forEach((def) => {
    const level = state.generators[def.id] || 0;
    if (level <= 0) {
      return;
    }
    let rate = def.baseRate * level;
    if (def.id === "furnace") {
      rate *= state.perks.furnaceRateMultiplier || 1;
    }
    if (def.id === "condenser") {
      rate *= state.perks.condenserRateMultiplier || 1;
    }
    if (def.id === "prism") {
      rate *= state.perks.prismRateMultiplier || 1;
    }
    rates[def.resource] += rate;
  });

  rates.matter *= state.perks.productionMultiplier * state.perks.matterRateMultiplier;
  rates.fire *= state.perks.productionMultiplier * state.perks.fireRateMultiplier;
  return rates;
}

export function prestigeShardGain(state) {
  const sumSeen = state.lifetime.matterSeen + state.lifetime.fireSeen * 100;
  const raw = Math.floor(Math.sqrt(sumSeen) / BALANCE.prestigeDivisor);
  return Math.floor(raw * state.perks.prestigeGainMultiplier);
}

export function ascendCost(state) {
  const count = state.lifetime.totalAscensions;
  return {
    matterCost: Math.floor(BALANCE.ascendBaseMatter * Math.pow(BALANCE.ascendCostGrowth, count)),
    fireCost: Math.floor(BALANCE.ascendBaseFire * Math.pow(BALANCE.ascendCostGrowth, count))
  };
}

export function ascendShardGainFromResources(state) {
  const matterLost = state.resources.matter;
  const fireLost = state.resources.fire;
  const base = matterLost + fireLost * BALANCE.fireShardValue;
  const raw = Math.floor(Math.sqrt(base) / BALANCE.prestigeDivisor);
  return Math.floor(raw * state.perks.prestigeGainMultiplier);
}
