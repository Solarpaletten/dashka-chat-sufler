/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║ 📄  features/translator/CleanBar.tsx                               ║
 * ║ 🏷️  version:  2.4.0                                                ║
 * ║ 📅  created:  2026-04-23                                           ║
 * ║ 👥  author:   Solar Team · Leanid + Claude                         ║
 * ║                                                                    ║
 * ║ 🎯  PURPOSE — Layer 3 (CLEAN) + Layer 4 (SPEAK) of Sufler          ║
 * ║                                                                    ║
 * ║     Shows two sections side-by-side or stacked:                    ║
 * ║       🎙 RAW    — what Grok heard (mixed RU/EN as user spoke)      ║
 * ║       ✨ CLEAN  — composed English sentence ready to speak         ║
 * ║                                                                    ║
 * ║     Actions on CLEAN:                                              ║
 * ║       🔊 Speak — TTS via existing useTTS                           ║
 * ║       📋 Copy  — clipboard                                         ║
 * ║                                                                    ║
 * ║ 🔄 CHANGELOG                                                       ║
 * ║   v2.4 — initial                                                   ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */
"use client";

import { useCallback, useState } from "react";
import type { LangCode, TtsVoice } from "./types";

interface CleanBarProps {
  raw: string;                   // what Grok heard (mixed)
  clean: string;                 // composed EN sentence
  recording: boolean;            // mic active
  voiceEN: TtsVoice;             // voice for English playback
  onSpeak: (text: string, lang: LangCode, voice: TtsVoice) => void;
  isPlaying: boolean;
  onStop: () => void;
}

export default function CleanBar({
  raw,
  clean,
  recording,
  voiceEN,
  onSpeak,
  isPlaying,
  onStop,
}: CleanBarProps) {
  const [copyFeedback, setCopyFeedback] = useState(false);

  const handleSpeak = useCallback(() => {
    if (!clean) return;
    if (isPlaying) {
      onStop();
      return;
    }
    onSpeak(clean, "EN", voiceEN);
  }, [clean, isPlaying, onSpeak, onStop, voiceEN]);

  const handleCopy = useCallback(() => {
    if (!clean || typeof navigator === "undefined") return;
    navigator.clipboard?.writeText(clean).catch(() => { });
    setCopyFeedback(true);
    window.setTimeout(() => setCopyFeedback(false), 1200);
  }, [clean]);

  // Hide entire bar when there's nothing to show and not recording.
  if (!recording && !raw && !clean) return null;

  return (
    <section className="clean-bar" aria-label="Sufler — main layer">
      <div className="clean-bar-row clean-bar-raw">
        <span className="clean-bar-icon" aria-hidden="true">🎙</span>
        <span className="clean-bar-label">Услышано</span>
        <p className="clean-bar-text clean-bar-text-raw">
          {raw || (recording
            ? <span className="clean-bar-placeholder">слушаю…</span>
            : <span className="clean-bar-placeholder">включи 🎧 Sufler чтобы говорить</span>
          )}
        </p>
      </div>

      <div className="clean-bar-row clean-bar-clean">
        <span className="clean-bar-icon" aria-hidden="true">✨</span>
        <span className="clean-bar-label">Готовая фраза</span>
        <p className="clean-bar-text clean-bar-text-clean">
          {clean || <span className="clean-bar-placeholder">появится когда заговоришь</span>}
        </p>
        <div className="clean-bar-actions">
          <button
            type="button"
            onClick={handleSpeak}
            disabled={!clean}
            className={`clean-bar-btn ${isPlaying ? "is-playing" : ""}`}
            aria-label={isPlaying ? "Остановить" : "Озвучить чистую фразу"}
            title={isPlaying ? "Остановить" : "🔊 Speak"}
          >
            {isPlaying ? "⏸" : "🔊"}
            <span>Speak</span>
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!clean}
            className={`clean-bar-btn ${copyFeedback ? "is-success" : ""}`}
            aria-label="Скопировать чистую фразу"
            title="Copy"
          >
            {copyFeedback ? "✓" : "📋"}
            <span>{copyFeedback ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
