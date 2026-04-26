/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║ 📄  features/translator/cleanEngine.ts                             ║
 * ║ 🏷️  version:  2.6.1                                                ║
 * ║ 📅  changed:  2026-04-25                                           ║
 * ║ 👥  author:   Solar Team · Leanid + Claude + Dashka                ║
 * ║                                                                    ║
 * ║ 🎯  PURPOSE — CLEAN engine (shared brain for Sufler + Pane)        ║
 * ║                                                                    ║
 * ║     ARCHITECTURAL PRINCIPLE (Dashka v2.6.1):                       ║
 * ║       "CLEAN — единый источник истины для ВСЕХ слоёв UI"           ║
 * ║                                                                    ║
 * ║     INPUT:  raw STT transcript (mixed RU/EN, casual)               ║
 * ║     OUTPUT: clean English sentence (capitalized, punctuated)       ║
 * ║                                                                    ║
 * ║     PIPELINE:                                                      ║
 * ║       raw → /api/flow → suggestions → buildCleanSentence → CLEAN   ║
 * ║                                                                    ║
 * ║ 🔄 CHANGELOG                                                       ║
 * ║   v2.6.1 — Extracted from useFlow.ts (was private)                 ║
 * ║          — Now reusable by usePane.ts (Variant 2)                  ║
 * ║          — Added analyzeAndClean() — full pipeline in one call     ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import type { FlowSuggestion } from "./types";

interface FlowResponse {
  status?: "ok" | "error";
  suggestions?: FlowSuggestion[];
  message?: string;
}

/**
 * Build a clean English sentence from raw transcript + suggestions.
 *
 * Strategy:
 *  - Apply RU → EN word replacements
 *  - Whole-word match, case-insensitive
 *  - Preserves spacing
 *  - Trims trailing/leading whitespace
 *  - Capitalizes first letter
 *  - Adds "." if no terminal punctuation [.!?]
 */
export function buildCleanSentence(
  raw: string,
  suggestions: FlowSuggestion[]
): string {
  if (!raw.trim()) return "";

  let text = raw.trim();

  // Apply RU → EN replacements (Smart Direction = EN)
  for (const s of suggestions) {
    if (s.sourceLanguage !== "ru") continue;
    if (!s.original || !s.translation) continue;

    // Whole-word, case-insensitive replace.
    // Russian words use Cyrillic, so \b doesn't match them — use lookarounds.
    const escaped = s.original.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    try {
      const re = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "giu");
      text = text.replace(re, s.translation);
    } catch {
      // Fallback for environments without lookbehind
      text = text.replace(new RegExp(escaped, "gi"), s.translation);
    }
  }

  // Collapse multiple spaces
  text = text.replace(/\s+/g, " ").trim();
  if (!text) return "";

  // Capitalize first letter (handles unicode)
  text = text.charAt(0).toUpperCase() + text.slice(1);

  // Append "." if no terminal punctuation
  if (!/[.!?]$/.test(text)) {
    text += ".";
  }

  return text;
}

/**
 * Full CLEAN pipeline: raw transcript → CLEAN English sentence.
 *
 * Used by Pane (Variant 2 — independent CLEAN, no Flow dependency).
 *
 * Calls /api/flow internally to get suggestions, then applies them.
 *
 * @param raw  — raw transcript from STT (may be mixed RU/EN)
 * @returns    — { cleanText, suggestions } — both for caller use
 */
export async function analyzeAndClean(raw: string): Promise<{
  cleanText: string;
  suggestions: FlowSuggestion[];
}> {
  const text = raw.trim();
  if (!text) return { cleanText: "", suggestions: [] };

  // If text has no Cyrillic at all → already English-ish, just clean format
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

  // Fallback: just format the raw text (capitalize + period)
  return {
    cleanText: buildCleanSentence(text, []),
    suggestions: [],
  };
}
