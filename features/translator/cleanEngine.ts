/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║ 📄  features/translator/cleanEngine.ts                             ║
 * ║ 🏷️  version:  2.7.1                                                ║
 * ║ 📅  changed:  2026-04-26                                           ║
 * ║ 👥  author:   Solar Team · Leanid + Claude + Dashka                ║
 * ║                                                                    ║
 * ║ 🎯  PURPOSE — Sentence Reconstruction Engine (NOT replace engine!) ║
 * ║                                                                    ║
 * ║     ARCHITECTURAL EVOLUTION (Dashka):                              ║
 * ║       v2.6.1 — string replacement engine ❌                        ║
 * ║       v2.7.0 — sentence reconstruction engine ✅                   ║
 * ║       v2.7.1 — + grammar polish rules (chain verbs, articles)      ║
 * ║                                                                    ║
 * ║     PIPELINE:                                                      ║
 * ║       raw                                                          ║
 * ║         ↓ apply common RU→EN phrasebook (long phrases first)       ║
 * ║         ↓ apply Flow suggestions (per-word RU→EN)                  ║
 * ║         ↓ normalizeMixedSentence (drop unknown Russian)            ║
 * ║         ↓ semanticDedupe (Hello hello → Hello)                     ║
 * ║         ↓ grammarPolish (v2.7.1 — fix chain verbs, articles)       ║
 * ║         ↓ capitalize + punctuate                                   ║
 * ║       CLEAN English sentence                                        ║
 * ║                                                                    ║
 * ║ 🔄 CHANGELOG                                                       ║
 * ║   v2.7.1 — grammarPolish — fix common natural-speech issues:       ║
 * ║          - "wanted to ask discuss" → "wanted to discuss"           ║
 * ║          - "discuss access" → "discuss the access"                 ║
 * ║          - "hello how are you" → "Hello, how are you"              ║
 * ║          - + 10 more idiomatic patterns                            ║
 * ║   v2.7.0 — Sentence reconstruction (Dashka brain v2)               ║
 * ║   v2.6.1 — Extracted from useFlow.ts (was private)                 ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import type { FlowSuggestion } from "./types";

interface FlowResponse {
  status?: "ok" | "error";
  suggestions?: FlowSuggestion[];
  message?: string;
}

/* ─── Common RU→EN phrasebook ─────────────────────────────────────── */
/**
 * Frequent phrases that appear in casual conversation.
 * Long phrases are matched FIRST (greedy match) so "хотел спросить"
 * doesn't get partially replaced as "wanted to ask" + "ask".
 */
const COMMON_RU_TO_EN: Record<string, string> = {
  // Greetings / partings
  "здравствуйте": "hello",
  "здравствуй": "hello",
  "привет": "hello",
  "добрый день": "good day",
  "доброе утро": "good morning",
  "добрый вечер": "good evening",
  "спокойной ночи": "good night",
  "до свидания": "goodbye",
  "пока": "bye",
  "увидимся": "see you",

  // Politeness
  "спасибо": "thank you",
  "большое спасибо": "thank you very much",
  "пожалуйста": "please",
  "извините": "excuse me",
  "простите": "sorry",

  // Status / agreement
  "как дела": "how are you",
  "как у вас": "how are you",
  "как у вас дела": "how are you",
  "как ты": "how are you",
  "хорошо": "good",
  "отлично": "great",
  "плохо": "bad",
  "нормально": "okay",
  "понял": "understood",
  "поняла": "understood",
  "ясно": "I see",
  "конечно": "of course",
  "да": "yes",
  "нет": "no",

  // Business common
  "обсудить": "discuss",
  "доступ": "access",
  "аккаунт": "account",
  "проект": "project",
  "встреча": "meeting",
  "договор": "contract",
  "клиент": "client",
  "отчёт": "report",
  "наш": "our",
  "наша": "our",
  "наше": "our",
  "наши": "our",

  // Common verbs
  "хотел спросить": "I wanted to ask",
  "хотела спросить": "I wanted to ask",
  "хочу спросить": "I want to ask",
  "хотел бы": "I would like",
  "хотела бы": "I would like",
  "не понимаю": "I don't understand",
  "не знаю": "I don't know",
  "помогите": "help me",
};

/* ─── Helpers ─────────────────────────────────────────────────────── */

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function capitalize(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Drop standalone Russian words that weren't translated by phrasebook
 * or suggestions. Keeps the structure of the sentence.
 */
function normalizeMixedSentence(
  text: string,
  dict: Record<string, string>
): string {
  const words = text.split(/\s+/);
  const result: string[] = [];

  for (const w of words) {
    const lower = w.toLowerCase();
    const stripped = lower.replace(/[.,!?;:"'()]/g, "");

    if (/[а-яё]/i.test(w)) {
      // Russian word survived — try one more lookup
      const translated = dict[stripped];
      if (translated) {
        result.push(translated);
      }
      // Otherwise: drop the unknown Russian word
      continue;
    }

    result.push(w);
  }

  return result.join(" ");
}

/**
 * Collapse consecutive duplicates that often arise from STT hallucinations
 * or repetitive phrasing.
 *
 * Examples:
 *   "Hello hello" → "Hello"
 *   "Thank you thank you" → "Thank you"
 *   "Hello, how are you. Hello, how are you." → "Hello, how are you."
 */
function semanticDedupe(text: string): string {
  let t = text;

  // Multi-word patterns first
  t = t.replace(/(hello[, ]+how are you[.,!?]*)\s*\1/gi, "$1");
  t = t.replace(/(thank you[.,!?]*)\s*\1/gi, "$1");
  t = t.replace(/(bye[, ]*bye[.,!?]*)\s*\1/gi, "$1");

  // Common single-word reduplications
  t = t.replace(/\b(hello|hi)\s+\1\b/gi, "$1");
  t = t.replace(/\b(thank you)\s+\1\b/gi, "$1");
  t = t.replace(/\b(yeah)\s+\1\b/gi, "$1");
  t = t.replace(/\b(yes)\s+\1\b/gi, "$1");
  t = t.replace(/\b(no)\s+\1\b/gi, "$1");

  // Generic adjacent duplicate words (same word twice)
  t = t.replace(/\b(\w+)\s+\1\b/gi, "$1");

  return t;
}

/**
 * Grammar polish — fix common rule-based grammar issues that arise
 * from word-by-word phrasebook substitution.
 *
 * v2.7.1: Initial polish ruleset (Dashka).
 *
 * Examples:
 *   "I wanted to ask discuss access" → "I wanted to discuss the access"
 *   "hello how are you" → "Hello, how are you"
 */
function grammarPolish(text: string): string {
  let t = text;

  /* ─── Chain verbs: "wanted to ask discuss" → "wanted to discuss" ── */
  // When two verbs collide after phrasebook expansion, drop "ask"
  t = t.replace(/\bI wanted to ask discuss\b/gi, "I wanted to discuss");
  t = t.replace(/\bI want to ask discuss\b/gi, "I want to discuss");
  t = t.replace(/\bI wanted to ask tell\b/gi, "I wanted to tell");
  t = t.replace(/\bI wanted to ask see\b/gi, "I wanted to see");

  /* ─── Article fixes: "discuss access" → "discuss the access" ────── */
  t = t.replace(/\bdiscuss access\b/gi, "discuss the access");
  t = t.replace(/\bdiscuss account\b/gi, "discuss the account");
  t = t.replace(/\bdiscuss project\b/gi, "discuss the project");
  t = t.replace(/\bdiscuss contract\b/gi, "discuss the contract");
  t = t.replace(/\bdiscuss meeting\b/gi, "discuss the meeting");
  t = t.replace(/\bdiscuss report\b/gi, "discuss the report");

  /* ─── "About X" article fix ─────────────────────────────────────── */
  t = t.replace(/\babout access\b/gi, "about the access");
  t = t.replace(/\babout account\b/gi, "about the account");
  t = t.replace(/\babout project\b/gi, "about the project");

  /* ─── Punctuation polish ────────────────────────────────────────── */
  // "hello how are you" → "Hello, how are you"
  t = t.replace(/\bhello how are you\b/gi, "Hello, how are you");
  t = t.replace(/\bhi how are you\b/gi, "Hi, how are you");

  // "thank you bye" → "Thank you. Bye"
  t = t.replace(/\bthank you bye\b/gi, "Thank you. Bye");

  // "hello thank you" → "Hello. Thank you"
  t = t.replace(/\bhello thank you\b/gi, "Hello. Thank you");

  /* ─── Polite chain: "I would like discuss" → "I would like to discuss" */
  t = t.replace(/\bI would like discuss\b/gi, "I would like to discuss");
  t = t.replace(/\bI would like ask\b/gi, "I would like to ask");
  t = t.replace(/\bI would like see\b/gi, "I would like to see");

  return t;
}

/* ─── Main brain function ─────────────────────────────────────────── */

/**
 * Build a clean English sentence from raw transcript + suggestions.
 *
 * Strategy (sentence reconstruction, NOT word replacement):
 *  1. Apply common RU→EN phrasebook (long phrases first — greedy)
 *  2. Apply Flow suggestions (per-word RU→EN from OpenAI)
 *  3. Normalize mixed: drop unknown Russian words
 *  4. Deduplicate semantic repetitions
 *  5. Capitalize + punctuate
 */
export function buildCleanSentence(
  raw: string,
  suggestions: FlowSuggestion[]
): string {
  if (!raw.trim()) return "";

  let text = raw.trim();

  // 1. Apply phrasebook — long phrases first to avoid partial matches
  const sortedDict = Object.entries(COMMON_RU_TO_EN)
    .sort((a, b) => b[0].length - a[0].length);

  for (const [ru, en] of sortedDict) {
    const escaped = escapeReg(ru);
    try {
      const re = new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, "giu");
      text = text.replace(re, en);
    } catch {
      text = text.replace(new RegExp(escaped, "gi"), en);
    }
  }

  // 2. Apply Flow suggestions (per-word, only RU sources)
  for (const s of suggestions) {
    if (s.sourceLanguage !== "ru") continue;
    if (!s.original || !s.translation) continue;

    const escaped = escapeReg(s.original);
    try {
      const re = new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, "giu");
      text = text.replace(re, s.translation);
    } catch {
      text = text.replace(new RegExp(escaped, "gi"), s.translation);
    }
  }

  // 3. Normalize mixed — drop any leftover unknown Russian words
  text = normalizeMixedSentence(text, COMMON_RU_TO_EN);

  // 4. Semantic deduplication
  text = semanticDedupe(text);

  // 5. Grammar polish (v2.7.1) — fix chain verbs, articles, punctuation
  text = grammarPolish(text);

  // 6. Final cleanup
  text = text.replace(/\s+([,.!?;:])/g, "$1");          // remove space before punct
  text = text.replace(/([,.!?;:])([^\s,.!?;:])/g, "$1 $2"); // ensure space after punct
  text = text.replace(/\s+/g, " ").trim();

  if (!text) return "";

  text = capitalize(text);
  if (!/[.!?]$/.test(text)) text += ".";

  return text;
}

/**
 * Full CLEAN pipeline: raw transcript → CLEAN English sentence.
 *
 * Used by Pane (Variant 2 — independent CLEAN, no Flow dependency).
 */
export async function analyzeAndClean(raw: string): Promise<{
  cleanText: string;
  suggestions: FlowSuggestion[];
}> {
  const text = raw.trim();
  if (!text) return { cleanText: "", suggestions: [] };

  // If text has no Cyrillic at all → already English-ish, brain still
  // applies phrasebook (no-op for EN) + dedupe + capitalize
  const hasCyrillic = /[\u0400-\u04FF]/.test(text);
  if (!hasCyrillic) {
    return {
      cleanText: buildCleanSentence(text, []),
      suggestions: [],
    };
  }

  try {
    const res = await fetch("/api/flow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = (await res.json()) as FlowResponse;

    if (data?.status === "ok" && Array.isArray(data.suggestions)) {
      return {
        cleanText: buildCleanSentence(text, data.suggestions),
        suggestions: data.suggestions,
      };
    }
  } catch {
    // Network/parse error — fall through to plain clean
  }

  // Fallback: brain still applies phrasebook + dedupe even without suggestions
  return {
    cleanText: buildCleanSentence(text, []),
    suggestions: [],
  };
}
