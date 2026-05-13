import { isUnlockMet } from "./unlockRules.js";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function countOwnedNodes(state) {
  return Object.values(state.ascensionTree || {}).filter(Boolean).length;
}

function clampInt(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function cloneRewards() {
  return {
    matter: 0,
    fire: 0,
    shards: 0,
    intel: 0
  };
}

const AUTO_ROUTE_MODES = new Set(["manual", "safe", "balanced", "aggressive"]);
const CONTINUOUS_STOP_MESSAGES = {
  chestFull: "Rewards chest is full.",
  insufficientResources: "Not enough resources to relaunch.",
  cancelled: "Expedition cancelled.",
  blocked: "Automatic relaunch was blocked."
};
const COLLECTION_DEFAULT_SOURCE_ID = "expeditionRareDrops";
const COLLECTION_ITEM_KEY_SEPARATOR = "::";
const COLLECTION_RARITY_ORDER = {
  common: 0,
  "semi-rare": 1,
  rare: 2,
  epic: 3,
  legendary: 4
};

function createCollectionItemKey(sourceId, itemId) {
  const cleanItemId = typeof itemId === "string" ? itemId.trim() : "";
  if (!cleanItemId) {
    return "";
  }
  const cleanSourceId = typeof sourceId === "string" ? sourceId.trim() : "";
  const resolvedSourceId = cleanSourceId || COLLECTION_DEFAULT_SOURCE_ID;
  return `${resolvedSourceId}${COLLECTION_ITEM_KEY_SEPARATOR}${cleanItemId}`;
}

function toTitleToken(value) {
  return String(value || "")
    .trim()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function createExpeditionSystem({ state, resourceManager, eventBus, balance, shipSystem, recompute }) {
  const expeditionBalance = balance.expeditions || {};
  const bandDefs = expeditionBalance.bands || [];
  const unlockNodeId = expeditionBalance.unlockNodeId;
  const shipDefs = expeditionBalance.ships || {};
  const voyageMapDefs = expeditionBalance.voyageMaps && typeof expeditionBalance.voyageMaps === "object"
    ? expeditionBalance.voyageMaps
    : {};

  function getCollectionState() {
    if (!state.expeditions.collection || typeof state.expeditions.collection !== "object") {
      state.expeditions.collection = {
        discoveredItems: {},
        claimedMilestones: {},
        legacyBackfillDone: false
      };
    }
    if (!state.expeditions.collection.discoveredItems || typeof state.expeditions.collection.discoveredItems !== "object") {
      state.expeditions.collection.discoveredItems = {};
    }
    if (!state.expeditions.collection.claimedMilestones || typeof state.expeditions.collection.claimedMilestones !== "object") {
      state.expeditions.collection.claimedMilestones = {};
    }
    state.expeditions.collection.legacyBackfillDone = Boolean(state.expeditions.collection.legacyBackfillDone);
    return state.expeditions.collection;
  }

  function getCollectionSourceDefs() {
    const configured = expeditionBalance.collectionSources && typeof expeditionBalance.collectionSources === "object"
      ? expeditionBalance.collectionSources
      : {};
    if (configured[COLLECTION_DEFAULT_SOURCE_ID]) {
      return configured;
    }
    return {
      ...configured,
      [COLLECTION_DEFAULT_SOURCE_ID]: {
        name: "Expedition Rare Drops",
        description: "Track every rare blueprint and ship part recovered from voyages.",
        autoFromRareDrops: true
      }
    };
  }

  function getCollectionMilestones() {
    const configured = Array.isArray(expeditionBalance.collectionMilestones)
      ? expeditionBalance.collectionMilestones
      : [];
    const usedIds = new Set();
    return configured
      .map((rawMilestone, index) => {
        const baseId = typeof rawMilestone?.id === "string" && rawMilestone.id.trim()
          ? rawMilestone.id.trim()
          : `collectionMilestone${index + 1}`;
        let milestoneId = baseId;
        while (usedIds.has(milestoneId)) {
          milestoneId = `${baseId}_${index + 1}`;
        }
        usedIds.add(milestoneId);
        return {
          id: milestoneId,
          requiredUnique: Math.max(1, clampInt(rawMilestone?.requiredUnique ?? rawMilestone?.threshold ?? (index + 1))),
          name: typeof rawMilestone?.name === "string" && rawMilestone.name.trim()
            ? rawMilestone.name.trim()
            : `Collection Milestone ${index + 1}`,
          description: typeof rawMilestone?.description === "string" ? rawMilestone.description : "",
          effect: rawMilestone?.effect && typeof rawMilestone.effect === "object" ? rawMilestone.effect : {}
        };
      })
      .sort((left, right) => left.requiredUnique - right.requiredUnique);
  }

  function getCollectionCatalog() {
    const sourceDefs = getCollectionSourceDefs();
    const sourceMap = new Map();

    function ensureSource(sourceId, sourceDef = {}) {
      if (!sourceMap.has(sourceId)) {
        sourceMap.set(sourceId, {
          id: sourceId,
          name: typeof sourceDef.name === "string" && sourceDef.name.trim()
            ? sourceDef.name.trim()
            : toTitleToken(sourceId),
          description: typeof sourceDef.description === "string" ? sourceDef.description : "",
          items: {}
        });
      }
      return sourceMap.get(sourceId);
    }

    function upsertSourceItem(sourceId, sourceDef, itemDef) {
      const itemId = typeof itemDef?.id === "string" ? itemDef.id.trim() : "";
      if (!itemId) {
        return;
      }
      const source = ensureSource(sourceId, sourceDef);
      const existing = source.items[itemId];
      const resolvedName = typeof itemDef?.name === "string" && itemDef.name.trim() ? itemDef.name.trim() : itemId;
      const resolvedRarity = typeof itemDef?.rarity === "string" && itemDef.rarity.trim()
        ? itemDef.rarity.trim().toLowerCase()
        : "rare";
      if (existing) {
        if (!existing.name && resolvedName) {
          existing.name = resolvedName;
        }
        if (!existing.rarity && resolvedRarity) {
          existing.rarity = resolvedRarity;
        }
        if (!existing.bandId && itemDef?.bandId) {
          existing.bandId = itemDef.bandId;
        }
        return;
      }
      source.items[itemId] = {
        id: itemId,
        name: resolvedName,
        rarity: resolvedRarity,
        bandId: typeof itemDef?.bandId === "string" ? itemDef.bandId : ""
      };
    }

    Object.entries(sourceDefs).forEach(([sourceId, sourceDef]) => {
      if (typeof sourceId !== "string" || !sourceId.trim()) {
        return;
      }
      const resolvedSourceId = sourceId.trim();
      const resolvedSourceDef = sourceDef && typeof sourceDef === "object" ? sourceDef : {};
      ensureSource(resolvedSourceId, resolvedSourceDef);

      const sourceItems = Array.isArray(resolvedSourceDef.items) ? resolvedSourceDef.items : [];
      sourceItems.forEach((itemDef) => upsertSourceItem(resolvedSourceId, resolvedSourceDef, itemDef));

      const autoFromRareDrops = resolvedSourceId === COLLECTION_DEFAULT_SOURCE_ID
        ? resolvedSourceDef.autoFromRareDrops !== false
        : Boolean(resolvedSourceDef.autoFromRareDrops);
      if (!autoFromRareDrops) {
        return;
      }

      Object.entries(expeditionBalance.rareBlueprintDrops || {}).forEach(([bandId, drops]) => {
        const list = Array.isArray(drops) ? drops : [];
        list.forEach((dropDef) => {
          upsertSourceItem(resolvedSourceId, resolvedSourceDef, {
            id: dropDef?.id,
            name: dropDef?.name,
            rarity: dropDef?.rarity,
            bandId
          });
        });
      });
    });

    const sources = Array.from(sourceMap.values())
      .map((source) => {
        const items = Object.values(source.items)
          .sort((left, right) => {
            const rarityDelta = (COLLECTION_RARITY_ORDER[right.rarity] || 0) - (COLLECTION_RARITY_ORDER[left.rarity] || 0);
            if (rarityDelta !== 0) {
              return rarityDelta;
            }
            return String(left.name || left.id).localeCompare(String(right.name || right.id));
          });
        return {
          id: source.id,
          name: source.name,
          description: source.description,
          items
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));

    const totalItems = sources.reduce((sum, source) => sum + source.items.length, 0);
    return { sources, totalItems };
  }

  function registerCollectionDiscovery(sourceId, itemId, options = {}) {
    const collection = getCollectionState();
    const cleanItemId = typeof itemId === "string" ? itemId.trim() : "";
    if (!cleanItemId) {
      return { ok: false, reason: "Unknown collection item." };
    }
    const cleanSourceId = typeof sourceId === "string" && sourceId.trim()
      ? sourceId.trim()
      : COLLECTION_DEFAULT_SOURCE_ID;
    const key = createCollectionItemKey(cleanSourceId, cleanItemId);
    if (!key) {
      return { ok: false, reason: "Unknown collection item." };
    }

    const discoveredItems = collection.discoveredItems;
    const previousCount = Object.keys(discoveredItems).length;
    if (discoveredItems[key]) {
      return { ok: true, discovered: false, totalUnique: previousCount };
    }

    const catalog = options.catalog || getCollectionCatalog();
    const sourceCatalog = catalog.sources.find((source) => source.id === cleanSourceId);
    const itemCatalog = sourceCatalog?.items.find((item) => item.id === cleanItemId) || null;
    const discoveredAt = clampInt(options.discoveredAt || Date.now());
    const entry = {
      sourceId: cleanSourceId,
      itemId: cleanItemId,
      name: typeof options.name === "string" && options.name.trim()
        ? options.name.trim()
        : (itemCatalog?.name || cleanItemId),
      rarity: typeof options.rarity === "string" && options.rarity.trim()
        ? options.rarity.trim().toLowerCase()
        : (itemCatalog?.rarity || "rare"),
      discoveredAt
    };
    discoveredItems[key] = entry;

    const totalUnique = previousCount + 1;
    if (!options.silent) {
      eventBus.emit("collection:discovered", {
        ...entry,
        totalUnique
      });
      const milestones = getCollectionMilestones();
      milestones.forEach((milestone) => {
        if (collection.claimedMilestones[milestone.id]) {
          return;
        }
        if (previousCount < milestone.requiredUnique && totalUnique >= milestone.requiredUnique) {
          eventBus.emit("collection:milestoneReady", {
            milestoneId: milestone.id,
            name: milestone.name,
            requiredUnique: milestone.requiredUnique,
            totalUnique
          });
        }
      });
    }

    return {
      ok: true,
      discovered: true,
      totalUnique,
      entry
    };
  }

  function backfillCollectionFromLegacyInventory() {
    const collection = getCollectionState();
    if (collection.legacyBackfillDone) {
      return;
    }

    const catalog = getCollectionCatalog();
    const fallbackTimestamp = clampInt(state.meta?.startedAt || Date.now());
    Object.entries(state.expeditions.blueprintInventory || {}).forEach(([dropId, count]) => {
      if ((Number(count) || 0) <= 0) {
        return;
      }
      registerCollectionDiscovery(COLLECTION_DEFAULT_SOURCE_ID, dropId, {
        discoveredAt: fallbackTimestamp,
        silent: true,
        catalog
      });
    });

    Object.entries(state.expeditions.partInventory || {}).forEach(([partRef, count]) => {
      if ((Number(count) || 0) <= 0) {
        return;
      }
      const parsedPart = shipSystem?.parsePartRef?.(partRef);
      const partId = parsedPart?.partId || (typeof partRef === "string" ? partRef.trim() : "");
      if (!partId) {
        return;
      }
      registerCollectionDiscovery(COLLECTION_DEFAULT_SOURCE_ID, partId, {
        discoveredAt: fallbackTimestamp,
        silent: true,
        catalog
      });
    });

    Object.entries(getMapInventory()).forEach(([mapId, count]) => {
      if ((Number(count) || 0) <= 0) {
        return;
      }
      registerCollectionDiscovery(COLLECTION_DEFAULT_SOURCE_ID, mapId, {
        discoveredAt: fallbackTimestamp,
        silent: true,
        catalog
      });
    });

    collection.legacyBackfillDone = true;
  }

  function ensureCollectionReady() {
    getCollectionState();
    backfillCollectionFromLegacyInventory();
  }

  function getCollectionStatus() {
    ensureCollectionReady();
    const collection = getCollectionState();
    const catalog = getCollectionCatalog();
    const discoveredItems = collection.discoveredItems || {};
    const uniqueDiscoveredTotal = Object.keys(discoveredItems).length;

    const sources = catalog.sources.map((source) => {
      const items = source.items.map((item) => {
        const key = createCollectionItemKey(source.id, item.id);
        const discoveredEntry = key ? discoveredItems[key] : null;
        return {
          ...item,
          key,
          discovered: Boolean(discoveredEntry),
          discoveredAt: discoveredEntry?.discoveredAt || 0,
          discoveredName: discoveredEntry?.name || item.name,
          discoveredRarity: discoveredEntry?.rarity || item.rarity
        };
      });
      const discoveredCount = items.filter((item) => item.discovered).length;
      return {
        ...source,
        items,
        discoveredCount,
        totalItems: items.length
      };
    });

    const trackableDiscovered = sources.reduce((sum, source) => sum + source.discoveredCount, 0);
    const milestones = getCollectionMilestones().map((milestone) => {
      const claimed = Boolean(collection.claimedMilestones[milestone.id]);
      const ready = !claimed && uniqueDiscoveredTotal >= milestone.requiredUnique;
      return {
        ...milestone,
        claimed,
        ready,
        currentUnique: uniqueDiscoveredTotal,
        remaining: Math.max(0, milestone.requiredUnique - uniqueDiscoveredTotal)
      };
    });

    return {
      sources,
      milestones,
      totalTrackable: catalog.totalItems,
      trackableDiscovered,
      uniqueDiscoveredTotal,
      completionFraction: catalog.totalItems > 0 ? trackableDiscovered / catalog.totalItems : 0
    };
  }

  function claimCollectionMilestone(milestoneId) {
    ensureCollectionReady();
    const collection = getCollectionState();
    const milestones = getCollectionMilestones();
    const milestone = milestones.find((entry) => entry.id === milestoneId);
    if (!milestone) {
      return { ok: false, reason: "Unknown collection milestone." };
    }
    if (collection.claimedMilestones[milestone.id]) {
      return { ok: false, reason: "Milestone already claimed." };
    }

    const totalUnique = Object.keys(collection.discoveredItems || {}).length;
    if (totalUnique < milestone.requiredUnique) {
      return {
        ok: false,
        reason: `Need ${milestone.requiredUnique} unique discoveries to claim this milestone.`
      };
    }

    collection.claimedMilestones[milestone.id] = true;
    if (typeof recompute === "function") {
      recompute();
    }
    eventBus.emit("collection:milestoneClaimed", {
      milestoneId: milestone.id,
      name: milestone.name,
      requiredUnique: milestone.requiredUnique,
      effect: milestone.effect,
      totalUnique
    });

    return {
      ok: true,
      milestone,
      totalUnique
    };
  }

  function getContinuousConfig() {
    const config = expeditionBalance.continuous || {};
    return {
      automationCostMultiplier: Math.max(1, Number(config.automationCostMultiplier) || 1.1),
      automationRewardMultiplier: clamp(Number(config.automationRewardMultiplier) || 0.8, 0.25, 1),
      chestFillRewardPenaltyPerItem: clamp(Number(config.chestFillRewardPenaltyPerItem) || 0.015, 0, 0.1),
      minAutomationRewardMultiplier: clamp(Number(config.minAutomationRewardMultiplier) || 0.65, 0.25, 1)
    };
  }

  function getRewardsChest() {
    const baseCapacity = Math.max(1, Math.floor(Number(expeditionBalance.rewardsChestCapacity) || 10));
    const perkBonus = Math.max(0, Math.floor(Number(state.perks?.rewardsChestCapacityBonus) || 0));
    const effectiveCapacity = baseCapacity + perkBonus;
    if (!state.expeditions.rewardsChest || typeof state.expeditions.rewardsChest !== "object") {
      state.expeditions.rewardsChest = {
        capacity: effectiveCapacity,
        items: []
      };
    }
    const chest = state.expeditions.rewardsChest;
    chest.capacity = effectiveCapacity;
    if (!Array.isArray(chest.items)) {
      chest.items = [];
    }
    if (chest.items.length > chest.capacity) {
      chest.items = chest.items.slice(0, chest.capacity);
    }
    return chest;
  }

  function isChestFull() {
    const chest = getRewardsChest();
    return chest.items.length >= chest.capacity;
  }

  function getContinuousState() {
    if (!state.expeditions.meta.continuous || typeof state.expeditions.meta.continuous !== "object") {
      state.expeditions.meta.continuous = {
        active: false,
        bandId: null,
        stopReason: ""
      };
    }
    const continuous = state.expeditions.meta.continuous;
    continuous.active = Boolean(continuous.active);
    continuous.bandId = typeof continuous.bandId === "string" ? continuous.bandId : null;
    continuous.stopReason = typeof continuous.stopReason === "string" ? continuous.stopReason : "";
    return continuous;
  }

  function setContinuousActive(bandId) {
    const continuous = getContinuousState();
    continuous.active = true;
    continuous.bandId = bandId;
    continuous.stopReason = "";
  }

  function stopContinuous(reasonKey, detailReason = "", bandId = null) {
    const continuous = getContinuousState();
    const reasonText = detailReason || CONTINUOUS_STOP_MESSAGES[reasonKey] || CONTINUOUS_STOP_MESSAGES.blocked;
    const previousBandId = continuous.bandId;
    continuous.active = false;
    continuous.stopReason = reasonText;
    continuous.bandId = typeof bandId === "string" ? bandId : previousBandId;
    eventBus.emit("expedition:continuousStopped", {
      reasonKey,
      reason: reasonText,
      bandId: continuous.bandId || null
    });
    return { reasonKey, reason: reasonText, bandId: continuous.bandId || null };
  }

  function mapStartFailureToStopKey(reason) {
    if (typeof reason !== "string") {
      return "blocked";
    }
    if (reason.toLowerCase().includes("chest")) {
      return "chestFull";
    }
    if (reason.startsWith("Need ")) {
      return "insufficientResources";
    }
    return "blocked";
  }

  function getAutomationRewardMultiplier() {
    const config = getContinuousConfig();
    const chest = getRewardsChest();
    const chestPenalty = chest.items.length * config.chestFillRewardPenaltyPerItem;
    return clamp(
      config.automationRewardMultiplier - chestPenalty,
      config.minAutomationRewardMultiplier,
      1
    );
  }

  function getBandById(bandId) {
    return bandDefs.find((band) => band.id === bandId) || null;
  }

  function getBandRank(bandId) {
    const idx = bandDefs.findIndex((band) => band.id === bandId);
    return idx >= 0 ? idx + 1 : 1;
  }

  function getShipFallbackStats(shipId) {
    const base = shipDefs[shipId]?.baseStats || {};
    return {
      speedMultiplier: Math.max(0.25, Number(base.speedMultiplier) || 1),
      riskMitigation: Math.max(0, Number(base.riskMitigation) || 0),
      yieldMultiplier: Math.max(0.25, Number(base.yieldMultiplier) || 1),
      penaltyDampening: Math.max(0, Number(base.penaltyDampening) || 0),
      rareDropWeight: Math.max(0.1, Number(base.rareDropWeight) || 1)
    };
  }

  function getSelectedShipContext() {
    const shipId = state.expeditions.selectedShip;
    const shipState = state.expeditions.ships?.[shipId];
    if (!shipId || !shipState || !shipState.acquired) {
      return null;
    }
    const resolvedStats = shipSystem?.getShipStats?.(shipId) || getShipFallbackStats(shipId);
    return {
      shipId,
      stats: {
        speedMultiplier: Math.max(0.25, Number(resolvedStats.speedMultiplier) || 1),
        riskMitigation: Math.max(0, Number(resolvedStats.riskMitigation) || 0),
        yieldMultiplier: Math.max(0.25, Number(resolvedStats.yieldMultiplier) || 1),
        penaltyDampening: Math.max(0, Number(resolvedStats.penaltyDampening) || 0),
        rareDropWeight: Math.max(0.1, Number(resolvedStats.rareDropWeight) || 1)
      }
    };
  }

  function getDropDefsForBand(bandId) {
    const table = expeditionBalance.rareBlueprintDrops || {};
    const list = table[bandId];
    return Array.isArray(list) ? list : [];
  }

  function getMapInventory() {
    if (!state.expeditions.mapInventory || typeof state.expeditions.mapInventory !== "object") {
      state.expeditions.mapInventory = {};
    }
    return state.expeditions.mapInventory;
  }

  function getUnlockedBandMapState() {
    if (!state.expeditions.meta.unlockedBands || typeof state.expeditions.meta.unlockedBands !== "object") {
      state.expeditions.meta.unlockedBands = {};
    }
    return state.expeditions.meta.unlockedBands;
  }

  function getPurchasedVoyagesState() {
    if (!state.expeditions.meta.purchasedVoyages || typeof state.expeditions.meta.purchasedVoyages !== "object") {
      state.expeditions.meta.purchasedVoyages = {};
    }
    return state.expeditions.meta.purchasedVoyages;
  }

  function getVoyagePurchaseIntelCost(band) {
    const configured = Number(band?.purchaseIntelCost);
    if (Number.isFinite(configured) && configured >= 0) {
      return Math.max(0, Math.floor(configured));
    }
    return 0;
  }

  function isVoyagePurchased(bandId) {
    const band = getBandById(bandId);
    if (!band) {
      return false;
    }
    if (getVoyagePurchaseIntelCost(band) <= 0) {
      return true;
    }
    return Boolean(getPurchasedVoyagesState()[bandId]);
  }

  function getVoyageMapDef(mapId) {
    const cleanMapId = typeof mapId === "string" ? mapId.trim() : "";
    if (!cleanMapId) {
      return null;
    }
    const raw = voyageMapDefs[cleanMapId];
    if (!raw || typeof raw !== "object") {
      return null;
    }
    const unlocksBandId = typeof raw.unlocksBandId === "string" ? raw.unlocksBandId.trim() : "";
    if (!unlocksBandId) {
      return null;
    }
    const name = typeof raw.name === "string" && raw.name.trim()
      ? raw.name.trim()
      : toTitleToken(cleanMapId);
    const description = typeof raw.description === "string" ? raw.description : "";
    return {
      id: cleanMapId,
      name,
      description,
      unlocksBandId
    };
  }

  function getVoyageMaps() {
    const mapInventory = getMapInventory();
    const unlockedBands = getUnlockedBandMapState();
    return Object.keys(voyageMapDefs)
      .map((mapId) => getVoyageMapDef(mapId))
      .filter(Boolean)
      .map((mapDef) => {
        const targetBand = getBandById(mapDef.unlocksBandId);
        return {
          ...mapDef,
          owned: Math.max(0, Number(mapInventory[mapDef.id]) || 0),
          unlocked: Boolean(unlockedBands[mapDef.unlocksBandId]),
          unlocksBandName: targetBand?.name || toTitleToken(mapDef.unlocksBandId)
        };
      })
      .sort((left, right) => String(left.name).localeCompare(String(right.name)));
  }

  function getBandMapRequirement(band) {
    const requiredMapId = typeof band?.requiredMapId === "string" ? band.requiredMapId.trim() : "";
    if (!requiredMapId) {
      return {
        ok: true,
        requiredMapId: null,
        mapName: "",
        owned: 0,
        unlocked: true
      };
    }

    const mapDef = getVoyageMapDef(requiredMapId);
    const mapName = mapDef?.name || toTitleToken(requiredMapId);
    const mapInventory = getMapInventory();
    const unlockedBands = getUnlockedBandMapState();
    const owned = Math.max(0, Number(mapInventory[requiredMapId]) || 0);
    const unlocked = Boolean(unlockedBands[band.id]);

    if (unlocked) {
      return {
        ok: true,
        requiredMapId,
        mapName,
        owned,
        unlocked
      };
    }

    const reason = owned > 0
      ? `Use ${mapName} from map inventory to unlock this voyage.`
      : `Requires voyage map: ${mapName}.`;
    return {
      ok: false,
      reason,
      requiredMapId,
      mapName,
      owned,
      unlocked
    };
  }

  function hasRequiredNodes(band) {
    const requiredNodes = band.requiredNodes || [];
    return requiredNodes.every((nodeId) => Boolean(state.ascensionTree[nodeId]));
  }

  function getChoiceUnlock(choice) {
    const requiredNodes = choice.requiredNodes || [];
    if (requiredNodes.length === 0) {
      return { ok: true };
    }
    const missing = requiredNodes.filter((nodeId) => !state.ascensionTree[nodeId]);
    if (missing.length > 0) {
      return {
        ok: false,
        reason: `Requires nodes: ${missing.join(", ")}.`
      };
    }
    return { ok: true };
  }

  function isBandUnlocked(bandId) {
    const band = getBandById(bandId);
    if (!band) {
      return { ok: false, reason: "Unknown expedition voyage." };
    }
    if (unlockNodeId && !state.ascensionTree[unlockNodeId]) {
      return { ok: false, reason: "Unlock Expedition Keystone in the Ascend tab." };
    }
    if (band.unlock && !isUnlockMet(state, band.unlock)) {
      if (band.unlock.type === "ascensionNodeCount") {
        return {
          ok: false,
          reason: `Need ${band.unlock.value} owned ascension nodes (${countOwnedNodes(state)} current).`
        };
      }
      return { ok: false, reason: "Prestige requirements not met." };
    }
    if (!hasRequiredNodes(band)) {
      return { ok: false, reason: "Missing required ascension branch nodes." };
    }
    const mapRequirement = getBandMapRequirement(band);
    if (!mapRequirement.ok) {
      return {
        ok: false,
        reason: mapRequirement.reason,
        requiredMapId: mapRequirement.requiredMapId,
        mapName: mapRequirement.mapName,
        mapOwned: mapRequirement.owned
      };
    }
    return { ok: true };
  }

  function getBands() {
    return bandDefs.map((band, index) => {
      const unlock = isBandUnlocked(band.id);
      const rank = index + 1;
      const mapRequirement = getBandMapRequirement(band);
      const requiredShip = typeof band.requiredShip === "string" ? band.requiredShip.trim() : "";
      const purchaseIntelCost = getVoyagePurchaseIntelCost(band);
      const purchased = isVoyagePurchased(band.id);
      return {
        ...band,
        rank,
        unlock,
        purchaseIntelCost,
        purchased,
        mapRequirement,
        requiredShipName: requiredShip ? (shipDefs[requiredShip]?.name || toTitleToken(requiredShip)) : ""
      };
    });
  }

  function roll(run) {
    const next = (1664525 * run.seed + 1013904223) >>> 0;
    run.seed = next;
    return next / 0x100000000;
  }

  function segmentDurationSeconds(run, band) {
    const total = Math.max(12, Number(band.durationSeconds) || 60);
    const stageCount = Math.max(1, run.stageCount || 1);
    const perStage = total / stageCount;
    const baseSpeed = Math.max(0.25, state.perks.expeditionSpeedMultiplier || 1);
    const shipSpeed = Math.max(0.25, run.ship?.stats?.speedMultiplier || 1);
    const routeSpeed = Math.max(0.3, run.modifiers.speedMultiplier || 1);
    return Math.max(6, perStage / (baseSpeed * shipSpeed * routeSpeed));
  }

  function makeChoicesForBand(band) {
    const choices = Array.isArray(band.routeChoices) && band.routeChoices.length > 0
      ? band.routeChoices
      : expeditionBalance.defaultRouteChoices || [];
    return choices.map((choice) => {
      const unlock = getChoiceUnlock(choice);
      return {
        ...choice,
        unlocked: unlock.ok,
        lockReason: unlock.ok ? "" : unlock.reason
      };
    });
  }

  function normalizeAutoMode(mode) {
    return AUTO_ROUTE_MODES.has(mode) ? mode : "manual";
  }

  function buyVoyage(bandId) {
    const band = getBandById(bandId);
    if (!band) {
      return { ok: false, reason: "Unknown expedition voyage." };
    }

    const unlock = isBandUnlocked(bandId);
    if (!unlock.ok) {
      return unlock;
    }

    const purchaseCost = getVoyagePurchaseIntelCost(band);
    if (purchaseCost <= 0) {
      return { ok: true, bandId, cost: 0, alreadyOwned: true };
    }

    const purchasedVoyages = getPurchasedVoyagesState();
    if (purchasedVoyages[bandId]) {
      return { ok: false, reason: "Voyage already purchased." };
    }

    const intel = Math.max(0, Number(state.expeditions.meta.intel) || 0);
    if (intel < purchaseCost) {
      return { ok: false, reason: `Need ${purchaseCost} Intel.` };
    }

    state.expeditions.meta.intel = intel - purchaseCost;
    purchasedVoyages[bandId] = true;
    eventBus.emit("expedition:voyagePurchased", {
      bandId,
      cost: purchaseCost,
      remainingIntel: state.expeditions.meta.intel
    });

    return {
      ok: true,
      bandId,
      cost: purchaseCost,
      remainingIntel: state.expeditions.meta.intel
    };
  }

  function stageVarianceConfigForBand(band) {
    const fallback = expeditionBalance.defaultStageVarianceRanges || {};
    const ranges = band.stageVarianceRanges || fallback;
    function normalizeRange(range, min, max, fallbackMin, fallbackMax) {
      const a = Number(range?.min);
      const b = Number(range?.max);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        return {
          min: clamp(Math.min(a, b), min, max),
          max: clamp(Math.max(a, b), min, max)
        };
      }
      return { min: fallbackMin, max: fallbackMax };
    }
    return {
      riskDelta: normalizeRange(ranges.riskDelta, -0.2, 0.2, -0.03, 0.04),
      yieldDelta: normalizeRange(ranges.yieldDelta, -0.25, 0.3, -0.04, 0.05),
      speedMultiplier: normalizeRange(ranges.speedMultiplier, 0.75, 1.25, 0.96, 1.05),
      intelFlat: normalizeRange(ranges.intelFlat, -2, 4, 0, 1)
    };
  }

  function rollRange(run, range) {
    const min = Number(range?.min) || 0;
    const max = Number(range?.max) || 0;
    return min + (max - min) * roll(run);
  }

  function buildStageVariances(run, band, stageCount) {
    const ranges = stageVarianceConfigForBand(band);
    const results = [];
    for (let i = 0; i < stageCount; i += 1) {
      results.push({
        riskDelta: rollRange(run, ranges.riskDelta),
        yieldDelta: rollRange(run, ranges.yieldDelta),
        speedMultiplier: rollRange(run, ranges.speedMultiplier),
        intelFlat: Math.round(rollRange(run, ranges.intelFlat))
      });
    }
    return results;
  }

  function buildStageChoices(run, band, stageIndex) {
    const stageVariance = run.stageVariances?.[stageIndex] || null;
    const baseChoices = makeChoicesForBand(band);
    if (!stageVariance) {
      return baseChoices;
    }
    return baseChoices.map((choice) => ({
      ...choice,
      riskDelta: Number(choice.riskDelta || 0) + stageVariance.riskDelta,
      yieldDelta: Number(choice.yieldDelta || 0) + stageVariance.yieldDelta,
      speedMultiplier: Math.max(0.7, Number(choice.speedMultiplier || 1) * stageVariance.speedMultiplier),
      intelFlat: Math.floor(Number(choice.intelFlat || 0) + stageVariance.intelFlat),
      stageVarianceSummary: stageVariance
    }));
  }

  function scoreChoiceForMode(choice, mode) {
    const risk = Number(choice.riskDelta) || 0;
    const yieldDelta = Number(choice.yieldDelta) || 0;
    const speedFactor = Number(choice.speedMultiplier) || 1;
    const speedDelta = speedFactor - 1;
    const intelFlat = Number(choice.intelFlat) || 0;
    if (mode === "safe") {
      return (-risk * 6) + (yieldDelta * 0.55) + (speedDelta * 0.25) + (intelFlat * 0.2);
    }
    if (mode === "aggressive") {
      return (risk * 4.5) + (yieldDelta * 1.8) + (speedDelta * 0.9) + (intelFlat * 0.25);
    }
    return (yieldDelta * 1.15) + (speedDelta * 0.55) + (intelFlat * 0.3) - (Math.abs(risk) * 2.4);
  }

  function autoChooseRouteIfNeeded() {
    const run = state.expeditions.activeRun;
    if (!run || !run.awaitingChoice) {
      return { ok: false, reason: "No voyage decision pending." };
    }
    const mode = normalizeAutoMode(run.autoRouteMode || state.expeditions.meta.autoRouteMode);
    if (mode === "manual") {
      return { ok: false, reason: "Manual mode." };
    }
    const options = (run.pendingChoices || []).filter((choice) => choice.unlocked);
    if (options.length === 0) {
      return { ok: false, reason: "No unlocked voyage options." };
    }
    const selected = options
      .map((choice) => ({ choice, score: scoreChoiceForMode(choice, mode) }))
      .sort((a, b) => b.score - a.score)[0]?.choice;
    if (!selected) {
      return { ok: false, reason: "No voyage selected." };
    }
    const result = chooseRoute(selected.id);
    if (result.ok) {
      eventBus.emit("expedition:autoRoute", {
        mode,
        bandId: run.bandId,
        stage: run.stageIndex + 1,
        choiceId: selected.id
      });
    }
    return result;
  }

  function applyOutcome(run, outcome) {
    if (!outcome) {
      return;
    }
    run.modifiers.riskDelta += Number(outcome.riskDelta) || 0;
    run.modifiers.yieldDelta += Number(outcome.yieldDelta) || 0;
    if (outcome.speedMultiplier) {
      run.modifiers.speedMultiplier *= Number(outcome.speedMultiplier) || 1;
    }
    run.modifiers.rewardFlat.matter += clampInt(outcome.matterFlat);
    run.modifiers.rewardFlat.fire += clampInt(outcome.fireFlat);
    run.modifiers.rewardFlat.shards += 0;
    run.modifiers.rewardFlat.intel += clampInt(outcome.intelFlat) + clampInt(outcome.shardsFlat);
    run.modifiers.penalty.matter += clampInt(outcome.matterPenalty);
    run.modifiers.penalty.fire += clampInt(outcome.firePenalty);
    run.modifiers.penalty.shards += 0;
  }

  function resolveEncounter(run, band, choice) {
    const encounterDefs = band.encounters || [];
    if (encounterDefs.length === 0) {
      return null;
    }

    const encounterMap = new Map(encounterDefs.map((entry) => [entry.id, entry]));
    const poolId = choice?.encounterPool;
    const poolIds = poolId ? (band.encounterPools?.[poolId] || []) : [];
    const pooledEncounters = poolIds
      .map((encounterId) => encounterMap.get(encounterId))
      .filter(Boolean);
    const activePool = pooledEncounters.length > 0 ? pooledEncounters : encounterDefs;

    const encounter = activePool[Math.floor(roll(run) * activePool.length)];
    if (!encounter) {
      return null;
    }

    const shipMitigation = run.ship?.stats?.riskMitigation || 0;
    const mitigation = clamp((state.perks.expeditionRiskMitigation || 0) + shipMitigation, 0, 0.8);
    const effectiveRisk = clamp((band.risk || 0.2) + run.modifiers.riskDelta, 0.05, 0.95);
    const difficulty = clamp((encounter.difficulty || 0.4) + effectiveRisk * 0.35, 0.05, 0.98);
    const successChance = clamp(1 - difficulty * (1 - mitigation), 0.12, 0.96);
    const success = roll(run) <= successChance;
    const shardProcChance = clamp(Number(state.perks.expeditionShardBonus) || 0, 0, 1);
    const shardProc = success && roll(run) < shardProcChance ? 1 : 0;

    applyOutcome(run, success ? encounter.success : encounter.fail);

    const logEntry = {
      stage: run.stageIndex,
      poolId: poolId || "default",
      name: encounter.name,
      description: encounter.description,
      success
    };

    if (success) {
      const dropDefs = getDropDefsForBand(run.bandId)
        .filter((drop) => {
          if (!Array.isArray(drop.fromPool) || drop.fromPool.length === 0) {
            return true;
          }
          return drop.fromPool.includes(logEntry.poolId);
        })
        .sort((a, b) => (a.chance || 0) - (b.chance || 0));
      const shipWeight = Math.max(0.1, run.ship?.stats?.rareDropWeight || 1);
      for (const drop of dropDefs) {
        const rawChance = Math.max(0, Number(drop.chance) || 0);
        const chance = clamp(rawChance * shipWeight, 0, 0.85);
        if (roll(run) <= chance) {
          const dropEntry = {
            id: drop.id,
            name: drop.name || drop.id,
            rarity: drop.rarity || "rare",
            blueprintForShip: drop.blueprintForShip || null,
            slot: drop.slot || null,
            shipId: drop.shipId || null,
            effects: drop.effects || null
          };
          run.pendingDrops.push(dropEntry);
          logEntry.drop = dropEntry.name;
          eventBus.emit("expedition:rareDrop", {
            bandId: run.bandId,
            stage: run.stageIndex,
            dropId: dropEntry.id
          });
          break;
        }
      }
    }

    run.encounterLog.push(logEntry);
    eventBus.emit("expedition:event", {
      type: "encounter",
      stage: run.stageIndex,
      encounterId: encounter.id,
      success
    });

    return logEntry;
  }

  function start(bandId, options = {}) {
    const automated = Boolean(options.automated);
    if (isChestFull()) {
      return { ok: false, reason: "Rewards chest is full. Claim rewards first." };
    }
    if (state.expeditions.activeRun) {
      return { ok: false, reason: "An expedition is already in progress." };
    }

    const band = getBandById(bandId);
    if (!band) {
      return { ok: false, reason: "Unknown expedition voyage." };
    }
    const ship = getSelectedShipContext();
    if (!ship) {
      return { ok: false, reason: "Select an acquired ship in Fleet Dock before launching." };
    }

    const unlock = isBandUnlocked(bandId);
    if (!unlock.ok) {
      eventBus.emit("expedition:blockedByPrestige", { bandId, reason: unlock.reason });
      return unlock;
    }

    const requiredShip = typeof band.requiredShip === "string" ? band.requiredShip.trim() : "";
    if (requiredShip && ship.shipId !== requiredShip) {
      const requiredShipName = shipDefs[requiredShip]?.name || toTitleToken(requiredShip);
      return { ok: false, reason: `Requires ${requiredShipName} as the active ship.` };
    }
    if (!isVoyagePurchased(bandId)) {
      const purchaseCost = getVoyagePurchaseIntelCost(band);
      return {
        ok: false,
        reason: purchaseCost > 0
          ? `Buy this voyage first (${purchaseCost} Intel).`
          : "Voyage is not owned yet."
      };
    }

    const continuousConfig = getContinuousConfig();
    const launchCostMultiplier = automated ? continuousConfig.automationCostMultiplier : 1;
    const matterCost = Math.max(0, Math.floor((band.cost?.matter || 0) * launchCostMultiplier));
    const fireCost = Math.max(0, Math.floor((band.cost?.fire || 0) * launchCostMultiplier));
    const rank = getBandRank(bandId);
    band.rank = rank;

    if (!resourceManager.spend("matter", matterCost)) {
      return { ok: false, reason: `Need ${matterCost} Matter.` };
    }
    if (!resourceManager.spend("fire", fireCost)) {
      state.resources.matter += matterCost;
      return { ok: false, reason: `Need ${fireCost} Fire.` };
    }
    setContinuousActive(bandId);

    const seed = (Date.now() + Math.floor(Math.random() * 1000000)) >>> 0;
    const stageCount = Math.max(1, Math.floor(Number(band.stageCount) || 2));
    const perkSpeedMultiplier = Math.max(0.25, state.perks.expeditionSpeedMultiplier || 1);
    const shipSpeed = Math.max(0.25, ship.stats.speedMultiplier || 1);

    state.expeditions.activeRun = {
      bandId,
      ship,
      rank: band.rank || getBands().find((item) => item.id === bandId)?.rank || 1,
      elapsedSeconds: 0,
      totalDurationSeconds: Math.max(12, Number(band.durationSeconds) || 60) / (perkSpeedMultiplier * shipSpeed),
      segmentElapsedSeconds: 0,
      segmentDurationSeconds: Math.max(6, (Number(band.durationSeconds) || 60) / stageCount / (perkSpeedMultiplier * shipSpeed)),
      stageCount,
      stageIndex: 0,
      requiredShip: requiredShip || null,
      autoRouteMode: normalizeAutoMode(state.expeditions.meta.autoRouteMode),
      awaitingChoice: false,
      pendingChoices: [],
      routeHistory: [],
      encounterLog: [],
      pendingDrops: [],
      modifiers: {
        riskDelta: 0,
        yieldDelta: 0,
        speedMultiplier: 1,
        rewardFlat: cloneRewards(),
        penalty: { matter: 0, fire: 0, shards: 0 }
      },
      seed,
      startedAt: Date.now(),
      costs: { matter: matterCost, fire: fireCost, intel: 0 },
      launchCostMultiplier,
      automatedLaunch: automated,
      automationRewardMultiplier: automated ? getAutomationRewardMultiplier() : 1
    };

    state.expeditions.activeRun.stageVariances = buildStageVariances(state.expeditions.activeRun, band, stageCount);

    state.expeditions.activeRun.pendingChoices = buildStageChoices(state.expeditions.activeRun, band, 0);
    state.expeditions.activeRun.awaitingChoice = true;

    autoChooseRouteIfNeeded();

    eventBus.emit("expedition:start", {
      bandId,
      stageCount,
      shipId: ship.shipId,
      automated,
      launchCostMultiplier
    });
    return { ok: true, automated, continuous: true };
  }

  function resolveActiveRun() {
    const run = state.expeditions.activeRun;
    if (!run) {
      return null;
    }
    const band = getBandById(run.bandId);
    if (!band) {
      state.expeditions.activeRun = null;
      return null;
    }

    const shipRiskMitigation = run.ship?.stats?.riskMitigation || 0;
    const shipYieldMultiplier = run.ship?.stats?.yieldMultiplier || 1;
    const penaltyDampening = clamp(run.ship?.stats?.penaltyDampening || 0, 0, 0.85);
    const riskMitigation = clamp((state.perks.expeditionRiskMitigation || 0) + shipRiskMitigation, 0, 0.7);
    const finalRisk = clamp((band.risk || 0.2) + run.modifiers.riskDelta, 0.04, 0.98);
    const rawSuccess = 1 - finalRisk * (1 - riskMitigation);
    const successChance = clamp(
      rawSuccess,
      expeditionBalance.minSuccessChance || 0.15,
      expeditionBalance.maxSuccessChance || 0.95
    );
    const success = roll(run) <= successChance;
    const shardProcChance = clamp(Number(state.perks.expeditionShardBonus) || 0, 0, 1);
    const shardProc = success && roll(run) < shardProcChance ? 1 : 0;

    const variance = 0.9 + roll(run) * 0.25;
    const routeYield = clamp(1 + (run.modifiers.yieldDelta || 0), 0.2, 3);
    const yieldMultiplier = Math.max(0.25, (state.perks.expeditionYieldMultiplier || 1) * shipYieldMultiplier * variance * routeYield);
    const intelMultiplier = Math.max(0.25, state.perks.expeditionIntelMultiplier || 1);

    const baseReward = band.rewards || {};
    const rewardFlat = run.modifiers.rewardFlat || cloneRewards();
    const penalty = run.modifiers.penalty || { matter: 0, fire: 0, shards: 0 };
    const dampenedPenalty = {
      matter: Math.floor((penalty.matter || 0) * (1 - penaltyDampening)),
      fire: Math.floor((penalty.fire || 0) * (1 - penaltyDampening)),
      shards: Math.floor((penalty.shards || 0) * (1 - penaltyDampening))
    };
    const rewards = success
      ? {
          matter: Math.max(0, Math.floor((baseReward.matter || 0) * yieldMultiplier) + rewardFlat.matter - dampenedPenalty.matter),
          fire: Math.max(0, Math.floor((baseReward.fire || 0) * yieldMultiplier) + rewardFlat.fire - dampenedPenalty.fire),
          shards: Math.max(0, Math.floor((baseReward.shards || 0) * yieldMultiplier) + rewardFlat.shards + shardProc - dampenedPenalty.shards),
          intel: Math.max(0, Math.floor((baseReward.intel || 0) * intelMultiplier) + rewardFlat.intel)
        }
      : {
          matter: Math.max(0, Math.floor((baseReward.matter || 0) * 0.12) - dampenedPenalty.matter),
          fire: Math.max(0, Math.floor((baseReward.fire || 0) * 0.12) - dampenedPenalty.fire),
          shards: 0,
          intel: Math.max(1, 1 + rewardFlat.intel)
        };

    const rewardMultiplier = clamp(Number(run.automationRewardMultiplier) || 1, 0.25, 1);
    const scaledRewards = {
      matter: Math.max(0, Math.floor((rewards.matter || 0) * rewardMultiplier)),
      fire: Math.max(0, Math.floor((rewards.fire || 0) * rewardMultiplier)),
      // Keep binary shard procs intact even for automated runs.
      shards: Math.max(0, Math.floor(rewards.shards || 0)),
      intel: Math.max(0, Math.floor((rewards.intel || 0) * rewardMultiplier))
    };

    const chestEntry = {
      success,
      bandId: band.id,
      bandName: band.name,
      finalRisk,
      shipId: run.ship?.shipId || null,
      routeHistory: run.routeHistory,
      encounters: run.encounterLog,
      drops: run.pendingDrops,
      rewards: scaledRewards,
      automatedLaunch: Boolean(run.automatedLaunch),
      automationRewardMultiplier: rewardMultiplier,
      completedAt: Date.now()
    };

    const chest = getRewardsChest();
    if (chest.items.length < chest.capacity) {
      chest.items.push(chestEntry);
    }
    state.expeditions.pendingRewards = null;
    state.expeditions.activeRun = null;

    state.lifetime.expeditionRuns += 1;
    if (success) {
      state.lifetime.expeditionWins += 1;
      state.expeditions.meta.completedRuns += 1;
      const rank = getBands().find((item) => item.id === band.id)?.rank || 1;
      state.expeditions.meta.bestBand = Math.max(state.expeditions.meta.bestBand, rank);
      state.lifetime.expeditionBestBand = Math.max(state.lifetime.expeditionBestBand, rank);
    } else {
      state.lifetime.expeditionLosses += 1;
      state.expeditions.meta.failedRuns += 1;
    }

    const chestCount = chest.items.length;
    const chestCapacity = chest.capacity;
    const chestFull = chestCount >= chestCapacity;

    eventBus.emit("expedition:complete", {
      bandId: band.id,
      success,
      rewards: scaledRewards,
      drops: chestEntry.drops,
      chestCount,
      chestCapacity,
      chestFull,
      bandName: band.name
    });

    if (chestFull) {
      stopContinuous("chestFull", CONTINUOUS_STOP_MESSAGES.chestFull, band.id);
      return chestEntry;
    }

    const continuous = getContinuousState();
    if (continuous.active && continuous.bandId === band.id) {
      const relaunch = start(band.id, { automated: true });
      if (!relaunch.ok) {
        const stopKey = mapStartFailureToStopKey(relaunch.reason);
        stopContinuous(stopKey, relaunch.reason, band.id);
      }
    }

    return chestEntry;
  }

  function chooseRoute(choiceId) {
    const run = state.expeditions.activeRun;
    if (!run) {
      return { ok: false, reason: "No active expedition." };
    }
    if (!run.awaitingChoice) {
      return { ok: false, reason: "No voyage decision pending." };
    }

    const band = getBandById(run.bandId);
    if (!band) {
      return { ok: false, reason: "Unknown expedition voyage." };
    }

    const choice = (run.pendingChoices || []).find((item) => item.id === choiceId);
    if (!choice) {
      return { ok: false, reason: "Invalid voyage choice." };
    }
    if (!choice.unlocked) {
      return { ok: false, reason: choice.lockReason || "Voyage option is locked by ascension requirements." };
    }

    applyOutcome(run, {
      riskDelta: choice.riskDelta,
      yieldDelta: choice.yieldDelta,
      speedMultiplier: choice.speedMultiplier,
      intelFlat: choice.intelFlat
    });

    run.routeHistory.push({
      stage: run.stageIndex + 1,
      id: choice.id,
      name: choice.name
    });
    run.awaitingChoice = false;
    run.pendingChoices = [];
    run.segmentDurationSeconds = segmentDurationSeconds(run, band);

    const encounter = resolveEncounter(run, band, choice);
    eventBus.emit("expedition:branch", {
      bandId: run.bandId,
      stage: run.stageIndex + 1,
      choiceId: choice.id,
      encounter: encounter?.name || null
    });

    return { ok: true, encounter };
  }

  function advance(dtSeconds, offlineMultiplier = 1) {
    const run = state.expeditions.activeRun;
    if (!run) {
      return { resolved: false };
    }
    if (run.awaitingChoice) {
      const autoResult = autoChooseRouteIfNeeded();
      if (autoResult.ok) {
        return { resolved: false, needsChoice: false, autoRouted: true };
      }
      return { resolved: false, needsChoice: true };
    }

    const safeDelta = Math.max(0, Number(dtSeconds) || 0) * Math.max(0, Number(offlineMultiplier) || 0);
    if (safeDelta <= 0) {
      return { resolved: false };
    }

    run.elapsedSeconds += safeDelta;
    run.segmentElapsedSeconds += safeDelta;
    eventBus.emit("expedition:step", {
      bandId: run.bandId,
      elapsedSeconds: run.elapsedSeconds,
      durationSeconds: run.totalDurationSeconds
    });

    if (run.segmentElapsedSeconds < run.segmentDurationSeconds) {
      return { resolved: false };
    }

    run.segmentElapsedSeconds = 0;
    run.stageIndex += 1;

    const band = getBandById(run.bandId);
    if (!band) {
      state.expeditions.activeRun = null;
      return { resolved: false };
    }

    if (run.stageIndex >= run.stageCount) {
      resolveActiveRun();
      return { resolved: true };
    }

    run.awaitingChoice = true;
    run.pendingChoices = buildStageChoices(run, band, run.stageIndex);
    autoChooseRouteIfNeeded();
    eventBus.emit("expedition:event", {
      type: "routeChoice",
      stage: run.stageIndex + 1,
      options: run.pendingChoices.map((item) => item.id)
    });
    return { resolved: false, needsChoice: true };
  }

  function claimChestEntry(entry) {
    ensureCollectionReady();
    const rewards = entry?.rewards || {};
    const policy = expeditionBalance.duplicateBlueprintPolicy || {};
    const drops = Array.isArray(entry?.drops) ? entry.drops : [];
    let duplicateIntel = 0;
    let duplicateShards = 0;

    drops.forEach((drop) => {
      if (!drop?.id) {
        return;
      }
      const mapDef = getVoyageMapDef(drop.id);
      if (mapDef) {
        const mapInventory = getMapInventory();
        mapInventory[mapDef.id] = Math.max(0, Number(mapInventory[mapDef.id]) || 0) + 1;
      } else if (drop.blueprintForShip) {
        const existing = state.expeditions.blueprintInventory[drop.id] || 0;
        if (existing > 0) {
          duplicateIntel += Math.max(0, Number(policy.intelPerDuplicate) || 0);
          duplicateShards += Math.max(0, Number(policy.shardsPerDuplicate) || 0);
        } else {
          state.expeditions.blueprintInventory[drop.id] = 1;
        }
      } else {
        state.expeditions.partInventory[drop.id] = (state.expeditions.partInventory[drop.id] || 0) + 1;
      }

      registerCollectionDiscovery(COLLECTION_DEFAULT_SOURCE_ID, drop.id, {
        name: drop.name || drop.id,
        rarity: drop.rarity || "rare",
        discoveredAt: Date.now()
      });
    });

    resourceManager.add("matter", rewards.matter || 0);
    resourceManager.add("fire", rewards.fire || 0);
    resourceManager.add("shards", rewards.shards || 0);
    resourceManager.add("shards", duplicateShards);
    state.expeditions.meta.intel += Math.max(0, rewards.intel || 0);
    state.expeditions.meta.intel += duplicateIntel;

    return {
      rewards,
      success: Boolean(entry?.success),
      bandId: entry?.bandId || "",
      bandName: entry?.bandName || "",
      drops,
      duplicateIntel,
      duplicateShards
    };
  }

  function useVoyageMap(mapId) {
    const mapDef = getVoyageMapDef(mapId);
    if (!mapDef) {
      return { ok: false, reason: "Unknown voyage map." };
    }

    const targetBand = getBandById(mapDef.unlocksBandId);
    if (!targetBand) {
      return { ok: false, reason: "This map has no valid voyage to unlock." };
    }

    const unlockedBands = getUnlockedBandMapState();
    if (unlockedBands[targetBand.id]) {
      return { ok: false, reason: `${targetBand.name} is already unlocked.` };
    }

    const mapInventory = getMapInventory();
    const owned = Math.max(0, Number(mapInventory[mapDef.id]) || 0);
    if (owned <= 0) {
      return { ok: false, reason: `Missing ${mapDef.name}.` };
    }

    if (owned <= 1) {
      delete mapInventory[mapDef.id];
    } else {
      mapInventory[mapDef.id] = owned - 1;
    }
    unlockedBands[targetBand.id] = true;

    eventBus.emit("expedition:mapUsed", {
      mapId: mapDef.id,
      mapName: mapDef.name,
      bandId: targetBand.id,
      bandName: targetBand.name
    });

    return {
      ok: true,
      mapId: mapDef.id,
      mapName: mapDef.name,
      bandId: targetBand.id,
      bandName: targetBand.name,
      remaining: Math.max(0, Number(mapInventory[mapDef.id]) || 0)
    };
  }

  function claimChestOne() {
    const chest = getRewardsChest();
    if (chest.items.length === 0) {
      return { ok: false, reason: "Rewards chest is empty." };
    }

    const entry = chest.items.shift();
    const result = claimChestEntry(entry);
    eventBus.emit("expedition:claim", {
      ...result,
      chestCount: chest.items.length,
      chestCapacity: chest.capacity,
      runsClaimed: 1
    });

    return {
      ok: true,
      ...result,
      chestCount: chest.items.length,
      chestCapacity: chest.capacity,
      runsClaimed: 1
    };
  }

  function getClaimAllPreview() {
    const chest = getRewardsChest();
    if (chest.items.length === 0) {
      return { ok: false, reason: "Rewards chest is empty." };
    }

    const policy = expeditionBalance.duplicateBlueprintPolicy || {};
    const previewBlueprintInventory = { ...(state.expeditions.blueprintInventory || {}) };
    const rewards = cloneRewards();
    let duplicateIntel = 0;
    let duplicateShards = 0;
    const drops = [];

    chest.items.forEach((entry) => {
      const entryRewards = entry?.rewards || {};
      rewards.matter += Math.max(0, Number(entryRewards.matter) || 0);
      rewards.fire += Math.max(0, Number(entryRewards.fire) || 0);
      rewards.shards += Math.max(0, Number(entryRewards.shards) || 0);
      rewards.intel += Math.max(0, Number(entryRewards.intel) || 0);

      const entryDrops = Array.isArray(entry?.drops) ? entry.drops : [];
      entryDrops.forEach((drop) => {
        if (!drop?.id) {
          return;
        }
        drops.push(drop);
        if (drop.blueprintForShip) {
          const existing = previewBlueprintInventory[drop.id] || 0;
          if (existing > 0) {
            duplicateIntel += Math.max(0, Number(policy.intelPerDuplicate) || 0);
            duplicateShards += Math.max(0, Number(policy.shardsPerDuplicate) || 0);
          } else {
            previewBlueprintInventory[drop.id] = 1;
          }
        }
      });
    });

    return {
      ok: true,
      runCount: chest.items.length,
      rewards,
      duplicateIntel,
      duplicateShards,
      totalRewards: {
        matter: rewards.matter,
        fire: rewards.fire,
        shards: rewards.shards + duplicateShards,
        intel: rewards.intel + duplicateIntel
      },
      drops
    };
  }

  function claimChestAll() {
    const chest = getRewardsChest();
    if (chest.items.length === 0) {
      return { ok: false, reason: "Rewards chest is empty." };
    }

    const claimed = [];
    while (chest.items.length > 0) {
      claimed.push(claimChestEntry(chest.items.shift()));
    }

    const mergedRewards = cloneRewards();
    let duplicateIntel = 0;
    let duplicateShards = 0;
    const allDrops = [];
    claimed.forEach((entry) => {
      mergedRewards.matter += Math.max(0, Number(entry.rewards?.matter) || 0);
      mergedRewards.fire += Math.max(0, Number(entry.rewards?.fire) || 0);
      mergedRewards.shards += Math.max(0, Number(entry.rewards?.shards) || 0);
      mergedRewards.intel += Math.max(0, Number(entry.rewards?.intel) || 0);
      duplicateIntel += Math.max(0, Number(entry.duplicateIntel) || 0);
      duplicateShards += Math.max(0, Number(entry.duplicateShards) || 0);
      if (Array.isArray(entry.drops)) {
        allDrops.push(...entry.drops);
      }
    });

    eventBus.emit("expedition:claim", {
      rewards: mergedRewards,
      success: claimed.every((entry) => entry.success),
      bandId: claimed.length === 1 ? claimed[0].bandId : "multiple",
      drops: allDrops,
      duplicateIntel,
      duplicateShards,
      chestCount: chest.items.length,
      chestCapacity: chest.capacity,
      runsClaimed: claimed.length
    });

    return {
      ok: true,
      rewards: mergedRewards,
      success: claimed.every((entry) => entry.success),
      bandId: claimed.length === 1 ? claimed[0].bandId : "multiple",
      drops: allDrops,
      duplicateIntel,
      duplicateShards,
      chestCount: chest.items.length,
      chestCapacity: chest.capacity,
      runsClaimed: claimed.length
    };
  }

  function claim() {
    return claimChestOne();
  }

  function abandon() {
    if (!state.expeditions.activeRun) {
      return { ok: false, reason: "No active expedition." };
    }
    const bandId = state.expeditions.activeRun.bandId;
    state.expeditions.activeRun = null;
    state.lifetime.expeditionLosses += 1;
    state.expeditions.meta.failedRuns += 1;
    stopContinuous("cancelled", CONTINUOUS_STOP_MESSAGES.cancelled, bandId);
    eventBus.emit("expedition:event", { type: "abandoned", bandId });
    return { ok: true };
  }

  function handleAscendReset() {
    state.expeditions.activeRun = null;
    state.expeditions.pendingRewards = null;
    const chest = getRewardsChest();
    chest.items = [];
    const continuous = getContinuousState();
    continuous.active = false;
    continuous.bandId = null;
    continuous.stopReason = "";
  }

  function setAutoRouteMode(mode) {
    const next = normalizeAutoMode(mode);
    state.expeditions.meta.autoRouteMode = next;
    if (state.expeditions.activeRun) {
      state.expeditions.activeRun.autoRouteMode = next;
      if (state.expeditions.activeRun.awaitingChoice && next !== "manual") {
        autoChooseRouteIfNeeded();
      }
    }
    return { ok: true, mode: next };
  }

  function getStatus() {
    ensureCollectionReady();
    const chest = getRewardsChest();
    const continuous = getContinuousState();
    const mapInventory = getMapInventory();
    const pendingFallback = chest.items.length > 0 ? chest.items[0] : null;
    return {
      unlockNodeId,
      unlocked: !unlockNodeId || Boolean(state.ascensionTree[unlockNodeId]),
      selectedShip: state.expeditions.selectedShip,
      selectedShipStats: getSelectedShipContext()?.stats || null,
      activeRun: state.expeditions.activeRun,
      pendingRewards: state.expeditions.pendingRewards || pendingFallback,
      rewardsChest: chest,
      continuous,
      meta: state.expeditions.meta,
      mapInventory: { ...mapInventory },
      voyageMaps: getVoyageMaps(),
      collection: getCollectionStatus(),
      autoRouteMode: normalizeAutoMode(state.expeditions.meta.autoRouteMode),
      bands: getBands()
    };
  }

  return {
    getStatus,
    getBands,
    isBandUnlocked,
    start,
    chooseRoute,
    setAutoRouteMode,
    advance,
    claim,
    claimChestOne,
    claimChestAll,
    getClaimAllPreview,
    useVoyageMap,
    buyVoyage,
    getVoyageMaps,
    registerCollectionDiscovery,
    getCollectionStatus,
    claimCollectionMilestone,
    abandon,
    stopContinuous,
    handleAscendReset
  };
}
