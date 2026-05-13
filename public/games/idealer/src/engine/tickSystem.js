import { productionPerSecond } from "./formulas.js";

export function createTickSystem({ state, balance, generatorDefs, resourceManager, eventBus, onAdvance }) {
  let timerId = null;

  function runTick() {
    const now = Date.now();
    const dtMs = Math.max(0, now - state.meta.lastTickAt);
    state.meta.lastTickAt = now;
    const dtSeconds = dtMs / 1000;

    const rates = productionPerSecond(state, generatorDefs);
    resourceManager.add("matter", rates.matter * dtSeconds);
    resourceManager.add("fire", rates.fire * dtSeconds);
    if (typeof onAdvance === "function") {
      onAdvance(dtSeconds);
    }

    eventBus.emit("tick", { state, rates, dtSeconds });
  }

  function start() {
    if (timerId) {
      return;
    }
    state.meta.lastTickAt = Date.now();
    timerId = setInterval(runTick, balance.tickMs);
  }

  function stop() {
    if (!timerId) {
      return;
    }
    clearInterval(timerId);
    timerId = null;
  }

  return { start, stop, runTick };
}
