import { isUnlockMet } from "./unlockRules.js";

const DOOR_DIRECTIONS = ["north", "east", "south", "west"];
const BASE_GRID_SIZE = 15;

const DEFAULT_TILE_LAYOUT = {
  spawn: { x: 7, y: 13 },
  special: { x: 7, y: 7 },
  doors: {
    north: { x: 7, y: 0 },
    east: { x: 14, y: 7 },
    south: { x: 7, y: 14 },
    west: { x: 0, y: 7 }
  },
  floorItems: [
    { x: 4, y: 11 },
    { x: 6, y: 11 },
    { x: 8, y: 11 }
  ],
  gatherNodes: [
    { x: 3, y: 4 },
    { x: 11, y: 4 },
    { x: 4, y: 6 }
  ],
  mobs: [
    { x: 10, y: 6 },
    { x: 9, y: 9 },
    { x: 6, y: 5 }
  ],
  chests: [
    { x: 4, y: 8 },
    { x: 11, y: 8 },
    { x: 10, y: 11 }
  ]
};

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clampInt(value, min, max) {
  const parsed = Math.floor(toNumber(value, min));
  return Math.min(max, Math.max(min, parsed));
}

function makeEmptySlots(slotCount) {
  return Array.from({ length: slotCount }, () => null);
}

function cloneUnlockTags(tags) {
  return Array.isArray(tags)
    ? tags.map((tag) => String(tag || "").trim()).filter(Boolean)
    : [];
}

function positionKey(x, y) {
  return `${x},${y}`;
}

function getGridConfig(config) {
  const width = clampInt(config.grid?.width, 9, 30);
  const height = clampInt(config.grid?.height, 9, 30);
  const stepMs = clampInt(config.grid?.stepMs, 50, 2000);
  return { width, height, stepMs };
}

function isWithinGrid(x, y, grid) {
  return x >= 0 && x < grid.width && y >= 0 && y < grid.height;
}

function scaleBasePoint(basePoint, grid) {
  if (!basePoint || typeof basePoint !== "object") {
    return null;
  }
  const x = clampInt(
    Math.round((toNumber(basePoint.x, 0) / (BASE_GRID_SIZE - 1)) * (grid.width - 1)),
    0,
    grid.width - 1
  );
  const y = clampInt(
    Math.round((toNumber(basePoint.y, 0) / (BASE_GRID_SIZE - 1)) * (grid.height - 1)),
    0,
    grid.height - 1
  );
  return { x, y };
}

function normalizePoint(pointLike, grid, fallbackPoint) {
  const fallback = scaleBasePoint(fallbackPoint, grid) || { x: Math.floor(grid.width / 2), y: Math.floor(grid.height / 2) };
  if (!pointLike || typeof pointLike !== "object") {
    return fallback;
  }
  const x = clampInt(pointLike.x, 0, grid.width - 1);
  const y = clampInt(pointLike.y, 0, grid.height - 1);
  return { x, y };
}

function findNearestFreePoint(preferred, used, grid) {
  const safePreferred = normalizePoint(preferred, grid, DEFAULT_TILE_LAYOUT.spawn);
  if (!used.has(positionKey(safePreferred.x, safePreferred.y))) {
    return safePreferred;
  }

  const maxRadius = Math.max(grid.width, grid.height);
  for (let radius = 1; radius <= maxRadius; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.abs(dx) + Math.abs(dy) > radius) {
          continue;
        }
        const x = safePreferred.x + dx;
        const y = safePreferred.y + dy;
        if (!isWithinGrid(x, y, grid)) {
          continue;
        }
        if (used.has(positionKey(x, y))) {
          continue;
        }
        return { x, y };
      }
    }
  }

  return safePreferred;
}

function createInventoryEntry(def, count = 1) {
  const maxStack = Math.max(1, Math.floor(toNumber(def.maxStack, 1)));
  return {
    itemId: def.id,
    itemType: def.type || "material",
    name: def.name || def.id,
    count: Math.max(1, Math.floor(toNumber(count, 1))),
    maxStack,
    toolTag: typeof def.toolTag === "string" ? def.toolTag : null,
    unlockTags: cloneUnlockTags(def.unlockTags),
    keyUses: def.type === "key" ? 1 : 0
  };
}

function getItemDef(config, itemId) {
  if (!itemId || typeof itemId !== "string") {
    return null;
  }
  return config.itemDefs?.[itemId] || null;
}

function getSlotCount(config) {
  return Math.max(1, Math.floor(toNumber(config.inventorySlots, 6)));
}

function resetInventoryState(state, config) {
  state.riftDelve.inventory.slots = makeEmptySlots(getSlotCount(config));
  state.riftDelve.inventory.equipped = {
    mainHand: null,
    offHand: null
  };
}

function setCraftingStationState(state, open, roomId = null) {
  if (!state.riftDelve.crafting || typeof state.riftDelve.crafting !== "object") {
    state.riftDelve.crafting = {
      knownRecipes: {},
      queuedCraft: null,
      stationOpen: false,
      stationRoomId: null
    };
  }

  state.riftDelve.crafting.stationOpen = Boolean(open);
  state.riftDelve.crafting.stationRoomId = open && typeof roomId === "string" ? roomId : null;
}

function addInventoryItem(state, config, itemId, count = 1) {
  const def = getItemDef(config, itemId);
  if (!def) {
    return { ok: false, reason: `Unknown item: ${itemId}.` };
  }

  const slots = state.riftDelve.inventory.slots;
  let remaining = Math.max(1, Math.floor(toNumber(count, 1)));

  if (def.type !== "tool") {
    for (let index = 0; index < slots.length && remaining > 0; index += 1) {
      const slot = slots[index];
      if (!slot || slot.itemId !== itemId || slot.count >= slot.maxStack) {
        continue;
      }
      const canAdd = Math.min(remaining, slot.maxStack - slot.count);
      slot.count += canAdd;
      remaining -= canAdd;
    }
  }

  while (remaining > 0) {
    const emptyIndex = slots.findIndex((slot) => !slot);
    if (emptyIndex === -1) {
      return { ok: false, reason: "Inventory full." };
    }
    const entry = createInventoryEntry(def, 0);
    const canPlace = Math.min(remaining, entry.maxStack);
    entry.count = canPlace;
    slots[emptyIndex] = entry;
    remaining -= canPlace;
  }

  if (def.type === "tool") {
    const equipped = state.riftDelve.inventory.equipped;
    const toolTag = def.toolTag || def.id;
    if (!equipped.mainHand) {
      equipped.mainHand = toolTag;
    } else if (!equipped.offHand && equipped.mainHand !== toolTag) {
      equipped.offHand = toolTag;
    }
  }

  return { ok: true };
}

function countInventoryItem(state, itemId) {
  return state.riftDelve.inventory.slots
    .filter((slot) => slot && slot.itemId === itemId)
    .reduce((total, slot) => total + slot.count, 0);
}

function syncEquippedTools(state) {
  const slots = Array.isArray(state.riftDelve?.inventory?.slots)
    ? state.riftDelve.inventory.slots
    : [];
  const equipped = state.riftDelve?.inventory?.equipped;
  if (!equipped || typeof equipped !== "object") {
    return;
  }

  const ownedTags = new Set(
    slots
      .filter((slot) => slot && typeof slot.toolTag === "string" && slot.toolTag)
      .map((slot) => slot.toolTag)
  );

  if (equipped.mainHand && !ownedTags.has(equipped.mainHand)) {
    equipped.mainHand = null;
  }
  if (equipped.offHand && !ownedTags.has(equipped.offHand)) {
    equipped.offHand = null;
  }

  if (!equipped.mainHand && equipped.offHand) {
    equipped.mainHand = equipped.offHand;
    equipped.offHand = null;
  }
}

function removeInventoryItem(state, itemId, amount) {
  let remaining = Math.max(0, Math.floor(toNumber(amount, 0)));
  if (remaining <= 0) {
    return true;
  }

  const slots = state.riftDelve.inventory.slots;
  for (let index = 0; index < slots.length && remaining > 0; index += 1) {
    const slot = slots[index];
    if (!slot || slot.itemId !== itemId) {
      continue;
    }
    const removeCount = Math.min(slot.count, remaining);
    slot.count -= removeCount;
    remaining -= removeCount;
    if (slot.count <= 0) {
      slots[index] = null;
    }
  }

  syncEquippedTools(state);

  return remaining <= 0;
}

function hasToolEquipped(state, toolTag) {
  const equipped = state.riftDelve.inventory.equipped || {};
  if (equipped.mainHand === toolTag || equipped.offHand === toolTag) {
    return true;
  }

  return state.riftDelve.inventory.slots.some((slot) => slot && slot.toolTag === toolTag);
}

function getEquippedToolTags(state) {
  const equipped = state.riftDelve.inventory.equipped || {};
  const tags = [];
  if (equipped.mainHand) {
    tags.push(equipped.mainHand);
  }
  if (equipped.offHand && equipped.offHand !== equipped.mainHand) {
    tags.push(equipped.offHand);
  }
  return tags;
}

function canCraftRecipe(state, recipe) {
  return recipe.costs.every((cost) => countInventoryItem(state, cost.itemId) >= cost.count);
}

function getMatchingKeySlots(state, lockTag) {
  const slots = state.riftDelve.inventory.slots;
  const matching = [];
  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    if (!slot || slot.itemType !== "key") {
      continue;
    }
    if ((slot.unlockTags || []).includes(lockTag)) {
      matching.push({ index, count: slot.count });
    }
  }
  return matching;
}

function consumeMatchingKeys(state, lockTag, requiredCount) {
  const needed = Math.max(1, Math.floor(toNumber(requiredCount, 1)));
  const matching = getMatchingKeySlots(state, lockTag);
  const total = matching.reduce((sum, entry) => sum + entry.count, 0);
  if (total < needed) {
    return false;
  }

  const slots = state.riftDelve.inventory.slots;
  let remaining = needed;
  for (const entry of matching) {
    if (remaining <= 0) {
      break;
    }
    const slot = slots[entry.index];
    if (!slot) {
      continue;
    }
    const consumed = Math.min(slot.count, remaining);
    slot.count -= consumed;
    remaining -= consumed;
    if (slot.count <= 0) {
      slots[entry.index] = null;
    }
  }

  return true;
}

function applyResourcePenalty(state, penalty = {}) {
  const matterPenalty = Math.max(0, Math.floor(toNumber(penalty.matter, 0)));
  const firePenalty = Math.max(0, Math.floor(toNumber(penalty.fire, 0)));
  const paidMatter = Math.min(state.resources.matter || 0, matterPenalty);
  const paidFire = Math.min(state.resources.fire || 0, firePenalty);
  state.resources.matter = Math.max(0, (state.resources.matter || 0) - paidMatter);
  state.resources.fire = Math.max(0, (state.resources.fire || 0) - paidFire);
  return { matter: paidMatter, fire: paidFire };
}

function getPlayerCombatPower(state, config) {
  const basePower = Math.max(1, Math.floor(toNumber(config.combat?.basePower, 1)));
  const toolPower = config.combat?.toolPower || {};
  const equippedTags = getEquippedToolTags(state);
  const addedPower = equippedTags.reduce((total, tag) => total + Math.max(0, toNumber(toolPower[tag], 0)), 0);
  return basePower + addedPower;
}

function manhattanDistance(a, b) {
  return Math.abs((a?.x ?? 0) - (b?.x ?? 0)) + Math.abs((a?.y ?? 0) - (b?.y ?? 0));
}

function buildPathBfs(start, target, grid, isBlocked) {
  if (start.x === target.x && start.y === target.y) {
    return [];
  }

  const startKey = positionKey(start.x, start.y);
  const targetKey = positionKey(target.x, target.y);
  const queue = [{ x: start.x, y: start.y }];
  const visited = new Set([startKey]);
  const parent = new Map();
  const directions = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: 1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 1 },
    { dx: -1, dy: -1 }
  ];

  let found = false;
  while (queue.length > 0) {
    const current = queue.shift();
    for (const direction of directions) {
      const nextX = current.x + direction.dx;
      const nextY = current.y + direction.dy;
      if (!isWithinGrid(nextX, nextY, grid)) {
        continue;
      }
      if (isBlocked(nextX, nextY)) {
        continue;
      }
      const nextKey = positionKey(nextX, nextY);
      if (visited.has(nextKey)) {
        continue;
      }
      visited.add(nextKey);
      parent.set(nextKey, positionKey(current.x, current.y));
      if (nextKey === targetKey) {
        found = true;
        queue.length = 0;
        break;
      }
      queue.push({ x: nextX, y: nextY });
    }
  }

  if (!found) {
    return null;
  }

  const reversed = [];
  let cursor = targetKey;
  while (cursor && cursor !== startKey) {
    const [xRaw, yRaw] = cursor.split(",");
    reversed.push({ x: Number(xRaw), y: Number(yRaw) });
    cursor = parent.get(cursor);
  }

  reversed.reverse();
  return reversed;
}

function createRoomState(config, roomId, depth) {
  const template = config.roomTemplates?.[roomId] || {
    id: roomId,
    name: roomId,
    floorItems: [],
    gatherNodes: [],
    mobs: [],
    chests: []
  };
  const doorTemplate = config.doorGraph?.[roomId] || {};
  const grid = getGridConfig(config);
  const usedTiles = new Set();

  const claimTile = (requested, fallback) => {
    const preferred = normalizePoint(requested, grid, fallback);
    const free = findNearestFreePoint(preferred, usedTiles, grid);
    usedTiles.add(positionKey(free.x, free.y));
    return free;
  };

  const spawnTile = claimTile(template.spawn, DEFAULT_TILE_LAYOUT.spawn);

  const lockStep = Math.max(1, Math.floor(toNumber(config.depthScaling?.lockTierEveryDescend, 1)));
  const requiredKeys = 1 + Math.floor(Math.max(0, depth - 1) / lockStep);

  const doors = {};
  DOOR_DIRECTIONS.forEach((direction) => {
    const templateDoor = doorTemplate[direction] || {};
    const lockTag = typeof templateDoor.lockTag === "string" ? templateDoor.lockTag : null;
    const blocked = Boolean(templateDoor.blocked);
    const unlocked = !blocked && !lockTag;
    const doorTile = claimTile(
      templateDoor.position,
      DEFAULT_TILE_LAYOUT.doors[direction] || DEFAULT_TILE_LAYOUT.spawn
    );
    doors[direction] = {
      direction,
      x: doorTile.x,
      y: doorTile.y,
      targetRoomId: typeof templateDoor.target === "string" ? templateDoor.target : null,
      lockTag,
      blocked,
      unlocked,
      requiredKeys: lockTag ? requiredKeys : 0
    };
  });

  const floorItems = (template.floorItems || []).map((itemSpec, index) => {
    const itemId = typeof itemSpec === "string" ? itemSpec : itemSpec?.itemId;
    const itemDef = getItemDef(config, itemId);
    const tile = claimTile(itemSpec?.position, DEFAULT_TILE_LAYOUT.floorItems[index % DEFAULT_TILE_LAYOUT.floorItems.length]);
    return {
      entityId: `${roomId}:item:${index}`,
      itemId,
      name: itemDef?.name || itemId,
      pickedUp: false,
      x: tile.x,
      y: tile.y
    };
  }).filter((item) => item.itemId);

  const gatherNodes = (template.gatherNodes || []).map((nodeSpec, index) => {
    const nodeType = typeof nodeSpec === "string" ? nodeSpec : nodeSpec?.nodeType;
    const nodeDef = config.gatherNodes?.[nodeType] || {};
    const baseCharges = Math.max(1, Math.floor(toNumber(nodeDef.baseCharges, 3)));
    const depthBonus = Math.max(0, Math.floor((depth - 1) / 2));
    const tile = claimTile(nodeSpec?.position, DEFAULT_TILE_LAYOUT.gatherNodes[index % DEFAULT_TILE_LAYOUT.gatherNodes.length]);
    return {
      nodeId: `${roomId}:node:${nodeType}:${index}`,
      nodeType,
      name: nodeDef.name || nodeType,
      requiredTool: nodeDef.requiredTool || null,
      yieldItemId: nodeDef.yieldItemId || null,
      yieldCount: Math.max(1, Math.floor(toNumber(nodeDef.yieldCount, 1))),
      remainingCharges: baseCharges + depthBonus,
      x: tile.x,
      y: tile.y
    };
  }).filter((node) => node.nodeType);

  const mobScale = 1 + Math.max(0, depth - 1) * Math.max(0, toNumber(config.depthScaling?.mobPowerPerDescend, 0.1));
  const mobs = (template.mobs || []).map((mobSpec, index) => {
    const mobType = typeof mobSpec === "string" ? mobSpec : mobSpec?.mobType;
    const mobDef = config.mobDefs?.[mobType] || {};
    const tile = claimTile(mobSpec?.position, DEFAULT_TILE_LAYOUT.mobs[index % DEFAULT_TILE_LAYOUT.mobs.length]);
    return {
      mobId: `${roomId}:mob:${mobType}:${index}`,
      mobType,
      name: mobDef.name || mobType,
      alive: true,
      requiredPower: Math.max(1, Math.ceil(toNumber(mobDef.basePower, 1) * mobScale)),
      failPenalty: mobDef.failPenalty && typeof mobDef.failPenalty === "object"
        ? {
          matter: Math.max(0, Math.floor(toNumber(mobDef.failPenalty.matter, 0))),
          fire: Math.max(0, Math.floor(toNumber(mobDef.failPenalty.fire, 0)))
        }
        : { matter: 0, fire: 0 },
      drops: Array.isArray(mobDef.drops)
        ? mobDef.drops.map((drop) => ({
          itemId: drop.itemId,
          count: Math.max(1, Math.floor(toNumber(drop.count, 1)))
        }))
        : [],
      x: tile.x,
      y: tile.y
    };
  }).filter((mob) => mob.mobType);

  const chests = (template.chests || []).map((chestSpec, index) => {
    const chestType = typeof chestSpec === "string" ? chestSpec : chestSpec?.chestType;
    const chestDef = config.chestDefs?.[chestType] || {};
    const tile = claimTile(chestSpec?.position, DEFAULT_TILE_LAYOUT.chests[index % DEFAULT_TILE_LAYOUT.chests.length]);
    return {
      chestId: `${roomId}:chest:${chestType}:${index}`,
      chestType,
      name: chestDef.name || chestType,
      opened: false,
      loot: Array.isArray(chestDef.loot)
        ? chestDef.loot.map((drop) => ({
          itemId: drop.itemId,
          count: Math.max(1, Math.floor(toNumber(drop.count, 1)))
        }))
        : [],
      x: tile.x,
      y: tile.y
    };
  }).filter((chest) => chest.chestType);

  const templateSpecial = template.special && typeof template.special === "object" ? template.special : null;
  let specialType = typeof templateSpecial?.type === "string" ? templateSpecial.type.trim().toLowerCase() : "";
  if (!specialType && roomId === "descend-room") {
    specialType = "descend";
  }

  const special = specialType
    ? (() => {
      const tile = claimTile(templateSpecial?.position, DEFAULT_TILE_LAYOUT.special);
      const defaultName = specialType === "descend"
        ? "Black Hole"
        : (specialType === "crafting" ? "Workbench" : "Special Focus");
      const configuredName = typeof templateSpecial?.name === "string" ? templateSpecial.name.trim() : "";
      return {
        type: specialType,
        entityId: `${roomId}:special:${specialType}`,
        name: configuredName || defaultName,
        x: tile.x,
        y: tile.y
      };
    })()
    : null;

  return {
    roomId,
    grid,
    spawn: { x: spawnTile.x, y: spawnTile.y },
    name: template.name || roomId,
    description: template.description || "",
    visited: false,
    floorItems,
    gatherNodes,
    mobs,
    chests,
    special,
    doors
  };
}

function createRunState(state, config) {
  const depth = Math.max(1, Math.floor(toNumber(state.riftDelve.meta.depth, 1)));
  const roomOrder = Array.isArray(config.roomOrder) && config.roomOrder.length > 0
    ? config.roomOrder
    : ["start-room"];

  const rooms = {};
  roomOrder.forEach((roomId) => {
    rooms[roomId] = createRoomState(config, roomId, depth);
  });

  const startRoomId = roomOrder[0];
  const startRoom = rooms[startRoomId];
  if (startRoom) {
    startRoom.visited = true;
  }

  const seedCounter = Math.max(1, Math.floor(toNumber(state.riftDelve.meta.seededRunCounter, 1)));
  return {
    runId: `rift-run-${seedCounter}`,
    depth,
    seed: depth * 100_000 + seedCounter,
    droppedItemCounter: 0,
    startedAt: Date.now(),
    currentRoomId: startRoomId,
    player: {
      x: startRoom?.spawn?.x ?? 0,
      y: startRoom?.spawn?.y ?? 0
    },
    movement: null,
    rooms
  };
}

function getCurrentRoom(state) {
  const run = state.riftDelve.activeRun;
  if (!run || !run.rooms) {
    return null;
  }
  return run.rooms[run.currentRoomId] || null;
}

function getDoorByPosition(room, x, y) {
  const doors = room?.doors || {};
  for (const direction of Object.keys(doors)) {
    const door = doors[direction];
    if (door && door.x === x && door.y === y) {
      return door;
    }
  }
  return null;
}

function transitionToRoom({ state, eventBus, run, targetRoomId }) {
  const targetRoom = run.rooms[targetRoomId];
  if (!targetRoom) {
    return false;
  }

  run.currentRoomId = targetRoomId;
  run.player = {
    x: targetRoom.spawn.x,
    y: targetRoom.spawn.y
  };
  run.movement = null;
  setCraftingStationState(state, false);

  if (!targetRoom.visited) {
    targetRoom.visited = true;
    state.riftDelve.meta.totalRoomsCleared += 1;
  }

  eventBus.emit("dungeon:roomEntered", { roomId: targetRoomId, depth: run.depth });
  return true;
}

export function createDungeonSystem({ state, resourceManager, eventBus, balance }) {
  const config = balance?.riftDelve || {};

  function getUnlockNodeId() {
    return typeof config.unlockNodeId === "string" && config.unlockNodeId
      ? config.unlockNodeId
      : "riftDelveKeystone";
  }

  function isUnlocked() {
    return isUnlockMet(state, { type: "ascensionNode", value: getUnlockNodeId() });
  }

  function getRecipeStatus() {
    const recipes = Array.isArray(config.craftingRecipes) ? config.craftingRecipes : [];
    return recipes.map((recipe) => ({
      ...recipe,
      canCraft: canCraftRecipe(state, recipe)
    }));
  }

  function getStatus() {
    const run = state.riftDelve.activeRun;
    const currentRoom = getCurrentRoom(state);
    const playerPower = getPlayerCombatPower(state, config);
    return {
      unlocked: isUnlocked(),
      unlockNodeId: getUnlockNodeId(),
      meta: state.riftDelve.meta,
      rewards: state.riftDelve.rewards,
      crafting: state.riftDelve.crafting,
      activeRun: run,
      currentRoom,
      inventory: state.riftDelve.inventory,
      recipes: getRecipeStatus(),
      movement: run?.movement || null,
      player: run?.player || null,
      playerPower
    };
  }

  function getKnownKeyUnlockTags() {
    const tags = new Set();
    const itemDefs = config.itemDefs && typeof config.itemDefs === "object" ? config.itemDefs : {};
    Object.values(itemDefs).forEach((def) => {
      if (!def || def.type !== "key") {
        return;
      }
      cloneUnlockTags(def.unlockTags).forEach((tag) => tags.add(tag));
    });
    return tags;
  }

  function validateRunCandidate(run, keyUnlockTags) {
    if (!run || typeof run !== "object") {
      return "Run generation returned invalid state.";
    }
    if (!run.rooms || typeof run.rooms !== "object") {
      return "Run generation returned no rooms.";
    }
    if (!run.currentRoomId || !run.rooms[run.currentRoomId]) {
      return "Start room is missing from generated run.";
    }

    const roomEntries = Object.entries(run.rooms);
    if (roomEntries.length <= 0) {
      return "Run generation returned zero rooms.";
    }

    for (const [roomId, room] of roomEntries) {
      if (!room || typeof room !== "object") {
        return `Room ${roomId} has invalid state.`;
      }
      Object.values(room.doors || {}).forEach((door) => {
        if (!door) {
          return;
        }
        if (door.targetRoomId && !run.rooms[door.targetRoomId]) {
          throw new Error(`Door from ${roomId} points to missing room ${door.targetRoomId}.`);
        }
        if (!door.blocked && door.lockTag && !keyUnlockTags.has(door.lockTag)) {
          throw new Error(`No key unlock tag configured for lock tag ${door.lockTag}.`);
        }
      });
    }

    const descendRoomId = run.rooms["descend-room"]
      ? "descend-room"
      : Object.keys(run.rooms).find((roomId) => run.rooms[roomId]?.special?.type === "descend");
    if (!descendRoomId) {
      return "No descend room is configured in generated run.";
    }

    const visited = new Set([run.currentRoomId]);
    const queue = [run.currentRoomId];

    while (queue.length > 0) {
      const roomId = queue.shift();
      const room = run.rooms[roomId];
      Object.values(room?.doors || {}).forEach((door) => {
        if (!door || door.blocked || !door.targetRoomId) {
          return;
        }
        if (door.lockTag && !keyUnlockTags.has(door.lockTag)) {
          return;
        }
        if (!visited.has(door.targetRoomId)) {
          visited.add(door.targetRoomId);
          queue.push(door.targetRoomId);
        }
      });
    }

    if (!visited.has(descendRoomId)) {
      return `Descend room ${descendRoomId} is unreachable from ${run.currentRoomId}.`;
    }

    return null;
  }

  function runSafetyValidation(options = {}) {
    const sampleCount = clampInt(options.sampleCount, 1, 200);
    const startDepth = clampInt(options.startDepth ?? state.riftDelve.meta.depth, 1, 999);
    const keyUnlockTags = getKnownKeyUnlockTags();
    const failures = [];

    for (let index = 0; index < sampleCount; index += 1) {
      const depth = clampInt(startDepth + index, 1, 999);
      const validationState = {
        riftDelve: {
          meta: {
            depth,
            seededRunCounter: index + 1
          }
        }
      };

      try {
        const run = createRunState(validationState, config);
        const issue = validateRunCandidate(run, keyUnlockTags);
        if (issue) {
          failures.push({
            index,
            depth,
            seed: run?.seed || 0,
            reason: issue
          });
        }
      } catch (error) {
        failures.push({
          index,
          depth,
          seed: 0,
          reason: error instanceof Error ? error.message : "Unexpected validation error."
        });
      }
    }

    return {
      ok: failures.length === 0,
      sampleCount,
      startDepth,
      failures
    };
  }

  function getInteractionAt(room, x, y) {
    if (room.special?.type === "descend" && room.special.x === x && room.special.y === y) {
      return { type: "descend" };
    }

    if (room.special?.type === "crafting" && room.special.x === x && room.special.y === y) {
      return { type: "craftingStation" };
    }

    const chest = room.chests.find((entry) => !entry.opened && entry.x === x && entry.y === y);
    if (chest) {
      return { type: "chest", chestId: chest.chestId };
    }

    const mob = room.mobs.find((entry) => entry.alive && entry.x === x && entry.y === y);
    if (mob) {
      return { type: "mob", mobId: mob.mobId };
    }

    const item = room.floorItems.find((entry) => !entry.pickedUp && entry.x === x && entry.y === y);
    if (item) {
      return { type: "item", entityId: item.entityId };
    }

    const node = room.gatherNodes.find((entry) => entry.remainingCharges > 0 && entry.x === x && entry.y === y);
    if (node) {
      return { type: "gather", nodeId: node.nodeId };
    }

    const door = getDoorByPosition(room, x, y);
    if (door) {
      return { type: "door", direction: door.direction };
    }

    return null;
  }

  function getBlockedTiles(room) {
    const blocked = new Set();

    Object.values(room.doors || {}).forEach((door) => {
      if (!door) {
        return;
      }
      blocked.add(positionKey(door.x, door.y));
    });

    room.floorItems.forEach((item) => {
      if (!item.pickedUp) {
        blocked.add(positionKey(item.x, item.y));
      }
    });

    room.gatherNodes.forEach((node) => {
      if (node.remainingCharges > 0) {
        blocked.add(positionKey(node.x, node.y));
      }
    });

    room.mobs.forEach((mob) => {
      if (mob.alive) {
        blocked.add(positionKey(mob.x, mob.y));
      }
    });

    room.chests.forEach((chest) => {
      if (!chest.opened) {
        blocked.add(positionKey(chest.x, chest.y));
      }
    });

    if (room.special) {
      blocked.add(positionKey(room.special.x, room.special.y));
    }

    return blocked;
  }

  function isAdjacentOrSame(run, x, y) {
    return manhattanDistance(run.player, { x, y }) <= 1;
  }

  function startRun() {
    if (!isUnlocked()) {
      return { ok: false, reason: "Unlock Rift Delve Keystone in Ascend." };
    }
    if (state.riftDelve.activeRun) {
      return { ok: false, reason: "A Rift Delve run is already active." };
    }

    const validation = runSafetyValidation({
      sampleCount: 1,
      startDepth: state.riftDelve.meta.depth
    });
    if (!validation.ok) {
      const firstFailure = validation.failures[0];
      return {
        ok: false,
        reason: `Rift Delve config invalid: ${firstFailure?.reason || "safety validation failed."}`
      };
    }

    state.riftDelve.meta.seededRunCounter += 1;
    resetInventoryState(state, config);
    setCraftingStationState(state, false);
    state.riftDelve.activeRun = createRunState(state, config);
    eventBus.emit("dungeon:start", {
      depth: state.riftDelve.activeRun.depth,
      runId: state.riftDelve.activeRun.runId
    });
    return { ok: true };
  }

  function pickupItem(entityId) {
    const run = state.riftDelve.activeRun;
    const room = getCurrentRoom(state);
    if (!room || !run) {
      return { ok: false, reason: "No active room." };
    }

    const item = room.floorItems.find((entry) => entry.entityId === entityId);
    if (!item) {
      return { ok: false, reason: "Item not found." };
    }
    if (item.pickedUp) {
      return { ok: false, reason: "That item has already been picked up." };
    }
    if (!isAdjacentOrSame(run, item.x, item.y)) {
      return { ok: false, reason: "Move next to the item to pick it up." };
    }

    const added = addInventoryItem(state, config, item.itemId, 1);
    if (!added.ok) {
      return added;
    }

    item.pickedUp = true;
    eventBus.emit("dungeon:pickup", {
      roomId: room.roomId,
      x: item.x,
      y: item.y,
      itemId: item.itemId,
      itemName: item.name,
      count: 1
    });
    return { ok: true };
  }

  function findNearbyDropTile(run, room) {
    const candidates = [
      { x: run.player.x, y: run.player.y },
      { x: run.player.x + 1, y: run.player.y },
      { x: run.player.x - 1, y: run.player.y },
      { x: run.player.x, y: run.player.y + 1 },
      { x: run.player.x, y: run.player.y - 1 },
      { x: run.player.x + 1, y: run.player.y + 1 },
      { x: run.player.x + 1, y: run.player.y - 1 },
      { x: run.player.x - 1, y: run.player.y + 1 },
      { x: run.player.x - 1, y: run.player.y - 1 }
    ];

    for (const candidate of candidates) {
      if (!isWithinGrid(candidate.x, candidate.y, room.grid)) {
        continue;
      }
      if (getInteractionAt(room, candidate.x, candidate.y)) {
        continue;
      }
      return candidate;
    }

    return null;
  }

  function dropInventorySlot(rawSlotIndex) {
    const run = state.riftDelve.activeRun;
    const room = getCurrentRoom(state);
    if (!run || !room) {
      return { ok: false, reason: "No active room." };
    }
    if (run.movement) {
      return { ok: false, reason: "Cannot drop items while moving." };
    }

    const slotIndex = Math.floor(toNumber(rawSlotIndex, -1));
    const slots = state.riftDelve.inventory?.slots;
    if (!Array.isArray(slots) || slotIndex < 0 || slotIndex >= slots.length) {
      return { ok: false, reason: "Invalid inventory slot." };
    }

    const slot = slots[slotIndex];
    if (!slot) {
      return { ok: false, reason: "That slot is empty." };
    }

    const dropTile = findNearbyDropTile(run, room);
    if (!dropTile) {
      return { ok: false, reason: "No free tile nearby to drop this item." };
    }

    run.droppedItemCounter = Math.max(0, Math.floor(toNumber(run.droppedItemCounter, 0))) + 1;
    const dropCount = 1;
    const droppedItem = {
      entityId: `${room.roomId}:drop:${run.droppedItemCounter}`,
      itemId: slot.itemId,
      name: slot.name || getItemDef(config, slot.itemId)?.name || slot.itemId,
      pickedUp: false,
      x: dropTile.x,
      y: dropTile.y
    };
    room.floorItems.push(droppedItem);

    slot.count -= dropCount;
    if (slot.count <= 0) {
      slots[slotIndex] = null;
    }
    syncEquippedTools(state);

    eventBus.emit("dungeon:drop", {
      roomId: room.roomId,
      x: dropTile.x,
      y: dropTile.y,
      itemId: droppedItem.itemId,
      itemName: droppedItem.name,
      count: dropCount
    });

    return {
      ok: true,
      slotIndex,
      dropped: {
        itemId: droppedItem.itemId,
        itemName: droppedItem.name,
        count: dropCount,
        x: dropTile.x,
        y: dropTile.y
      }
    };
  }

  function gatherNode(nodeId) {
    const run = state.riftDelve.activeRun;
    const room = getCurrentRoom(state);
    if (!room || !run) {
      return { ok: false, reason: "No active room." };
    }

    const node = room.gatherNodes.find((entry) => entry.nodeId === nodeId);
    if (!node) {
      return { ok: false, reason: "Gather node not found." };
    }
    if (node.remainingCharges <= 0) {
      return { ok: false, reason: `${node.name} is depleted.` };
    }
    if (!isAdjacentOrSame(run, node.x, node.y)) {
      return { ok: false, reason: "Move next to this resource first." };
    }
    if (node.requiredTool && !hasToolEquipped(state, node.requiredTool)) {
      eventBus.emit("dungeon:requirementFailed", {
        roomId: room.roomId,
        x: node.x,
        y: node.y,
        requirementType: "tool",
        requiredItemId: node.requiredTool,
        message: `Need ${node.requiredTool} to gather here.`
      });
      return { ok: false, reason: `Need ${node.requiredTool} to gather here.` };
    }

    const added = addInventoryItem(state, config, node.yieldItemId, node.yieldCount);
    if (!added.ok) {
      return added;
    }

    node.remainingCharges -= 1;
    eventBus.emit("dungeon:gather", {
      roomId: room.roomId,
      x: node.x,
      y: node.y,
      nodeType: node.nodeType,
      nodeName: node.name,
      itemId: node.yieldItemId,
      itemName: getItemDef(config, node.yieldItemId)?.name || node.yieldItemId,
      amount: node.yieldCount
    });
    return { ok: true };
  }

  function fightMob(mobId) {
    const run = state.riftDelve.activeRun;
    const room = getCurrentRoom(state);
    if (!room || !run) {
      return { ok: false, reason: "No active room." };
    }

    const mob = (Array.isArray(room.mobs) ? room.mobs : []).find((entry) => entry.mobId === mobId);
    if (!mob) {
      return { ok: false, reason: "Mob not found." };
    }
    if (!mob.alive) {
      return { ok: false, reason: "That mob is already defeated." };
    }
    if (!isAdjacentOrSame(run, mob.x, mob.y)) {
      return { ok: false, reason: "Move next to the mob to attack." };
    }

    const playerPower = getPlayerCombatPower(state, config);
    if (playerPower < mob.requiredPower) {
      const penaltyPaid = applyResourcePenalty(state, mob.failPenalty);
      eventBus.emit("dungeon:mobFailed", {
        roomId: room.roomId,
        x: mob.x,
        y: mob.y,
        mobName: mob.name,
        mobType: mob.mobType,
        playerPower,
        requiredPower: mob.requiredPower,
        penalty: penaltyPaid
      });
      return {
        ok: false,
        reason: `Need power ${mob.requiredPower}. Current power ${playerPower}.`
      };
    }

    mob.alive = false;
    const lootResults = [];
    mob.drops.forEach((drop) => {
      const added = addInventoryItem(state, config, drop.itemId, drop.count);
      lootResults.push({ ...drop, collected: added.ok });
    });
    eventBus.emit("dungeon:mobDefeated", {
      roomId: room.roomId,
      x: mob.x,
      y: mob.y,
      mobName: mob.name,
      mobType: mob.mobType,
      playerPower,
      requiredPower: mob.requiredPower,
      loot: lootResults
    });
    return {
      ok: true,
      playerPower,
      requiredPower: mob.requiredPower,
      loot: lootResults
    };
  }

  function openChest(chestId) {
    const run = state.riftDelve.activeRun;
    const room = getCurrentRoom(state);
    if (!room || !run) {
      return { ok: false, reason: "No active room." };
    }

    const chest = (Array.isArray(room.chests) ? room.chests : []).find((entry) => entry.chestId === chestId);
    if (!chest) {
      return { ok: false, reason: "Chest not found." };
    }
    if (chest.opened) {
      return { ok: false, reason: "Chest already opened." };
    }
    if (!isAdjacentOrSame(run, chest.x, chest.y)) {
      return { ok: false, reason: "Move next to the chest to open it." };
    }

    chest.opened = true;
    const lootResults = [];
    chest.loot.forEach((drop) => {
      const added = addInventoryItem(state, config, drop.itemId, drop.count);
      lootResults.push({ ...drop, collected: added.ok });
    });
    eventBus.emit("dungeon:chestOpened", {
      roomId: room.roomId,
      x: chest.x,
      y: chest.y,
      chestType: chest.chestType,
      chestName: chest.name,
      loot: lootResults
    });
    return {
      ok: true,
      loot: lootResults
    };
  }

  function craft(recipeId) {
    const run = state.riftDelve.activeRun;
    const room = getCurrentRoom(state);
    if (!run || !room) {
      return { ok: false, reason: "No active run." };
    }
    if (!state.riftDelve.crafting?.stationOpen || state.riftDelve.crafting?.stationRoomId !== room.roomId) {
      return { ok: false, reason: "Use the workbench tile to craft." };
    }

    const recipes = Array.isArray(config.craftingRecipes) ? config.craftingRecipes : [];
    const recipe = recipes.find((entry) => entry.id === recipeId);
    if (!recipe) {
      return { ok: false, reason: "Unknown recipe." };
    }
    if (!canCraftRecipe(state, recipe)) {
      return { ok: false, reason: "Missing materials for this recipe." };
    }

    const outputItemId = recipe.output?.itemId;
    const outputCount = Math.max(1, Math.floor(toNumber(recipe.output?.count, 1)));
    const outputDef = getItemDef(config, outputItemId);
    if (!outputDef) {
      return { ok: false, reason: "Recipe output is not configured." };
    }

    recipe.costs.forEach((cost) => {
      removeInventoryItem(state, cost.itemId, cost.count);
    });

    const addProbe = addInventoryItem(state, config, outputItemId, outputCount);
    if (!addProbe.ok) {
      recipe.costs.forEach((cost) => {
        addInventoryItem(state, config, cost.itemId, cost.count);
      });
      return addProbe;
    }

    eventBus.emit("dungeon:craft", {
      roomId: room.roomId,
      x: room.special?.type === "crafting" ? room.special.x : run.player.x,
      y: room.special?.type === "crafting" ? room.special.y : run.player.y,
      recipeId,
      outputItemId,
      outputName: outputDef.name || outputItemId,
      outputCount
    });
    return { ok: true };
  }

  function interactCraftingStation() {
    const run = state.riftDelve.activeRun;
    const room = getCurrentRoom(state);
    if (!run || !room || room.special?.type !== "crafting") {
      return { ok: false, reason: "No workbench focus in this room." };
    }
    if (!isAdjacentOrSame(run, room.special.x, room.special.y)) {
      return { ok: false, reason: "Move next to the workbench to craft." };
    }

    setCraftingStationState(state, true, room.roomId);
    eventBus.emit("dungeon:craftStationOpened", {
      roomId: room.roomId,
      x: room.special.x,
      y: room.special.y
    });
    return { ok: true, message: "Workbench ready.", openCrafting: true };
  }

  function closeCraftingStation() {
    if (!state.riftDelve.crafting?.stationOpen) {
      return { ok: true };
    }
    setCraftingStationState(state, false);
    return { ok: true };
  }

  function unlockDoor(direction) {
    const run = state.riftDelve.activeRun;
    const room = getCurrentRoom(state);
    if (!room || !run) {
      return { ok: false, reason: "No active room." };
    }
    const door = room.doors?.[direction];
    if (!door) {
      return { ok: false, reason: "Unknown door." };
    }
    if (door.blocked) {
      return { ok: false, reason: "That doorway is collapsed." };
    }
    if (!isAdjacentOrSame(run, door.x, door.y)) {
      return { ok: false, reason: "Move next to the door to unlock it." };
    }
    if (door.unlocked) {
      return { ok: true };
    }
    if (!door.lockTag) {
      door.unlocked = true;
      return { ok: true };
    }

    const required = Math.max(1, Math.floor(toNumber(door.requiredKeys, 1)));
    const canConsume = consumeMatchingKeys(state, door.lockTag, required);
    if (!canConsume) {
      eventBus.emit("dungeon:requirementFailed", {
        roomId: room.roomId,
        x: door.x,
        y: door.y,
        requirementType: "key",
        lockTag: door.lockTag,
        requiredCount: required,
        message: `Need ${required} matching key(s) for ${door.lockTag} lock.`
      });
      return { ok: false, reason: `Need ${required} matching key(s) for ${door.lockTag} lock.` };
    }

    door.unlocked = true;
    eventBus.emit("dungeon:unlock", {
      roomId: room.roomId,
      x: door.x,
      y: door.y,
      direction,
      lockTag: door.lockTag,
      required
    });
    return { ok: true };
  }

  function executeInteraction(interaction) {
    if (!interaction) {
      return { ok: false, reason: "Nothing to interact with." };
    }
    if (interaction.type === "descend") {
      return interactDescend();
    }
    if (interaction.type === "craftingStation") {
      return interactCraftingStation();
    }
    if (interaction.type === "chest") {
      return openChest(interaction.chestId);
    }
    if (interaction.type === "mob") {
      return fightMob(interaction.mobId);
    }
    if (interaction.type === "item") {
      return pickupItem(interaction.entityId);
    }
    if (interaction.type === "gather") {
      return gatherNode(interaction.nodeId);
    }
    if (interaction.type === "door") {
      const run = state.riftDelve.activeRun;
      const room = getCurrentRoom(state);
      if (!run || !room) {
        return { ok: false, reason: "No active room." };
      }
      const door = room.doors?.[interaction.direction];
      if (!door) {
        return { ok: false, reason: "Unknown door." };
      }
      if (door.blocked) {
        return { ok: false, reason: "That doorway is collapsed." };
      }
      if (!door.unlocked) {
        return unlockDoor(door.direction);
      }
      if (!door.targetRoomId) {
        return { ok: false, reason: "That door leads nowhere." };
      }
      const transitioned = transitionToRoom({
        state,
        eventBus,
        run,
        targetRoomId: door.targetRoomId
      });
      if (!transitioned) {
        return { ok: false, reason: "Door destination is invalid." };
      }
      return { ok: true, message: "Entered next room." };
    }
    return { ok: false, reason: "Unknown interaction." };
  }

  function interactAtTile(x, y) {
    const run = state.riftDelve.activeRun;
    const room = getCurrentRoom(state);
    if (!run || !room) {
      return { ok: false, reason: "No active run." };
    }

    if (!isAdjacentOrSame(run, x, y)) {
      return { ok: false, reason: "Move next to that tile before interacting." };
    }

    const interaction = getInteractionAt(room, x, y);
    if (!interaction) {
      return { ok: false, reason: "Nothing to interact with on this tile." };
    }

    return executeInteraction(interaction);
  }

  function moveToTile(rawX, rawY) {
    const run = state.riftDelve.activeRun;
    const room = getCurrentRoom(state);
    if (!run || !room) {
      return { ok: false, reason: "No active run." };
    }

    const x = Math.floor(toNumber(rawX, -1));
    const y = Math.floor(toNumber(rawY, -1));
    if (!isWithinGrid(x, y, room.grid)) {
      return { ok: false, reason: "Tile is outside room bounds." };
    }

    const interaction = getInteractionAt(room, x, y);
    if (interaction && isAdjacentOrSame(run, x, y)) {
      return executeInteraction(interaction);
    }

    const blocked = getBlockedTiles(room);
    blocked.delete(positionKey(run.player.x, run.player.y));

    let destination = { x, y };
    let onArrive = null;

    if (interaction) {
      const candidates = [
        { x: x + 1, y },
        { x: x - 1, y },
        { x, y: y + 1 },
        { x, y: y - 1 }
      ].filter((candidate) => isWithinGrid(candidate.x, candidate.y, room.grid));

      let bestPath = null;
      let bestTarget = null;
      for (const candidate of candidates) {
        const candidateKey = positionKey(candidate.x, candidate.y);
        if (blocked.has(candidateKey) && !(candidate.x === run.player.x && candidate.y === run.player.y)) {
          continue;
        }

        const path = buildPathBfs(
          run.player,
          candidate,
          room.grid,
          (tileX, tileY) => {
            const key = positionKey(tileX, tileY);
            if (tileX === run.player.x && tileY === run.player.y) {
              return false;
            }
            return blocked.has(key) && !(tileX === candidate.x && tileY === candidate.y);
          }
        );
        if (!path) {
          continue;
        }
        if (!bestPath || path.length < bestPath.length) {
          bestPath = path;
          bestTarget = candidate;
        }
      }

      if (!bestPath || !bestTarget) {
        return { ok: false, reason: "No path to stand next to that object." };
      }

      destination = { x: bestTarget.x, y: bestTarget.y };
      onArrive = {
        type: "interact",
        x,
        y
      };

      if (!bestPath.length) {
        return executeInteraction(interaction);
      }

      const stepMs = room.grid.stepMs;
      run.movement = {
        type: "grid",
        steps: bestPath,
        stepMs,
        remainingMs: stepMs,
        totalMs: bestPath.length * stepMs,
        target: destination,
        onArrive
      };

      eventBus.emit("dungeon:move", {
        roomId: room.roomId,
        from: { x: run.player.x, y: run.player.y },
        to: { x: destination.x, y: destination.y },
        steps: bestPath.length,
        viaDoor: interaction.type === "door"
      });

      return { ok: true, message: `Moving next to target at (${x}, ${y}).` };
    }

    if (blocked.has(positionKey(x, y))) {
      return { ok: false, reason: "Cannot stand on that tile." };
    }

    if (run.player.x === x && run.player.y === y) {
      return { ok: false, reason: "Already on that tile." };
    }

    const path = buildPathBfs(
      run.player,
      { x, y },
      room.grid,
      (tileX, tileY) => {
        if (tileX === run.player.x && tileY === run.player.y) {
          return false;
        }
        return blocked.has(positionKey(tileX, tileY));
      }
    );
    if (!path || !path.length) {
      return { ok: false, reason: "No path to that tile." };
    }

    const stepMs = room.grid.stepMs;
    run.movement = {
      type: "grid",
      steps: path,
      stepMs,
      remainingMs: stepMs,
      totalMs: path.length * stepMs,
      target: { x, y },
      onArrive: null
    };

    eventBus.emit("dungeon:move", {
      roomId: room.roomId,
      from: { x: run.player.x, y: run.player.y },
      to: { x, y },
      steps: path.length,
      viaDoor: false
    });

    return { ok: true, message: `Moving to (${x}, ${y}).` };
  }

  function moveToDoor(direction) {
    const room = getCurrentRoom(state);
    if (!room) {
      return { ok: false, reason: "No active room." };
    }
    const door = room.doors?.[direction];
    if (!door) {
      return { ok: false, reason: "Unknown door." };
    }
    if (door.blocked) {
      return { ok: false, reason: "That doorway is collapsed." };
    }

    return moveToTile(door.x, door.y);
  }

  function interactDescend() {
    const room = getCurrentRoom(state);
    const run = state.riftDelve.activeRun;
    if (!room || !run || room.special?.type !== "descend") {
      return { ok: false, reason: "No descend focus in this room." };
    }

    if (!isAdjacentOrSame(run, room.special.x, room.special.y)) {
      return { ok: false, reason: "Move next to the black hole to descend." };
    }

    const depth = Math.max(1, Math.floor(toNumber(state.riftDelve.meta.depth, 1)));
    const rewardMultiplier = 1 + (Math.max(0, depth - 1) * toNumber(config.depthScaling?.rewardPerDescend, 0.1));
    const baseReward = config.rewards?.descendBase || { matter: 0, fire: 0, shards: 0, relics: 0 };
    const reward = {
      matter: Math.max(0, Math.floor(toNumber(baseReward.matter, 0) * rewardMultiplier)),
      fire: Math.max(0, Math.floor(toNumber(baseReward.fire, 0) * rewardMultiplier)),
      shards: Math.max(0, Math.floor(toNumber(baseReward.shards, 0) * rewardMultiplier)),
      relics: Math.max(0, Math.floor(toNumber(baseReward.relics, 0) * rewardMultiplier))
    };

    resourceManager.add("matter", reward.matter);
    resourceManager.add("fire", reward.fire);
    resourceManager.add("shards", reward.shards);
    state.riftDelve.rewards.lifetime.relicsEarned += reward.relics;

    state.riftDelve.meta.totalDescends += 1;
    state.riftDelve.meta.bestDepth = Math.max(state.riftDelve.meta.bestDepth, depth);
    state.riftDelve.meta.depth = depth + 1;
    state.riftDelve.activeRun = null;
    resetInventoryState(state, config);
    setCraftingStationState(state, false);

    eventBus.emit("dungeon:descend", {
      roomId: room.roomId,
      x: room.special.x,
      y: room.special.y,
      depth,
      reward,
      nextDepth: state.riftDelve.meta.depth
    });
    return { ok: true, reward, nextDepth: state.riftDelve.meta.depth };
  }

  function abandonRun() {
    if (!state.riftDelve.activeRun) {
      return { ok: false, reason: "No active run to abandon." };
    }
    state.riftDelve.activeRun = null;
    resetInventoryState(state, config);
    setCraftingStationState(state, false);
    eventBus.emit("dungeon:abandon", {});
    return { ok: true };
  }

  function advance(dtSeconds, offlineMultiplier = 1) {
    const run = state.riftDelve.activeRun;
    if (!run || !run.movement) {
      return;
    }

    const multiplier = Math.max(0, toNumber(offlineMultiplier, 1));
    let elapsedMs = Math.max(0, toNumber(dtSeconds, 0) * 1000 * multiplier);
    if (elapsedMs <= 0) {
      return;
    }

    let safety = 0;
    while (elapsedMs > 0 && run.movement && safety < 2000) {
      safety += 1;
      const movement = run.movement;
      const consume = Math.min(elapsedMs, movement.remainingMs);
      movement.remainingMs -= consume;
      elapsedMs -= consume;

      if (movement.remainingMs > 0) {
        continue;
      }

      const nextStep = movement.steps.shift();
      if (nextStep) {
        run.player = { x: nextStep.x, y: nextStep.y };
      }

      if (movement.steps.length > 0) {
        movement.remainingMs += movement.stepMs;
        continue;
      }

      const arrival = movement.onArrive;
      run.movement = null;
      if (arrival?.type === "interact") {
        const arrivalRoom = getCurrentRoom(state);
        if (arrivalRoom) {
          executeInteraction(getInteractionAt(arrivalRoom, arrival.x, arrival.y));
        }
      }
    }
  }

  return {
    getStatus,
    startRun,
    moveToTile,
    interactAtTile,
    pickupItem,
    dropInventorySlot,
    gatherNode,
    fightMob,
    openChest,
    craft,
    closeCraftingStation,
    unlockDoor,
    moveToDoor,
    interactDescend,
    abandonRun,
    advance,
    runSafetyValidation
  };
}
