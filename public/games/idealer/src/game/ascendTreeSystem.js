import { isUnlockMet } from "./unlockRules.js";

const NEIGHBORS = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 }
];

export function createAscendTreeSystem({ state, nodes, resourceManager, eventBus, recompute }) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const coordsMap = new Map(nodes.map((node) => [`${node.q},${node.r}`, node.id]));

  function hasNode(nodeId) {
    return Boolean(state.ascensionTree[nodeId]);
  }

  function isAdjacentPurchased(node) {
    return NEIGHBORS.some((offset) => {
      const key = `${node.q + offset.q},${node.r + offset.r}`;
      const neighborId = coordsMap.get(key);
      return neighborId && state.ascensionTree[neighborId];
    });
  }

  function isUnlocked(nodeId) {
    const node = nodeMap.get(nodeId);
    if (!node) {
      return false;
    }
    if (!isUnlockMet(state, node.unlock)) {
      return false;
    }
    if (node.q === 0 && node.r === 0) {
      return true;
    }
    return isAdjacentPurchased(node);
  }

  function buy(nodeId) {
    const node = nodeMap.get(nodeId);
    if (!node) {
      return { ok: false, reason: "Unknown node." };
    }
    if (hasNode(nodeId)) {
      return { ok: false, reason: "Already unlocked." };
    }
    if (!isUnlocked(nodeId)) {
      return { ok: false, reason: "Node not connected." };
    }
    if (!resourceManager.spend("shards", node.cost)) {
      return { ok: false, reason: "Not enough shards." };
    }

    state.ascensionTree[nodeId] = true;
    recompute();
    eventBus.emit("ascend:unlock", { nodeId });
    return { ok: true };
  }

  return { nodes, buy, isUnlocked, hasNode };
}
