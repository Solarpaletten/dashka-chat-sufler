/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║ 📄  features/translator/useFlow.ts                                 ║
 * ║ 🏷️  version:  2.3.0                                                ║
 * ║ 📅  created:  2026-04-23                                           ║
 * ║ 👥  author:   Solar Team · Leanid + Claude                         ║
 * ║                                                                    ║
 * ║ 🎯  PURPOSE — Dashka Flow hook                                     ║
 * ║     Manages microphone → STT (Web Speech или Grok) → /api/flow    ║
 * ║     → suggestions (last 3, LRU)                                    ║
 * ║                                                                    ║
 * ║     Hybrid STT strategy:                                           ║
 * ║     - Chrome/Edge Desktop + Android → Web Speech API (FREE)        ║
 * ║     - Safari iPhone/iPad/Mac + Firefox → Grok STT (via /api/stt)   ║
 * ║                                                                    ║
 * ║ 🔄 CHANGELOG                                                       ║
 * ║   v2.3 — initial: hybrid STT + flow analysis                       ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FlowSuggestion, SttEngine } from "./types";

/* global SpeechRecognition */
type SpeechRecognitionResultsType = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SpeechRecognitionType = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionResultsType) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionType;

const MAX_SUGGESTIONS = 3;          // LRU cap
const FLOW_DEBOUNCE_MS = 800;       // debounce before analyzing transcript
const GROK_CHUNK_SECONDS = 4;       // audio chunk size for Grok STT

/** Detect which STT engine to use based on browser capabilities */
function detectEngine(): SttEngine {
  if (typeof window === "undefined") return "grok";
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  const hasWebSpeech = Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);

  // Safari (iPhone/Mac) declares webkitSpeechRecognition but continuous mode is flaky.
  // Use Grok STT for Safari for reliability.
  const ua = navigator.userAgent;
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);

  if (isSafari) return "grok";
  if (hasWebSpeech) return "web-speech";
  return "grok";
}

export interface UseFlowOptions {
  /** Language of the "host" conversation, e.g. "DE" */
  targetLanguage: string;
  /** Force a specific engine (overrides auto-detect) */
  forceEngine?: SttEngine;
}

export interface UseFlowReturn {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  recording: boolean;
  engine: SttEngine;
  suggestions: FlowSuggestion[];
  transcript: string;
  error: string | null;
  clear: () => void;
}

export function useFlow({ targetLanguage, forceEngine }: UseFlowOptions): UseFlowReturn {
  const [enabled, setEnabled] = useState(false);
  const [recording, setRecording] = useState(false);
  const [engine, setEngine] = useState<SttEngine>("web-speech");
  const [suggestions, setSuggestions] = useState<FlowSuggestion[]>([]);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const debounceRef = useRef<number | null>(null);
  const lastAnalyzedRef = useRef<string>("");

  // Engine detection on mount
  useEffect(() => {
    setEngine(forceEngine ?? detectEngine());
  }, [forceEngine]);

  /** Send accumulated transcript to /api/flow, merge suggestions (LRU) */
  const analyzeText = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || trimmed === lastAnalyzedRef.current) return;
    lastAnalyzedRef.current = trimmed;

    try {
      const res = await fetch("/api/flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, targetLanguage }),
      });
      const data = await res.json();
      if (data?.status !== "ok") {
        setError(data?.message ?? "Flow error");
        return;
      }
      const incoming: FlowSuggestion[] = data.suggestions ?? [];
      if (incoming.length === 0) return;

      // Merge: keep last MAX_SUGGESTIONS, dedupe by original+german
      setSuggestions((prev) => {
        const seen = new Set<string>();
        const merged: FlowSuggestion[] = [];
        // New first (newest on top)
        for (const s of [...incoming, ...prev]) {
          const key = `${s.original}|${s.german}`.toLowerCase();
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
  }, [targetLanguage]);

  /** Debounced analyze — called from STT onresult */
  const scheduleAnalyze = useCallback((text: string) => {
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void analyzeText(text);
    }, FLOW_DEBOUNCE_MS);
  }, [analyzeText]);

  /** Start Web Speech API recognition */
  const startWebSpeech = useCallback(() => {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setError("Web Speech API not supported");
      return false;
    }

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    // Use target language locale — lets native words come through cleanly.
    // Foreign-language interjections will arrive as best-effort transliteration
    // but OpenAI /api/flow still identifies them as non-target words.
    rec.lang = targetToLocale(targetLanguage);

    let fullTranscript = "";

    rec.onresult = (e: SpeechRecognitionResultsType) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0].transcript;
        if (r.isFinal) fullTranscript += text + " ";
        else interim += text;
      }
      const combined = (fullTranscript + interim).trim();
      setTranscript(combined);
      if (combined) scheduleAnalyze(combined);
    };

    rec.onerror = (ev) => {
      if (ev.error !== "no-speech" && ev.error !== "aborted") {
        setError(`STT: ${ev.error}`);
      }
    };

    rec.onend = () => {
      // Auto-restart if still enabled (continuous recognition can time out)
      if (recognitionRef.current === rec && enabled) {
        try { rec.start(); } catch { /* ignore */ }
      }
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setRecording(true);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "STT start failed");
      return false;
    }
  }, [enabled, targetLanguage, scheduleAnalyze]);

  /** Start Grok STT (MediaRecorder → chunks → /api/stt) */
  const startGrokStt = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mr = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      // Every GROK_CHUNK_SECONDS: send accumulated audio to /api/stt
      const flushInterval = window.setInterval(async () => {
        if (chunksRef.current.length === 0) return;
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        chunksRef.current = [];

        const form = new FormData();
        form.append("file", blob, `flow-${Date.now()}.webm`);

        try {
          const res = await fetch("/api/stt", { method: "POST", body: form });
          const data = await res.json();
          if (data?.status === "ok" && data.text) {
            const text = String(data.text).trim();
            if (text) {
              setTranscript((prev) => (prev ? prev + " " : "") + text);
              scheduleAnalyze(text);
            }
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "STT network error");
        }
      }, GROK_CHUNK_SECONDS * 1000);

      // Save interval id for cleanup (via weak ref on MR)
      (mr as unknown as { __flushId?: number }).__flushId = flushInterval;

      mr.start(1000); // emit chunks every 1s
      mediaRecorderRef.current = mr;
      setRecording(true);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone access denied");
      return false;
    }
  }, [scheduleAnalyze]);

  /** Stop all listening */
  const stopAll = useCallback(() => {
    setRecording(false);
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    // Web Speech
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    // Grok STT
    if (mediaRecorderRef.current) {
      const mr = mediaRecorderRef.current;
      const flushId = (mr as unknown as { __flushId?: number }).__flushId;
      if (flushId) window.clearInterval(flushId);
      try { mr.stop(); } catch { /* ignore */ }
      mediaRecorderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  /** Effect: start/stop based on `enabled` */
  useEffect(() => {
    if (!enabled) {
      stopAll();
      return;
    }
    if (engine === "web-speech") {
      startWebSpeech();
    } else {
      void startGrokStt();
    }
    return () => stopAll();
  }, [enabled, engine, startWebSpeech, startGrokStt, stopAll]);

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
    engine,
    suggestions,
    transcript,
    error,
    clear,
  };
}

/** Map our LangCode → BCP-47 speech locale */
function targetToLocale(lang: string): string {
  const map: Record<string, string> = {
    DE: "de-DE", EN: "en-US", PL: "pl-PL", ZH: "zh-CN",
    FR: "fr-FR", IT: "it-IT", ES: "es-ES",
    LV: "lv-LV", LT: "lt-LT", UA: "uk-UA",
    RU: "ru-RU",
  };
  return map[lang] ?? "de-DE";
}
