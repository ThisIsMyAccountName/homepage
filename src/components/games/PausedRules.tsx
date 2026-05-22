/**
 * Compact rules card shown inside the pause overlay of each daily game so
 * players can refresh on how to play without leaving the puzzle. Sized to fit
 * inside the (potentially small) shared daily board square.
 */
interface PausedRulesProps {
  rules: string[];
}

export function PausedRules({ rules }: PausedRulesProps) {
  return (
    <ul className="max-w-[20rem] space-y-1 rounded-md border border-border bg-card/95 px-3 py-2 text-left text-xs text-muted shadow-md backdrop-blur-sm">
      {rules.map((r, i) => (
        <li key={i}>• {r}</li>
      ))}
    </ul>
  );
}
