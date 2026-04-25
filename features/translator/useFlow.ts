/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║ 📄  features/translator/useFlow.ts                                 ║
 * ║ 🏷️  version:  2.4.0                                                ║
 * ║ 📅  changed:  2026-04-23                                           ║
 * ║ 👥  author:   Solar Team · Leanid + Claude                         ║
 * ║                                                                    ║
 * ║ 🎯  PURPOSE — Dashka Sufler hook (Grok STT + 4-layer model)        ║
 * ║                                                                    ║
 * ║     Layer 1 RAW       — what Grok heard                            ║
 * ║     Layer 2 FLOW      — suggestions (optional, learning)           ║
 * ║     Layer 3 CLEAN     — composed sentence (Smart Direction = EN)   ║
 * ║     Layer 4 SPEAK     — handled in CleanBar (calls TTS)            ║
 * ║                                                                    ║
 * ║ 🔄 CHANGELOG                                                       ║
 * ║   v2.4   — + cleanText (Smart Direction → EN, capitalize, punct)   ║
 * ║          — + isNew flag on suggestions (auto-clear after 6s)       ║
 * ║          — Flow toggle default OFF (was: persisted state only)     ║
 * ║   v2.3.1 — Grok-only STT, mic mutex                                ║
 * ║   v2.3   — initial hybrid Web Speech + Grok                        ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FlowSuggestion } from "./types";

const CHUNK_SECONDS = 4;          // send to Grok every 4 seconds
const FLOW_DEBOUNCE_MS = 600;     // debounce flow analysis after STT update
const MAX_SUGGESTIONS = 5;        // keep last N (LRU)
const MAX_TRANSCRIPT_CHARS = 1500; // cap accumulated text passed to /api/flow

export interface UseFlowReturn {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  recording: boolean;             // true while mic is open
  suggestions: FlowSuggestion[];
  transcript: string;
  cleanText: string;              // v2.4: Smart Direction = EN, capitalized, punctuated
  error: string | null;
  clear: () => void;
}

export function useFlow(): UseFlowReturn {
  const [enabled, setEnabled] = useState(false);
  const [recording, setRecording] = useState(false);
  const [suggestions, setSuggestions] = useState<FlowSuggestion[]>([]);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const flushTimerRef = useRef<number | null>(null);
  const debounceRef = useRef<number | null>(null);
  const lastAnalyzedRef = useRef<string>("");
  const enabledRef = useRef(enabled);

  // Keep ref in sync so flush callback sees current value
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  /** Send accumulated transcript to /api/flow, merge suggestions (LRU) */
  const analyzeText = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || trimmed === lastAnalyzedRef.current) return;
    lastAnalyzedRef.current = trimmed;

    try {
      const tail = trimmed.length > MAX_TRANSCRIPT_CHARS
        ? trimmed.slice(-MAX_TRANSCRIPT_CHARS)
        : trimmed;

      const res = await fetch("/api/flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: tail }),
      });
      const data = await res.json();
      if (data?.status !== "ok") {
        setError(data?.message ?? "Flow error");
        return;
      }
      const incoming: FlowSuggestion[] = (data.suggestions ?? []).map(
        (s: FlowSuggestion) => ({ ...s, isNew: true })
      );
      if (incoming.length === 0) return;

      // Merge with dedupe (LRU). Existing suggestions lose isNew if duplicated.
      setSuggestions((prev) => {
        const seen = new Set<string>();
        const merged: FlowSuggestion[] = [];
        for (const s of [...incoming, ...prev]) {
          const key = `${s.original}|${s.translation}`.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(s);
          if (merged.length >= MAX_SUGGESTIONS) break;
        }
        return merged;
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    }
  }, []);

  const scheduleAnalyze = useCallback((text: string) => {
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void analyzeText(text);
    }, FLOW_DEBOUNCE_MS);
  }, [analyzeText]);

  /** Send accumulated audio chunks to /api/stt */
  const flushChunks = useCallback(async () => {
    if (chunksRef.current.length === 0) return;
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    chunksRef.current = [];

    if (blob.size < 2048) return; // skip too-small (mostly silence)

    const form = new FormData();
    form.append("language", "en");
    form.append("file", blob, `sufler-${Date.now()}.webm`);

    try {
      const res = await fetch("/api/stt", { method: "POST", body: form });
      const data = await res.json();
      if (data?.status === "ok" && data.text) {
        const newText = String(data.text).trim();
        if (newText) {
          setTranscript((prev) => {
            const combined = prev ? `${prev} ${newText}` : newText;
            // Cap memory — keep last N chars
            return combined.length > MAX_TRANSCRIPT_CHARS * 2
              ? combined.slice(-MAX_TRANSCRIPT_CHARS * 2)
              : combined;
          });
          scheduleAnalyze(newText);
        }
      } else if (data?.status === "error") {
        setError(data.message ?? "STT error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "STT network error");
    }
  }, [scheduleAnalyze]);

  /** Start microphone recording with chunk flushing */
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "audio/webm";

      const mr = new MediaRecorder(stream, { mimeType });
      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      mr.start(1000); // emit chunks every 1 second
      mediaRecorderRef.current = mr;

      // Periodic flush to /api/stt
      flushTimerRef.current = window.setInterval(() => {
        if (enabledRef.current) void flushChunks();
      }, CHUNK_SECONDS * 1000);

      setRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone access denied");
      setEnabled(false); // user-visible state goes back to "off"
    }
  }, [flushChunks]);

  /** Stop microphone, flush final chunk */
  const stopRecording = useCallback(() => {
    if (flushTimerRef.current !== null) {
      window.clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (mediaRecorderRef.current) {
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
      mediaRecorderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    chunksRef.current = [];
    setRecording(false);
  }, []);

  /** Effect: react to `enabled` toggle */
  useEffect(() => {
    if (enabled) {
      void startRecording();
    } else {
      stopRecording();
    }
    return () => stopRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  /** Auto-clear isNew flags 6s after suggestions update */
  useEffect(() => {
    if (suggestions.length === 0) return;
    const hasNew = suggestions.some((s) => s.isNew);
    if (!hasNew) return;
    const timer = window.setTimeout(() => {
      setSuggestions((prev) => prev.map((s) => ({ ...s, isNew: false })));
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [suggestions]);

  /** v2.4: Build CLEAN sentence — Smart Direction = English */
  const cleanText = buildCleanSentence(transcript, suggestions);

  const clear = useCallback(() => {
    setSuggestions([]);
    setTranscript("");
    setError(null);
    lastAnalyzedRef.current = "";
  }, []);

  return {
    enabled,
    setEnabled,
    recording,
    suggestions,
    transcript,
    cleanText,
    error,
    clear,
  };
}

/* ─── Clean sentence builder (v2.4) ───────────────────────────────── */

/**
 * Smart Direction = English. Replaces RU words found in `raw` with their
 * EN translations from `suggestions`. Then capitalize first letter and
 * append punctuation if missing.
 *
 * Rules:
 *  - Only Russian-sourced suggestions are applied (we want English output)
 *  - Whole-word match, case-insensitive
 *  - Preserves spacing
 *  - Trims trailing/leading whitespace
 *  - Capitalizes first letter
 *  - Adds "." if no terminal punctuation [.!?]
 */
function buildCleanSentence(raw: string, suggestions: FlowSuggestion[]): string {
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
