/**
 * Server-only loader for the cryptic clue pool. Reads
 * `data/cryptic-clues.json` (user-supplied, gitignored) with a module-scope
 * cache invalidated by file mtime; falls back to the small committed pool
 * at `./data/cryptic-fallback.json` when the user file is missing.
 *
 * Each entry is normalized through `parsePattern` / `parseClue` and dropped
 * if it fails validation, so a bad row in the dataset never crashes a
 * request.
 *
 * The pool is sorted by key (canonical order) and then shuffled with a
 * fixed app-wide seed so the daily index doesn't correlate with the
 * answer alphabet — neighboring days shouldn't pick "SEDATE" then "SEDATED".
 */

import { promises as fs } from "fs";
import path from "path";
import { createSeededRng } from "@/lib/daily";
import fallbackData from "./data/cryptic-fallback.json";
import { compactAnswer, parseClue, parsePattern } from "./parsing";
import type { CrypticEntry, RawClueValue } from "./types";

const DATA_FILE = path.join(process.cwd(), "data", "cryptic-clues.json");

const MIN_LETTERS = 4;
const MAX_LETTERS = 15;
const MAX_CLUE_LENGTH = 180;
const SHUFFLE_SEED = 0x1f87a3c5;

type PoolSource = "user" | "fallback";

interface CacheEntry {
  entries: CrypticEntry[];
  byKey: Map<string, CrypticEntry>;
  source: PoolSource;
  mtimeMs: number;
}

let cache: CacheEntry | null = null;

function isAnswerKey(key: string): boolean {
  return /^[A-Z][A-Z \-]*[A-Z]$/.test(key) || /^[A-Z]$/.test(key);
}

function isRawValue(value: unknown): value is RawClueValue {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.clue === "string" &&
    typeof v.pattern === "string" &&
    typeof v.wordplay === "string"
  );
}

function normalize(raw: unknown): CrypticEntry[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const out: CrypticEntry[] = [];
  for (const [rawKey, rawValue] of Object.entries(raw as Record<string, unknown>)) {
    const key = rawKey.trim();
    if (!isAnswerKey(key)) continue;
    if (!isRawValue(rawValue)) continue;

    const compact = compactAnswer(key);
    if (compact.length < MIN_LETTERS || compact.length > MAX_LETTERS) continue;

    const pattern = parsePattern(rawValue.pattern);
    if (pattern.segments.length === 0) continue;
    if (pattern.totalLetters !== compact.length) continue;

    const clue = rawValue.clue.trim();
    if (clue.length === 0 || clue.length > MAX_CLUE_LENGTH) continue;

    const parsedClue = parseClue(clue);
    if (parsedClue.defRanges.length === 0) continue;

    out.push({
      key,
      compact,
      clue,
      pattern: rawValue.pattern,
      wordplay: rawValue.wordplay.trim(),
    });
  }

  // Canonical order: lex by key, then a fixed-seed shuffle so the daily
  // index doesn't walk the alphabet.
  out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const rng = createSeededRng(SHUFFLE_SEED);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function buildCache(entries: CrypticEntry[], source: PoolSource, mtimeMs: number): CacheEntry {
  const byKey = new Map<string, CrypticEntry>();
  for (const e of entries) byKey.set(e.key, e);
  return { entries, byKey, source, mtimeMs };
}

async function loadPool(): Promise<CacheEntry> {
  let stat;
  try {
    stat = await fs.stat(DATA_FILE);
  } catch {
    stat = null;
  }

  if (!stat) {
    if (cache && cache.source === "fallback") return cache;
    const entries = normalize(fallbackData);
    cache = buildCache(entries, "fallback", 0);
    return cache;
  }

  if (cache && cache.source === "user" && cache.mtimeMs === stat.mtimeMs) {
    return cache;
  }

  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    const entries = normalize(parsed);
    if (entries.length === 0) {
      // File present but unusable — fall back rather than serve nothing.
      cache = buildCache(normalize(fallbackData), "fallback", 0);
      return cache;
    }
    cache = buildCache(entries, "user", stat.mtimeMs);
    return cache;
  } catch {
    cache = buildCache(normalize(fallbackData), "fallback", 0);
    return cache;
  }
}

export async function getPoolSize(): Promise<number> {
  return (await loadPool()).entries.length;
}

export async function getEntryByKey(key: string): Promise<CrypticEntry | null> {
  const pool = await loadPool();
  return pool.byKey.get(key) ?? null;
}

export async function getDailyEntry(seed: number): Promise<CrypticEntry | null> {
  const pool = await loadPool();
  if (pool.entries.length === 0) return null;
  const idx = ((seed % pool.entries.length) + pool.entries.length) % pool.entries.length;
  return pool.entries[idx];
}

export async function getRandomEntry(
  excludeKeys: ReadonlySet<string>
): Promise<CrypticEntry | null> {
  const pool = await loadPool();
  if (pool.entries.length === 0) return null;
  const candidates = pool.entries.filter((e) => !excludeKeys.has(e.key));
  if (candidates.length === 0) {
    // Player has seen everything — pick from the full pool.
    return pool.entries[Math.floor(Math.random() * pool.entries.length)];
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}
