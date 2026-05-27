"use client";

import { useMemo, useState } from "react";
import { analyzeWordplay, type Span, type SpanClass, type Step } from "./wordplayParser";

interface WordplayBreakdownProps {
  wordplay: string;
  answer: string;
}

/**
 * Renders the wordplay block in the cryptic post-solve panel. Three layers:
 *
 *   1. Highlighted notation — the original wordplay text, colour-coded by
 *      token role (kept letters, dropped context, anagram/reversal marks,
 *      connectors, hints).
 *   2. Step-by-step breakdown — one numbered line per operation with an
 *      intermediate result where the parser could compute it.
 *   3. Final answer line.
 *
 * A small "?" toggle opens a legend explaining the colour scheme. When the
 * parser can't decompose the clue (parse confidence "low") the step list
 * is hidden and only the highlighted notation + answer remain.
 */
export function WordplayBreakdown({ wordplay, answer }: WordplayBreakdownProps) {
  const [legendOpen, setLegendOpen] = useState(false);

  const analysis = useMemo(
    () => analyzeWordplay(wordplay || "", answer || ""),
    [wordplay, answer],
  );

  if (!wordplay) {
    return (
      <p className="font-mono text-sm leading-relaxed text-muted">
        No wordplay recorded.
      </p>
    );
  }

  const showSteps = analysis.confidence !== "none" && analysis.steps.length > 0;

  return (
    <div className="space-y-3">
      {/* Highlighted notation row */}
      <div className="flex items-start gap-2">
        <p className="flex-1 font-mono text-sm leading-relaxed text-foreground whitespace-pre-wrap">
          {analysis.spans.map((span, i) => (
            <SpanView key={i} span={span} />
          ))}
        </p>
        <button
          type="button"
          onClick={() => setLegendOpen((o) => !o)}
          aria-label={legendOpen ? "Hide notation legend" : "Show notation legend"}
          aria-expanded={legendOpen}
          className="shrink-0 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-mono text-muted transition-colors hover:text-foreground"
        >
          {legendOpen ? "×" : "?"}
        </button>
      </div>

      {legendOpen && <Legend />}

      {/* Step list */}
      {showSteps && (
        <ol className="space-y-1.5 border-t border-border/50 pt-3">
          {analysis.steps.map((step, i) => (
            <li
              key={i}
              className="flex items-start gap-2 font-mono text-xs leading-relaxed text-muted"
            >
              <span className="shrink-0 text-[10px] text-muted/60">
                {String(i + 1).padStart(2, "0")}
              </span>
              <StepView step={step} />
            </li>
          ))}
        </ol>
      )}

      {/* Final answer */}
      {analysis.compactAnswer && (
        <p className="border-t border-border/50 pt-3 font-mono text-xs leading-relaxed text-muted">
          <span className="mr-2 text-[10px] uppercase tracking-wider text-accent">
            Answer
          </span>
          <span className="font-bold tracking-widest text-foreground">
            {answer}
          </span>
        </p>
      )}
    </div>
  );
}

// ── Span (inline highlighted notation) ─────────────────────────────────────

function SpanView({ span }: { span: Span }) {
  const cls = classToStyle(span.cls);
  if (!cls) return <span>{span.text}</span>;
  return <span className={cls}>{span.text}</span>;
}

function classToStyle(cls: SpanClass): string | null {
  switch (cls) {
    case "kept":
      return "text-foreground font-bold";
    case "dropped":
      return "text-muted/70 line-through decoration-muted/40";
    case "bracket":
      return "text-muted/50";
    case "paren":
      return "text-muted/60";
    case "anagramOp":
      return "text-amber-400 font-bold";
    case "reversalOp":
      return "text-sky-400 font-bold";
    case "concatOp":
      return "text-accent font-bold";
    case "connector":
      return "italic text-accent/80";
    case "indicator":
      return "italic text-amber-400/80";
    case "hint":
      return "italic text-muted/80";
    case "special":
      return "italic text-accent";
    case "punct":
      return "text-muted/60";
    case "ws":
      return null;
    case "raw":
      return "text-muted";
    default:
      return null;
  }
}

// ── Step renderer ──────────────────────────────────────────────────────────

function StepView({ step }: { step: Step }) {
  if (step.kind === "literal") {
    return (
      <span>
        <Tag color="kept">{step.source}</Tag>
        <Arrow />
        <Result>{step.keep}</Result>
        {step.meaning && <Meaning text={step.meaning} />}
      </span>
    );
  }
  if (step.kind === "selection") {
    return (
      <span>
        From <Source>{step.source}</Source> keep the uppercase letters{" "}
        <Arrow />
        <Result>{step.keep}</Result>
        {step.meaning && <Meaning text={step.meaning} />}
      </span>
    );
  }
  if (step.kind === "anagram") {
    return (
      <span>
        Anagram of <Source>{step.letters}</Source>
        {step.indicator && (
          <>
            {" "}
            <span className="italic text-amber-400/80">({step.indicator})</span>
          </>
        )}
        <Arrow />
        {step.result ? (
          <Result>{step.result}</Result>
        ) : (
          <span className="font-bold tracking-widest text-foreground/60">
            {"?".repeat(step.letters.length)}
          </span>
        )}
      </span>
    );
  }
  if (step.kind === "reversal") {
    return (
      <span>
        Reverse <Source>{step.source || "?"}</Source>
        {step.indicator && (
          <>
            {" "}
            <span className="italic text-sky-400/80">({step.indicator})</span>
          </>
        )}
        <Arrow />
        <Result>{step.result}</Result>
      </span>
    );
  }
  if (step.kind === "container") {
    return (
      <span>
        Place <Source>{step.inner}</Source>{" "}
        <span className="italic text-accent/80">{step.connector}</span>{" "}
        <Source>{step.outer}</Source>
        {step.result && (
          <>
            <Arrow />
            <Result>{step.result}</Result>
          </>
        )}
      </span>
    );
  }
  if (step.kind === "concat") {
    return (
      <span>
        Join{" "}
        {step.parts.map((p, i) => (
          <span key={i}>
            {i > 0 && <span className="mx-1 text-accent">+</span>}
            <Source>{p}</Source>
          </span>
        ))}
        {step.result && (
          <>
            <Arrow />
            <Result>{step.result}</Result>
          </>
        )}
      </span>
    );
  }
  if (step.kind === "special") {
    return (
      <span>
        <span className="italic text-accent">{step.label}</span>
        {step.note && (
          <>
            {" — "}
            <span className="text-muted">{step.note}</span>
          </>
        )}
      </span>
    );
  }
  if (step.kind === "note") {
    return <span className="italic text-muted">{step.text}</span>;
  }
  return null;
}

function Source({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-bold tracking-wide text-foreground/90">
      {children}
    </span>
  );
}

function Result({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-bold tracking-widest text-accent">{children}</span>
  );
}

function Arrow() {
  return <span className="mx-1.5 text-muted/60">→</span>;
}

function Meaning({ text }: { text: string }) {
  return (
    <span className="ml-2 italic text-muted/70">({text})</span>
  );
}

function Tag({
  color,
  children,
}: {
  color: "kept" | "drop";
  children: React.ReactNode;
}) {
  const cls =
    color === "kept" ? "text-foreground font-bold" : "text-muted/70 line-through";
  return <span className={cls}>{children}</span>;
}

// ── Legend ─────────────────────────────────────────────────────────────────

function Legend() {
  const items: { label: string; sample: string; cls: SpanClass }[] = [
    { label: "Kept letters (form the answer)", sample: "ABC", cls: "kept" },
    { label: "Dropped context", sample: "xyz", cls: "dropped" },
    { label: "Anagram marker", sample: "*", cls: "anagramOp" },
    { label: "Reversal marker", sample: "<", cls: "reversalOp" },
    { label: "Concatenation", sample: "+", cls: "concatOp" },
    { label: "Container / order word", sample: "inside", cls: "connector" },
    { label: "Indicator hint", sample: "(*shuffled)", cls: "indicator" },
    { label: "Meaning hint", sample: "(meaning)", cls: "hint" },
  ];
  return (
    <ul className="grid grid-cols-1 gap-1 rounded-md border border-border/60 bg-background/40 p-3 text-[11px] sm:grid-cols-2">
      {items.map((it) => (
        <li key={it.label} className="flex items-baseline gap-2 font-mono">
          <span className={classToStyle(it.cls) ?? ""}>{it.sample}</span>
          <span className="text-muted">{it.label}</span>
        </li>
      ))}
    </ul>
  );
}
