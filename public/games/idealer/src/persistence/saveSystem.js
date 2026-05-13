import { sanitizeState } from "../engine/gameState.js";

const SAVE_PREFIX = "dimensional-alchemy-save";
const ACTIVE_SLOT_KEY = "dimensional-alchemy-active-slot";
const SLOT_IDS = ["slot-1", "slot-2", "slot-3"];

function slotKey(slotId) {
  return `${SAVE_PREFIX}:${slotId}`;
}

export function listSlots() {
  return SLOT_IDS.map((id, index) => ({ id, label: `Slot ${index + 1}` }));
}

export function getActiveSlot() {
  const stored = localStorage.getItem(ACTIVE_SLOT_KEY);
  return SLOT_IDS.includes(stored) ? stored : "slot-1";
}

export function setActiveSlot(slotId) {
  if (!SLOT_IDS.includes(slotId)) {
    return;
  }
  localStorage.setItem(ACTIVE_SLOT_KEY, slotId);
}

export function resetSlot(slotId) {
  if (!SLOT_IDS.includes(slotId)) {
    return;
  }
  localStorage.removeItem(slotKey(slotId));
}

export function loadState(slotId = getActiveSlot()) {
  try {
    const raw = localStorage.getItem(slotKey(slotId));
    if (!raw) {
      return null;
    }
    return sanitizeState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveState(state, slotId = getActiveSlot()) {
  const payload = {
    ...state,
    meta: {
      ...state.meta,
      lastSavedAt: Date.now()
    }
  };
  localStorage.setItem(slotKey(slotId), JSON.stringify(payload));
}

export function applyOfflineProgress(state, balance, resourceManager, generatorDefs, formulas, onAdvanceOffline) {
  const now = Date.now();
  if (state.meta?.offlineEligible === false) {
    state.meta.lastTickAt = now;
    state.meta.offlineEligible = true;
    return { elapsedSeconds: 0, matterGain: 0, fireGain: 0 };
  }
  const elapsedMs = Math.max(0, now - (state.meta.lastSavedAt || now));
  const elapsedSeconds = elapsedMs / 1000;
  if (elapsedSeconds < 1) {
    state.meta.lastTickAt = now;
    return { elapsedSeconds: 0, matterGain: 0, fireGain: 0 };
  }

  const rates = formulas.productionPerSecond(state, generatorDefs);
  const multiplier = balance.offlineEfficiency * state.perks.offlineEfficiencyMultiplier;
  const matterGain = rates.matter * elapsedSeconds * multiplier;
  const fireGain = rates.fire * elapsedSeconds * multiplier;

  resourceManager.add("matter", matterGain);
  resourceManager.add("fire", fireGain);
  if (typeof onAdvanceOffline === "function") {
    onAdvanceOffline(elapsedSeconds);
  }
  state.meta.lastTickAt = now;

  return { elapsedSeconds, matterGain, fireGain };
}
