import { useEffect } from "react";

/** Pauses the game whenever the browser tab/window loses visibility. */
export function useAutoPause(
  setPaused: (v: boolean) => void,
  won: boolean
) {
  useEffect(() => {
    if (won) return;
    const handler = () => {
      if (document.visibilityState === "hidden") setPaused(true);
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [setPaused, won]);
}
