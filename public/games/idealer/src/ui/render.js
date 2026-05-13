import { ascendCost, ascendShardGainFromResources, generatorCost } from "../engine/formulas.js";
import { researchCost } from "../game/researchSystem.js";

const VIEW_STATE_STORAGE_PREFIX = "dimensionalAlchemy.viewState";
const VALID_MAIN_TABS = new Set(["upgrades", "research", "expeditions", "collection", "dungeons", "ascend"]);
const VALID_EXPEDITION_VIEWS = new Set(["runs", "fleet", "ship"]);
const DUNGEON_DIRECTION_LABELS = {
  north: "North",
  east: "East",
  south: "South",
  west: "West"
};

function formatIntOrFixed(value, digits = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "0";
  }
  const factor = 10 ** digits;
  const rounded = Math.round(numeric * factor) / factor;
  if (Number.isInteger(rounded)) {
    return String(rounded);
  }
  return rounded.toFixed(digits);
}

function formatPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "0%";
  }
  return `${formatIntOrFixed(numeric * 100)}%`;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return "∞";
  }
  const rounded = Math.round(value * 100) / 100;
  const abs = Math.abs(rounded);
  if (abs >= 1_000_000_000) {
    return rounded.toExponential(2).replace("e+", "e");
  }
  if (abs >= 1_000_000) {
    return `${formatIntOrFixed(rounded / 1_000_000)}M`;
  }
  if (abs >= 1_000) {
    return `${formatIntOrFixed(rounded / 1_000)}K`;
  }
  return formatIntOrFixed(rounded);
}

function formatScaledNumber(value, scale) {
  const scaled = value * scale;
  return formatIntOrFixed(scaled);
}

function scaleDescription(text, scale) {
  if (!scale || scale === 1) {
    return text;
  }
  return text.replace(/-?\d+(?:\.\d+)?/g, (match) => {
    const value = Number(match);
    if (!Number.isFinite(value)) {
      return match;
    }
    return formatScaledNumber(value, scale);
  });
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return `${minutes}:${String(rem).padStart(2, "0")}`;
}

function formatInt(value) {
  return Math.max(0, Math.floor(Number(value) || 0)).toLocaleString("en-US");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toTitleToken(value) {
  return String(value || "")
    .trim()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildViewStateStorageKey(activeSlotId = "default") {
  const normalizedSlot = typeof activeSlotId === "string" && activeSlotId.trim()
    ? activeSlotId.trim()
    : "default";
  return `${VIEW_STATE_STORAGE_PREFIX}:${normalizedSlot}`;
}

function loadViewState(storageKey) {
  const defaults = {
    activeTab: "upgrades",
    expeditionsView: "runs"
  };
  if (typeof window === "undefined" || !window.localStorage) {
    return defaults;
  }
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return defaults;
    }
    const parsed = JSON.parse(raw);
    const activeTab = VALID_MAIN_TABS.has(parsed?.activeTab) ? parsed.activeTab : defaults.activeTab;
    const expeditionsView = VALID_EXPEDITION_VIEWS.has(parsed?.expeditionsView)
      ? parsed.expeditionsView
      : defaults.expeditionsView;
    return {
      activeTab,
      expeditionsView
    };
  } catch {
    return defaults;
  }
}

function persistViewState(storageKey, viewState) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(viewState));
  } catch {
    // Ignore storage failures in restrictive browser modes.
  }
}

const COLLECTION_EFFECT_META = {
  matterRateMultiplier: { label: "Matter production", mode: "multiplier", order: 10 },
  fireRateMultiplier: { label: "Fire production", mode: "multiplier", order: 11 },
  productionMultiplier: { label: "All production", mode: "multiplier", order: 12 },
  prestigeGainMultiplier: { label: "Shard gain", mode: "multiplier", order: 20 },
  expeditionYieldMultiplier: { label: "Expedition yield", mode: "multiplier", order: 30 },
  expeditionSpeedMultiplier: { label: "Expedition speed", mode: "multiplier", order: 31 },
  expeditionIntelMultiplier: { label: "Expedition intel gain", mode: "multiplier", order: 32 },
  expeditionRiskMitigation: { label: "Expedition risk mitigation", mode: "percent", order: 33 },
  expeditionShardBonus: { label: "Expedition shard bonus", mode: "percent", order: 34 },
  rewardsChestCapacityBonus: { label: "Rewards chest capacity", mode: "integer", order: 40 },
  partTierCapBonus: { label: "Part tier cap", mode: "integer", order: 41 },
  facilityMaxLevelBonus: { label: "Facility max level", mode: "integer", order: 42 }
};

function formatSignedPercent(value) {
  const magnitude = Math.abs(value * 100);
  return `${value >= 0 ? "+" : "-"}${formatIntOrFixed(magnitude)}%`;
}

function formatSignedFlat(value) {
  const magnitude = Math.abs(value);
  return `${value >= 0 ? "+" : "-"}${formatIntOrFixed(magnitude)}`;
}

function toCollectionEffectDelta(effectKey, rawValue) {
  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  const mode = COLLECTION_EFFECT_META[effectKey]?.mode;
  if (mode === "multiplier" || (!mode && String(effectKey).endsWith("Multiplier"))) {
    return numeric - 1;
  }
  return numeric;
}

function formatCollectionEffectLabel(effectKey, totalDelta) {
  if (!Number.isFinite(totalDelta) || Math.abs(totalDelta) < 1e-9) {
    return "";
  }
  const meta = COLLECTION_EFFECT_META[effectKey] || {};
  const label = meta.label || toTitleToken(effectKey);
  const mode = meta.mode || (String(effectKey).endsWith("Multiplier") ? "multiplier" : "flat");
  if (mode === "multiplier" || mode === "percent") {
    return `${formatSignedPercent(totalDelta)} ${label}`;
  }
  if (mode === "integer") {
    const rounded = Math.round(totalDelta);
    if (rounded === 0) {
      return "";
    }
    return `${rounded >= 0 ? "+" : "-"}${Math.abs(rounded).toLocaleString("en-US")} ${label}`;
  }
  return `${formatSignedFlat(totalDelta)} ${label}`;
}

function getClaimedCollectionEffectSummary(milestones) {
  const totals = {};
  (Array.isArray(milestones) ? milestones : []).forEach((milestone) => {
    if (!milestone?.claimed) {
      return;
    }
    const effect = milestone.effect && typeof milestone.effect === "object" ? milestone.effect : {};
    Object.entries(effect).forEach(([effectKey, effectValue]) => {
      const delta = toCollectionEffectDelta(effectKey, effectValue);
      if (!Number.isFinite(delta) || Math.abs(delta) < 1e-9) {
        return;
      }
      totals[effectKey] = (totals[effectKey] || 0) + delta;
    });
  });

  return Object.entries(totals)
    .sort((left, right) => {
      const leftMeta = COLLECTION_EFFECT_META[left[0]] || {};
      const rightMeta = COLLECTION_EFFECT_META[right[0]] || {};
      const orderDelta = (leftMeta.order || 999) - (rightMeta.order || 999);
      if (orderDelta !== 0) {
        return orderDelta;
      }
      const leftLabel = leftMeta.label || toTitleToken(left[0]);
      const rightLabel = rightMeta.label || toTitleToken(right[0]);
      return leftLabel.localeCompare(rightLabel);
    })
    .map(([effectKey, totalDelta]) => formatCollectionEffectLabel(effectKey, totalDelta))
    .filter(Boolean);
}

export function createRenderer({ appEl, state, balance, currencyDisplay = {}, generatorDefs, formulas, systems, saveSlots, debugOptions = {}, eventBus = null }) {
  const viewStateStorageKey = buildViewStateStorageKey(saveSlots?.activeSlotId);
  const persistedViewState = loadViewState(viewStateStorageKey);

  const ui = {
    notice: "",
    good: false,
    activeTab: persistedViewState.activeTab,
    debugPanelVisible: false,
    lastDebugRefreshAt: 0,
    isBound: false,
    panelEl: null,
    pinnedEl: null,
    ascendView: null,
    expeditionsView: persistedViewState.expeditionsView,
    fleetFocusSlot: "hull",
    draggingPartId: "",
    dragHoverSlot: "",
    dragSourceType: "",
    dragSourceSlot: "",
    dragSourceShipId: "",
    dragDropHandled: false,
    rareDropPopups: [],
    rareDropPopupId: 0,
    dungeonBubbles: [],
    dungeonBubbleId: 0,
    dungeonBubbleBound: false,
    rareDropTableState: {},
    lastExpeditionSignature: "",
    lastDungeonSignature: "",
    lastDungeonLiveState: null,
    scrollPositions: {
      upgrades: 0,
      research: 0,
      expeditions: 0,
      collection: 0,
      dungeons: 0
    }
  };

  const refs = {};
  const currencyMeta = currencyDisplay && typeof currencyDisplay === "object" ? currencyDisplay : {};
  const rareDropNameById = Object.values(balance?.expeditions?.rareBlueprintDrops || {})
    .flat()
    .reduce((map, drop) => {
      const dropId = typeof drop?.id === "string" ? drop.id.trim() : "";
      const dropName = typeof drop?.name === "string" ? drop.name.trim() : "";
      if (!dropId || !dropName || map[dropId]) {
        return map;
      }
      map[dropId] = dropName;
      return map;
    }, {});

  function toFallbackToken(value, maxChars = 3) {
    const text = String(value || "").trim();
    if (!text) {
      return "?";
    }
    const words = text.split(/[^A-Za-z0-9]+/).filter(Boolean);
    if (words.length >= 2) {
      return words
        .slice(0, maxChars)
        .map((word) => word.charAt(0).toUpperCase())
        .join("");
    }
    const compact = text.replace(/[^A-Za-z0-9]/g, "").slice(0, maxChars);
    return compact ? compact.toUpperCase() : "?";
  }

  function toIconSlug(value) {
    const slug = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return slug || "unknown";
  }

  function getDropDisplayName(dropId, fallback = "") {
    const cleanDropId = typeof dropId === "string" ? dropId.trim() : "";
    if (cleanDropId && rareDropNameById[cleanDropId]) {
      return rareDropNameById[cleanDropId];
    }
    if (fallback) {
      return fallback;
    }
    return cleanDropId ? toTitleToken(cleanDropId) : "Unknown Drop";
  }

  function normalizeCurrencyId(resourceId) {
    const normalized = String(resourceId || "matter").trim().toLowerCase();
    return normalized || "matter";
  }

  function getCurrencyConfig(resourceId) {
    const id = normalizeCurrencyId(resourceId);
    const configured = currencyMeta[id];
    if (configured && typeof configured === "object") {
      return {
        id,
        label: configured.label || toTitleToken(id),
        cardFallback: configured.cardFallback || configured.inlineFallback || "?",
        inlineFallback: configured.inlineFallback || configured.cardFallback || "?",
        iconPath: configured.iconPath || "",
        alt: configured.alt || `${configured.label || toTitleToken(id)} icon`
      };
    }

    const label = toTitleToken(id);
    const cardFallback = (label || "?").slice(0, 3).toUpperCase() || "?";
    return {
      id,
      label,
      cardFallback,
      inlineFallback: cardFallback.charAt(0) || "?",
      iconPath: "",
      alt: `${label || "Resource"} icon`
    };
  }

  function renderCurrencyIcon(resourceId, variant = "inline") {
    const currency = getCurrencyConfig(resourceId);
    const fallback = variant === "card"
      ? (currency.cardFallback || currency.inlineFallback || "?")
      : (currency.inlineFallback || currency.cardFallback || "?");
    const iconClass = variant === "card"
      ? "currency-icon currency-icon--card card-icon"
      : "currency-icon currency-icon--inline";
    const imageMarkup = currency.iconPath
      ? `<img class="currency-icon__image" src="${currency.iconPath}" data-icon-src="${currency.iconPath}" alt="" loading="eager" decoding="async" draggable="false">`
      : "";
    return `<span class="${iconClass}" data-currency-icon data-currency-id="${currency.id}" title="${currency.label}" role="img" aria-label="${currency.alt}">${imageMarkup}<span class="currency-icon__fallback" aria-hidden="true">${fallback}</span></span>`;
  }

  function renderExpeditionItemIcon(itemId, options = {}) {
    const variant = typeof options.variant === "string" && options.variant.trim()
      ? options.variant.trim()
      : "inline";
    const label = typeof options.label === "string" && options.label.trim()
      ? options.label.trim()
      : getDropDisplayName(itemId);
    const iconKey = toIconSlug(options.iconKey || itemId || label);
    const iconPath = typeof options.iconPath === "string" && options.iconPath.trim()
      ? options.iconPath.trim()
      : `assets/icons/expedition-items/${iconKey}.png`;
    const fallback = typeof options.fallback === "string" && options.fallback.trim()
      ? options.fallback.trim()
      : toFallbackToken(label);
    const iconClass = `drop-icon drop-icon--${variant}`;
    return `<span class="${iconClass}" data-drop-icon data-drop-key="${iconKey}" title="${label}" role="img" aria-label="${label} icon"><img class="drop-icon__image" src="${iconPath}" alt="" loading="lazy" decoding="async" draggable="false"><span class="drop-icon__fallback" aria-hidden="true">${fallback}</span></span>`;
  }

  function formatCurrencyAmount(resourceId, amount, options = {}) {
    const { showPositiveSign = false } = options;
    const numeric = Number(amount);
    const safeValue = Number.isFinite(numeric) ? numeric : 0;
    const sign = showPositiveSign && safeValue >= 0 ? "+" : "";
    return `${sign}${formatNumber(safeValue)}${renderCurrencyIcon(resourceId)}`;
  }

  function hydrateCurrencyIcons(root = appEl) {
    if (!root) {
      return;
    }
    root.querySelectorAll("[data-currency-icon]").forEach((iconEl) => {
      const imageEl = iconEl.querySelector(".currency-icon__image");
      if (!imageEl) {
        iconEl.classList.remove("is-loaded");
        return;
      }

      const applyLoadState = () => {
        if (imageEl.naturalWidth > 0) {
          iconEl.classList.add("is-loaded");
        } else {
          iconEl.classList.remove("is-loaded");
        }
      };

      if (imageEl.dataset.iconBound !== "true") {
        imageEl.dataset.iconBound = "true";
        imageEl.addEventListener("load", applyLoadState);
        imageEl.addEventListener("error", () => {
          iconEl.classList.remove("is-loaded");
        });
      }

      if (imageEl.complete) {
        applyLoadState();
      }
    });
  }

  function hydrateDropIcons(root = appEl) {
    if (!root) {
      return;
    }
    root.querySelectorAll("[data-drop-icon]").forEach((iconEl) => {
      const imageEl = iconEl.querySelector(".drop-icon__image");
      if (!imageEl) {
        iconEl.classList.remove("is-loaded");
        return;
      }

      const applyLoadState = () => {
        if (imageEl.naturalWidth > 0) {
          iconEl.classList.add("is-loaded");
        } else {
          iconEl.classList.remove("is-loaded");
        }
      };

      if (imageEl.dataset.iconBound !== "true") {
        imageEl.dataset.iconBound = "true";
        imageEl.addEventListener("load", applyLoadState);
        imageEl.addEventListener("error", () => {
          iconEl.classList.remove("is-loaded");
        });
      }

      if (imageEl.complete) {
        applyLoadState();
      }
    });
  }

  function hydrateUiIcons(root = appEl) {
    hydrateCurrencyIcons(root);
    hydrateDropIcons(root);
  }

  function persistCurrentViewState() {
    persistViewState(viewStateStorageKey, {
      activeTab: ui.activeTab,
      expeditionsView: ui.expeditionsView
    });
  }

  function snapshotRareDropTableState() {
    if (!ui.panelEl) {
      return;
    }
    ui.panelEl
      .querySelectorAll("details.expedition-loot-table[data-loot-table-key]")
      .forEach((detailsEl) => {
        const key = detailsEl.dataset.lootTableKey;
        if (!key) {
          return;
        }
        ui.rareDropTableState[key] = detailsEl.open;
      });
  }

  function setNotice(text, good = false) {
    ui.notice = text;
    ui.good = good;
  }

  function pruneDungeonBubbles(now = Date.now()) {
    ui.dungeonBubbles = ui.dungeonBubbles.filter((bubble) => bubble.expiresAt > now);
  }

  function queueDungeonBubble({ roomId, x, y, message, variant = "good", durationMs = 2200 }) {
    if (!message || typeof roomId !== "string") {
      return;
    }
    const tileX = Math.floor(Number(x));
    const tileY = Math.floor(Number(y));
    if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) {
      return;
    }

    const now = Date.now();
    pruneDungeonBubbles(now);
    ui.dungeonBubbleId += 1;
    ui.dungeonBubbles.push({
      id: ui.dungeonBubbleId,
      roomId,
      x: tileX,
      y: tileY,
      message: String(message),
      variant,
      expiresAt: now + clamp(Math.floor(Number(durationMs) || 2200), 600, 7000)
    });

    if (ui.dungeonBubbles.length > 40) {
      ui.dungeonBubbles = ui.dungeonBubbles.slice(ui.dungeonBubbles.length - 40);
    }
  }

  function formatDungeonLootBubbleText(loot) {
    const parts = (Array.isArray(loot) ? loot : [])
      .filter((entry) => entry && entry.collected !== false)
      .map((entry) => {
        const count = Math.max(0, Math.floor(Number(entry.count) || 0));
        const label = toTitleToken(entry.itemName || entry.itemId || "item");
        return count > 0 ? `${formatInt(count)} ${label}` : "";
      })
      .filter(Boolean);
    return parts.length > 0 ? parts.slice(0, 3).join(", ") : "nothing";
  }

  function formatDungeonPrimaryLootBubbleText(loot) {
    const first = (Array.isArray(loot) ? loot : [])
      .find((entry) => entry && entry.collected !== false);
    if (!first) {
      return "nothing";
    }
    const count = Math.max(0, Math.floor(Number(first.count) || 0));
    const label = toTitleToken(first.itemName || first.itemId || "item");
    return `${formatInt(count)}x ${label}`;
  }

  function setupDungeonInteractionBubbles() {
    if (ui.dungeonBubbleBound || !eventBus || typeof eventBus.on !== "function") {
      return;
    }
    ui.dungeonBubbleBound = true;

    eventBus.on("dungeon:pickup", (payload = {}) => {
      queueDungeonBubble({
        roomId: payload.roomId,
        x: payload.x,
        y: payload.y,
        message: `Picked up ${payload.itemName || toTitleToken(payload.itemId || "item")}`,
        variant: "good"
      });
    });

    eventBus.on("dungeon:gather", (payload = {}) => {
      const itemName = payload.itemName || toTitleToken(payload.itemId || "resource");
      const amount = Math.max(0, Math.floor(Number(payload.amount) || 0));
      const nodeName = String(payload.nodeName || payload.nodeType || "resource").toLowerCase();
      const message = nodeName.includes("tree")
        ? `Chopped tree for ${formatInt(amount)} ${itemName}`
        : `Gathered ${formatInt(amount)} ${itemName}`;
      queueDungeonBubble({
        roomId: payload.roomId,
        x: payload.x,
        y: payload.y,
        message,
        variant: "good"
      });
    });

    eventBus.on("dungeon:chestOpened", (payload = {}) => {
      const lootText = formatDungeonLootBubbleText(payload.loot);
      queueDungeonBubble({
        roomId: payload.roomId,
        x: payload.x,
        y: payload.y,
        message: `Looted chest for ${lootText}`,
        variant: "good"
      });
    });

    eventBus.on("dungeon:mobDefeated", (payload = {}) => {
      const lootText = formatDungeonPrimaryLootBubbleText(payload.loot);
      const mobName = payload.mobName || toTitleToken(payload.mobType || "mob");
      queueDungeonBubble({
        roomId: payload.roomId,
        x: payload.x,
        y: payload.y,
        message: `${mobName} dropped ${lootText}`,
        variant: "good"
      });
    });

    eventBus.on("dungeon:drop", (payload = {}) => {
      const itemName = payload.itemName || toTitleToken(payload.itemId || "item");
      const count = Math.max(0, Math.floor(Number(payload.count) || 0));
      queueDungeonBubble({
        roomId: payload.roomId,
        x: payload.x,
        y: payload.y,
        message: `Dropped ${formatInt(count)}x ${itemName}`,
        variant: "info",
        durationMs: 1600
      });
    });

    eventBus.on("dungeon:mobFailed", (payload = {}) => {
      queueDungeonBubble({
        roomId: payload.roomId,
        x: payload.x,
        y: payload.y,
        message: `Need power ${formatInt(payload.requiredPower || 0)}`,
        variant: "bad",
        durationMs: 1800
      });
    });

    eventBus.on("dungeon:requirementFailed", (payload = {}) => {
      const fallbackMessage = payload.requiredItemId
        ? `Need ${toTitleToken(payload.requiredItemId)}`
        : "Missing required item";
      queueDungeonBubble({
        roomId: payload.roomId,
        x: payload.x,
        y: payload.y,
        message: payload.message || fallbackMessage,
        variant: "bad",
        durationMs: 1800
      });
    });

    eventBus.on("dungeon:craft", (payload = {}) => {
      const outputName = payload.outputName || toTitleToken(payload.outputItemId || "item");
      queueDungeonBubble({
        roomId: payload.roomId,
        x: payload.x,
        y: payload.y,
        message: `Crafted ${formatInt(payload.outputCount || 0)} ${outputName}`,
        variant: "good"
      });
    });

    eventBus.on("dungeon:unlock", (payload = {}) => {
      queueDungeonBubble({
        roomId: payload.roomId,
        x: payload.x,
        y: payload.y,
        message: `Unlocked ${toTitleToken(payload.direction || "door")} door`,
        variant: "info"
      });
    });

    eventBus.on("dungeon:craftStationOpened", (payload = {}) => {
      queueDungeonBubble({
        roomId: payload.roomId,
        x: payload.x,
        y: payload.y,
        message: "Workbench ready",
        variant: "info",
        durationMs: 1600
      });
    });

    eventBus.on("dungeon:descend", (payload = {}) => {
      queueDungeonBubble({
        roomId: payload.roomId,
        x: payload.x,
        y: payload.y,
        message: `Descended to depth ${formatInt(payload.nextDepth || 1)}`,
        variant: "info",
        durationMs: 2200
      });
    });
  }

  function toDungeonTileKey(x, y) {
    return `${Math.floor(Number(x) || 0)},${Math.floor(Number(y) || 0)}`;
  }

  function parseDungeonTileKey(key) {
    const [xRaw, yRaw] = String(key || "").split(",");
    const x = Math.floor(Number(xRaw));
    const y = Math.floor(Number(yRaw));
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }
    return { x, y };
  }

  function getDungeonTileMaps(room) {
    const floorItems = Array.isArray(room?.floorItems) ? room.floorItems : [];
    const gatherNodes = Array.isArray(room?.gatherNodes) ? room.gatherNodes : [];
    const livingMobs = (Array.isArray(room?.mobs) ? room.mobs : []).filter((mob) => mob.alive);
    const closedChests = (Array.isArray(room?.chests) ? room.chests : []).filter((chest) => !chest.opened);
    const remainingItems = floorItems.filter((item) => !item.pickedUp);

    return {
      itemsByKey: new Map(remainingItems.map((item) => [toDungeonTileKey(item.x, item.y), item])),
      gatherByKey: new Map(gatherNodes.filter((node) => Number(node.remainingCharges || 0) > 0).map((node) => [toDungeonTileKey(node.x, node.y), node])),
      mobsByKey: new Map(livingMobs.map((mob) => [toDungeonTileKey(mob.x, mob.y), mob])),
      chestsByKey: new Map(closedChests.map((chest) => [toDungeonTileKey(chest.x, chest.y), chest])),
      doorsByKey: new Map(
        Object.values(room?.doors || {})
          .filter(Boolean)
          .map((door) => [toDungeonTileKey(door.x, door.y), door])
      )
    };
  }

  function getDungeonBubblesByKey(activeRoomId) {
    const bubblesByKey = new Map();
    ui.dungeonBubbles.forEach((bubble) => {
      if (bubble.roomId !== activeRoomId) {
        return;
      }
      const key = toDungeonTileKey(bubble.x, bubble.y);
      const existing = bubblesByKey.get(key) || [];
      existing.push(bubble);
      bubblesByKey.set(key, existing.slice(-3));
    });
    return bubblesByKey;
  }

  function getDungeonTilePresentation({ room, player, movement, tileMaps, bubblesByKey, x, y }) {
    const key = toDungeonTileKey(x, y);
    const door = tileMaps.doorsByKey.get(key);
    const item = tileMaps.itemsByKey.get(key);
    const gather = tileMaps.gatherByKey.get(key);
    const mob = tileMaps.mobsByKey.get(key);
    const chest = tileMaps.chestsByKey.get(key);
    const specialCrafting = room.special?.type === "crafting" && room.special.x === x && room.special.y === y;
    const specialDescend = room.special?.type === "descend" && room.special.x === x && room.special.y === y;
    const isPlayer = player.x === x && player.y === y;
    const isTarget = Boolean(movement) && movement.target?.x === x && movement.target?.y === y;

    let token = "";
    let title = `Tile (${x}, ${y})`;
    const classes = ["rift-cell"];

    if (door) {
      if (door.blocked) {
        classes.push("rift-cell--door-blocked");
        token = "X";
        title = `${DUNGEON_DIRECTION_LABELS[door.direction] || door.direction} Door: collapsed`;
      } else if (door.unlocked) {
        classes.push("rift-cell--door-open");
        token = (DUNGEON_DIRECTION_LABELS[door.direction] || "D").charAt(0);
        title = `${DUNGEON_DIRECTION_LABELS[door.direction] || door.direction} Door: open`;
      } else {
        classes.push("rift-cell--door-locked");
        token = "L";
        title = `${DUNGEON_DIRECTION_LABELS[door.direction] || door.direction} Door: locked (${door.lockTag || "key"})`;
      }
    }
    if (gather) {
      classes.push("rift-cell--gather");
      token = gather.nodeType === "tree" ? "T" : "R";
      title = `${gather.name} (${formatInt(gather.remainingCharges)} charges)`;
    }
    if (item) {
      classes.push("rift-cell--item");
      token = "I";
      title = `Item: ${item.name}`;
    }
    if (chest) {
      classes.push("rift-cell--chest");
      token = "C";
      title = `Chest: ${chest.name}`;
    }
    if (mob) {
      classes.push("rift-cell--mob");
      token = "M";
      title = `${mob.name} (power ${formatInt(mob.requiredPower || 1)})`;
    }
    if (specialCrafting) {
      classes.push("rift-cell--crafting");
      token = "W";
      title = `${room.special?.name || "Workbench"}`;
    }
    if (specialDescend) {
      classes.push("rift-cell--descend");
      token = "O";
      title = "Descend Hole";
    }
    if (isPlayer) {
      classes.push("rift-cell--player");
      token = "P";
      title = `${title} | You are here`;
    }
    if (isTarget) {
      classes.push("rift-cell--target");
      title = `${title} | Movement target`;
    }

    const tileBubbles = bubblesByKey.get(key) || [];
    const bubbleMarkup = tileBubbles
      .map((bubble, index) => `<span class="rift-cell-bubble rift-cell-bubble--${bubble.variant || "info"}" style="--bubble-index:${index};">${escapeHtml(bubble.message)}</span>`)
      .join("");

    return {
      x,
      y,
      classes,
      title,
      token,
      isTarget,
      bubbleMarkup
    };
  }

  function renderDungeonTileInnerMarkup(tile) {
    return `${tile.token ? `<span class="rift-cell-token">${tile.token}</span>` : ""}${tile.isTarget ? '<span class="rift-cell-target-marker">X</span>' : ""}${tile.bubbleMarkup}`;
  }

  function renderDungeonTileButtonMarkup(tile) {
    return `
      <button
        class="${tile.classes.join(" ")}"
        data-action="dungeon:tile:${tile.x}:${tile.y}"
        data-rift-x="${tile.x}"
        data-rift-y="${tile.y}"
        title="${escapeHtml(tile.title)}"
      >
        ${renderDungeonTileInnerMarkup(tile)}
      </button>
    `;
  }

  function applyDungeonTileElement(tileEl, tile) {
    tileEl.className = tile.classes.join(" ");
    tileEl.title = tile.title;
    tileEl.innerHTML = renderDungeonTileInnerMarkup(tile);
  }

  function getDungeonLiveSnapshot() {
    const status = systems.dungeons.getStatus();
    const run = status.activeRun;
    const room = status.currentRoom;
    if (!run || !room) {
      return null;
    }

    pruneDungeonBubbles();

    const player = status.player || run.player || { x: 0, y: 0 };
    const movement = status.movement || run.movement || null;
    const roomId = room.roomId || run.currentRoomId || "";
    const bubbleKeys = new Set();
    const bubbleTokens = [];
    ui.dungeonBubbles.forEach((bubble) => {
      if (bubble.roomId === roomId) {
        bubbleKeys.add(toDungeonTileKey(bubble.x, bubble.y));
        bubbleTokens.push(`${bubble.id}:${bubble.x}:${bubble.y}`);
      }
    });

    return {
      room,
      roomId,
      player,
      movement,
      playerKey: toDungeonTileKey(player.x, player.y),
      targetKey: movement?.target ? toDungeonTileKey(movement.target.x, movement.target.y) : "",
      bubbleKeys,
      bubbleSignature: bubbleTokens.join(",")
    };
  }

  function toStoredDungeonLiveState(snapshot) {
    if (!snapshot) {
      return null;
    }
    return {
      roomId: snapshot.roomId,
      playerKey: snapshot.playerKey,
      targetKey: snapshot.targetKey,
      bubbleKeys: Array.from(snapshot.bubbleKeys),
      bubbleSignature: snapshot.bubbleSignature
    };
  }

  function refreshDungeonLiveState() {
    if (ui.activeTab !== "dungeons" || !ui.panelEl) {
      ui.lastDungeonLiveState = null;
      return;
    }

    const snapshot = getDungeonLiveSnapshot();
    if (!snapshot) {
      ui.lastDungeonLiveState = null;
      return;
    }

    const previous = ui.lastDungeonLiveState;
    if (!previous || previous.roomId !== snapshot.roomId) {
      ui.lastDungeonLiveState = toStoredDungeonLiveState(snapshot);
      return;
    }

    const keysToRefresh = new Set();
    [previous.playerKey, snapshot.playerKey, previous.targetKey, snapshot.targetKey]
      .filter((key) => Boolean(key))
      .forEach((key) => keysToRefresh.add(key));

    if ((previous.bubbleSignature || "") !== (snapshot.bubbleSignature || "")) {
      (Array.isArray(previous.bubbleKeys) ? previous.bubbleKeys : []).forEach((key) => keysToRefresh.add(key));
      snapshot.bubbleKeys.forEach((key) => keysToRefresh.add(key));
    }

    const posXEl = ui.panelEl.querySelector("[data-dungeon-pos-x]");
    const posYEl = ui.panelEl.querySelector("[data-dungeon-pos-y]");
    if (posXEl) {
      posXEl.textContent = formatInt(snapshot.player.x);
    }
    if (posYEl) {
      posYEl.textContent = formatInt(snapshot.player.y);
    }

    if (keysToRefresh.size <= 0) {
      ui.lastDungeonLiveState = toStoredDungeonLiveState(snapshot);
      return;
    }

    const tileMaps = getDungeonTileMaps(snapshot.room);
    const bubblesByKey = getDungeonBubblesByKey(snapshot.roomId);

    keysToRefresh.forEach((key) => {
      const tilePos = parseDungeonTileKey(key);
      if (!tilePos) {
        return;
      }
      const tileEl = ui.panelEl.querySelector(`[data-rift-x="${tilePos.x}"][data-rift-y="${tilePos.y}"]`);
      if (!tileEl) {
        return;
      }

      const tile = getDungeonTilePresentation({
        room: snapshot.room,
        player: snapshot.player,
        movement: snapshot.movement,
        tileMaps,
        bubblesByKey,
        x: tilePos.x,
        y: tilePos.y
      });
      applyDungeonTileElement(tileEl, tile);
    });

    ui.lastDungeonLiveState = toStoredDungeonLiveState(snapshot);
  }

  function dismissRareDropPopup(popupId) {
    ui.rareDropPopups = ui.rareDropPopups.filter((popup) => popup.id !== popupId);
    renderRareDropPopups();
  }
  function renderRareDropPopups() {
    if (!refs.rarePopupStack) {
      return;
    }
    const now = Date.now();
    ui.rareDropPopups = ui.rareDropPopups.filter((popup) => popup.expiresAt > now);
    if (ui.rareDropPopups.length === 0) {
      refs.rarePopupStack.innerHTML = "";
      refs.rarePopupStack.classList.add("hidden");
      return;
    }

    refs.rarePopupStack.classList.remove("hidden");
    refs.rarePopupStack.innerHTML = ui.rareDropPopups
      .map((popup) => {
        const items = popup.items
          .map((item) => `<div class="rare-popup-item"><span class="rare-popup-rarity">${item.rarity}</span>${renderExpeditionItemIcon(item.id || item.name, { label: item.name, variant: "popup" })}<span>${item.name}</span></div>`)
          .join("");
        const overflow = popup.overflowCount > 0
          ? `<div class="rare-popup-more">+${popup.overflowCount} more rare drop${popup.overflowCount === 1 ? "" : "s"}</div>`
          : "";
        return `
          <article class="rare-popup" data-popup-id="${popup.id}">
            <button class="rare-popup-close" data-action="rare-popup:dismiss:${popup.id}" aria-label="Dismiss rare drop popup">x</button>
            <div class="rare-popup-title">Rare Drops Claimed</div>
            ${items}
            ${overflow}
          </article>
        `;
      })
      .join("");
    hydrateUiIcons(refs.rarePopupStack);
  }

  function showRareDropPopup(drops) {
    const rareDrops = (Array.isArray(drops) ? drops : [])
      .filter((drop) => drop && drop.id)
      .filter((drop) => ["semi-rare", "rare", "epic", "legendary"].includes(String(drop.rarity || "").toLowerCase()));
    if (rareDrops.length === 0) {
      return;
    }

    const popupItems = rareDrops.slice(0, 3).map((drop) => ({
      id: String(drop.id || ""),
      name: getDropDisplayName(drop.id, String(drop.name || drop.id)),
      rarity: toTitleToken(drop.rarity || "rare")
    }));

    ui.rareDropPopupId += 1;
    ui.rareDropPopups.unshift({
      id: ui.rareDropPopupId,
      items: popupItems,
      overflowCount: Math.max(0, rareDrops.length - popupItems.length),
      expiresAt: Date.now() + 7000
    });
    ui.rareDropPopups = ui.rareDropPopups.slice(0, 3);
    renderRareDropPopups();
  }

  function actionButton(label, className, action, disabled = false) {
    return `<button class="${className}" data-action="${action}" ${disabled ? "disabled" : ""}>${label}</button>`;
  }

  function formatCost(cost) {
    if (!cost) {
      return "Free";
    }
    const matter = Math.max(0, Number(cost.matter) || 0);
    const fire = Math.max(0, Number(cost.fire) || 0);
    const shards = Math.max(0, Number(cost.shards) || 0);
    const intel = Math.max(0, Number(cost.intel) || 0);
    const parts = [formatCurrencyAmount("matter", matter), formatCurrencyAmount("fire", fire)];
    if (intel > 0) {
      parts.push(formatCurrencyAmount("intel", intel));
    }
    if (shards > 0) {
      parts.push(formatCurrencyAmount("shards", shards));
    }
    return parts.join(" | ");
  }

  function formatPartEffects(effects) {
    return Object.entries(effects || {})
      .map(([key, value]) => `${key} ${value >= 0 ? "+" : ""}${formatPercent(Number(value) || 0)}`)
      .join(" | ");
  }

  function scalePartEffects(effects, scale = 1) {
    const scaled = {};
    Object.entries(effects || {}).forEach(([key, value]) => {
      const numeric = Number(value) || 0;
      scaled[key] = numeric * scale;
    });
    return scaled;
  }

  function getBandRareDrops(bandId) {
    const table = balance?.expeditions?.rareBlueprintDrops || {};
    const drops = table?.[bandId];
    return Array.isArray(drops) ? drops : [];
  }

  function getRareDropTypeLabel(drop) {
    const voyageMaps = balance?.expeditions?.voyageMaps || {};
    if (drop?.id && voyageMaps[drop.id]) {
      const unlockBandId = typeof voyageMaps[drop.id]?.unlocksBandId === "string"
        ? voyageMaps[drop.id].unlocksBandId
        : "";
      return unlockBandId ? `Map (${toTitleToken(unlockBandId)})` : "Map";
    }
    if (drop?.blueprintForShip) {
      return `Blueprint (${String(drop.blueprintForShip).toUpperCase()})`;
    }
    if (drop?.shipId && drop?.slot) {
      return `Part (${String(drop.shipId).toUpperCase()} ${String(drop.slot).toUpperCase()})`;
    }
    if (drop?.shipId) {
      return `Part (${String(drop.shipId).toUpperCase()})`;
    }
    return "Rare";
  }

  function renderBandRareDropTable(bandId, title = "Loot Table", tableKey = "") {
    const resolvedTableKey = typeof tableKey === "string" && tableKey.trim()
      ? tableKey.trim()
      : String(bandId || "unknown");
    const openAttr = ui.rareDropTableState[resolvedTableKey] ? " open" : "";
    const drops = getBandRareDrops(bandId);
    if (drops.length === 0) {
      return `
        <details class="expedition-loot-table" data-loot-table-key="${resolvedTableKey}"${openAttr}>
          <summary>${title}</summary>
          <div class="kv">No rare drops configured.</div>
        </details>
      `;
    }

    const rows = [...drops]
      .sort((left, right) => (Number(right?.chance) || 0) - (Number(left?.chance) || 0))
      .map((drop) => {
        const dropName = typeof drop?.name === "string" && drop.name.trim() ? drop.name.trim() : (drop?.id || "Unknown Drop");
        const dropRate = formatPercent(Number(drop?.chance) || 0);
        const dropType = getRareDropTypeLabel(drop);
        return `
          <div class="expedition-loot-row">
            <span class="expedition-loot-name">${renderExpeditionItemIcon(drop?.id || dropName, { label: dropName, variant: "loot" })}<span>${dropName}</span></span>
            <span class="expedition-loot-type">${dropType}</span>
            <span class="expedition-loot-rate">${dropRate}</span>
          </div>
        `;
      })
      .join("");

    return `
      <details class="expedition-loot-table" data-loot-table-key="${resolvedTableKey}"${openAttr}>
        <summary>${title}</summary>
        <div class="expedition-loot-header">
          <span>Drop</span>
          <span>Type</span>
          <span>Rate</span>
        </div>
        <div class="expedition-loot-rows">${rows}</div>
      </details>
    `;
  }

  function isTelemetryEnabled() {
    if (typeof debugOptions?.isTelemetryEnabled !== "function") {
      return false;
    }
    return Boolean(debugOptions.isTelemetryEnabled());
  }

  function setTelemetryEnabled(nextEnabled) {
    if (typeof debugOptions?.setTelemetryEnabled === "function") {
      debugOptions.setTelemetryEnabled(Boolean(nextEnabled));
    }
  }

  function getGeneratorIncrementRate(def) {
    let rate = def.baseRate;
    if (def.id === "furnace") {
      rate *= state.perks.furnaceRateMultiplier || 1;
    }
    if (def.id === "condenser") {
      rate *= state.perks.condenserRateMultiplier || 1;
    }
    if (def.id === "prism") {
      rate *= state.perks.prismRateMultiplier || 1;
    }
    const resourceMultiplier = def.resource === "matter"
      ? state.perks.matterRateMultiplier
      : state.perks.fireRateMultiplier;
    return rate * state.perks.productionMultiplier * resourceMultiplier;
  }

  function isExpeditionUnlocked() {
    return Boolean(systems.expeditions.getStatus().unlocked);
  }

  function isDungeonUnlocked() {
    const nodeId = balance?.riftDelve?.unlockNodeId || "riftDelveKeystone";
    return Boolean(state.ascensionTree?.[nodeId]);
  }

  function getNextUpgradeText() {
    const unlockedUpgradeIds = balance.upgradeOrder.filter((id) => systems.upgrades.isUnlocked(id));
    const nextUpgradeId = unlockedUpgradeIds.find((id) => {
      const tier = systems.upgrades.getTier(id);
      return tier < systems.upgrades.getMaxTier(id);
    });
    return nextUpgradeId
      ? `${balance.upgrades[nextUpgradeId]?.name || nextUpgradeId}: ${formatNumber(systems.upgrades.getCost(nextUpgradeId))} matter`
      : "All unlocked upgrades maxed";
  }

  function buildDebugPanelMarkup() {
    const telemetryEnabled = isTelemetryEnabled();
    const riftDepth = Math.max(1, Math.floor(Number(state.riftDelve?.meta?.depth) || 1));
    const generatorRows = Object.values(generatorDefs)
      .map((def) => `
        <div class="row">
          <div class="kv"><strong>${def.name}</strong> Lv.<span data-debug-gen-level="${def.id}">0</span></div>
          <div class="kv">+<span data-debug-gen-rate="${def.id}">0</span>/s | Next <span data-debug-gen-cost="${def.id}">0</span> ${def.costResource} | Payback <span data-debug-gen-payback="${def.id}">n/a</span> | Afford <span data-debug-gen-afford="${def.id}">no</span></div>
        </div>
      `)
      .join("");

    return `
      <div class="debug-panel__header">
        <h2>Balance Debug</h2>
        <div class="debug-panel__actions">
          ${actionButton(telemetryEnabled ? "Telemetry On" : "Telemetry Off", telemetryEnabled ? "secondary compact" : "ghost compact", "debug:telemetry")}
          ${actionButton("Close", "ghost compact", "debug:toggle")}
        </div>
      </div>
      <div class="row">
        <div class="kv">Rates</div>
        <div class="kv" data-debug-rates>0/s Matter | 0/s Fire</div>
      </div>
      <div class="row">
        <div class="kv">Multipliers</div>
        <div class="kv" data-debug-multipliers>prod x1 | matter x1 | fire x1 | growth x1</div>
      </div>
      <div class="row">
        <div class="kv">Next Upgrade</div>
        <div class="kv" data-debug-next-upgrade>None</div>
      </div>
      <div class="row">
        <div>
          <div class="kv">Rift Delve Depth</div>
          <div class="kv">Sets meta depth for testing rewards and next run scaling.</div>
        </div>
        <div class="debug-panel__depth-controls">
          <input
            class="debug-panel__depth-input"
            type="number"
            min="1"
            max="999"
            step="1"
            value="${riftDepth}"
            data-debug-rift-depth
            aria-label="Set Rift Delve depth"
          >
          ${actionButton("Set Depth", "ghost compact", "debug:set-rift-depth")}
        </div>
      </div>
      <div class="row">
        <div>
          <div class="kv">Rift Safety Validation</div>
          <div class="kv">Runs deterministic depth checks for room graph reachability and lock compatibility.</div>
        </div>
        <div class="debug-panel__depth-controls">
          ${actionButton("Validate Rift x100", "ghost compact", "debug:validate-rift")}
        </div>
      </div>
      ${generatorRows}
    `;
  }

  function cacheDebugRefs() {
    refs.debugRates = appEl.querySelector("[data-debug-rates]");
    refs.debugMultipliers = appEl.querySelector("[data-debug-multipliers]");
    refs.debugNextUpgrade = appEl.querySelector("[data-debug-next-upgrade]");
    refs.debugTelemetryButton = appEl.querySelector('button[data-action="debug:telemetry"]');
    refs.debugRiftDepthInput = appEl.querySelector("[data-debug-rift-depth]");

    refs.debugGenerators = {};
    Object.values(generatorDefs).forEach((def) => {
      refs.debugGenerators[def.id] = {
        level: appEl.querySelector(`[data-debug-gen-level="${def.id}"]`),
        rate: appEl.querySelector(`[data-debug-gen-rate="${def.id}"]`),
        cost: appEl.querySelector(`[data-debug-gen-cost="${def.id}"]`),
        payback: appEl.querySelector(`[data-debug-gen-payback="${def.id}"]`),
        afford: appEl.querySelector(`[data-debug-gen-afford="${def.id}"]`)
      };
    });
  }

  function refreshDebugPanelMetrics() {
    if (!ui.debugPanelVisible || !refs.debugPanel) {
      return;
    }
    if (!refs.debugRates || !refs.debugMultipliers || !refs.debugNextUpgrade || !refs.debugGenerators) {
      return;
    }

    const rates = formulas.productionPerSecond(state, generatorDefs);
    refs.debugRates.textContent = `${formatNumber(rates.matter)}/s Matter | ${formatNumber(rates.fire)}/s Fire`;
    refs.debugMultipliers.textContent = `prod x${formatIntOrFixed(state.perks.productionMultiplier)} | matter x${formatIntOrFixed(state.perks.matterRateMultiplier)} | fire x${formatIntOrFixed(state.perks.fireRateMultiplier)} | growth x${formatIntOrFixed(state.perks.generatorCostGrowthMultiplier)}`;
    refs.debugNextUpgrade.textContent = getNextUpgradeText();

    Object.values(generatorDefs).forEach((def) => {
      const rowRefs = refs.debugGenerators[def.id];
      if (!rowRefs) {
        return;
      }
      const level = state.generators[def.id] || 0;
      const cost = generatorCost(def, level, state.perks.generatorCostGrowthMultiplier);
      const incrementalRate = getGeneratorIncrementRate(def);
      const paybackSeconds = incrementalRate > 0 ? cost / incrementalRate : Number.POSITIVE_INFINITY;

      if (rowRefs.level) {
        rowRefs.level.textContent = String(level);
      }
      if (rowRefs.rate) {
        rowRefs.rate.textContent = formatNumber(incrementalRate);
      }
      if (rowRefs.cost) {
        rowRefs.cost.textContent = formatNumber(cost);
      }
      if (rowRefs.payback) {
        rowRefs.payback.textContent = Number.isFinite(paybackSeconds) ? formatDuration(paybackSeconds) : "n/a";
      }
      if (rowRefs.afford) {
        const available = state.resources[def.costResource] || 0;
        rowRefs.afford.textContent = available >= cost ? "yes" : "no";
      }
    });

    const telemetryEnabled = isTelemetryEnabled();
    if (refs.debugTelemetryButton) {
      refs.debugTelemetryButton.textContent = telemetryEnabled ? "Telemetry On" : "Telemetry Off";
      refs.debugTelemetryButton.classList.toggle("secondary", telemetryEnabled);
      refs.debugTelemetryButton.classList.toggle("ghost", !telemetryEnabled);
    }
  }

  function syncDebugRiftDepthInput() {
    if (!refs.debugRiftDepthInput) {
      return;
    }
    const riftDepth = Math.max(1, Math.floor(Number(state.riftDelve?.meta?.depth) || 1));
    refs.debugRiftDepthInput.value = String(riftDepth);
  }

  function buildLayout() {
    const expeditionUnlocked = isExpeditionUnlocked();
    const slotOptions = saveSlots
      ? saveSlots.slots
          .map((slot) => {
            const selected = slot.id === saveSlots.activeSlotId ? "selected" : "";
            return `<option value="${slot.id}" ${selected}>${slot.label}</option>`;
          })
          .join("")
      : "";

    appEl.innerHTML = `
      <section class="titlebar">
        <h1>Dimensional Alchemy</h1>
        <div class="subtitle">A cosmic lab idle prototype. First implementation slice with layered progression.</div>

        ${saveSlots ? `
        <div class="save-bar">
          <label class="kv" for="save-slot">Save Slot</label>
          <select id="save-slot" data-action="save-slot">
            ${slotOptions}
          </select>
          <button class="ghost" data-action="save-reset">Reset Slot</button>
          <button class="ghost" data-action="debug:toggle">Debug</button>
        </div>
        ` : `
        <div class="save-bar">
          <button class="ghost" data-action="debug:toggle">Debug</button>
        </div>
        `}

        <div class="resource-grid">
          <div class="resource-card resource-card--matter" data-resource="matter">
            <div class="card-title">
              ${renderCurrencyIcon("matter", "card")}
              <div class="label">Matter</div>
            </div>
            <div class="value" id="matter-value">0</div>
            <div class="hint" id="transmute-yield"><span id="transmute-matter-amount">+1</span>${renderCurrencyIcon("matter")}<span>/tap</span><span id="transmute-fire-bonus" class="hidden"> +<span id="transmute-fire-bonus-amount">0</span>${renderCurrencyIcon("fire")}</span></div>
            <div class="action">${actionButton("Transmute", "primary", "transmute")}</div>
          </div>
          <div class="resource-card resource-card--fire" data-resource="fire">
            <div class="card-title">
              ${renderCurrencyIcon("fire", "card")}
              <div class="label">Fire</div>
            </div>
            <div class="value" id="fire-value">0</div>
            <div class="hint" id="convert-yield"><span id="convert-cost-amount">100</span>${renderCurrencyIcon("matter")}<span> -> </span><span id="convert-out-amount">1</span>${renderCurrencyIcon("fire")}</div>
            <div class="action">${actionButton("Convert", "secondary", "convert")}</div>
          </div>
          <div class="resource-card resource-card--intel ${expeditionUnlocked ? "" : "is-locked"}" data-resource="intel" id="intel-card">
            <div class="card-title">
              ${renderCurrencyIcon("intel", "card")}
              <div class="label">Intel</div>
            </div>
            <div class="value" id="intel-value">0</div>
            <div class="hint" id="intel-hint">${expeditionUnlocked ? "Runs and ship upgrades" : "Unlock Expedition Keystone"}</div>
            <div class="action"><button class="secondary" data-action="tab:expeditions" id="intel-open" ${expeditionUnlocked ? "" : "disabled"}>Expeditions</button></div>
          </div>
          <div class="resource-card resource-card--ascend" data-resource="shards">
            <div class="card-title">
              ${renderCurrencyIcon("shards", "card")}
              <div class="label">Shards</div>
            </div>
            <div class="value" id="shards-value">0</div>
            <div class="hint" id="ascend-gain"><span id="ascend-matter-cost">0</span>${renderCurrencyIcon("matter")}<span> + </span><span id="ascend-fire-cost">0</span>${renderCurrencyIcon("fire")}<span> -> </span><span id="ascend-gain-amount">+0</span>${renderCurrencyIcon("shards")}</div>
            <div class="action">${actionButton("Ascend", "ghost", "ascend")}</div>
          </div>
        </div>
      </section>

      <section class="tabbar">
        ${actionButton("Upgrades", "ghost tab", "tab:upgrades")}
        ${actionButton("Research", "ghost tab", "tab:research")}
        ${actionButton("Expeditions", "ghost tab", "tab:expeditions", !expeditionUnlocked)}
        ${actionButton("Collection", "ghost tab", "tab:collection")}
        ${actionButton("Dungeons", "ghost tab", "tab:dungeons", false)}
        ${actionButton("Ascend", "ghost tab", "tab:ascend")}
      </section>

      <section class="main-grid" id="main-grid">
        <article class="panel" id="pinned-panel"></article>

        <article class="panel" id="dynamic-panel"></article>
      </section>

      <section class="rare-popup-stack hidden" id="rare-popup-stack" aria-live="polite" aria-atomic="false"></section>

      <section class="panel debug-panel hidden" id="debug-panel"></section>
    `;

    refs.matter = appEl.querySelector("#matter-value");
    refs.fire = appEl.querySelector("#fire-value");
    refs.shards = appEl.querySelector("#shards-value");
    refs.intel = appEl.querySelector("#intel-value");
    refs.intelCard = appEl.querySelector("#intel-card");
    refs.intelHint = appEl.querySelector("#intel-hint");
    refs.intelAction = appEl.querySelector("#intel-open");
    refs.expeditionsTab = appEl.querySelector('button[data-action="tab:expeditions"]');
    refs.dungeonsTab = appEl.querySelector('button[data-action="tab:dungeons"]');
    refs.mainGrid = appEl.querySelector("#main-grid");
    refs.rarePopupStack = appEl.querySelector("#rare-popup-stack");
    ui.pinnedEl = appEl.querySelector("#pinned-panel");
    refs.saveSlot = appEl.querySelector("#save-slot");
    refs.saveReset = appEl.querySelector("[data-action='save-reset']");
    refs.debugPanel = appEl.querySelector("#debug-panel");
    ui.panelEl = appEl.querySelector("#dynamic-panel");
    hydrateUiIcons(appEl);
  }

  function renderPinnedPanel(rates) {
    return `
      ${renderOverviewPanel(rates)}
      <div class="notice" id="notice"></div>
    `;
  }

  function cachePinnedRefs() {
    refs.transmuteYield = appEl.querySelector("#transmute-yield");
    refs.convertYield = appEl.querySelector("#convert-yield");
    refs.ascendGain = appEl.querySelector("#ascend-gain");
    refs.transmuteMatterAmount = appEl.querySelector("#transmute-matter-amount");
    refs.transmuteFireBonus = appEl.querySelector("#transmute-fire-bonus");
    refs.transmuteFireBonusAmount = appEl.querySelector("#transmute-fire-bonus-amount");
    refs.convertCostAmount = appEl.querySelector("#convert-cost-amount");
    refs.convertOutAmount = appEl.querySelector("#convert-out-amount");
    refs.ascendMatterCost = appEl.querySelector("#ascend-matter-cost");
    refs.ascendFireCost = appEl.querySelector("#ascend-fire-cost");
    refs.ascendGainAmount = appEl.querySelector("#ascend-gain-amount");
    refs.prodInline = appEl.querySelector("#prod-inline");
    refs.rate = appEl.querySelector("#rate-value");
    refs.notice = appEl.querySelector("#notice");
    refs.convertButton = appEl.querySelector('button[data-action="convert"]');
    refs.ascendButton = appEl.querySelector('button[data-action="ascend"]');
  }

  function renderOverviewPanel(rates) {
    const rateLine = `${formatNumber(rates.matter)}/s Matter | ${formatNumber(rates.fire)}/s Fire`;
    const generatorRows = Object.values(generatorDefs)
      .map((def) => {
        const level = state.generators[def.id] || 0;
        const cost = generatorCost(def, level, state.perks.generatorCostGrowthMultiplier);
        const effectiveRate = getGeneratorIncrementRate(def);

        return `
          <div class="row">
            <div>
              <div><strong>${def.name}</strong> Lv.${level}</div>
              <div class="kv">+${formatNumber(effectiveRate)}/s ${renderCurrencyIcon(def.resource)} | Cost ${formatCurrencyAmount(def.costResource, cost)}</div>
            </div>
            ${actionButton("Buy", "ghost", `buy:${def.id}`)}
          </div>
        `;
      })
      .join("");

    return `
      <h2>Generators</h2>
      <div class="row row--overview-output">
        <div class="muted">Output</div>
        <div class="kv"><span id="prod-inline">x${formatIntOrFixed(state.perks.productionMultiplier)}</span> mult | <span id="rate-value">${rateLine}</span></div>
      </div>
      ${generatorRows}
      <div class="row">
        <div class="muted">Hint</div>
        <div class="kv">Buy generators to automate income.</div>
      </div>
    `;
  }

  function renderDebugPanel() {
    if (!refs.debugPanel) {
      return;
    }
    if (!ui.debugPanelVisible) {
      refs.debugPanel.classList.add("hidden");
      return;
    }

    if (!refs.debugPanel.querySelector("[data-debug-rates]")) {
      refs.debugPanel.innerHTML = buildDebugPanelMarkup();
      cacheDebugRefs();
    }

    refs.debugPanel.classList.remove("hidden");
    refreshDebugPanelMetrics();
  }

  function toggleDebugPanel(forceState) {
    const wasVisible = ui.debugPanelVisible;
    ui.debugPanelVisible = typeof forceState === "boolean" ? forceState : !ui.debugPanelVisible;
    ui.lastDebugRefreshAt = 0;
    renderDebugPanel();
    if (ui.debugPanelVisible && !wasVisible) {
      syncDebugRiftDepthInput();
    }
    return ui.debugPanelVisible;
  }

  function renderUpgradesPanel() {
    const rows = balance.upgradeOrder
      .map((upgradeId) => balance.upgrades[upgradeId])
      .filter(Boolean)
      .map((def) => {
        const tier = systems.upgrades.getTier(def.id);
        const maxTier = systems.upgrades.getMaxTier(def.id);
        const maxed = tier >= maxTier;
        const unlocked = systems.upgrades.isUnlocked(def.id);
        const cost = systems.upgrades.getCost(def.id);
        const affordable = (state.resources[def.costResource] || 0) >= cost;
        const unlockInfo = systems.upgrades.getUnlockInfo(def.id);
        const missing = Math.max(0, unlockInfo.requiredTotal - unlockInfo.currentTotal);

        if (!unlocked) {
          return `
            <div class="row">
              <div>
                <div><strong>${def.name}</strong></div>
                <div class="kv">Need ${missing} total tiers to unlock</div>
              </div>
            </div>
          `;
        }

        const disabled = maxed;

        let status = maxed ? "Maxed" : `Lv.${tier}/${maxTier}`;

        const description = scaleDescription(def.description, balance.upgradePower || 1);

        return `
          <div class="row">
            <div>
              <div><strong>${def.name}</strong></div>
              <div class="kv">${description}</div>
              <div class="kv">${status}${maxed ? "" : ` | Next: ${formatCurrencyAmount(def.costResource, cost)}`}</div>
            </div>
            ${actionButton(maxed ? "Max" : "Buy Tier", "ghost", `upgrade:${def.id}`, disabled)}
          </div>
        `;
      })
      .join("");

    return `
      <h2>Upgrades</h2>
      <div class="scroll-panel">${rows}</div>
    `;
  }

  function renderResearchPanel() {
    const rows = balance.researchOrder
      .map((researchId) => balance.research[researchId])
      .filter(Boolean)
      .map((def) => {
        const level = state.research[def.id] || 0;
        const maxed = level >= def.maxLevel;
        const unlocked = systems.research.isUnlocked(def.id);
        const nextCost = systems.research.getCost(def.id);
        const affordable = (state.resources[def.costResource] || 0) >= nextCost;
        const disabled = maxed || !unlocked;
        const unlockInfo = systems.research.getUnlockInfo(def.id);
        const missing = Math.max(0, unlockInfo.requiredTotal - unlockInfo.currentTotal);

        if (!unlocked) {
          return `
            <div class="row">
              <div>
                <div><strong>${def.name}</strong></div>
                <div class="kv">Need ${missing} prior researches at Lv.1</div>
              </div>
            </div>
          `;
        }

        let status = maxed ? "Maxed" : `Lv.${level}/${def.maxLevel}`;

        return `
          <div class="row">
            <div>
              <div><strong>${def.name}</strong></div>
              <div class="kv">${def.description}</div>
              <div class="kv">${status}${maxed ? "" : ` | Next: ${formatCurrencyAmount(def.costResource, nextCost)}`}</div>
            </div>
            ${actionButton(maxed ? "Max" : "Research", "ghost", `research:${def.id}`, disabled)}
          </div>
        `;
      })
      .join("");

    return `
      <h2>Research</h2>
      <div class="scroll-panel">${rows}</div>
    `;
  }

  function renderCollectionPanel() {
    const collectionStatus = systems.expeditions.getCollectionStatus?.() || {
      sources: [],
      milestones: [],
      totalTrackable: 0,
      trackableDiscovered: 0,
      uniqueDiscoveredTotal: 0,
      completionFraction: 0
    };
    const totalTrackable = Math.max(0, Number(collectionStatus.totalTrackable) || 0);
    const trackableDiscovered = Math.max(0, Number(collectionStatus.trackableDiscovered) || 0);
    const uniqueDiscoveredTotal = Math.max(0, Number(collectionStatus.uniqueDiscoveredTotal) || 0);
    const completionPercent = clamp((Number(collectionStatus.completionFraction) || 0) * 100, 0, 100);
    const expeditionUnlocked = isExpeditionUnlocked();
    const claimedEffectSummary = getClaimedCollectionEffectSummary(collectionStatus.milestones || []);
    const claimedEffectsMarkup = claimedEffectSummary.length > 0
      ? `<div class="chip-row collection-claimed-effects-list">${claimedEffectSummary
        .map((effectLabel) => `<span class="chip collection-effect-chip">${effectLabel}</span>`)
        .join("")}</div>`
      : "<div class=\"kv collection-claimed-effects-empty\">No milestone rewards claimed yet.</div>";

    const milestoneCards = (collectionStatus.milestones || [])
      .filter((milestone) => !milestone.claimed)
      .map((milestone) => {
        const ready = Boolean(milestone.ready);
        const classNames = ["collection-milestone"];
        if (ready) {
          classNames.push("is-ready");
        }
        const remaining = Math.max(0, Number(milestone.remaining) || 0);
        const buttonLabel = ready
          ? "Claim"
          : `${formatInt(remaining)} left`;
        return `
          <article class="${classNames.join(" ")}">
            <div class="collection-milestone-main">
              <div class="collection-milestone-name">
                <strong>${milestone.name}</strong>
                <span class="collection-milestone-desc">${milestone.description || "Collection milestone reward."}</span>
              </div>
            </div>
            ${actionButton(
              buttonLabel,
              ready ? "secondary compact" : "ghost compact",
              `collection:claim:${milestone.id}`,
              !ready
            )}
          </article>
        `;
      })
      .join("");

    const sourceSections = (collectionStatus.sources || [])
      .map((source) => {
        const sourceTotal = Math.max(0, Number(source.totalItems) || 0);
        const sourceDiscovered = Math.max(0, Number(source.discoveredCount) || 0);
        const sourcePercent = sourceTotal > 0 ? clamp((sourceDiscovered / sourceTotal) * 100, 0, 100) : 0;
        const items = (source.items || [])
          .map((item, index) => {
            const discovered = Boolean(item.discovered);
            const rarityToken = discovered
              ? toTitleToken(item.discoveredRarity || item.rarity || "rare")
              : "Unknown";
            const nameToken = discovered
              ? (item.discoveredName || item.name || item.id)
              : `Unknown Relic #${index + 1}`;
            const iconMarkup = discovered
              ? renderExpeditionItemIcon(item.id || nameToken, { label: nameToken, variant: "collection" })
              : renderExpeditionItemIcon("unknown", {
                label: "Unknown Relic",
                fallback: "?",
                variant: "collection",
                iconPath: "assets/icons/expedition-items/unknown.png"
              });
            const classNames = ["collection-item"];
            if (discovered) {
              classNames.push("is-discovered");
            } else {
              classNames.push("is-hidden");
            }
            return `
              <div class="${classNames.join(" ")}">
                <div class="collection-item-main">
                  <div class="collection-item-name">${iconMarkup}<span>${nameToken}</span></div>
                  <div class="chip-row">
                    <span class="chip chip--rarity">${rarityToken}</span>
                    ${item.bandId ? `<span class="chip">${item.bandId}</span>` : ""}
                  </div>
                </div>
                <div class="collection-item-state">${discovered ? "Found" : "Hidden"}</div>
              </div>
            `;
          })
          .join("");

        return `
          <section class="collection-source">
            <div class="collection-source-head">
              <h3>${source.name}</h3>
              <div class="kv">${formatInt(sourceDiscovered)}/${formatInt(sourceTotal)} found</div>
            </div>
            ${source.description ? `<div class="kv">${source.description}</div>` : ""}
            <div class="collection-progress collection-progress--source"><span style="width:${sourcePercent.toFixed(1)}%"></span></div>
            <div class="collection-item-list">
              ${items || "<div class=\"kv\">No catalog entries yet.</div>"}
            </div>
          </section>
        `;
      })
      .join("");

    return `
      <h2>Collection</h2>
      <div class="collection-summary">
        <div class="collection-summary-title">Rare Finds Logged</div>
        <div class="kv">${formatInt(trackableDiscovered)}/${formatInt(totalTrackable)} catalog entries | ${formatInt(uniqueDiscoveredTotal)} unique discoveries</div>
        <div class="collection-progress"><span style="width:${completionPercent.toFixed(1)}%"></span></div>
      </div>
      ${expeditionUnlocked ? "" : "<div class=\"kv\">Unlock Expedition Keystone to begin collecting expedition relics.</div>"}
      <h3>Milestones</h3>
      <div class="collection-claimed-effects">
        <div class="collection-claimed-effects-title">Reward effects claimed so far</div>
        ${claimedEffectsMarkup}
      </div>
      <div class="collection-milestone-grid">${milestoneCards || "<div class=\"kv\">All milestones claimed.</div>"}</div>
      <h3>Catalog</h3>
      <div class="scroll-panel collection-scroll">${sourceSections || "<div class=\"kv\">No collection sources configured.</div>"}</div>
    `;
  }

  function renderAscendPanel() {
    const nodeWidth = 140;
    const nodeHeight = 140;
    const gap = -5;
    const width = nodeWidth + gap;
    const height = nodeHeight * 0.75 + gap;
    const nodes = systems.ascendTree.nodes
      .map((node) => {
        const owned = systems.ascendTree.hasNode(node.id);
        const unlocked = systems.ascendTree.isUnlocked(node.id);
        const affordable = state.resources.shards >= node.cost;

        const classList = ["hex-node"];
        if (owned) {
          classList.push("owned");
        } else if (!unlocked) {
          classList.push("locked");
        }

        const x = width * (node.q + node.r / 2);
        const y = height * node.r;
        const style = `style="--x:${x.toFixed(1)}px; --y:${y.toFixed(1)}px;"`;
        const disabled = owned || !unlocked;

        const description = unlocked ? node.description : "Unknown effect";
        const title = unlocked ? node.description : "Unknown effect";
        const costLine = unlocked ? `<div class="hex-meta">${formatCurrencyAmount("shards", node.cost)}</div>` : "";

        return `
          <button class="${classList.join(" ")}" data-action="ascend:${node.id}" ${style} ${disabled ? "disabled" : ""} title="${title}">
            <div class="hex-title">${node.name}</div>
            ${costLine}
            <div class="hex-meta">${description}</div>
          </button>
        `;
      })
      .join("");

    return `
      <h2>Ascension Grid</h2>
      <div class="muted">Spend shards to unlock permanent hex nodes. Unlocks must connect to an owned node.</div>
      <div class="hex-viewport" data-ascend-viewport>
        <div class="hex-stage" data-ascend-stage>
          <div class="hex-grid">${nodes}</div>
        </div>
      </div>
    `;
  }

  function getZoneStyleForShip(shipDef, slot) {
    const fallback = {
      hull: { left: 20, top: 72 },
      sail: { left: 44, top: 24 },
      anchor: { left: 78, top: 76 },
      net: { left: 62, top: 48 }
    };
    const configured = shipDef?.visual?.zones?.[slot] || {};
    const left = Number.isFinite(Number(configured.left)) ? Number(configured.left) : fallback[slot].left;
    const top = Number.isFinite(Number(configured.top)) ? Number(configured.top) : fallback[slot].top;
    return `style="left:${left}%; top:${top}%;"`;
  }

  function renderShipGraphic(shipStatus, selectedShipId, selectedShipState, selectedShipDef, selectedSlot, partDefs) {
    const visual = selectedShipDef.visual || {};
    const assetPath = typeof visual.asset === "string" && visual.asset.length > 0 ? visual.asset : "";
    const mastCount = Math.max(1, Math.min(3, Math.floor(Number(visual.mastCount) || 1)));
    const mastOffsets = mastCount === 1
      ? [46]
      : mastCount === 2
        ? [40, 56]
        : [34, 50, 66];
    const palette = visual.palette || {};
    const paletteStyle = [
      palette.hullStart ? `--ship-hull-start:${palette.hullStart};` : "",
      palette.hullEnd ? `--ship-hull-end:${palette.hullEnd};` : "",
      palette.sailTop ? `--ship-sail-top:${palette.sailTop};` : "",
      palette.sailBottom ? `--ship-sail-bottom:${palette.sailBottom};` : "",
      palette.waterTop ? `--ship-water-top:${palette.waterTop};` : "",
      palette.waterBottom ? `--ship-water-bottom:${palette.waterBottom};` : ""
    ].join("");
    const zones = ["hull", "sail", "anchor", "net"]
      .map((slot) => {
        const active = selectedSlot === slot ? " active" : "";
        const label = slot[0].toUpperCase() + slot.slice(1);
        const equippedRefRaw = selectedShipState.equippedParts?.[slot];
        const equippedRef = systems.ships.parsePartRef?.(equippedRefRaw) || null;
        const equippedPart = equippedRef && partDefs[equippedRef.partId] ? partDefs[equippedRef.partId] : null;
        const tier = Math.max(1, Number(equippedRef?.tier) || 1);
        const effectsScale = equippedPart ? systems.ships.getPartTierScale?.(equippedRef.partId, tier) || 1 : 1;
        const equippedName = equippedPart ? `${equippedPart.name} T${tier}` : "None";
        const effectsText = equippedPart
          ? formatPartEffects(scalePartEffects(equippedPart.effects || {}, effectsScale))
          : "Drop compatible part here";
        const zoneStyle = getZoneStyleForShip(selectedShipDef, slot);
        const equippedRefValue = equippedRef?.ref || "";
        const draggableAttr = equippedRefValue ? 'draggable="true"' : "";
        return `
          <button class="ship-zone${active}" data-action="ship:focus:${slot}" data-slot="${slot}" data-ship-id="${selectedShipId}" data-equipped-ref="${equippedRefValue}" ${zoneStyle} ${draggableAttr}>
            <strong>${label}</strong>
            <span>${equippedName}</span>
            <span class="ship-zone-meta">${effectsText || "No stat modifiers."}</span>
          </button>
        `;
      })
      .join("");
    const masts = mastOffsets
      .map((offset) => `<div class="ship-layer ship-layer--mast" style="left:${offset}%;"></div>`)
      .join("");

    const theme = selectedShipDef.visual?.theme || selectedShipId || "raft";
    const artMarkup = assetPath
      ? `<img class="ship-asset" src="${assetPath}" alt="${selectedShipDef.name || selectedShipId} profile">`
      : `
        <div class="ship-waterline"></div>
        <div class="ship-hull"></div>
        ${masts}
        <div class="ship-layer ship-layer--sails"></div>
      `;
    return `
      <div class="ship-graphic ship-graphic--${theme}" style="${paletteStyle}">
        ${artMarkup}
        ${zones}
      </div>
    `;
  }

  function formatShipStatSummary(shipStats) {
    if (!shipStats) {
      return "";
    }
    const riskMitigation = Number(shipStats.riskMitigation) || 0;
    const riskPrefix = riskMitigation >= 0 ? "+" : "";
    return ` | Speed x${formatIntOrFixed(shipStats.speedMultiplier || 1)} | Risk Mit ${riskPrefix}${formatPercent(riskMitigation)} | Yield x${formatIntOrFixed(shipStats.yieldMultiplier || 1)} | Rare x${formatIntOrFixed(shipStats.rareDropWeight || 1)}`;
  }

  function renderFleetDockPanel() {
    const expeditionStatus = systems.expeditions.getStatus();
    const shipStatus = systems.ships.getStatus();
    const shipDefs = shipStatus.shipDefs || {};
    const ships = shipStatus.ships || {};
    const facilityDefs = shipStatus.facilityDefs || {};
    const activeRun = expeditionStatus.activeRun;
    const activeBand = activeRun
      ? (expeditionStatus.bands || []).find((band) => band.id === activeRun.bandId)
      : null;
    const lockedShipId = typeof activeBand?.requiredShip === "string" ? activeBand.requiredShip : "";
    const shipSwitchLocked = Boolean(activeRun && lockedShipId);
    const lockedShipName = shipDefs[lockedShipId]?.name || toTitleToken(lockedShipId);

    const selectedShipId = shipStatus.selectedShip;
    const selectedShipState = ships[selectedShipId] || {};
    const selectedShipDef = shipDefs[selectedShipId] || {};
    const selectedShipStats = systems.ships.getShipStats(selectedShipId) || null;

    const shipCards = Object.values(shipDefs)
      .map((def) => {
        const ship = ships[def.id] || {};
        const acquired = Boolean(ship.acquired);
        const selected = def.id === selectedShipId;
        const unlock = systems.ships.isShipUnlockMet(def.id);
        const classNames = ["ship-card"];
        if (selected) {
          classNames.push("active");
        }
        if (!acquired) {
          classNames.push("locked");
        }
        const action = acquired ? `ship:select:${def.id}` : `ship:buy:${def.id}`;
        const actionText = acquired ? (selected ? "Selected" : "Select") : "Buy";
        const lockedByVoyage = shipSwitchLocked && def.id !== lockedShipId;
        const disabled = (acquired ? selected : !unlock.ok) || lockedByVoyage;

        return `
          <div class="ship-card-wrap">
            <div class="${classNames.join(" ")}">
              <div><strong>${def.name}</strong></div>
              <div class="kv">Base: Speed x${formatIntOrFixed(def.baseStats?.speedMultiplier || 1)} | Risk Mit ${Number(def.baseStats?.riskMitigation || 0) >= 0 ? "+" : ""}${formatPercent(def.baseStats?.riskMitigation || 0)}</div>
              <div class="kv">Yield x${formatIntOrFixed(def.baseStats?.yieldMultiplier || 1)} | Rare x${formatIntOrFixed(def.baseStats?.rareDropWeight || 1)}</div>
              ${acquired ? "<div class=\"kv\">Owned</div>" : `<div class="kv">Cost: ${formatCost(def.purchaseCost)}</div>`}
              ${!acquired && !unlock.ok ? `<div class="kv">${unlock.reason}</div>` : ""}
              ${lockedByVoyage ? `<div class="kv">Locked during active voyage. ${lockedShipName} required.</div>` : ""}
              ${actionButton(actionText, acquired ? "ghost" : "secondary", action, disabled)}
            </div>
          </div>
        `;
      })
      .join("");

    const facilityRows = Object.entries(facilityDefs)
      .map(([facilityId, def]) => {
        const shipFacility = systems.ships.getFacilitySpec?.(selectedShipId, facilityId) || def;
        const level = Math.max(0, Math.floor(Number(selectedShipState.facilities?.[facilityId]) || 0));
        const maxLevel = shipFacility.maxLevel || 0;
        const maxed = level >= maxLevel;
        const nextCost = systems.ships.getFacilityUpgradeCost?.(selectedShipId, facilityId, level) || null;
        const disabled = maxed || !selectedShipState.acquired;
        const effectParts = [];
        if (shipFacility.effectsPerLevel?.speedMultiplier) {
          effectParts.push(`${formatSignedPercent(shipFacility.effectsPerLevel.speedMultiplier)} speed/lv`);
        }
        if (shipFacility.effectsPerLevel?.yieldMultiplier) {
          effectParts.push(`${formatSignedPercent(shipFacility.effectsPerLevel.yieldMultiplier)} yield/lv`);
        }
        if (shipFacility.effectsPerLevel?.riskMitigation) {
          effectParts.push(`${formatSignedPercent(shipFacility.effectsPerLevel.riskMitigation)} risk mit/lv`);
        }
        if (shipFacility.effectsPerLevel?.penaltyDampening) {
          effectParts.push(`${formatSignedPercent(shipFacility.effectsPerLevel.penaltyDampening)} penalty damp/lv`);
        }
        if (shipFacility.effectsPerLevel?.rareDropWeight) {
          effectParts.push(`${formatSignedPercent(shipFacility.effectsPerLevel.rareDropWeight)} rare weight/lv`);
        }

        return `
          <div class="row">
            <div>
              <div><strong>${def.label}</strong> Lv.${level}/${maxLevel}</div>
              <div class="kv">${effectParts.join(" | ")}</div>
              <div class="kv">${maxed ? "Maxed" : formatCost(nextCost)}</div>
            </div>
            ${actionButton("Upgrade", "ghost", `ship:upgrade:${selectedShipId}:${facilityId}`, disabled)}
          </div>
        `;
      })
      .join("");
    const blueprintRows = Object.entries(shipStatus.blueprintInventory || {})
      .filter(([, count]) => Number(count) > 0)
      .map(([id, count]) => {
        const displayName = getDropDisplayName(id, id);
        return `<div class="kv expedition-ledger-row">${renderExpeditionItemIcon(id, { label: displayName, variant: "ledger" })}<span>${displayName} x${count}</span></div>`;
      })
      .join("");

    return `
      <h2>Fleet Dock</h2>
      <div class="fleet-layout">
        <section class="fleet-left">
          <div class="ship-cards">${shipCards}</div>
          <div class="kv">Selected: <strong>${selectedShipDef.name || selectedShipId}</strong>${formatShipStatSummary(selectedShipStats)}</div>
          ${shipSwitchLocked ? `<div class="kv">Ship switching is locked while ${lockedShipName} voyage is active.</div>` : ""}
          <div class="kv">Use the Ships subtab for interactive slot management and part inventory.</div>
        </section>
        <section class="fleet-right">
          <h3>Facility Upgrades</h3>
          <div class="scroll-panel">${facilityRows}</div>
          <h3>Blueprint Ledger</h3>
          <div class="inventory-list">${blueprintRows || "<div class=\"kv\">No blueprints discovered yet.</div>"}</div>
        </section>
      </div>
    `;
  }

  function renderShipGuiPanel() {
    const shipStatus = systems.ships.getStatus();
    const shipDefs = shipStatus.shipDefs || {};
    const ships = shipStatus.ships || {};
    const partDefs = shipStatus.partDefs || {};

    const selectedShipId = shipStatus.selectedShip;
    const selectedShipState = ships[selectedShipId] || {};
    const selectedShipDef = shipDefs[selectedShipId] || {};
    const selectedShipStats = systems.ships.getShipStats(selectedShipId) || null;
    const selectedSlot = ui.fleetFocusSlot;
    const equippedPartCounts = shipStatus.equippedPartCounts || {};
    const fusionInfo = shipStatus.partFusion || {};
    const allPartItems = Object.entries(shipStatus.partInventory || {})
      .filter(([, count]) => Number(count) > 0)
      .map(([partRef, count]) => {
        const parsed = systems.ships.parsePartRef?.(partRef);
        if (!parsed) {
          return null;
        }
        const def = partDefs[parsed.partId];
        if (!def) {
          return null;
        }
        const normalizedRef = parsed.ref || partRef;
        const equippedCount = Number(equippedPartCounts[normalizedRef]) || 0;
        const availableCount = Math.max(0, Number(count) - equippedCount);
        const combineInfo = systems.ships.getCombineInfo?.(normalizedRef) || { ok: false, reason: "Unable to fuse." };
        return {
          partRef: normalizedRef,
          basePartId: parsed.partId,
          tier: Math.max(1, Number(parsed.tier) || 1),
          count: Number(count),
          equippedCount,
          availableCount,
          combineInfo,
          def,
          compatibleWithSelectedShip: !def.shipId || def.shipId === selectedShipId,
          compatibleWithFocusSlot: def.slot === selectedSlot
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const rarityWeight = { "semi-rare": 1, rare: 2, epic: 3 };
        if (a.compatibleWithSelectedShip !== b.compatibleWithSelectedShip) {
          return a.compatibleWithSelectedShip ? -1 : 1;
        }
        if (a.def.slot !== b.def.slot) {
          return String(a.def.slot).localeCompare(String(b.def.slot));
        }
        const nameDiff = String(a.def.name || a.basePartId).localeCompare(String(b.def.name || b.basePartId));
        if (nameDiff !== 0) {
          return nameDiff;
        }
        if (a.tier !== b.tier) {
          return a.tier - b.tier;
        }
        const rarityDiff = (rarityWeight[a.def.rarity] || 0) - (rarityWeight[b.def.rarity] || 0);
        if (rarityDiff !== 0) {
          return rarityDiff;
        }
        return String(a.basePartId).localeCompare(String(b.basePartId));
      });

    const inventoryRows = allPartItems.length > 0
      ? allPartItems.map((item) => {
        const encoded = encodeURIComponent(item.partRef);
        const effectScale = systems.ships.getPartTierScale?.(item.basePartId, item.tier) || 1;
        const effectText = formatPartEffects(scalePartEffects(item.def.effects || {}, effectScale));
        const rarity = item.def.rarity || "rare";
        const slotEquippedRef = systems.ships.parsePartRef?.(selectedShipState.equippedParts?.[item.def.slot] || "")?.ref || "";
        const canEquipByCount = item.availableCount > 0 || slotEquippedRef === item.partRef;
        const canEquipByFilter = item.compatibleWithSelectedShip;
        const canEquip = canEquipByCount && canEquipByFilter;
        const canCombine = Boolean(item.combineInfo?.ok);
        const combineLabel = canCombine ? `Fuse -> T${item.combineInfo.nextTier}` : "Fuse";
        const combineHintRaw = canCombine
          ? `Consumes 2x T${item.tier}, creates 1x T${item.combineInfo.nextTier}.`
          : (item.combineInfo?.reason || "Cannot fuse now.");
        const combineHint = combineHintRaw === "Need 2 unequipped copies of this part tier." ? "" : combineHintRaw;
        const equippedBadge = item.equippedCount > 0 ? `<span class="chip">Equipped ${item.equippedCount}</span>` : "";
        const shipBadge = item.def.shipId ? `<span class="chip chip--ship">${item.def.shipId}</span>` : "";
        return `
          <div class="inventory-item inventory-item--part" draggable="true" data-part-id="${item.partRef}" data-slot="${item.def.slot}" data-ship-id="${selectedShipId}">
            <div>
              <div class="inventory-item-title">${renderExpeditionItemIcon(item.basePartId, { label: item.def.name, variant: "inventory" })}<strong>${item.def.name} T${item.tier}</strong> x${item.count} <span class="kv">(${item.availableCount} free)</span></div>
              <div class="chip-row"><span class="chip chip--rarity">${rarity}</span><span class="chip chip--tier">T${item.tier}</span><span class="chip">${item.def.slot}</span>${shipBadge}${equippedBadge}</div>
              <div class="kv">${effectText || "No stat modifiers."}</div>
              ${combineHint ? `<div class="kv">${combineHint}</div>` : ""}
            </div>
            <div class="inventory-item-actions">
              ${actionButton("Equip", "secondary compact", `ship:equip:${selectedShipId}:${item.def.slot}:${encoded}`, !canEquip)}
              ${actionButton(combineLabel, "ghost compact", `ship:combine:${encoded}`, !canCombine)}
            </div>
          </div>
        `;
      }).join("")
      : "<div class=\"kv\">No parts in inventory yet.</div>";

    return `
      <h2>${selectedShipDef.name ? ` ${selectedShipDef.name}` : ""}</h2>
      <div class="ship-gui-layout">
        <section class="ship-gui-main">
          ${renderShipGraphic(shipStatus, selectedShipId, selectedShipState, selectedShipDef, selectedSlot, partDefs)}
          <div class="kv">${selectedShipDef.name || selectedShipId}${formatShipStatSummary(selectedShipStats)} | Tip: drag an equipped part off the ship graphic to unequip it.</div>
        </section>
        <section class="ship-gui-inventory">
          <div class="inventory-header">
            <h3>Part Inventory</h3>
            <div class="kv">Cap T${Math.max(1, Number(fusionInfo.effectiveGlobalMaxTier) || 6)} | Fuse 2 of the same tier into 1 higher tier.</div>
          </div>
          <div class="inventory-list inventory-list--parts">${inventoryRows}</div>
        </section>
      </div>
    `;
  }

  function renderExpeditionsLockedPanel() {
    return `
      <h2>Prestige Expeditions</h2>
      <div class="muted">Unlock <strong>Expedition Keystone</strong> in Ascend to access expedition runs, fleet dock upgrades, and ship loadouts.</div>
      <div class="row">
        <div class="kv">Expedition details remain hidden until the unlock is purchased.</div>
        ${actionButton("Go to Ascend", "secondary", "tab:ascend")}
      </div>
    `;
  }

  function renderExpeditionsPanel() {
    const expeditionStatus = systems.expeditions.getStatus();
    if (!expeditionStatus.unlocked) {
      ui.expeditionsView = "runs";
      return renderExpeditionsLockedPanel();
    }

    const shipStats = expeditionStatus.selectedShipStats;
    const selectedShipName = toTitleToken(expeditionStatus.selectedShip);
    const shipLine = expeditionStatus.selectedShip
      ? `<div class="kv">${selectedShipName}${formatShipStatSummary(shipStats)}</div>`
      : "<div class=\"kv\">No ship selected.</div>";
    const autoMode = expeditionStatus.autoRouteMode || "manual";
    const modeLabels = { manual: "Manual", safe: "Safe", balanced: "Balanced", aggressive: "Aggro" };
    const modeRow = `
      <div class="expedition-mode-row">
        <div class="kv">Voyage Mode</div>
        <div class="expedition-mode-buttons">
          ${Object.keys(modeLabels)
            .map((mode) => actionButton(modeLabels[mode], `ghost compact mode-btn ${autoMode === mode ? "active" : ""}`, `expedition:mode:${mode}`))
            .join("")}
        </div>
      </div>
    `;
    const voyageMaps = Array.isArray(expeditionStatus.voyageMaps) ? expeditionStatus.voyageMaps : [];
    const mapSummary = voyageMaps.length > 0
      ? `<div class="kv expedition-meta-inline"><strong>Map Inventory:</strong> ${voyageMaps
        .map((map) => `${renderExpeditionItemIcon(map.id || map.name, { label: map.name, variant: "map" })} ${map.name} x${Math.max(0, Number(map.owned) || 0)}`)
        .join(" | ")}</div>`
      : "";
    const metaSummary = `<div class="kv expedition-meta-inline"><strong>Successful Runs:</strong> ${formatInt(expeditionStatus.meta.completedRuns || 0)} | <strong>Failed Runs:</strong> ${formatInt(expeditionStatus.meta.failedRuns || 0)}</div>`;
    const subTabs = `
      <div class="expedition-topbar">
        <div class="expedition-subtabs">
          ${actionButton("Runs", `ghost ${ui.expeditionsView === "runs" ? "active" : ""}`, "expedition:view:runs")}
          ${actionButton("Fleet Dock", `ghost ${ui.expeditionsView === "fleet" ? "active" : ""}`, "expedition:view:fleet")}
          ${actionButton("Ships", `ghost ${ui.expeditionsView === "ship" ? "active" : ""}`, "expedition:view:ship")}
        </div>
        ${metaSummary}
      </div>
    `;

    if (ui.expeditionsView === "fleet") {
      return `${subTabs}${renderFleetDockPanel()}`;
    }

    if (ui.expeditionsView === "ship") {
      return `${subTabs}${renderShipGuiPanel()}`;
    }

    const chest = expeditionStatus.rewardsChest || { capacity: 10, items: [] };
    const chestItems = Array.isArray(chest.items) ? chest.items : [];
    const chestCapacity = Math.max(1, Number(chest.capacity) || 10);
    const chestCount = chestItems.length;
    const chestFull = chestCount >= chestCapacity;
    const claimPreview = chestCount > 0 ? systems.expeditions.getClaimAllPreview() : null;
    const accumulatedRewards = claimPreview?.ok
      ? (claimPreview.totalRewards || { matter: 0, fire: 0, intel: 0 })
      : { matter: 0, fire: 0, intel: 0 };
    const accumulatedDropCount = claimPreview?.ok && Array.isArray(claimPreview.drops)
      ? claimPreview.drops.length
      : 0;
    const continuous = expeditionStatus.continuous || { active: false, bandId: null, stopReason: "" };
    const loopState = continuous.active
      ? `Running${continuous.bandId ? ` (${continuous.bandId})` : ""}`
      : (continuous.stopReason ? `Stopped: ${continuous.stopReason}` : "Idle");
    const chestRow = `
      <div class="expedition-chest-compact">
        <div class="expedition-chest-main">
          <div class="expedition-chest-title">Rewards Chest ${chestCount}/${chestCapacity}${chestFull ? " • FULL" : ""}</div>
          <div class="expedition-chest-stats">
            <span>Loop: ${loopState}</span>
            ${chestCount > 0
              ? `<span>Booty: ${formatCurrencyAmount("matter", accumulatedRewards.matter || 0, { showPositiveSign: true })}, ${formatCurrencyAmount("fire", accumulatedRewards.fire || 0, { showPositiveSign: true })}, ${formatCurrencyAmount("intel", accumulatedRewards.intel || 0, { showPositiveSign: true })}${accumulatedDropCount > 0 ? `, ${accumulatedDropCount} drop${accumulatedDropCount === 1 ? "" : "s"}` : ""}</span>`
              : "<span>Chest empty</span>"}
          </div>
        </div>
        <div class="expedition-chest-actions">
          ${actionButton("Claim All", "secondary", "expedition:claim-all", chestCount === 0)}
        </div>
      </div>
    `;

    if (expeditionStatus.activeRun) {
      const run = expeditionStatus.activeRun;
      const segmentProgressRaw = run.segmentDurationSeconds > 0
        ? run.segmentElapsedSeconds / run.segmentDurationSeconds
        : 0;
      const segmentProgress = Math.max(0, Math.min(1, segmentProgressRaw));
      const completedStages = run.awaitingChoice ? run.stageIndex : run.stageIndex + segmentProgress;
      const totalProgressRaw = run.stageCount > 0 ? completedStages / run.stageCount : 0;
      const progress = Math.max(0, Math.min(100, totalProgressRaw * 100));
      const band = expeditionStatus.bands.find((item) => item.id === run.bandId);
      const shipRiskMitigation = run.ship?.stats?.riskMitigation || 0;
      const totalMitigation = clamp((state.perks.expeditionRiskMitigation || 0) + shipRiskMitigation, 0, 0.8);
      const currentRisk = clamp((band?.risk || 0) + (run.modifiers?.riskDelta || 0), 0.04, 0.98);
      const mitigatedRisk = currentRisk * (1 - totalMitigation);
      const stageCount = Math.max(1, Number(run.stageCount) || 1);
      const stageNumber = Math.min(run.stageIndex + 1, stageCount);
      const progressNotches = stageCount > 1
        ? Array.from({ length: stageCount - 1 }, (_, index) => {
          const left = (((index + 1) / stageCount) * 100).toFixed(3);
          return `<span class="expedition-progress-notch" style="left:${left}%"></span>`;
        }).join("")
        : "";

      const choicePanel = run.awaitingChoice
        ? `
          <div class="expedition-choice-list">
            ${(run.pendingChoices || [])
              .map((choice) => {
                const risk = Number(choice.riskDelta) || 0;
                const yieldDelta = Number(choice.yieldDelta) || 0;
                const speed = Number(choice.speedMultiplier || 1);
                const intelFlat = Math.round(Number(choice.intelFlat || 0));
                const riskText = `${formatSignedPercent(risk)} risk`;
                const yieldText = `${formatSignedPercent(yieldDelta)} yield`;
                return `
                  <div class="expedition-choice-card">
                    <div class="expedition-choice-main">
                      <div><strong>${choice.name}</strong></div>
                      <div class="expedition-choice-stats">
                        <span>${riskText}</span>
                        <span>${yieldText}</span>
                        <span>x${formatIntOrFixed(speed)} speed</span>
                        <span>${formatCurrencyAmount("intel", intelFlat, { showPositiveSign: true })}</span>
                      </div>
                      ${choice.unlocked ? "" : `<div class="kv">${choice.lockReason || "Locked"}</div>`}
                    </div>
                    ${actionButton("Pick", "secondary", `expedition:route:${choice.id}`, !choice.unlocked)}
                  </div>
                `;
              })
              .join("")}
          </div>
        `
        : "";

      return `
        ${subTabs}
        <h2>Prestige Expeditions</h2>
        ${shipLine}
        ${mapSummary}
        ${modeRow}
        ${chestRow}
        <div class="row expedition-run-card">
          <div class="expedition-run-main">
            <div class="kv" id="expedition-stage-text">Stage ${stageNumber}/${stageCount}</div>
            <div class="kv" id="expedition-risk-text">Risk ${formatPercent(mitigatedRisk)}</div>
            ${renderBandRareDropTable(run.bandId, "Rare Drops", `run:${run.bandId}`)}
          </div>
          ${actionButton("Abandon", "ghost", "expedition:abandon")}
        </div>
        <div class="expedition-progress"><span id="expedition-progress-fill" style="width:${Math.max(2, progress).toFixed(1)}%"></span>${progressNotches}</div>
        ${choicePanel}
      `;
    }

    const bandRows = expeditionStatus.bands
      .map((band) => {
        const cost = band.cost || {};
        const purchaseIntelCost = Math.max(0, Number(band.purchaseIntelCost) || 0);
        const purchased = Boolean(band.purchased);
        const disabledByUnlock = !band.unlock.ok;
        const disabledByChest = chestFull;
        const disabledByPurchase = !purchased;
        const disabled = disabledByUnlock || disabledByChest || disabledByPurchase;
        const mapRequirement = band.mapRequirement || { ok: true };
        const mapName = mapRequirement.mapName || toTitleToken(mapRequirement.requiredMapId || "");
        const hasMap = Math.max(0, Number(mapRequirement.owned) || 0) > 0;
        const mapUnlocked = Boolean(mapRequirement.unlocked);
        const canUseMap = Boolean(mapRequirement.requiredMapId) && hasMap && !mapUnlocked;
        const canBuy = !purchased && band.unlock.ok && purchaseIntelCost > 0;
        const buyLabel = `Buy ${formatCurrencyAmount("intel", purchaseIntelCost)}`;
        const encodedMapId = mapRequirement.requiredMapId
          ? encodeURIComponent(mapRequirement.requiredMapId)
          : "";
        const requirements = disabledByUnlock
          ? `<div class="kv">${band.unlock.reason}</div>`
          : (disabledByChest
            ? "<div class=\"kv\">Chest full. Claim rewards first.</div>"
            : "");
        const costLine = `${formatCurrencyAmount("matter", cost.matter || 0)} | ${formatCurrencyAmount("fire", cost.fire || 0)}`;
        const mapLine = mapRequirement.requiredMapId
          ? `<div class="kv">Map: ${mapName || mapRequirement.requiredMapId} ${mapUnlocked ? "(Unlocked)" : `(Owned: ${Math.max(0, Number(mapRequirement.owned) || 0)})`}</div>`
          : "";
        const shipRequirementLine = band.requiredShip
          ? `<div class="kv">Ship Requirement: ${band.requiredShipName || toTitleToken(band.requiredShip)}</div>`
          : "";
        return `
          <article class="expedition-band-card">
            <div><strong>${band.name}</strong></div>
            <div class="kv">${costLine}</div>
            <div class="kv">${formatDuration(band.durationSeconds || 0)} | ${formatPercent(Number(band.risk) || 0)} risk</div>
            <div class="kv">${Math.max(1, band.stageCount || 1)} stage${Math.max(1, band.stageCount || 1) === 1 ? "" : "s"}</div>
            ${band.description ? `<div class="kv">${band.description}</div>` : ""}
            ${mapLine}
            ${shipRequirementLine}
            <div class="expedition-inline-note">
              ${requirements}
            </div>
            ${renderBandRareDropTable(band.id, "Rare Drops", `band:${band.id}`)}
            <div class="expedition-band-actions">
              ${canUseMap ? actionButton("Use Map", "ghost compact", `expedition:use-map:${encodedMapId}`) : ""}
              ${!purchased && purchaseIntelCost > 0 ? actionButton(buyLabel, "ghost compact", `expedition:buy:${band.id}`, !canBuy) : ""}
              ${actionButton("Start Loop", "secondary", `expedition:start:${band.id}`, disabled)}
            </div>
          </article>
        `;
      })
      .join("");

    return `
      ${subTabs}
      <h2>Prestige Expeditions</h2>
      ${shipLine}
      ${mapSummary}
      ${modeRow}
      ${chestRow}
      <div class="expedition-band-grid">${bandRows}</div>
    `;
  }

  function renderDungeonsLockedPanel() {
    const unlockNodeId = balance?.riftDelve?.unlockNodeId || "riftDelveKeystone";
    return `
      <div class="muted">Unlock <strong>${toTitleToken(unlockNodeId)}</strong> in Ascend to enter room-crawls.</div>
      <div class="row">
        <div class="kv">This system adds room traversal, inventory crafting, and descend loops.</div>
        ${actionButton("Go to Ascend", "secondary", "tab:ascend")}
      </div>
    `;
  }

  function renderDungeonsPanel() {
    const status = systems.dungeons.getStatus();
    if (!status.unlocked) {
      return renderDungeonsLockedPanel();
    }

    const meta = status.meta || {};
    const relicsEarned = formatInt(status.rewards?.lifetime?.relicsEarned || 0);
    if (!status.activeRun) {
      return `
        <div class="row">
          <div>
            <div><strong>Depth ${formatInt(meta.depth || 1)}</strong></div>
            <div class="kv">Best ${formatInt(meta.bestDepth || 1)} | Descends ${formatInt(meta.totalDescends || 0)} | Rooms Cleared ${formatInt(meta.totalRoomsCleared || 0)} | Relics ${relicsEarned}</div>
          </div>
          ${actionButton("Start Run", "primary", "dungeon:start")}
        </div>
      `;
    }

    const room = status.currentRoom || { floorItems: [], gatherNodes: [], mobs: [], chests: [], doors: {}, grid: { width: 15, height: 15 } };
    const run = status.activeRun;
    const movement = status.movement;
    const crafting = status.crafting || {};
    const craftingVisible = Boolean(crafting.stationOpen && crafting.stationRoomId === room.roomId);
    pruneDungeonBubbles();
    const player = status.player || run.player || { x: 0, y: 0 };
    const grid = room.grid || { width: 15, height: 15 };
    const tileMaps = getDungeonTileMaps(room);
    const activeBubbleRoomId = room.roomId || run.currentRoomId || "";
    const bubblesByKey = getDungeonBubblesByKey(activeBubbleRoomId);

    const tileButtons = [];
    for (let y = 0; y < grid.height; y += 1) {
      for (let x = 0; x < grid.width; x += 1) {
        const tile = getDungeonTilePresentation({
          room,
          player,
          movement,
          tileMaps,
          bubblesByKey,
          x,
          y
        });
        tileButtons.push(renderDungeonTileButtonMarkup(tile));
      }
    }

    const craftingRows = (Array.isArray(status.recipes) ? status.recipes : [])
      .map((recipe) => {
        const costs = (Array.isArray(recipe.costs) ? recipe.costs : [])
          .map((cost) => `${formatInt(cost.count || 0)} ${toTitleToken(cost.itemId)}`)
          .join(" + ");
        const outputCount = formatInt(recipe.output?.count || 1);
        const outputName = toTitleToken(recipe.output?.itemId || "item");
        return `
          <div class="row">
            <div class="kv">${recipe.name}: ${costs} -> ${outputCount} ${outputName}</div>
            ${actionButton("Craft", "secondary compact", `dungeon:craft:${recipe.id}`, !recipe.canCraft || Boolean(movement))}
          </div>
        `;
      })
      .join("");

    const craftingInventoryPopup = craftingVisible
      ? `
        <div class="rift-crafting-popup rift-crafting-popup--inventory">
          <div class="rift-crafting-popup__header">
            <h3>Workbench</h3>
            ${actionButton("Close", "ghost compact", "dungeon:craft-close")}
          </div>
          <div class="rift-crafting-popup__body">
            ${craftingRows || "<div class=\"kv\">No recipes available.</div>"}
          </div>
        </div>
      `
      : "";

    const inventorySlots = (status.inventory?.slots || []).map((slot, index) => {
      if (!slot) {
        return `<div class="rift-slot"><span class="kv">Slot ${index + 1}</span><div class="muted">Empty</div></div>`;
      }
      return `
        <div class="rift-slot">
          <span class="kv">Slot ${index + 1}</span>
          <div class="rift-slot-row">
            <div><strong>${slot.name}</strong> x${formatInt(slot.count || 0)}</div>
            <div class="rift-slot-actions">${actionButton("Drop 1", "ghost compact", `dungeon:drop-slot:${index}`, Boolean(movement))}</div>
          </div>
        </div>
      `;
    }).join("");

    const descendAction = room.special?.type === "descend"
      ? `<div class="row">${actionButton("Descend", "primary", "dungeon:descend", Boolean(movement))}<div class="kv">Black hole soft-resets this system and increases depth.</div></div>`
      : "";

    return `
      <div class="row">
        <div>
          <div><strong>${room.name || "Unknown Room"}</strong> | Depth ${formatInt(run.depth || 1)}</div>
          <div class="kv">${room.description || ""} | Combat power ${formatInt(status.playerPower || 1)} | Pos (<span data-dungeon-pos-x>${formatInt(player.x)}</span>, <span data-dungeon-pos-y>${formatInt(player.y)}</span>) | Relics ${relicsEarned}</div>
        </div>
        ${actionButton("Abandon", "ghost", "dungeon:abandon")}
      </div>

      <div class="rift-room-layout">
        <aside class="rift-room-sidebar">
          <h3>Inventory (6 Slots)</h3>
          <div class="rift-inventory-grid">${inventorySlots}</div>
          ${craftingInventoryPopup}
        </aside>

        <div class="rift-room-main">
          <div class="rift-grid-wrap">
            <div class="rift-grid-board" style="--cols:${grid.width};--rows:${grid.height};">
              ${tileButtons.join("")}
            </div>
          </div>

          ${descendAction}
        </div>
      </div>
    `;
  }

  function renderTabPanel(rates) {
    if (ui.activeTab === "upgrades") {
      return renderUpgradesPanel();
    }
    if (ui.activeTab === "research") {
      return renderResearchPanel();
    }
    if (ui.activeTab === "expeditions") {
      return renderExpeditionsPanel();
    }
    if (ui.activeTab === "collection") {
      return renderCollectionPanel();
    }
    if (ui.activeTab === "dungeons") {
      return renderDungeonsPanel();
    }
    if (ui.activeTab === "ascend") {
      return renderAscendPanel();
    }
    return renderUpgradesPanel();
  }

  function applyTabActiveState() {
    appEl.querySelectorAll("button[data-action^='tab:']").forEach((el) => {
      const action = el.getAttribute("data-action");
      const isActive = action === `tab:${ui.activeTab}`;
      el.classList.toggle("active", isActive);
    });
  }

  function renderPanel() {
    const rates = formulas.productionPerSecond(state, generatorDefs);
    const expeditionUnlocked = isExpeditionUnlocked();
    const isAscendTab = ui.activeTab === "ascend";
    const isExpeditionsTab = ui.activeTab === "expeditions" && expeditionUnlocked;
    const isDungeonsTab = ui.activeTab === "dungeons";
    const isFullWidthTab = isAscendTab || isExpeditionsTab || isDungeonsTab;
    snapshotRareDropTableState();
    if (ui.panelEl && (ui.activeTab === "upgrades" || ui.activeTab === "research" || ui.activeTab === "expeditions" || ui.activeTab === "collection" || ui.activeTab === "dungeons")) {
      const currentScroll = ui.panelEl.querySelector(".scroll-panel");
      if (currentScroll) {
        ui.scrollPositions[ui.activeTab] = currentScroll.scrollTop;
      }
    }
    if (ui.pinnedEl) {
      ui.pinnedEl.innerHTML = renderPinnedPanel(rates);
      cachePinnedRefs();
    }
    ui.panelEl.innerHTML = renderTabPanel(rates);
    applyTabActiveState();
    if (ui.panelEl && (ui.activeTab === "upgrades" || ui.activeTab === "research" || ui.activeTab === "expeditions" || ui.activeTab === "collection" || ui.activeTab === "dungeons")) {
      const nextScroll = ui.panelEl.querySelector(".scroll-panel");
      if (nextScroll) {
        nextScroll.scrollTop = ui.scrollPositions[ui.activeTab] || 0;
      }
    }
    hydrateUiIcons(ui.pinnedEl);
    hydrateUiIcons(ui.panelEl);
    refs.mainGrid.classList.toggle("full-width-mode", isFullWidthTab);
    refs.mainGrid.classList.toggle("expeditions-mode", isExpeditionsTab);
    if (isAscendTab) {
      refs.mainGrid.classList.add("ascend-mode");
      setupAscendInteractions();
    } else {
      refs.mainGrid.classList.remove("ascend-mode");
    }
    ui.lastExpeditionSignature = getExpeditionRenderSignature();
    ui.lastDungeonSignature = getDungeonRenderSignature();
    ui.lastDungeonLiveState = toStoredDungeonLiveState(getDungeonLiveSnapshot());
    persistCurrentViewState();
  }

  function getExpeditionRenderSignature() {
    const status = systems.expeditions.getStatus();
    const run = status.activeRun;
    const chest = status.rewardsChest || { capacity: 0, items: [] };
    const chestCount = Array.isArray(chest.items) ? chest.items.length : 0;
    const chestCapacity = Math.max(0, Number(chest.capacity) || 0);
    const continuous = status.continuous || { active: false, bandId: null, stopReason: "" };
    return [
      ui.expeditionsView,
      status.selectedShip || "",
      run ? "active" : "inactive",
      run?.bandId || "",
      run?.stageIndex ?? -1,
      run?.awaitingChoice ? 1 : 0,
      run?.pendingChoices?.length ?? 0,
      run?.routeHistory?.length ?? 0,
      run?.encounterLog?.length ?? 0,
      run?.pendingDrops?.length ?? 0,
      chestCount,
      chestCapacity,
      continuous.active ? 1 : 0,
      continuous.bandId || "",
      continuous.stopReason || ""
    ].join("|");
  }

  function getDungeonRenderSignature() {
    pruneDungeonBubbles();
    const status = systems.dungeons.getStatus();
    const run = status.activeRun;
    const room = status.currentRoom;
    const doorSignature = Object.values(room?.doors || {})
      .map((door) => `${door.direction}:${door.unlocked ? 1 : 0}:${door.blocked ? 1 : 0}:${door.requiredKeys || 0}`)
      .join(",");
    return [
      status.unlocked ? 1 : 0,
      status.meta?.depth || 0,
      status.meta?.totalDescends || 0,
      status.rewards?.lifetime?.relicsEarned || 0,
      status.crafting?.stationOpen ? 1 : 0,
      status.crafting?.stationRoomId || "",
      status.playerPower || 0,
      run?.runId || "",
      run?.currentRoomId || "",
      run?.movement ? 1 : 0,
      run?.movement?.target?.x ?? -1,
      run?.movement?.target?.y ?? -1,
      Array.isArray(room?.floorItems) ? room.floorItems.filter((item) => !item.pickedUp).length : 0,
      Array.isArray(room?.gatherNodes) ? room.gatherNodes.map((node) => node.remainingCharges || 0).join(",") : "",
      Array.isArray(room?.mobs) ? room.mobs.filter((mob) => mob.alive).length : 0,
      Array.isArray(room?.chests) ? room.chests.filter((chest) => !chest.opened).length : 0,
      room?.special?.type || "",
      doorSignature,
      (status.inventory?.slots || []).map((slot) => (slot ? `${slot.itemId}:${slot.count}` : "_")).join(",")
    ].join("|");
  }

  function refreshExpeditionLiveState() {
    if (ui.activeTab !== "expeditions" || ui.expeditionsView !== "runs") {
      return;
    }
    const status = systems.expeditions.getStatus();
    const run = status.activeRun;
    if (!run || run.awaitingChoice) {
      return;
    }

    const segmentProgressRaw = run.segmentDurationSeconds > 0
      ? run.segmentElapsedSeconds / run.segmentDurationSeconds
      : 0;
    const segmentProgress = Math.max(0, Math.min(1, segmentProgressRaw));
    const completedStages = run.stageIndex + segmentProgress;
    const totalProgressRaw = run.stageCount > 0 ? completedStages / run.stageCount : 0;
    const progress = Math.max(0, Math.min(100, totalProgressRaw * 100));
    const stageCount = Math.max(1, Number(run.stageCount) || 1);
    const stageNumber = Math.min(run.stageIndex + 1, stageCount);
    const band = status.bands.find((item) => item.id === run.bandId);
    const shipRiskMitigation = run.ship?.stats?.riskMitigation || 0;
    const totalMitigation = clamp((state.perks.expeditionRiskMitigation || 0) + shipRiskMitigation, 0, 0.8);
    const currentRisk = clamp((band?.risk || 0) + (run.modifiers?.riskDelta || 0), 0.04, 0.98);
    const mitigatedRisk = currentRisk * (1 - totalMitigation);

    const stageEl = ui.panelEl.querySelector("#expedition-stage-text");
    const riskEl = ui.panelEl.querySelector("#expedition-risk-text");
    const progressEl = ui.panelEl.querySelector("#expedition-progress-fill");

    if (stageEl) {
      stageEl.textContent = `Stage ${stageNumber}/${stageCount}`;
    }
    if (riskEl) {
      riskEl.textContent = `Risk ${formatPercent(mitigatedRisk)}`;
    }
    if (progressEl) {
      progressEl.style.width = `${Math.max(2, progress).toFixed(1)}%`;
    }
  }

  function setupAscendInteractions() {
    const viewport = ui.panelEl.querySelector("[data-ascend-viewport]");
    const stage = ui.panelEl.querySelector("[data-ascend-stage]");
    if (!viewport || !stage) {
      return;
    }

    if (!ui.ascendView) {
      ui.ascendView = {
        scale: 1,
        minScale: 0.6,
        maxScale: 1.8,
        x: 0,
        y: 0,
        dragging: false,
        panning: false,
        startX: 0,
        startY: 0,
        baseX: 0,
        baseY: 0,
        suppressClick: false
      };
    }

    const view = ui.ascendView;

    function updateTransform() {
      stage.style.setProperty("--pan-x", `${view.x.toFixed(1)}px`);
      stage.style.setProperty("--pan-y", `${view.y.toFixed(1)}px`);
      stage.style.setProperty("--zoom", view.scale.toFixed(3));
    }

    updateTransform();

    if (viewport.dataset.bound === "true") {
      return;
    }
    viewport.dataset.bound = "true";

    viewport.addEventListener("wheel", (event) => {
      event.preventDefault();
      const delta = event.deltaY;
      const nextScale = clamp(view.scale * (delta > 0 ? 0.9 : 1.1), view.minScale, view.maxScale);
      if (nextScale === view.scale) {
        return;
      }

      const rect = viewport.getBoundingClientRect();
      const cx = event.clientX - rect.left - rect.width / 2;
      const cy = event.clientY - rect.top - rect.height / 2;
      const ratio = nextScale / view.scale;

      view.x = cx - (cx - view.x) * ratio;
      view.y = cy - (cy - view.y) * ratio;
      view.scale = nextScale;
      updateTransform();
    }, { passive: false });

    viewport.addEventListener("pointerdown", (event) => {
      const button = event.target.closest("button");
      if (button && !(button.classList.contains("owned") || button.classList.contains("locked"))) {
        return;
      }
      view.dragging = true;
      view.panning = false;
      view.startX = event.clientX;
      view.startY = event.clientY;
      view.baseX = view.x;
      view.baseY = view.y;
      viewport.setPointerCapture(event.pointerId);
    });

    viewport.addEventListener("pointermove", (event) => {
      if (!view.dragging) {
        return;
      }
      const dx = event.clientX - view.startX;
      const dy = event.clientY - view.startY;
      if (!view.panning && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        view.panning = true;
        viewport.classList.add("dragging");
      }
      if (!view.panning) {
        return;
      }
      view.x = view.baseX + dx;
      view.y = view.baseY + dy;
      updateTransform();
    });

    function endPan(event) {
      if (!view.dragging) {
        return;
      }
      view.dragging = false;
      viewport.classList.remove("dragging");
      if (view.panning) {
        view.suppressClick = true;
        setTimeout(() => {
          view.suppressClick = false;
        }, 50);
      }
      view.panning = false;
      if (event?.pointerId) {
        viewport.releasePointerCapture(event.pointerId);
      }
    }

    viewport.addEventListener("pointerup", endPan);
    viewport.addEventListener("pointercancel", endPan);
    viewport.addEventListener("pointerleave", endPan);
  }

  function bindEvents() {
    if (ui.isBound) {
      return;
    }
    appEl.addEventListener("click", (event) => {
      const target = event.target.closest("button[data-action]");
      if (!target || target.disabled) {
        return;
      }
      if (ui.activeTab === "ascend" && ui.ascendView?.suppressClick) {
        return;
      }
      const action = target.getAttribute("data-action") || "";
      const expeditionActionRequested =
        action === "tab:expeditions" ||
        action.startsWith("expedition:") ||
        action.startsWith("ship:");
      const dungeonActionRequested =
        action.startsWith("dungeon:");
      if (!isExpeditionUnlocked() && expeditionActionRequested) {
        ui.expeditionsView = "runs";
        setNotice("Unlock Expedition Keystone in Ascend to access Expeditions.", false);
        if (action === "tab:expeditions") {
          ui.activeTab = "ascend";
          renderPanel();
        }
        refreshHud();
        return;
      }
      if (!isDungeonUnlocked() && dungeonActionRequested) {
        setNotice("Unlock Rift Delve Keystone in Ascend to access Dungeons.", false);
        refreshHud();
        return;
      }

      if (action === "debug:toggle") {
        toggleDebugPanel();
      } else if (action === "debug:telemetry") {
        const nextEnabled = !isTelemetryEnabled();
        setTelemetryEnabled(nextEnabled);
        setNotice(`Balance telemetry ${nextEnabled ? "enabled" : "disabled"}.`, nextEnabled);
        ui.lastDebugRefreshAt = 0;
        refreshDebugPanelMetrics();
      } else if (action === "debug:set-rift-depth") {
        const rawDepth = refs.debugRiftDepthInput?.value;
        const parsedDepth = Math.floor(Number(rawDepth));
        if (!Number.isFinite(parsedDepth)) {
          setNotice("Enter a valid Rift Delve depth value.", false);
          refreshHud();
          return;
        }

        const nextDepth = clamp(parsedDepth, 1, 999);
        if (!state.riftDelve || typeof state.riftDelve !== "object") {
          state.riftDelve = { meta: { depth: nextDepth, bestDepth: nextDepth } };
        }
        if (!state.riftDelve.meta || typeof state.riftDelve.meta !== "object") {
          state.riftDelve.meta = { depth: nextDepth, bestDepth: nextDepth };
        }

        state.riftDelve.meta.depth = nextDepth;
        state.riftDelve.meta.bestDepth = Math.max(
          Math.max(1, Math.floor(Number(state.riftDelve.meta.bestDepth) || 1)),
          nextDepth
        );

        if (state.riftDelve.activeRun && typeof state.riftDelve.activeRun === "object") {
          state.riftDelve.activeRun.depth = nextDepth;
        }

        ui.lastDungeonSignature = "";
        ui.lastDebugRefreshAt = 0;
        refreshDebugPanelMetrics();
        setNotice(`Rift Delve depth set to ${formatInt(nextDepth)}.`, true);
        renderPanel();
      } else if (action === "debug:validate-rift") {
        if (!systems.dungeons || typeof systems.dungeons.runSafetyValidation !== "function") {
          setNotice("Rift safety validator is not available.", false);
          refreshHud();
          return;
        }

        const result = systems.dungeons.runSafetyValidation({
          sampleCount: 100,
          startDepth: state.riftDelve?.meta?.depth || 1
        });
        if (result.ok) {
          setNotice(`Rift validation passed across ${formatInt(result.sampleCount || 0)} depth samples.`, true);
        } else {
          const firstFailure = Array.isArray(result.failures) ? result.failures[0] : null;
          const depthLabel = firstFailure ? `depth ${formatInt(firstFailure.depth || 0)}: ` : "";
          const reason = firstFailure?.reason || "Unknown validation failure.";
          setNotice(`Rift validation failed at ${depthLabel}${reason}`, false);
        }
        ui.lastDebugRefreshAt = 0;
        refreshDebugPanelMetrics();
        renderPanel();
      } else if (action === "transmute") {
        systems.actions.manualTransmute();
        setNotice("Matter transmuted.", true);
        if (ui.activeTab !== "overview") {
          renderPanel();
        }
      } else if (action === "convert") {
        const result = systems.actions.convertMatterToFire();
        setNotice(result.ok ? "Conversion successful." : result.reason, result.ok);
        if (ui.activeTab !== "overview") {
          renderPanel();
        }
      } else if (action === "ascend") {
        const ascendGain = Math.max(1, ascendShardGainFromResources(state));
        const ascendCostValues = ascendCost(state);
        const confirmed = window.confirm(
          `Ascend now for +${formatNumber(ascendGain)} Shards?\nThis spends ${formatNumber(ascendCostValues.matterCost)} Matter and ${formatNumber(ascendCostValues.fireCost)} Fire.`
        );
        if (!confirmed) {
          return;
        }
        const result = systems.actions.ascend();
        setNotice(result.ok ? `Ascension complete. +${result.gain} shards.` : result.reason, result.ok);
        renderPanel();
      } else if (action.startsWith("buy:")) {
        const generatorId = action.split(":")[1];
        const result = systems.generators.buy(generatorId);
        setNotice(result.ok ? "Generator purchased." : result.reason, result.ok);
        renderPanel();
      } else if (action.startsWith("upgrade:")) {
        const upgradeId = action.split(":")[1];
        const result = systems.upgrades.buy(upgradeId);
        setNotice(result.ok ? "Upgrade purchased." : result.reason, result.ok);
        renderPanel();
      } else if (action.startsWith("research:")) {
        const researchId = action.split(":")[1];
        const result = systems.research.levelUp(researchId);
        setNotice(result.ok ? "Research advanced." : result.reason, result.ok);
        renderPanel();
      } else if (action.startsWith("tab:")) {
        ui.activeTab = action.split(":")[1];
        if (ui.activeTab === "expeditions" && !ui.expeditionsView) {
          ui.expeditionsView = "runs";
        }
        renderPanel();
      } else if (action.startsWith("expedition:view:")) {
        ui.expeditionsView = action.split(":")[2] || "runs";
        renderPanel();
      } else if (action.startsWith("expedition:mode:")) {
        const mode = action.split(":")[2] || "manual";
        const result = systems.expeditions.setAutoRouteMode(mode);
        setNotice(result.ok ? `Voyage mode set to ${result.mode}.` : (result.reason || "Unable to set voyage mode."), result.ok);
        renderPanel();
      } else if (action.startsWith("expedition:buy:")) {
        const bandId = action.split(":")[2];
        const result = systems.expeditions.buyVoyage(bandId);
        const notice = result.ok
          ? (result.cost > 0
            ? `Voyage purchased for ${formatNumber(result.cost)} Intel.`
            : "Voyage already available.")
          : result.reason;
        setNotice(notice, result.ok);
        renderPanel();
      } else if (action.startsWith("expedition:start:")) {
        const bandId = action.split(":")[2];
        const result = systems.expeditions.start(bandId);
        const mode = systems.expeditions.getStatus().autoRouteMode || "manual";
        setNotice(result.ok ? `Expedition loop launched (${mode}).` : result.reason, result.ok);
        renderPanel();
      } else if (action.startsWith("expedition:use-map:")) {
        const encodedMapId = action.slice("expedition:use-map:".length);
        const mapId = decodeURIComponent(encodedMapId || "");
        const result = systems.expeditions.useVoyageMap(mapId);
        const notice = result.ok
          ? `${result.mapName} consumed. ${result.bandName} unlocked.`
          : result.reason;
        setNotice(notice, result.ok);
        renderPanel();
      } else if (action === "expedition:claim-all") {
        const result = systems.expeditions.claimChestAll();
        const dropCount = Array.isArray(result.drops) ? result.drops.length : 0;
        const runCount = Math.max(0, Number(result.runsClaimed) || 0);
        const claimNotice = result.ok
          ? (dropCount > 0
            ? `Claimed ${runCount} reward runs from chest. ${dropCount} rare find(s) secured.`
            : `Claimed ${runCount} reward runs from chest.`)
          : result.reason;
        setNotice(claimNotice, result.ok);
        renderPanel();
      } else if (action === "expedition:abandon") {
        const result = systems.expeditions.abandon();
        setNotice(result.ok ? "Expedition abandoned." : result.reason, result.ok);
        renderPanel();
      } else if (action.startsWith("expedition:route:")) {
        const choiceId = action.split(":")[2];
        const result = systems.expeditions.chooseRoute(choiceId);
        const notice = result.ok
          ? (result.encounter ? `Voyage path locked. Encounter: ${result.encounter.name}.` : "Voyage path locked.")
          : result.reason;
        setNotice(notice, result.ok);
        renderPanel();
      } else if (action === "dungeon:start") {
        const result = systems.dungeons.startRun();
        setNotice(result.ok ? "Rift Delve run started." : result.reason, result.ok);
        renderPanel();
      } else if (action.startsWith("dungeon:tile:")) {
        const parts = action.split(":");
        const x = Number(parts[2]);
        const y = Number(parts[3]);
        const result = systems.dungeons.moveToTile(x, y);
        setNotice(result.ok ? (result.message || "Moving.") : result.reason, result.ok);
        renderPanel();
      } else if (action.startsWith("dungeon:craft:")) {
        const recipeId = action.split(":")[2] || "";
        const result = systems.dungeons.craft(recipeId);
        setNotice(result.ok ? "Craft complete." : result.reason, result.ok);
        renderPanel();
      } else if (action.startsWith("dungeon:drop-slot:")) {
        const slotIndex = Number(action.split(":")[2]);
        const result = systems.dungeons.dropInventorySlot(slotIndex);
        const droppedName = result?.dropped?.itemName || "item";
        const droppedCount = formatInt(result?.dropped?.count || 0);
        setNotice(result.ok ? `Dropped ${droppedCount}x ${droppedName}.` : result.reason, result.ok);
        renderPanel();
      } else if (action === "dungeon:craft-close") {
        const result = systems.dungeons.closeCraftingStation();
        setNotice(result.ok ? "Workbench closed." : result.reason, result.ok);
        renderPanel();
      } else if (action === "dungeon:descend") {
        const result = systems.dungeons.interactDescend();
        const notice = result.ok
          ? `Descended. +${formatInt(result.reward?.relics || 0)} relics. Depth ${formatInt(result.nextDepth || 1)} unlocked.`
          : result.reason;
        setNotice(notice, result.ok);
        renderPanel();
      } else if (action === "dungeon:abandon") {
        const result = systems.dungeons.abandonRun();
        setNotice(result.ok ? "Rift Delve run abandoned." : result.reason, result.ok);
        renderPanel();
      } else if (action.startsWith("collection:claim:")) {
        const milestoneId = action.split(":")[2] || "";
        const result = systems.expeditions.claimCollectionMilestone(milestoneId);
        setNotice(result.ok ? `${result.milestone.name} claimed.` : result.reason, result.ok);
        renderPanel();
      } else if (action.startsWith("rare-popup:dismiss:")) {
        const popupId = Number(action.split(":")[2]);
        if (Number.isFinite(popupId)) {
          dismissRareDropPopup(popupId);
        }
      } else if (action.startsWith("ship:select:")) {
        const shipId = action.split(":")[2];
        const result = systems.ships.selectShip(shipId);
        setNotice(result.ok ? "Ship selected." : result.reason, result.ok);
        renderPanel();
      } else if (action.startsWith("ship:buy:")) {
        const shipId = action.split(":")[2];
        const result = systems.ships.buyShip(shipId);
        setNotice(result.ok ? "Ship purchased." : result.reason, result.ok);
        renderPanel();
      } else if (action.startsWith("ship:focus:")) {
        ui.fleetFocusSlot = action.split(":")[2] || "hull";
        ui.dragHoverSlot = "";
        renderPanel();
      } else if (action.startsWith("ship:upgrade:")) {
        const shipId = action.split(":")[2];
        const facilityId = action.split(":")[3];
        const result = systems.ships.upgradeFacility(shipId, facilityId);
        setNotice(result.ok ? "Facility upgraded." : result.reason, result.ok);
        renderPanel();
      } else if (action.startsWith("ship:equip:")) {
        const shipId = action.split(":")[2];
        const slotId = action.split(":")[3];
        const encodedPartId = action.split(":")[4] || "";
        const partId = decodeURIComponent(encodedPartId);
        const result = systems.ships.equipPart(shipId, slotId, partId);
        setNotice(result.ok ? "Part equipped." : result.reason, result.ok);
        renderPanel();
      } else if (action.startsWith("ship:combine:")) {
        const encodedPartRef = action.split(":")[2] || "";
        const partRef = decodeURIComponent(encodedPartRef);
        const result = systems.ships.combinePart(partRef);
        const partName = result.partId
          ? (systems.ships.getStatus().partDefs?.[result.partId]?.name || result.partId)
          : "Part";
        const notice = result.ok
          ? `${partName} fused to T${result.nextTier}.`
          : result.reason;
        setNotice(notice, result.ok);
        renderPanel();
      } else if (action.startsWith("ship:unequip:")) {
        const shipId = action.split(":")[2];
        const slotId = action.split(":")[3];
        const result = systems.ships.unequipPart(shipId, slotId);
        setNotice(result.ok ? "Part unequipped." : result.reason, result.ok);
        renderPanel();
      } else if (action.startsWith("ascend:")) {
        const nodeId = action.split(":")[1];
        const result = systems.ascendTree.buy(nodeId);
        setNotice(result.ok ? "Ascension node unlocked." : result.reason, result.ok);
        renderPanel();
      } else if (action === "save-reset" && saveSlots) {
        saveSlots.onReset(saveSlots.activeSlotId);
      }

      refreshHud();
    });

    appEl.addEventListener("toggle", (event) => {
      const detailsEl = event.target instanceof Element
        ? event.target.closest("details.expedition-loot-table[data-loot-table-key]")
        : null;
      if (!detailsEl) {
        return;
      }
      const key = detailsEl.dataset.lootTableKey;
      if (!key) {
        return;
      }
      ui.rareDropTableState[key] = detailsEl.open;
    }, true);

    function clearShipDropTargets() {
      appEl.querySelectorAll(".ship-zone.drop-target, .ship-zone.drop-invalid").forEach((zoneEl) => {
        zoneEl.classList.remove("drop-target", "drop-invalid");
      });
    }

    function getDraggedPartDef() {
      if (!ui.draggingPartId) {
        return null;
      }
      const parsed = systems.ships.parsePartRef?.(ui.draggingPartId);
      if (!parsed) {
        return null;
      }
      return systems.ships.getStatus().partDefs?.[parsed.partId] || null;
    }

    appEl.addEventListener("dragstart", (event) => {
      const itemEl = event.target.closest(".inventory-item[data-part-id]");
      if (itemEl) {
        ui.draggingPartId = itemEl.dataset.partId || "";
        const sourceShipId = itemEl.dataset.shipId || systems.ships.getStatus().selectedShip;
        ui.dragSourceType = "inventory";
        ui.dragSourceSlot = "";
        ui.dragSourceShipId = sourceShipId;
        ui.dragDropHandled = false;
        const payload = JSON.stringify({
          partId: ui.draggingPartId,
          slotId: itemEl.dataset.slot || "",
          shipId: sourceShipId
        });
        event.dataTransfer?.setData("text/plain", payload);
        event.dataTransfer.effectAllowed = "move";
        itemEl.classList.add("dragging");
        return;
      }

      const zoneEl = event.target.closest(".ship-zone[data-slot][data-equipped-ref]");
      const equippedRef = zoneEl?.dataset.equippedRef || "";
      if (!zoneEl || !equippedRef) {
        return;
      }

      ui.draggingPartId = equippedRef;
      ui.dragSourceType = "equipped-zone";
      ui.dragSourceSlot = zoneEl.dataset.slot || "";
      ui.dragSourceShipId = zoneEl.dataset.shipId || systems.ships.getStatus().selectedShip;
      ui.dragDropHandled = false;
      const payload = JSON.stringify({
        partId: ui.draggingPartId,
        slotId: ui.dragSourceSlot,
        shipId: ui.dragSourceShipId,
        source: "equipped-zone"
      });
      event.dataTransfer?.setData("text/plain", payload);
      event.dataTransfer.effectAllowed = "move";
      zoneEl.classList.add("dragging");
    });

    appEl.addEventListener("dragend", (event) => {
      const sourceType = ui.dragSourceType;
      const sourceShipId = ui.dragSourceShipId;
      const sourceSlot = ui.dragSourceSlot;
      const dropHandled = ui.dragDropHandled;

      const itemEl = event.target.closest(".inventory-item.dragging");
      const zoneEl = event.target.closest(".ship-zone.dragging");
      if (itemEl) {
        itemEl.classList.remove("dragging");
      }
      if (zoneEl) {
        zoneEl.classList.remove("dragging");
      }

      ui.draggingPartId = "";
      ui.dragHoverSlot = "";
      ui.dragSourceType = "";
      ui.dragSourceSlot = "";
      ui.dragSourceShipId = "";
      ui.dragDropHandled = false;
      clearShipDropTargets();

      if (sourceType === "equipped-zone" && !dropHandled && sourceShipId && sourceSlot) {
        const result = systems.ships.unequipPart(sourceShipId, sourceSlot);
        setNotice(result.ok ? "Part unequipped." : result.reason, result.ok);
        renderPanel();
        refreshHud();
      }
    });

    appEl.addEventListener("dragover", (event) => {
      const zoneEl = event.target.closest(".ship-zone[data-slot]");
      if (!zoneEl || !ui.draggingPartId) {
        return;
      }
      const partDef = getDraggedPartDef();
      const slotId = zoneEl.dataset.slot || "";
      const shipId = zoneEl.dataset.shipId || systems.ships.getStatus().selectedShip;
      const compatible = Boolean(partDef) && partDef.slot === slotId && (!partDef.shipId || partDef.shipId === shipId);
      ui.dragHoverSlot = slotId;
      clearShipDropTargets();
      zoneEl.classList.add(compatible ? "drop-target" : "drop-invalid");
      if (compatible) {
        event.preventDefault();
      }
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = compatible ? "move" : "none";
      }
    });

    appEl.addEventListener("dragleave", (event) => {
      const zoneEl = event.target.closest(".ship-zone[data-slot]");
      if (!zoneEl) {
        return;
      }
      ui.dragHoverSlot = "";
      zoneEl.classList.remove("drop-target", "drop-invalid");
    });

    appEl.addEventListener("drop", (event) => {
      const zoneEl = event.target.closest(".ship-zone[data-slot]");
      if (!zoneEl) {
        return;
      }
      if (!isExpeditionUnlocked()) {
        clearShipDropTargets();
        ui.draggingPartId = "";
        ui.dragHoverSlot = "";
        setNotice("Unlock Expedition Keystone in Ascend to manage ship parts.", false);
        refreshHud();
        return;
      }
      event.preventDefault();
      ui.dragDropHandled = true;
      let payload = null;
      const rawData = event.dataTransfer?.getData("text/plain") || "";
      if (rawData) {
        try {
          payload = JSON.parse(rawData);
        } catch {
          payload = null;
        }
      }

      const partId = payload?.partId || ui.draggingPartId;
      const shipId = zoneEl.dataset.shipId || payload?.shipId || systems.ships.getStatus().selectedShip;
      const slotId = zoneEl.dataset.slot || "";
      const parsedPart = systems.ships.parsePartRef?.(partId);
      const partDef = parsedPart ? systems.ships.getStatus().partDefs?.[parsedPart.partId] || null : null;
      clearShipDropTargets();

      if (!partId || !shipId || !slotId) {
        return;
      }

      if (!partDef) {
        setNotice("Unknown part selected.", false);
        return;
      }
      if (partDef.slot !== slotId) {
        setNotice(`That part fits ${partDef.slot}, not ${slotId}.`, false);
        return;
      }
      if (partDef.shipId && partDef.shipId !== shipId) {
        setNotice(`That part is restricted to ${partDef.shipId}.`, false);
        return;
      }

      const result = systems.ships.equipPart(shipId, slotId, parsedPart?.ref || partId);
      setNotice(result.ok ? "Part equipped." : result.reason, result.ok);
      renderPanel();
      refreshHud();
    });

    if (refs.saveSlot && saveSlots) {
      refs.saveSlot.addEventListener("change", (event) => {
        const value = event.target.value;
        saveSlots.onSelect(value);
      });
    }
    ui.isBound = true;
  }

  function start() {
    setupDungeonInteractionBubbles();
    buildLayout();
    bindEvents();
    renderPanel();
    renderDebugPanel();
    refreshHud();
  }

  function refreshHud() {
    const rates = formulas.productionPerSecond(state, generatorDefs);
    const ascendGain = Math.max(1, ascendShardGainFromResources(state));
    const ascendCostValues = ascendCost(state);
    const expeditionStatus = systems.expeditions.getStatus();
    const expeditionUnlocked = Boolean(expeditionStatus.unlocked);
    const chest = expeditionStatus.rewardsChest || { capacity: 10, items: [] };
    const chestItems = Array.isArray(chest.items) ? chest.items : [];
    const chestCount = chestItems.length;

    refs.matter.textContent = formatNumber(state.resources.matter);
    refs.fire.textContent = formatNumber(state.resources.fire);
    refs.shards.textContent = formatNumber(state.resources.shards);
    refs.intel.textContent = formatNumber(state.expeditions?.meta?.intel || 0);
    refs.prodInline.textContent = `x${formatIntOrFixed(state.perks.productionMultiplier)}`;

    refs.intelCard.classList.toggle("is-locked", !expeditionUnlocked);
    refs.intelHint.textContent = expeditionUnlocked ? "Runs and ship upgrades" : "Unlock Expedition Keystone";
    refs.intelAction.disabled = !expeditionUnlocked;
    if (refs.expeditionsTab) {
      refs.expeditionsTab.disabled = !expeditionUnlocked;
    }
    if (!expeditionUnlocked && ui.activeTab === "expeditions") {
      ui.activeTab = "ascend";
      ui.expeditionsView = "runs";
      renderPanel();
    }

    const clickBase = (balance.baseClickMatter + state.perks.clickMatterBonus) * state.perks.clickMultiplier;
    const clickFire = state.perks.clickFireBonus;
    refs.transmuteMatterAmount.textContent = `+${formatNumber(clickBase)}`;
    if (clickFire > 0) {
      refs.transmuteFireBonus.classList.remove("hidden");
      refs.transmuteFireBonusAmount.textContent = formatNumber(clickFire);
    } else {
      refs.transmuteFireBonus.classList.add("hidden");
    }
    const conversionBase = balance.elementConversionCost * state.perks.conversionCostMultiplier;
    const conversionCost = Math.max(1, Math.floor(conversionBase - state.perks.conversionCostFlatReduction));
    const conversionOut = (1 + state.perks.conversionFireBonus) * state.perks.conversionYieldMultiplier;
    refs.convertCostAmount.textContent = formatNumber(conversionCost);
    refs.convertOutAmount.textContent = formatNumber(conversionOut);
    refs.ascendMatterCost.textContent = formatNumber(ascendCostValues.matterCost);
    refs.ascendFireCost.textContent = formatNumber(ascendCostValues.fireCost);
    refs.ascendGainAmount.textContent = `+${formatNumber(ascendGain)}`;
    refs.rate.textContent = `${formatNumber(rates.matter)}/s Matter | ${formatNumber(rates.fire)}/s Fire`;

    refs.convertButton.disabled = state.resources.matter < conversionCost;
    refs.ascendButton.disabled =
      state.resources.matter < ascendCostValues.matterCost ||
      state.resources.fire < ascendCostValues.fireCost;

    refs.notice.textContent = ui.notice;
    refs.notice.classList.toggle("good", ui.good);
    renderRareDropPopups();

    if (ui.debugPanelVisible) {
      const now = Date.now();
      if (now - ui.lastDebugRefreshAt >= 250) {
        ui.lastDebugRefreshAt = now;
        refreshDebugPanelMetrics();
      }
    }

    if (ui.activeTab === "expeditions") {
      const nextSignature = getExpeditionRenderSignature();
      if (nextSignature !== ui.lastExpeditionSignature) {
        ui.lastExpeditionSignature = nextSignature;
        renderPanel();
      } else {
        refreshExpeditionLiveState();
      }
    } else if (ui.activeTab === "dungeons") {
      const nextSignature = getDungeonRenderSignature();
      if (nextSignature !== ui.lastDungeonSignature) {
        ui.lastDungeonSignature = nextSignature;
        renderPanel();
      } else {
        refreshDungeonLiveState();
      }
    }
  }

  return {
    start,
    setNotice,
    showRareDropPopup,
    refreshHud,
    toggleDebugPanel
  };
}
