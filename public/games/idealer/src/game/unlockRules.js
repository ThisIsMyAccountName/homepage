export function isUnlockMet(state, unlock) {
  if (!unlock || !unlock.type) {
    return true;
  }

  if (unlock.type === "matterSeen") {
    return state.lifetime.matterSeen >= unlock.value;
  }
  if (unlock.type === "fireSeen") {
    return state.lifetime.fireSeen >= unlock.value;
  }
  if (unlock.type === "ascensions") {
    return state.lifetime.totalAscensions >= unlock.value;
  }
  if (unlock.type === "ascensionNode") {
    return Boolean(state.ascensionTree?.[unlock.value]);
  }
  if (unlock.type === "ascensionNodeCount") {
    const count = Object.values(state.ascensionTree || {}).filter(Boolean).length;
    return count >= unlock.value;
  }
  return true;
}
