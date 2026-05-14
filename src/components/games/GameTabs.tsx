"use client";

interface GameTabsProps {
  tabs: readonly string[];
  active: string;
  onChange: (tab: string) => void;
  className?: string;
}

export function GameTabs({ tabs, active, onChange, className }: GameTabsProps) {
  return (
    <div className={`flex gap-4 border-b border-border w-full ${className ?? ""}`}>
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`pb-2 text-sm font-medium capitalize transition-colors ${
            active === t
              ? "border-b-2 border-accent text-foreground -mb-px"
              : "text-muted hover:text-foreground"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
