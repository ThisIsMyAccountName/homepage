"use client";

import { useState } from "react";
import { buildShareText, type ShareGame } from "@/lib/share";
import { getTodayKey } from "@/lib/daily";

interface ShareScoreProps {
  game: ShareGame;
  time: number;
  errors: number;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function ShareScore({ game, time, errors }: ShareScoreProps) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  const handleShare = async () => {
    const text = buildShareText({
      game,
      time,
      errors,
      date: getTodayKey(),
      url: `${window.location.origin}/`,
    });
    const ok = await copyToClipboard(text);
    setState(ok ? "copied" : "error");
    setTimeout(() => setState("idle"), 2500);
  };

  return (
    <button
      onClick={handleShare}
      className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-accent/40 hover:bg-card-hover"
    >
      {state === "copied" ? (
        <span className="text-accent">✓ Copied to clipboard</span>
      ) : state === "error" ? (
        <span className="text-red-400">Copy failed — try again</span>
      ) : (
        <>
          <span>📋</span>
          <span>Share result</span>
        </>
      )}
    </button>
  );
}
