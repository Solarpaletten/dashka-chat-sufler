/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║ 📄  features/translator/useFlow.ts                                 ║
 * ║ 🏷️  version:  2.5.1                                                ║
 * ║ 📅  changed:  2026-04-25                                           ║
 * ║ 👥  author:   Solar Team · Leanid + Claude                         ║
 * ║                                                                    ║
 * ║ 🎯  PURPOSE — Dashka Sufler hook (Whisper STT + 4-layer model)     ║
 * ║                                                                    ║
 * ║ 🔄 CHANGELOG                                                       ║
 * ║   v2.5.1 — record audio/mp4 by default (Whisper-friendly)          ║
 * ║          — fallback chain: mp4 → ogg → webm                        ║
 * ║          — filename extension matches actual codec                 ║
 * ║          — increased min chunk size to handle WebM header issue    ║
 * ║   v2.4   — + cleanText (Smart Direction → EN, capitalize, punct)   ║
 * ║   v2.3.1 — Grok-only STT, mic mutex                                ║
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
    const recorder = mediaRecorderRef.current;
    const recordedMime = recorder?.mimeType || "audio/webm";
    const blob = new Blob(chunksRef.current, { type: recordedMime });
    chunksRef.current = [];

    // Skip too-small chunks — broken WebM headers, or just silence
    if (blob.size < 8192) return;

    // Pick filename extension that MATCHES the actual codec.
    // Whisper uses extension to identify format — wrong ext = 400 error.
    const ext = recordedMime.includes("mp4") ? "mp4"
              : recordedMime.includes("m4a") ? "m4a"
              : recordedMime.includes("ogg") ? "ogg"
              : recordedMime.includes("mpeg") ? "mp3"
              : recordedMime.includes("webm") ? "webm"
              : "webm";

    const form = new FormData();
    // Don't send language — Whisper auto-detects mixed RU/EN best
    form.append("file", blob, `sufler-${Date.now()}.${ext}`);

    try {
      const res = await fetch("/api/stt", { method: "POST", body: form });
      const data = await res.json();
      if (data?.status === "ok" && data.text) {
        const newText = String(data.text).trim();
        if (newText) {
          setTranscript((prev) => {
            const combined = prev ? `${prev} ${newText}` : newText;
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

      // Prefer Whisper-friendly mime types in order:
      //  1. audio/mp4 — Safari, modern Chrome — universal
      //  2. audio/ogg + opus — Firefox
      //  3. audio/webm — Chrome legacy — works but headers can be quirky
      const candidates = [
        "audio/mp4",
        "audio/mp4;codecs=mp4a.40.2",
        "audio/ogg;codecs=opus",
        "audio/webm;codecs=opus",
        "audio/webm",
      ];
      const mimeType = candidates.find((m) => MediaRecorder.isTypeSupported(m))
        ?? "audio/webm";

      const mr = new MediaRecorder(stream, { mimeType });

      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      // CRITICAL: Don't pass timeslice to start() — that produces incomplete
      // WebM/MP4 chunks with broken headers that Whisper can't parse.
      // Instead: stop and restart recorder every CHUNK_SECONDS to get
      // complete files with proper headers.
      mr.start();
      mediaRecorderRef.current = mr;

      // Periodic stop+restart cycle to get complete audio files
      flushTimerRef.current = window.setInterval(() => {
        if (!enabledRef.current) return;
        const currentMr = mediaRecorderRef.current;
        if (currentMr && currentMr.state === "recording") {
          // Stopping fires final ondataavailable with complete file
          currentMr.stop();
          // Process and restart on next tick
          window.setTimeout(() => {
            if (!enabledRef.current) return;
            void flushChunks();
            const newMr = new MediaRecorder(stream, { mimeType });
            newMr.ondataavailable = (ev) => {
              if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
            };
            newMr.start();
            mediaRecorderRef.current = newMr;
          }, 50);
        }
      }, CHUNK_SECONDS * 1000);

      setRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone access denied");
      setEnabled(false);
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
