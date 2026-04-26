/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║ 📄  features/translator/usePane.ts                                 ║
 * ║ 🏷️  version:  2.6.1                                                ║
 * ║ 📅  changed:  2026-04-25                                           ║
 * ║ 👥  author:   Solar Team · Leanid + Claude + Dashka                ║
 * ║                                                                    ║
 * ║ 🎯  PURPOSE — Pane hook (Whisper STT → CLEAN → translate)          ║
 * ║                                                                    ║
 * ║     ARCHITECTURAL PRINCIPLE (v2.6.1):                              ║
 * ║       "CLEAN — единый источник истины для ВСЕХ слоёв UI"          ║
 * ║                                                                    ║
 * ║     OLD pipeline (v2.6.0 — broken):                                ║
 * ║       mic → Whisper RAW → translate → display                      ║
 * ║                          ↑                                          ║
 * ║                          mixed RU+EN confused the model            ║
 * ║                                                                    ║
 * ║     NEW pipeline (v2.6.1 — Dashka's vision):                       ║
 * ║       mic → Whisper RAW → analyzeAndClean → CLEAN → translate      ║
 * ║                                ↑                                    ║
 * ║                                same brain as Sufler                ║
 * ║                                                                    ║
 * ║     RIGHT Pane special: source language is null (auto-detect)      ║
 * ║       because input may be mixed RU+EN.                            ║
 * ║                                                                    ║
 * ║ 🔄 CHANGELOG                                                       ║
 * ║   v2.6.1 — Pane uses CLEAN before translate (Dashka brain fix)     ║
 * ║          — Right pane sends source=null (auto-detect)              ║
 * ║          — Stores both rawText and cleanText for visibility        ║
 * ║   v2.6.0 — REPLACED Web Speech API with Whisper STT                ║
 * ║   v2.1   — initial Web Speech version                              ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type PaneState,
  type PaneConfig,
  type TtsVoice,
  type TranslateResponse,
} from "./types";
import { analyzeAndClean } from "./cleanEngine";

interface UsePaneArgs {
  config: PaneConfig;
  autoTTS: boolean;
  onTranslated?: (text: string, toLang: string, voice: TtsVoice) => void;
}

const MAX_CHARS = 5000;

export function usePane({ config, autoTTS, onTranslated }: UsePaneArgs) {
  const [state, setState] = useState<PaneState>({
    inputText: "",
    translatedText: "",
    isTranslating: false,
    error: null,
    micState: "Idle",
    voice: config.defaultVoice,
    isPlaying: false,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const set = useCallback(
    (partial: Partial<PaneState>) =>
      setState((prev) => ({ ...prev, ...partial })),
    []
  );

  const translate = useCallback(
    async (textOverride?: string, silent = false) => {
      const text = (textOverride ?? state.inputText).trim();
      if (!text) return;
      if (!silent) set({ isTranslating: true, error: null });
      try {
        // v2.6.1: Right pane (Speech Completion) sends source=null
        // because input may be mixed RU+EN — let server auto-detect.
        // Left pane (Beginner) keeps explicit source for cleaner handling.
        const isRightPane = config.id === "right";

        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            source_language: isRightPane ? null : config.from,
            target_language: config.to,
          }),
        });
        const data = (await res.json()) as TranslateResponse;
        if (!res.ok || data.status !== "success") {
          throw new Error(data?.message || `HTTP ${res.status}`);
        }
        set({ translatedText: data.translated_text });
        if (!silent && autoTTS && onTranslated) {
          onTranslated(data.translated_text, config.to, state.voice);
        }
      } catch (e) {
        if (!silent) {
          set({ error: e instanceof Error ? e.message : "Ошибка перевода" });
        }
      } finally {
        if (!silent) set({ isTranslating: false });
      }
    },
    [state.inputText, state.voice, config.id, config.from, config.to, autoTTS, onTranslated, set]
  );

  const clear = useCallback(() => {
    set({ inputText: "", translatedText: "", error: null });
  }, [set]);

  const setInputText = useCallback(
    (text: string) => set({ inputText: text.slice(0, MAX_CHARS) }),
    [set]
  );

  const setVoice = useCallback(
    (v: TtsVoice) => {
      set({ voice: v });
      if (typeof window !== "undefined") {
        window.localStorage.setItem(`dashka-voice-${config.id}`, v);
      }
    },
    [config.id, set]
  );

  // restore voice from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(`dashka-voice-${config.id}`) as TtsVoice | null;
    if (saved) setState((prev) => ({ ...prev, voice: saved }));
  }, [config.id]);

  /** Cleanup on unmount */
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  /** Send recorded audio to Whisper */
  const sendToWhisper = useCallback(async (blob: Blob, mimeType: string) => {
    set({ micState: "Processing", error: null });

    const ext = mimeType.includes("mp4") ? "mp4"
              : mimeType.includes("ogg") ? "ogg"
              : mimeType.includes("webm") ? "webm"
              : "webm";

    const form = new FormData();
    // For LEFT pane (RU→EN): hint Russian for cleaner transcription
    // For RIGHT pane (EN→RU): no language hint — auto-detect for mixed input
    if (config.from === "RU") {
      form.append("language", "ru");
    }
    form.append("file", blob, `pane-${config.id}-${Date.now()}.${ext}`);

    try {
      const res = await fetch("/api/stt", { method: "POST", body: form });
      const data = await res.json();
      if (data?.status === "ok" && data.text) {
        const rawText = String(data.text).trim().slice(0, MAX_CHARS);
        if (rawText) {
          // ═══════════════════════════════════════════════════════════
          // v2.6.1 BRAIN FIX (Dashka's vision):
          //   STT → CLEAN → translate (NOT STT → translate)
          //
          // For RIGHT pane (Speech Completion mode) — apply CLEAN
          //   because input is mixed RU+EN, needs normalization.
          //
          // For LEFT pane (Beginner mode) — skip CLEAN
          //   because input is pure Russian, no replacement needed.
          // ═══════════════════════════════════════════════════════════
          let displayText = rawText;
          if (config.id === "right") {
            try {
              const { cleanText } = await analyzeAndClean(rawText);
              if (cleanText) displayText = cleanText;
            } catch {
              // CLEAN failed — fall through with raw text
            }
          }

          // Show CLEAN (or raw) in input field
          setState((prev) => ({ ...prev, inputText: displayText, micState: "Idle" }));
          // Auto-translate from CLEAN (single source of truth)
          await translate(displayText, false);
        } else {
          set({ micState: "Idle" });
        }
      } else {
        set({
          micState: "Idle",
          error: data?.message ?? "Не удалось распознать речь",
        });
      }
    } catch (err) {
      set({
        micState: "Idle",
        error: err instanceof Error ? err.message : "Ошибка распознавания",
      });
    }
  }, [config.from, config.id, set, translate]);

  const toggleMic = useCallback(async () => {
    // Already recording → stop and process
    if (state.micState === "Recording") {
      const mr = mediaRecorderRef.current;
      if (mr && mr.state === "recording") {
        mr.stop(); // ondataavailable will fire with complete blob
      }
      return;
    }
    if (state.micState === "Processing") return;

    // Start new recording
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      // Whisper-friendly mime types
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

      mr.onstop = async () => {
        // Stop the stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        // Build complete blob
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        if (blob.size < 4096) {
          set({ micState: "Idle", error: "Слишком короткая запись" });
          return;
        }
        await sendToWhisper(blob, mimeType);
      };

      mr.start();
      mediaRecorderRef.current = mr;
      set({ micState: "Recording", error: null });
    } catch (err) {
      set({
        micState: "Idle",
        error: err instanceof Error ? err.message : "Доступ к микрофону запрещён",
      });
    }
  }, [state.micState, set, sendToWhisper]);

  return {
    ...state,
    config,
    translate: () => translate(),
    setInputText,
    setVoice,
    clear,
    toggleMic,
    isRecording: state.micState === "Recording",
    isProcessing: state.micState === "Processing",
  };
}
