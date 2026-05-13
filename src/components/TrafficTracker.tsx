"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function TrafficTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // Fire and forget — don't block rendering
    fetch("/api/traffic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
    }).catch(() => {
      // Silently fail
    });
  }, [pathname]);

  return null;
}
