"use client";

import dynamic from "next/dynamic";

// ssr:false because DailyHub reads localStorage in its initializers to choose
// the active step without hydration mismatches.
const DailyHub = dynamic(
  () => import("@/components/daily/DailyHub").then((m) => ({ default: m.DailyHub })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-8 text-sm text-muted">
        Loading daily puzzles...
      </div>
    ),
  }
);

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-[18px] sm:px-6">
      <DailyHub />
    </main>
  );
}
