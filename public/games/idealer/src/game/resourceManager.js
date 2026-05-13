export function createResourceManager(state) {
  function add(resource, amount) {
    const n = Number(amount) || 0;
    if (n <= 0) {
      return;
    }
    state.resources[resource] = (state.resources[resource] || 0) + n;
    if (resource === "matter") {
      state.lifetime.matterSeen += n;
    }
    if (resource === "fire") {
      state.lifetime.fireSeen += n;
    }
  }

  function canAfford(resource, amount) {
    return (state.resources[resource] || 0) >= amount;
  }

  function spend(resource, amount) {
    if (!canAfford(resource, amount)) {
      return false;
    }
    state.resources[resource] -= amount;
    return true;
  }

  return { add, spend, canAfford };
}
