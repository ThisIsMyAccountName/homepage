import { isUnlockMet } from "./unlockRules.js";

function hasBlueprint(state, blueprintId) {
  return (state.expeditions.blueprintInventory[blueprintId] || 0) > 0;
}

function ensureShip(state, shipId) {
  const ship = state.expeditions.ships[shipId];
  return ship && typeof ship === "object" ? ship : null;
}

export function createShipSystem({ state, balance, resourceManager, eventBus }) {
  const expeditionBalance = balance.expeditions || {};
  const shipDefs = expeditionBalance.ships || {};
  const shipTierOrder = Object.keys(shipDefs);
  const facilityDefs = expeditionBalance.shipFacilities || {};
  function isPartDropDefinition(entry) {
    if (!entry || typeof entry !== "object" || entry.blueprintForShip) {
      return false;
    }
    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    const slot = typeof entry.slot === "string" ? entry.slot.trim() : "";
    return Boolean(id && slot);
  }
  const partDefs = Object.values(expeditionBalance.rareBlueprintDrops || {})
    .flat()
    .filter((entry) => isPartDropDefinition(entry))
    .reduce((map, entry) => {
      map[entry.id] = entry;
      return map;
    }, {});
  const PART_TIER_SUFFIX_RE = /@t(\d+)$/i;

  function getFusionSettings() {
    const raw = expeditionBalance.partFusion && typeof expeditionBalance.partFusion === "object"
      ? expeditionBalance.partFusion
      : {};
    return {
      baseMaxTier: Math.max(1, Math.floor(Number(raw.baseMaxTier) || 6)),
      linearEffectPerTier: Math.max(0, Number(raw.linearEffectPerTier) || 0.2),
      maxTierBonusPerk: typeof raw.maxTierBonusPerk === "string" && raw.maxTierBonusPerk
        ? raw.maxTierBonusPerk
        : "partTierCapBonus",
      partScaleOverrides: raw.partScaleOverrides && typeof raw.partScaleOverrides === "object"
        ? raw.partScaleOverrides
        : {},
      partMaxTierOverrides: raw.partMaxTierOverrides && typeof raw.partMaxTierOverrides === "object"
        ? raw.partMaxTierOverrides
        : {}
    };
  }

  function createPartRef(partId, tier = 1) {
    const cleanPartId = typeof partId === "string" ? partId.trim() : "";
    if (!cleanPartId) {
      return "";
    }
    const safeTier = Math.max(1, Math.floor(Number(tier) || 1));
    return safeTier <= 1 ? cleanPartId : `${cleanPartId}@t${safeTier}`;
  }

  function parsePartRef(partRef) {
    if (typeof partRef !== "string") {
      return null;
    }
    const raw = partRef.trim();
    if (!raw) {
      return null;
    }
    const suffixMatch = raw.match(PART_TIER_SUFFIX_RE);
    if (!suffixMatch) {
      return {
        raw,
        partId: raw,
        tier: 1,
        ref: raw
      };
    }
    const partId = raw.slice(0, suffixMatch.index);
    if (!partId) {
      return null;
    }
    const tier = Math.max(1, Math.floor(Number(suffixMatch[1]) || 1));
    return {
      raw,
      partId,
      tier,
      ref: createPartRef(partId, tier)
    };
  }

  function normalizePartInventory() {
    const source = state.expeditions.partInventory && typeof state.expeditions.partInventory === "object"
      ? state.expeditions.partInventory
      : {};
    const normalized = {};
    Object.entries(source).forEach(([rawRef, value]) => {
      const parsed = parsePartRef(rawRef);
      if (!parsed) {
        return;
      }
      const count = Math.max(0, Math.floor(Number(value) || 0));
      if (count <= 0) {
        return;
      }
      normalized[parsed.ref] = (normalized[parsed.ref] || 0) + count;
    });
    state.expeditions.partInventory = normalized;
    return normalized;
  }

  function getGlobalPartTierCapBonus() {
    const settings = getFusionSettings();
    const perkKey = settings.maxTierBonusPerk;
    return Math.max(0, Math.floor(Number(state.perks?.[perkKey]) || 0));
  }

  function getPartFusionCap(partId) {
    const settings = getFusionSettings();
    const globalCap = settings.baseMaxTier + getGlobalPartTierCapBonus();
    const override = Math.max(0, Math.floor(Number(settings.partMaxTierOverrides?.[partId]) || 0));
    const resolved = override > 0 ? override : globalCap;
    return Math.max(1, Math.min(99, resolved));
  }

  function getPartTierScale(partId, tier) {
    const settings = getFusionSettings();
    const override = Number(settings.partScaleOverrides?.[partId]);
    const linearStep = Number.isFinite(override) ? Math.max(0, override) : settings.linearEffectPerTier;
    const safeTier = Math.max(1, Math.floor(Number(tier) || 1));
    return 1 + (safeTier - 1) * linearStep;
  }

  function getFacilitySpec(shipId, facilityId) {
    const base = facilityDefs[facilityId];
    if (!base) {
      return null;
    }
    const shipProfile = shipDefs?.[shipId]?.facilityProfile?.[facilityId] || {};
    const facilityCapBonus = Math.max(0, Math.floor(Number(state.perks?.facilityMaxLevelBonus) || 0));
    const baseMaxLevel = Math.max(1, Math.floor(Number(shipProfile.maxLevel) || Number(base.maxLevel) || 1));
    return {
      ...base,
      maxLevel: Math.max(1, Math.min(99, baseMaxLevel + facilityCapBonus)),
      effectsPerLevel: {
        ...(base.effectsPerLevel || {}),
        ...(shipProfile.effectsPerLevel || {})
      }
    };
  }

  function getShipTierCostMultiplier(shipId) {
    const tierIndex = shipTierOrder.indexOf(shipId);
    const tier = tierIndex >= 0 ? tierIndex + 1 : 1;
    return 1 + (tier - 1) * 0.85;
  }

  function scaleFacilityCost(cost, shipId) {
    const multiplier = getShipTierCostMultiplier(shipId);
    return {
      matter: Math.max(0, Math.floor((Number(cost?.matter) || 0) * multiplier)),
      fire: Math.max(0, Math.floor((Number(cost?.fire) || 0) * multiplier)),
      intel: Math.max(0, Math.ceil((Number(cost?.intel) || 0) * multiplier))
    };
  }

  function getFacilityUpgradeCost(shipId, facilityId, levelHint = null) {
    const facilityDef = getFacilitySpec(shipId, facilityId);
    if (!facilityDef) {
      return null;
    }
    const shipState = ensureShip(state, shipId);
    const resolvedLevel = levelHint === null
      ? Math.max(0, Math.floor(Number(shipState?.facilities?.[facilityId]) || 0))
      : Math.max(0, Math.floor(Number(levelHint) || 0));
    const rawLevelCosts = Array.isArray(facilityDef.levelCosts) ? facilityDef.levelCosts : [];
    if (rawLevelCosts.length === 0) {
      return null;
    }

    const tail = rawLevelCosts[Math.max(0, rawLevelCosts.length - 1)] || { matter: 0, fire: 0, intel: 0 };
    const extraLevels = Math.max(0, resolvedLevel - (rawLevelCosts.length - 1));
    const baseCost = extraLevels <= 0
      ? rawLevelCosts[resolvedLevel]
      : {
        matter: Math.floor((Number(tail.matter) || 0) * Math.pow(1.55, extraLevels)),
        fire: Math.floor((Number(tail.fire) || 0) * Math.pow(1.52, extraLevels)),
        intel: Math.ceil((Number(tail.intel) || 0) * Math.pow(1.45, extraLevels))
      };
    if (!baseCost) {
      return null;
    }
    return scaleFacilityCost(baseCost, shipId);
  }

  function getEquippedPartCounts() {
    const counts = {};
    Object.values(state.expeditions.ships || {}).forEach((ship) => {
      Object.values(ship?.equippedParts || {}).forEach((rawRef) => {
        const parsed = parsePartRef(rawRef);
        if (!parsed) {
          return;
        }
        counts[parsed.ref] = (counts[parsed.ref] || 0) + 1;
      });
    });
    return counts;
  }

  function getPartAvailability(partRef) {
    const inventory = normalizePartInventory();
    const parsed = parsePartRef(partRef);
    if (!parsed) {
      return { total: 0, equipped: 0, available: 0, ref: "" };
    }
    const equippedCounts = getEquippedPartCounts();
    const total = Math.max(0, Number(inventory[parsed.ref]) || 0);
    const equipped = Math.max(0, Number(equippedCounts[parsed.ref]) || 0);
    return {
      total,
      equipped,
      available: Math.max(0, total - equipped),
      ref: parsed.ref
    };
  }

  function getCombineInfo(partRef) {
    const parsed = parsePartRef(partRef);
    if (!parsed) {
      return { ok: false, reason: "Unknown part reference." };
    }
    const part = partDefs[parsed.partId];
    if (!part) {
      return { ok: false, reason: "Unknown part." };
    }
    const maxTier = getPartFusionCap(parsed.partId);
    if (parsed.tier >= maxTier) {
      return {
        ok: false,
        reason: `Tier cap reached (T${maxTier}).`,
        partId: parsed.partId,
        tier: parsed.tier,
        maxTier,
        fromRef: parsed.ref,
        toRef: parsed.ref,
        nextTier: parsed.tier
      };
    }
    const availability = getPartAvailability(parsed.ref);
    if (availability.available < 2) {
      return {
        ok: false,
        reason: "Need 2 unequipped copies of this part tier.",
        partId: parsed.partId,
        tier: parsed.tier,
        maxTier,
        fromRef: parsed.ref,
        toRef: createPartRef(parsed.partId, parsed.tier + 1),
        nextTier: parsed.tier + 1,
        available: availability.available,
        required: 2
      };
    }
    return {
      ok: true,
      partId: parsed.partId,
      tier: parsed.tier,
      maxTier,
      fromRef: parsed.ref,
      toRef: createPartRef(parsed.partId, parsed.tier + 1),
      nextTier: parsed.tier + 1,
      available: availability.available,
      required: 2
    };
  }

  function combinePart(partRef) {
    const combineInfo = getCombineInfo(partRef);
    if (!combineInfo.ok) {
      return combineInfo;
    }

    const inventory = normalizePartInventory();
    const fromCount = Math.max(0, Number(inventory[combineInfo.fromRef]) || 0);
    if (fromCount < 2) {
      return { ok: false, reason: "Not enough parts available for fusion." };
    }

    const remaining = fromCount - 2;
    if (remaining > 0) {
      inventory[combineInfo.fromRef] = remaining;
    } else {
      delete inventory[combineInfo.fromRef];
    }
    inventory[combineInfo.toRef] = Math.max(0, Number(inventory[combineInfo.toRef]) || 0) + 1;

    eventBus.emit("ship:partCombined", {
      partId: combineInfo.partId,
      fromRef: combineInfo.fromRef,
      toRef: combineInfo.toRef,
      fromTier: combineInfo.tier,
      toTier: combineInfo.nextTier
    });

    return {
      ok: true,
      ...combineInfo,
      remainingFromCount: Math.max(0, Number(inventory[combineInfo.fromRef]) || 0),
      toCount: Math.max(0, Number(inventory[combineInfo.toRef]) || 0)
    };
  }

  function getShipStats(shipId) {
    normalizePartInventory();
    const shipState = ensureShip(state, shipId);
    const shipDef = shipDefs[shipId];
    if (!shipState || !shipDef) {
      return null;
    }

    const stats = {
      speedMultiplier: shipDef.baseStats?.speedMultiplier || 1,
      riskMitigation: shipDef.baseStats?.riskMitigation || 0,
      yieldMultiplier: shipDef.baseStats?.yieldMultiplier || 1,
      penaltyDampening: shipDef.baseStats?.penaltyDampening || 0,
      rareDropWeight: shipDef.baseStats?.rareDropWeight || 1
    };

    Object.entries(shipState.facilities || {}).forEach(([facilityId, level]) => {
      const def = getFacilitySpec(shipId, facilityId);
      if (!def || !def.effectsPerLevel) {
        return;
      }
      const n = Math.max(0, Math.min(Math.floor(Number(level) || 0), Number(def.maxLevel) || 0));
      stats.speedMultiplier *= 1 + (def.effectsPerLevel.speedMultiplier || 0) * n;
      stats.yieldMultiplier *= 1 + (def.effectsPerLevel.yieldMultiplier || 0) * n;
      stats.rareDropWeight *= 1 + (def.effectsPerLevel.rareDropWeight || 0) * n;
      stats.riskMitigation += (def.effectsPerLevel.riskMitigation || 0) * n;
      stats.penaltyDampening += (def.effectsPerLevel.penaltyDampening || 0) * n;
    });

    Object.entries(shipState.equippedParts || {}).forEach(([slotId, rawRef]) => {
      const parsed = parsePartRef(rawRef);
      if (!parsed) {
        return;
      }
      const part = partDefs[parsed.partId];
      if (!part || part.slot !== slotId) {
        return;
      }
      const scale = getPartTierScale(parsed.partId, parsed.tier);
      const effects = part.effects || {};
      stats.speedMultiplier *= 1 + (effects.speedMultiplier || 0) * scale;
      stats.yieldMultiplier *= 1 + (effects.yieldMultiplier || 0) * scale;
      stats.rareDropWeight *= 1 + (effects.rareDropWeight || 0) * scale;
      stats.riskMitigation += (effects.riskMitigation || 0) * scale;
      stats.penaltyDampening += (effects.penaltyDampening || 0) * scale;
    });

    stats.riskMitigation = Math.max(0, Math.min(0.9, stats.riskMitigation));
    stats.penaltyDampening = Math.max(0, Math.min(0.85, stats.penaltyDampening));
    return stats;
  }

  function isShipUnlockMet(shipId) {
    const def = shipDefs[shipId];
    if (!def) {
      return { ok: false, reason: "Unknown ship." };
    }
    if (def.unlock && !isUnlockMet(state, def.unlock)) {
      return { ok: false, reason: "Prestige unlock requirement not met." };
    }
    if (def.requiredBlueprint && !hasBlueprint(state, def.requiredBlueprint)) {
      return { ok: false, reason: `Missing blueprint: ${def.requiredBlueprint}.` };
    }
    return { ok: true };
  }

  function buyShip(shipId) {
    const shipState = ensureShip(state, shipId);
    const shipDef = shipDefs[shipId];
    if (!shipState || !shipDef) {
      return { ok: false, reason: "Unknown ship." };
    }
    if (shipState.acquired) {
      return { ok: false, reason: "Ship already acquired." };
    }

    const unlock = isShipUnlockMet(shipId);
    if (!unlock.ok) {
      return unlock;
    }

    const cost = shipDef.purchaseCost || {};
    const matter = Math.max(0, cost.matter || 0);
    const fire = Math.max(0, cost.fire || 0);
    const intel = Math.max(0, Number(cost.intel || 0));

    if (!resourceManager.spend("matter", matter)) {
      return { ok: false, reason: `Need ${matter} Matter.` };
    }
    if (!resourceManager.spend("fire", fire)) {
      state.resources.matter += matter;
      return { ok: false, reason: `Need ${fire} Fire.` };
    }
    if ((state.expeditions.meta.intel || 0) < intel) {
      state.resources.matter += matter;
      state.resources.fire += fire;
      return { ok: false, reason: `Need ${intel} Intel.` };
    }
    state.expeditions.meta.intel = Math.max(0, Number(state.expeditions.meta.intel || 0) - intel);

    shipState.acquired = true;
    eventBus.emit("ship:bought", { shipId });
    return { ok: true };
  }

  function selectShip(shipId) {
    const shipState = ensureShip(state, shipId);
    if (!shipState) {
      return { ok: false, reason: "Unknown ship." };
    }
    if (!shipState.acquired) {
      return { ok: false, reason: "Ship not acquired." };
    }

    const activeRun = state.expeditions.activeRun;
    if (activeRun && typeof activeRun.bandId === "string") {
      const activeBand = (expeditionBalance.bands || []).find((band) => band.id === activeRun.bandId) || null;
      const requiredShip = typeof activeBand?.requiredShip === "string" ? activeBand.requiredShip.trim() : "";
      if (requiredShip && shipId !== requiredShip) {
        const requiredShipName = shipDefs[requiredShip]?.name || requiredShip;
        return {
          ok: false,
          reason: `Cannot change ship during this voyage. ${requiredShipName} is required.`
        };
      }
    }

    state.expeditions.selectedShip = shipId;
    eventBus.emit("ship:selected", { shipId });
    return { ok: true };
  }

  function upgradeFacility(shipId, facilityId) {
    const shipState = ensureShip(state, shipId);
    const facilityDef = getFacilitySpec(shipId, facilityId);
    if (!shipState || !facilityDef) {
      return { ok: false, reason: "Unknown ship or facility." };
    }
    if (!shipState.acquired) {
      return { ok: false, reason: "Ship not acquired." };
    }

    const currentLevel = Math.max(0, Math.floor(Number(shipState.facilities?.[facilityId]) || 0));
    if (currentLevel >= (facilityDef.maxLevel || 0)) {
      return { ok: false, reason: "Facility is maxed." };
    }

    const cost = getFacilityUpgradeCost(shipId, facilityId, currentLevel);
    if (!cost) {
      return { ok: false, reason: "Missing upgrade cost data." };
    }

    if (!resourceManager.spend("matter", Math.max(0, cost.matter || 0))) {
      return { ok: false, reason: `Need ${cost.matter || 0} Matter.` };
    }
    if (!resourceManager.spend("fire", Math.max(0, cost.fire || 0))) {
      state.resources.matter += Math.max(0, cost.matter || 0);
      return { ok: false, reason: `Need ${cost.fire || 0} Fire.` };
    }
    const intelCost = Math.max(0, Number(cost.intel || 0));
    if ((state.expeditions.meta.intel || 0) < intelCost) {
      state.resources.matter += Math.max(0, cost.matter || 0);
      state.resources.fire += Math.max(0, cost.fire || 0);
      return { ok: false, reason: `Need ${intelCost} Intel.` };
    }
    state.expeditions.meta.intel = Math.max(0, Number(state.expeditions.meta.intel || 0) - intelCost);

    shipState.facilities[facilityId] = currentLevel + 1;
    eventBus.emit("ship:facilityUpgraded", { shipId, facilityId, level: currentLevel + 1 });
    return { ok: true };
  }

  function equipPart(shipId, slotId, partId) {
    normalizePartInventory();
    const shipState = ensureShip(state, shipId);
    if (!shipState) {
      return { ok: false, reason: "Unknown ship." };
    }
    if (!shipState.acquired) {
      return { ok: false, reason: "Ship not acquired." };
    }
    const parsed = parsePartRef(partId);
    if (!parsed) {
      return { ok: false, reason: "Unknown part." };
    }
    const ref = parsed.ref;
    const part = partDefs[parsed.partId];
    if (!part) {
      return { ok: false, reason: "Unknown part." };
    }
    const cap = getPartFusionCap(parsed.partId);
    if (parsed.tier > cap) {
      return { ok: false, reason: `Part tier exceeds cap (T${cap}).` };
    }
    if (part.slot !== slotId) {
      return { ok: false, reason: `Part fits ${part.slot}, not ${slotId}.` };
    }
    if (part.shipId && part.shipId !== shipId) {
      return { ok: false, reason: `Part is restricted to ${part.shipId}.` };
    }
    if ((state.expeditions.partInventory[ref] || 0) <= 0) {
      return { ok: false, reason: "Part not in inventory." };
    }

    const equippedCounts = getEquippedPartCounts();
    const slotRef = parsePartRef(shipState.equippedParts?.[slotId]);
    const currentlyEquipped = slotRef?.ref === ref;
    const allocation = Number(equippedCounts[ref]) || 0;
    const totalOwned = Math.max(0, Number(state.expeditions.partInventory[ref]) || 0);
    if (!currentlyEquipped && allocation >= totalOwned) {
      return { ok: false, reason: "All copies of this part are already equipped." };
    }

    shipState.equippedParts[slotId] = ref;
    eventBus.emit("ship:partEquipped", { shipId, slotId, partId: ref, basePartId: parsed.partId, tier: parsed.tier });
    return { ok: true };
  }

  function unequipPart(shipId, slotId) {
    const shipState = ensureShip(state, shipId);
    if (!shipState) {
      return { ok: false, reason: "Unknown ship." };
    }
    if (!shipState.equippedParts[slotId]) {
      return { ok: false, reason: "No part equipped in slot." };
    }

    const partId = shipState.equippedParts[slotId];
    shipState.equippedParts[slotId] = null;
    eventBus.emit("ship:partUnequipped", { shipId, slotId, partId });
    return { ok: true };
  }

  function getStatus() {
    normalizePartInventory();
    const equippedPartCounts = getEquippedPartCounts();
    const fusionSettings = getFusionSettings();
    const tierBonus = getGlobalPartTierCapBonus();
    return {
      selectedShip: state.expeditions.selectedShip,
      ships: state.expeditions.ships,
      shipDefs,
      facilityDefs,
      partDefs,
      equippedPartCounts,
      blueprintInventory: state.expeditions.blueprintInventory,
      partInventory: state.expeditions.partInventory,
      partFusion: {
        baseMaxTier: fusionSettings.baseMaxTier,
        linearEffectPerTier: fusionSettings.linearEffectPerTier,
        maxTierBonus: tierBonus,
        effectiveGlobalMaxTier: fusionSettings.baseMaxTier + tierBonus
      }
    };
  }

  return {
    getStatus,
    getShipStats,
    getFacilitySpec,
    getFacilityUpgradeCost,
    parsePartRef,
    createPartRef,
    getPartFusionCap,
    getPartTierScale,
    getCombineInfo,
    combinePart,
    isShipUnlockMet,
    buyShip,
    selectShip,
    upgradeFacility,
    equipPart,
    unequipPart
  };
}
