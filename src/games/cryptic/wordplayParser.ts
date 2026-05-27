/**
 * Parses the informal wordplay notation used in `data/cryptic-clues.json`
 * into:
 *   1. `spans` — source-faithful classification for inline highlighting
 *   2. `steps` — a structured operation list for the step-by-step view
 *
 * The notation is a hand-edited mix that combines a few standard cryptic
 * conventions:
 *
 *   - UPPERCASE letters contribute to the answer; lowercase letters within
 *     a letter-run are context only ("not kept"). So `B[a]L[l]E[t]` keeps
 *     BLE, and `tamp[A]` keeps A.
 *   - `(WORD)*` or `*(WORD)` = anagram of WORD.
 *   - `WORD<` or `(WORD)<` = reversal.
 *   - `+` joins two components.
 *   - Container relationships are expressed with words: "in", "around",
 *     "holding", "containing", "covering", "inside", etc.
 *   - Parenthetical hints `(lowercase)` describe meaning; `(*x)` /
 *     `(<x)` are indicator hints for the matching operator.
 *   - Special markers: "Double Definition", "&lit", "Cryptic Definition".
 *
 * The parser is intentionally lenient — when it can't make sense of a
 * fragment it falls through to a `raw` span so the inline view still
 * shows the original text. Step extraction is best-effort: confidence
 * is reported back to the caller so the UI can hide the step list when
 * we couldn't decompose the clue.
 */

// ── Public types ────────────────────────────────────────────────────────────

export type SpanClass =
  | "ws"
  | "kept"        // uppercase letter that contributes to the answer
  | "dropped"     // lowercase letter in a letter-run (context only)
  | "bracket"     // [ or ]
  | "paren"       // ( or )
  | "anagramOp"   // *
  | "reversalOp"  // <
  | "concatOp"    // +
  | "connector"   // top-level connector word ("in", "around", "+ ", etc.)
  | "hint"        // descriptive lowercase text inside parens
  | "indicator"   // text inside (*…) or (<…) — the indicator word
  | "special"     // "Double Definition", "&lit", etc.
  | "punct"       // , ; : - – —
  | "raw";

export interface Span {
  text: string;
  cls: SpanClass;
  start: number;
  end: number;
}

export type Step =
  | { kind: "literal"; source: string; keep: string; meaning?: string; note?: string }
  | { kind: "selection"; source: string; keep: string; meaning?: string; note?: string }
  | { kind: "anagram"; letters: string; indicator?: string; result?: string }
  | { kind: "reversal"; source: string; result: string; indicator?: string }
  | { kind: "container"; outer: string; inner: string; connector: string; result?: string }
  | { kind: "concat"; parts: string[]; result?: string }
  | { kind: "special"; label: string; note?: string }
  | { kind: "note"; text: string };

export interface WordplayAnalysis {
  spans: Span[];
  steps: Step[];
  /** "high" = parser produced a meaningful decomposition; "low" = mostly raw. */
  confidence: "high" | "low" | "none";
  /** Answer with letters only, uppercase, for final-step comparison. */
  compactAnswer: string;
}

// ── Tokens (intermediate) ──────────────────────────────────────────────────

type Tok =
  | { kind: "lit"; raw: string; keep: string; start: number; end: number }
  | { kind: "word"; raw: string; start: number; end: number }
  | { kind: "star"; start: number; end: number }
  | { kind: "lt"; start: number; end: number }
  | { kind: "plus"; start: number; end: number }
  | { kind: "punct"; raw: string; start: number; end: number }
  | { kind: "ws"; raw: string; start: number; end: number }
  | {
      kind: "group";
      raw: string;
      inner: Tok[];
      role: "literalGroup" | "hint" | "anagramIndicator" | "reversalIndicator" | "subExpr";
      start: number;
      end: number;
    };

const CONTAINER_WORDS = new Set([
  "in",
  "inside",
  "into",
  "around",
  "surrounding",
  "holding",
  "holds",
  "containing",
  "contains",
  "covering",
  "covers",
  "encased",
  "wrapping",
  "wraps",
  "captures",
  "capturing",
  "captivated",
  "captivating",
  "protects",
  "protecting",
  "occupying",
  "occupies",
  "eats",
  "eating",
  "swallowing",
  "swallows",
  "embracing",
  "embraced",
  "hugging",
  "carrying",
  "carries",
  "outside",
  "shielded",
  "filled",
  "shows",
  "describes",
  "drawn", // "drawn into"
  "tuck",  // "tuck into"
  "found", // "found in"
  "keeping",
  "keeps",
  "incorporates",
  "incorporating",
  "wears",
  "wearing",
  "ate",
  "swallow",
  "supporting",
  "encloses",
  "enclosing",
  "round",
  "trapped",
  "trapping",
  "absorbing",
  "absorbs",
]);

const CONCAT_CONNECTORS = new Set([
  "and",
  "with",
  "on",
  "by",
  "after",
  "before",
  "next",
  "beside",
  "supported",
  "joined",
  "then",
  "above",
  "below",
  "over",
  "under",
  "to",
  "meeting",
  "meets",
  "from",
  "following",
  "follows",
  "preceded",
  "preceding",
  "atop",
  "leads",
  "leading",
  "chasing",
  "chases",
]);

// ── Tokenizer ──────────────────────────────────────────────────────────────

function isLetter(ch: string): boolean {
  return /[A-Za-z]/.test(ch);
}

function tokenize(input: string, base = 0): Tok[] {
  const tokens: Tok[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];

    if (/\s/.test(ch)) {
      let j = i + 1;
      while (j < input.length && /\s/.test(input[j])) j++;
      tokens.push({ kind: "ws", raw: input.slice(i, j), start: base + i, end: base + j });
      i = j;
      continue;
    }

    if (ch === "+") {
      tokens.push({ kind: "plus", start: base + i, end: base + i + 1 });
      i++;
      continue;
    }

    if (ch === "*") {
      tokens.push({ kind: "star", start: base + i, end: base + i + 1 });
      i++;
      continue;
    }

    if (ch === "<") {
      tokens.push({ kind: "lt", start: base + i, end: base + i + 1 });
      i++;
      continue;
    }

    if (",;:".includes(ch) || ch === "-" || ch === "–" || ch === "—") {
      tokens.push({ kind: "punct", raw: ch, start: base + i, end: base + i + 1 });
      i++;
      continue;
    }

    if (ch === "(") {
      // Balanced paren group.
      let depth = 1;
      let j = i + 1;
      while (j < input.length && depth > 0) {
        if (input[j] === "(") depth++;
        else if (input[j] === ")") depth--;
        if (depth > 0) j++;
      }
      const innerRaw = input.slice(i + 1, j);
      const innerTokens = tokenize(innerRaw, base + i + 1);
      const role = classifyGroupRole(innerTokens);
      tokens.push({
        kind: "group",
        raw: input.slice(i, j + 1),
        inner: innerTokens,
        role,
        start: base + i,
        end: base + j + 1,
      });
      i = j + 1;
      continue;
    }

    // Letter / bracket runs → a single LIT or WORD token.
    if (isLetter(ch) || ch === "[" || ch === "]" || ch === "'" || ch === "’") {
      let j = i;
      while (j < input.length) {
        const c = input[j];
        if (isLetter(c) || c === "[" || c === "]" || c === "'" || c === "’") {
          j++;
        } else {
          break;
        }
      }
      const raw = input.slice(i, j);
      const keep = raw.replace(/[^A-Z]/g, "");
      if (keep.length === 0) {
        tokens.push({ kind: "word", raw, start: base + i, end: base + j });
      } else {
        tokens.push({ kind: "lit", raw, keep, start: base + i, end: base + j });
      }
      i = j;
      continue;
    }

    // Anything else — skip but record as punct so the inline view stays
    // faithful to the source.
    tokens.push({ kind: "punct", raw: ch, start: base + i, end: base + i + 1 });
    i++;
  }
  return tokens;
}

function classifyGroupRole(inner: Tok[]): "literalGroup" | "hint" | "anagramIndicator" | "reversalIndicator" | "subExpr" {
  const nonWs = inner.filter((t) => t.kind !== "ws");
  if (nonWs.length === 0) return "hint";
  if (nonWs[0].kind === "star") return "anagramIndicator";
  if (nonWs[0].kind === "lt") return "reversalIndicator";

  // Count structural content. Stray `*` / `<` characters inside a
  // descriptive paren ("priest, <turning up") aren't structural — they're
  // editorial markup describing why the operator applies. Only `+` and the
  // presence of letter-bearing tokens decide whether this is a real
  // sub-expression.
  let litCount = 0;
  let structuralGroupCount = 0;
  let wordCount = 0;
  let plusCount = 0;
  for (const t of nonWs) {
    if (t.kind === "lit") litCount++;
    else if (t.kind === "word") wordCount++;
    else if (t.kind === "plus") plusCount++;
    else if (t.kind === "group" && t.role !== "hint" && t.role !== "anagramIndicator" && t.role !== "reversalIndicator") {
      structuralGroupCount++;
    }
  }

  // No letter-bearing content at all → a plain hint.
  if (litCount === 0 && structuralGroupCount === 0) return "hint";

  // Lone literal in parens, no extras → literal group.
  if (litCount === 1 && wordCount === 0 && structuralGroupCount === 0 && plusCount === 0) {
    return "literalGroup";
  }

  // Mostly descriptive (words outnumber the structural pieces) → hint with
  // some uppercase context like "(I travel, back)" or "(R. Wood?)".
  if (plusCount === 0 && wordCount >= litCount + structuralGroupCount) return "hint";

  return "subExpr";
}

// ── Span builder (for inline rendering) ────────────────────────────────────

function buildSpans(tokens: Tok[]): Span[] {
  const out: Span[] = [];
  for (const tok of tokens) {
    pushTok(tok, out);
  }
  return out;
}

function pushTok(tok: Tok, out: Span[]): void {
  if (tok.kind === "ws") {
    out.push({ text: tok.raw, cls: "ws", start: tok.start, end: tok.end });
    return;
  }
  if (tok.kind === "lit") {
    // Split into per-char spans by class so the kept letters pop visually.
    for (let k = 0; k < tok.raw.length; k++) {
      const c = tok.raw[k];
      let cls: SpanClass;
      if (c === "[" || c === "]") cls = "bracket";
      else if (/[A-Z]/.test(c)) cls = "kept";
      else cls = "dropped";
      out.push({ text: c, cls, start: tok.start + k, end: tok.start + k + 1 });
    }
    return;
  }
  if (tok.kind === "word") {
    const cls: SpanClass = isConnectorWord(tok.raw) ? "connector" : "hint";
    out.push({ text: tok.raw, cls, start: tok.start, end: tok.end });
    return;
  }
  if (tok.kind === "star") {
    out.push({ text: "*", cls: "anagramOp", start: tok.start, end: tok.end });
    return;
  }
  if (tok.kind === "lt") {
    out.push({ text: "<", cls: "reversalOp", start: tok.start, end: tok.end });
    return;
  }
  if (tok.kind === "plus") {
    out.push({ text: "+", cls: "concatOp", start: tok.start, end: tok.end });
    return;
  }
  if (tok.kind === "punct") {
    out.push({ text: tok.raw, cls: "punct", start: tok.start, end: tok.end });
    return;
  }
  if (tok.kind === "group") {
    // Open paren
    out.push({ text: "(", cls: "paren", start: tok.start, end: tok.start + 1 });
    // Inner — for indicator/hint groups, mark inner non-ws tokens specially
    if (tok.role === "anagramIndicator" || tok.role === "reversalIndicator" || tok.role === "hint") {
      for (const sub of tok.inner) {
        if (sub.kind === "ws") {
          out.push({ text: sub.raw, cls: "ws", start: sub.start, end: sub.end });
        } else if (sub.kind === "star") {
          out.push({ text: "*", cls: "anagramOp", start: sub.start, end: sub.end });
        } else if (sub.kind === "lt") {
          out.push({ text: "<", cls: "reversalOp", start: sub.start, end: sub.end });
        } else if (sub.kind === "punct") {
          out.push({ text: sub.raw, cls: "punct", start: sub.start, end: sub.end });
        } else if (sub.kind === "word") {
          out.push({
            text: sub.raw,
            cls: tok.role === "hint" ? "hint" : "indicator",
            start: sub.start,
            end: sub.end,
          });
        } else if (sub.kind === "lit") {
          // Lit inside a hint group is unusual but possible — keep highlight.
          pushTok(sub, out);
        } else if (sub.kind === "group") {
          pushTok(sub, out);
        }
      }
    } else {
      for (const sub of tok.inner) pushTok(sub, out);
    }
    // Close paren
    out.push({ text: ")", cls: "paren", start: tok.end - 1, end: tok.end });
  }
}

function isConnectorWord(raw: string): boolean {
  // Multi-word connectors (e.g. "encased in") are handled token-by-token —
  // this just classifies a single lowercase word run.
  const w = raw.toLowerCase().replace(/[^a-z]/g, "");
  return CONTAINER_WORDS.has(w) || CONCAT_CONNECTORS.has(w);
}

// ── Step extraction ────────────────────────────────────────────────────────

interface Atom {
  /** Display string for this atom in step descriptions (e.g. "AXE", "(CRETE)*"). */
  display: string;
  /** Letters the atom contributes to the answer; "?" runs for anagrams. */
  result: string;
  /** Sub-steps that describe how the atom is built. */
  steps: Step[];
  /** True when `result` is exact (no unknown letters). */
  resolved: boolean;
  /** Optional meaning hint attached via a trailing hint group. */
  meaning?: string;
}

function isOpenAtomTok(t: Tok): boolean {
  return t.kind === "lit" || t.kind === "group";
}

/**
 * Walk a token stream and yield "atom phrases" separated by operators
 * (`+`, container/concat words, punctuation). Returns the atoms and the
 * operators that connected them.
 */
interface AtomChain {
  atoms: Atom[];
  ops: { kind: "concat" | "container" | "punct"; word: string }[];
}

/** Shared context for a single parse — currently just carries the answer. */
interface ParseCtx {
  answer: string;
}

function buildAtomChain(tokens: Tok[], ctx: ParseCtx): AtomChain | null {
  const meaningful = tokens.filter((t) => t.kind !== "ws");
  if (meaningful.length === 0) return { atoms: [], ops: [] };

  const atoms: Atom[] = [];
  const ops: AtomChain["ops"] = [];
  let i = 0;
  while (i < meaningful.length) {
    const tok = meaningful[i];

    // Skip leading punctuation between atoms.
    if (tok.kind === "punct") {
      if (atoms.length > 0) {
        ops.push({ kind: "punct", word: tok.raw });
      }
      i++;
      continue;
    }

    // Operator-only tokens between atoms.
    if (tok.kind === "plus") {
      if (atoms.length > 0) ops.push({ kind: "concat", word: "+" });
      i++;
      continue;
    }

    // A standalone *star at the head of a group means "anagram of the next group".
    if (tok.kind === "star") {
      const next = meaningful[i + 1];
      if (next && next.kind === "group") {
        const atom = atomFromAnagram(next, undefined, ctx);
        const indicatorAfter = consumeTrailingIndicator(meaningful, i + 2, "anagramIndicator");
        if (indicatorAfter.indicator) {
          // Attach indicator text into the atom's first anagram step.
          const first = atom.steps.find((s) => s.kind === "anagram");
          if (first && first.kind === "anagram") first.indicator = indicatorAfter.indicator;
        }
        atoms.push(atom);
        // Attach trailing hint if any.
        i = consumeTrailingHint(meaningful, indicatorAfter.next, atom);
        continue;
      }
      // Unknown lone star — drop it.
      i++;
      continue;
    }

    // A standalone < (rare) at head — drop it.
    if (tok.kind === "lt") {
      i++;
      continue;
    }

    // A lowercase word at this position is a connector.
    if (tok.kind === "word") {
      // Multi-word connector check, e.g. "encased in".
      const phrase = collectConnectorPhrase(meaningful, i);
      if (phrase.kind && atoms.length > 0) {
        ops.push({ kind: phrase.kind, word: phrase.phrase });
        i = phrase.next;
        continue;
      }
      // Leading or unattached word — drop into nothing.
      i = phrase.next;
      continue;
    }

    // A LIT or GROUP starts an atom.
    if (isOpenAtomTok(tok)) {
      const built = buildAtomFromHead(meaningful, i, ctx);
      if (!built) return null;
      atoms.push(built.atom);
      i = built.next;
      continue;
    }

    // Anything else — skip.
    i++;
  }
  return { atoms, ops };
}

function buildAtomFromHead(toks: Tok[], idx: number, ctx: ParseCtx): { atom: Atom; next: number } | null {
  const head = toks[idx];
  if (head.kind === "lit") {
    let atom = atomFromLit(head);
    let next = idx + 1;

    // Trailing < → reversal.
    if (toks[next]?.kind === "lt") {
      atom = wrapReversal(atom);
      next++;
    }
    // Trailing * → anagram (rare on a bare LIT, but seen).
    if (toks[next]?.kind === "star") {
      atom = wrapAnagram(atom, ctx);
      next++;
    }
    // Indicator group (*x) or (<x).
    const ind = consumeTrailingIndicator(toks, next, "any");
    if (ind.indicator) attachIndicatorToAtom(atom, ind.kind, ind.indicator);
    next = ind.next;
    // Plain hint (lowercase) → meaning.
    next = consumeTrailingHint(toks, next, atom);
    return { atom, next };
  }

  if (head.kind === "group") {
    let atom: Atom | null = null;
    if (head.role === "literalGroup") {
      // (LIT) — treat as the inner literal.
      const lit = head.inner.find((t) => t.kind === "lit") as Extract<Tok, { kind: "lit" }> | undefined;
      if (!lit) return null;
      atom = atomFromLit(lit);
      atom.display = head.raw; // preserve parens for display readability
    } else if (head.role === "subExpr") {
      // Recursively parse the group.
      const sub = analyzeTokens(head.inner, ctx);
      if (!sub) return null;
      atom = sub;
    } else if (head.role === "anagramIndicator" || head.role === "reversalIndicator" || head.role === "hint") {
      // A leading hint/indicator with no preceding operand — skip.
      return { atom: { display: head.raw, result: "", steps: [], resolved: true }, next: idx + 1 };
    }
    if (!atom) return null;
    let next = idx + 1;

    // Trailing operators applied to the whole group.
    if (toks[next]?.kind === "star") {
      atom = wrapAnagram(atom, ctx);
      next++;
    }
    if (toks[next]?.kind === "lt") {
      atom = wrapReversal(atom);
      next++;
    }
    const ind = consumeTrailingIndicator(toks, next, "any");
    if (ind.indicator) attachIndicatorToAtom(atom, ind.kind, ind.indicator);
    next = ind.next;
    next = consumeTrailingHint(toks, next, atom);
    return { atom, next };
  }
  return null;
}

function atomFromLit(lit: Extract<Tok, { kind: "lit" }>): Atom {
  // A literal with some lowercase context counts as a selection (deletion);
  // a pure-uppercase literal is just a straight word component.
  const hasContext = /[a-z\[\]]/.test(lit.raw);
  const steps: Step[] = [];
  if (hasContext) {
    steps.push({
      kind: "selection",
      source: lit.raw,
      keep: lit.keep,
    });
  } else {
    steps.push({
      kind: "literal",
      source: lit.raw,
      keep: lit.keep,
    });
  }
  return { display: lit.raw, result: lit.keep, steps, resolved: true };
}

function atomFromAnagram(group: Extract<Tok, { kind: "group" }>, indicator: string | undefined, ctx: ParseCtx): Atom {
  // Pull the contained letters.
  const letters = group.inner
    .filter((t): t is Extract<Tok, { kind: "lit" }> => t.kind === "lit")
    .map((t) => t.keep)
    .join("");
  const display = `${group.raw}*`;
  const result = resolveAnagramResult(letters, ctx.answer);
  return {
    display,
    result: result ?? "?".repeat(letters.length),
    resolved: !!result,
    steps: [{ kind: "anagram", letters, indicator, result }],
  };
}

function wrapAnagram(atom: Atom, ctx: ParseCtx): Atom {
  const letters = atom.result.replace(/[^A-Z]/g, "");
  const result = resolveAnagramResult(letters, ctx.answer);
  return {
    display: `${atom.display}*`,
    result: result ?? "?".repeat(letters.length || atom.result.length),
    resolved: !!result,
    steps: [...atom.steps, { kind: "anagram", letters, result }],
  };
}

/**
 * If exactly one substring of `answer` is an anagram of `letters`, return it.
 * Otherwise return undefined — caller will show "????" instead.
 */
function resolveAnagramResult(letters: string, answer: string): string | undefined {
  if (!letters || !answer) return undefined;
  const sorted = letters.split("").sort().join("");
  const matches = new Set<string>();
  for (let i = 0; i + letters.length <= answer.length; i++) {
    const sub = answer.slice(i, i + letters.length);
    if (sub.split("").sort().join("") === sorted) matches.add(sub);
  }
  return matches.size === 1 ? matches.values().next().value : undefined;
}

function wrapReversal(atom: Atom): Atom {
  const result = atom.resolved ? reverseStr(atom.result) : atom.result.split("").reverse().join("");
  return {
    display: `${atom.display}<`,
    result,
    resolved: atom.resolved,
    steps: [...atom.steps, { kind: "reversal", source: atom.result, result }],
  };
}

function reverseStr(s: string): string {
  return s.split("").reverse().join("");
}

function attachIndicatorToAtom(atom: Atom, kind: "anagram" | "reversal", indicator: string): void {
  for (let k = atom.steps.length - 1; k >= 0; k--) {
    const s = atom.steps[k];
    if (kind === "anagram" && s.kind === "anagram" && !s.indicator) {
      s.indicator = indicator;
      return;
    }
    if (kind === "reversal" && s.kind === "reversal" && !s.indicator) {
      s.indicator = indicator;
      return;
    }
  }
}

function consumeTrailingIndicator(
  toks: Tok[],
  idx: number,
  want: "anagramIndicator" | "reversalIndicator" | "any",
): { indicator?: string; kind: "anagram" | "reversal"; next: number } {
  // Skip whitespace (already filtered) — meaningful sequence.
  const t = toks[idx];
  if (!t || t.kind !== "group") return { kind: "anagram", next: idx };
  const ok =
    want === "any"
      ? t.role === "anagramIndicator" || t.role === "reversalIndicator"
      : t.role === want;
  if (!ok) return { kind: "anagram", next: idx };
  const kind: "anagram" | "reversal" =
    t.role === "anagramIndicator" ? "anagram" : "reversal";
  const text = t.inner
    .filter((s) => s.kind === "word")
    .map((s) => (s as Extract<Tok, { kind: "word" }>).raw)
    .join(" ")
    .trim();
  return { indicator: text || undefined, kind, next: idx + 1 };
}

function consumeTrailingHint(toks: Tok[], idx: number, atom: Atom): number {
  const t = toks[idx];
  if (!t || t.kind !== "group" || t.role !== "hint") return idx;
  const text = renderHintInner(t.inner);
  if (text) {
    atom.meaning = text;
    // Tag the meaning into the most recent literal-ish step.
    for (let k = atom.steps.length - 1; k >= 0; k--) {
      const s = atom.steps[k];
      if (s.kind === "literal" || s.kind === "selection") {
        s.meaning = text;
        break;
      }
    }
  }
  return idx + 1;
}

/**
 * Stringify the inner of a hint group with reasonable spacing — words
 * separated by spaces, punctuation hugging the preceding word.
 */
function renderHintInner(inner: Tok[]): string {
  let out = "";
  for (const t of inner) {
    if (t.kind === "ws") continue;
    if (t.kind === "word") {
      if (out && !out.endsWith(" ")) out += " ";
      out += t.raw;
    } else if (t.kind === "lit") {
      if (out && !out.endsWith(" ")) out += " ";
      out += t.raw;
    } else if (t.kind === "punct") {
      out += t.raw;
    } else if (t.kind === "star") {
      out += "*";
    } else if (t.kind === "lt") {
      out += "<";
    } else if (t.kind === "plus") {
      if (out && !out.endsWith(" ")) out += " ";
      out += "+";
    } else if (t.kind === "group") {
      if (out && !out.endsWith(" ")) out += " ";
      out += t.raw;
    }
  }
  return out.replace(/\s+/g, " ").trim();
}

function collectConnectorPhrase(
  toks: Tok[],
  idx: number,
): { kind: "container" | "concat" | null; phrase: string; next: number } {
  // Up to 3 consecutive lowercase word tokens, also skipping hint groups.
  const words: string[] = [];
  let j = idx;
  let saw = false;
  while (j < toks.length) {
    const t = toks[j];
    if (t.kind === "word") {
      words.push(t.raw);
      saw = true;
      j++;
      if (words.length >= 4) break;
      continue;
    }
    if (t.kind === "group" && t.role === "hint" && saw) {
      // Allow a hint mid-phrase but don't consume it as the connector.
      j++;
      continue;
    }
    break;
  }
  if (words.length === 0) return { kind: null, phrase: "", next: idx + 1 };
  const phrase = words.join(" ").toLowerCase();
  // Classify by any container word in the phrase.
  for (const w of words) {
    if (CONTAINER_WORDS.has(w.toLowerCase())) {
      return { kind: "container", phrase, next: j };
    }
  }
  for (const w of words) {
    if (CONCAT_CONNECTORS.has(w.toLowerCase())) {
      return { kind: "concat", phrase, next: j };
    }
  }
  // Unknown lowercase phrase → treat as concat with a label.
  return { kind: "concat", phrase, next: j };
}

/**
 * Turn a token list into a single Atom (or null on failure). Top-level
 * `analyzeWordplay` calls this on the full token list and the inner of
 * each sub-expression group.
 */
function analyzeTokens(tokens: Tok[], ctx: ParseCtx): Atom | null {
  const chain = buildAtomChain(tokens, ctx);
  if (!chain || chain.atoms.length === 0) return null;
  if (chain.atoms.length === 1) return chain.atoms[0];

  const atoms = chain.atoms;
  const ops = chain.ops;

  // For an all-concat chain, try the straight order first; if the answer
  // doesn't contain the produced string but DOES contain the reverse
  // concat (e.g. "X on Y" in a down clue means Y above X), use that
  // instead. This keeps simple +-chains honest while accommodating the
  // small handful of directional connector words.
  const allConcat = ops.every((o) => o.kind === "concat" || o.kind === "punct");
  if (allConcat) {
    const allResolved = atoms.every((a) => a.resolved);
    let parts = atoms.map((a) => a.display);
    let result = atoms.map((a) => a.result).join("");
    if (allResolved && ctx.answer && !ctx.answer.includes(result)) {
      const reversedJoin = [...atoms].reverse().map((a) => a.result).join("");
      if (ctx.answer.includes(reversedJoin)) {
        parts = [...parts].reverse();
        result = reversedJoin;
      }
    }
    const combinedSteps: Step[] = atoms.flatMap((a) => a.steps);
    combinedSteps.push({
      kind: "concat",
      parts,
      result: allResolved ? result : undefined,
    });
    return {
      display: parts.join(" + "),
      result: allResolved ? result : "",
      resolved: allResolved,
      steps: combinedSteps,
    };
  }

  // Mixed chain (contains a container): fold left-to-right.
  let current: Atom = atoms[0];
  let combineSteps: Step[] = [...current.steps];
  let combineDisplay = current.display;
  let combineResult = current.result;
  let combineResolved = current.resolved;

  for (let k = 1; k < atoms.length; k++) {
    const op = ops[k - 1] ?? { kind: "concat", word: "+" };
    const next = atoms[k];

    if (op.kind === "container") {
      const result =
        combineResolved && next.resolved
          ? interleaveContainer(combineResult, next.result, ctx.answer)
          : "";
      combineSteps = [
        ...combineSteps,
        ...next.steps,
        {
          kind: "container",
          outer: combineDisplay,
          inner: next.display,
          connector: op.word,
          result: result || undefined,
        },
      ];
      combineDisplay = `${combineDisplay} ${op.word} ${next.display}`;
      combineResult = result || "";
      combineResolved = !!result;
    } else {
      const result =
        combineResolved && next.resolved ? combineResult + next.result : "";
      combineSteps = [...combineSteps, ...next.steps];
      combineDisplay = `${combineDisplay} ${op.word === "+" ? "+" : op.word} ${next.display}`;
      combineResult = result || "";
      combineResolved = !!result;
    }
    current = {
      display: combineDisplay,
      result: combineResult,
      resolved: combineResolved,
      steps: combineSteps,
    };
  }

  return current;
}

/**
 * Place `inner` inside `outer`. When the answer is available we look for
 * a substring of the form `outer[:k] + inner + outer[k:]` and pick the
 * matching `k` — that gives the exact form BO|NINE|SS for BOSS around
 * NINE = BONINESS. Falls back to midpoint insertion when the answer
 * doesn't disambiguate.
 */
function interleaveContainer(outer: string, inner: string, answer: string): string {
  if (!outer || !inner) return outer + inner;
  if (answer) {
    for (let k = 0; k <= outer.length; k++) {
      const candidate = outer.slice(0, k) + inner + outer.slice(k);
      if (answer.includes(candidate)) return candidate;
    }
    // Also try inner-around-outer (some clues phrase the container with the
    // smaller word as the wrapper, e.g. "RE around DANE").
    for (let k = 0; k <= inner.length; k++) {
      const candidate = inner.slice(0, k) + outer + inner.slice(k);
      if (answer.includes(candidate)) return candidate;
    }
  }
  const mid = Math.ceil(outer.length / 2);
  return outer.slice(0, mid) + inner + outer.slice(mid);
}

// ── Public entry point ─────────────────────────────────────────────────────

export function analyzeWordplay(rawInput: string, answer: string): WordplayAnalysis {
  const input = (rawInput || "").trim();
  const compactAnswer = (answer || "").toUpperCase().replace(/[^A-Z]/g, "");

  if (!input) {
    return { spans: [], steps: [], confidence: "none", compactAnswer };
  }

  // Special-case markers first.
  const special = detectSpecial(input);
  if (special) {
    return {
      spans: [{ text: input, cls: "special", start: 0, end: input.length }],
      steps: [{ kind: "special", label: special.label, note: special.note }],
      confidence: "high",
      compactAnswer,
    };
  }

  const tokens = tokenize(input);
  const spans = buildSpans(tokens);

  // Try to analyze structurally.
  const ctx: ParseCtx = { answer: compactAnswer };
  const atom = safeAnalyze(tokens, ctx);
  let steps: Step[] = atom?.steps ?? [];

  // Trailing "&lit" marker.
  if (/&lit\b/i.test(input)) {
    steps = [
      ...steps,
      { kind: "note", text: "&lit — the whole clue also serves as the definition." },
    ];
  }

  // Confidence: high when we both decomposed the clue AND the final result
  // matches the answer (or every atom resolved). low when something was
  // computed but it doesn't add up. none when nothing came out at all.
  let confidence: "high" | "low" | "none" = "none";
  if (steps.length > 0) {
    const finalResultMatches = !!atom && atom.resolved && atom.result === compactAnswer;
    const anyResolvedStep = steps.some(
      (s) =>
        (s.kind === "concat" && s.result === compactAnswer) ||
        (s.kind === "container" && s.result === compactAnswer) ||
        s.kind === "special",
    );
    confidence = finalResultMatches || anyResolvedStep || atom === null ? "high" : "low";
    if (atom === null) confidence = "low";
  }

  return { spans, steps, confidence, compactAnswer };
}

function safeAnalyze(tokens: Tok[], ctx: ParseCtx): Atom | null {
  try {
    return analyzeTokens(tokens, ctx);
  } catch {
    return null;
  }
}

function detectSpecial(input: string): { label: string; note?: string } | null {
  const lower = input.toLowerCase();
  if (lower.startsWith("double definition")) {
    const colon = input.indexOf(":");
    return {
      label: "Double Definition",
      note: colon >= 0 ? input.slice(colon + 1).trim() : undefined,
    };
  }
  if (lower.startsWith("cryptic definition")) {
    return { label: "Cryptic Definition" };
  }
  if (lower === "&lit" || lower === "& lit") {
    return { label: "&lit", note: "The whole clue is both definition and wordplay." };
  }
  return null;
}
