/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║ 📄  features/translator/FlowPanel.tsx                              ║
 * ║ 🏷️  version:  2.3.0                                                ║
 * ║ 📅  created:  2026-04-23                                           ║
 * ║ 👥  author:   Solar Team · Leanid + Claude                         ║
 * ║                                                                    ║
 * ║ 🎯  PURPOSE — Dashka Flow bottom panel                             ║
 * ║     Shows last 3 suggestions (LRU) with 🔊 TTS buttons             ║
 * ║                                                                    ║
 * ║ 🔄 CHANGELOG                                                       ║
 * ║   v2.3 — initial                                                   ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */
"use client";

import { useCallback, useState } from "react";
import type { FlowSuggestion, LangCode, SttEngine, TtsVoice } from "./types";

interface FlowPanelProps {
  suggestions: FlowSuggestion[];
  engine: SttEngine;
  recording: boolean;
  targetLanguage: LangCode;
  voice: TtsVoice;
  error?: string | null;
  onPlaySuggestion: (text: string, lang: LangCode, voice: TtsVoice) => void;
  onClear: () => void;
}

const FLAG_BY_SOURCE: Record<string, string> = {
  ru: "🇷🇺",
  en: "🇺🇸",
  unknown: "🌐",
};

export default function FlowPanel({
  suggestions,
  engine,
  recording,
  targetLanguage,
  voice,
  error,
  onPlaySuggestion,
  onClear,
}: FlowPanelProps) {
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);

  const handlePlay = useCallback((idx: number, text: string) => {
    setPlayingIdx(idx);
    onPlaySuggestion(text, targetLanguage, voice);
    // clear after short delay (purely visual feedback)
    window.setTimeout(() => setPlayingIdx((p) => (p === idx ? null : p)), 1500);
  }, [onPlaySuggestion, targetLanguage, voice]);

  return (
    <section className="flow-panel" aria-label="Dashka Flow — suggestions">
      <div className="flow-panel-header">
        <div className="flow-panel-title">
          <span className="flow-panel-icon">🎧</span>
          <span>Dashka Flow</span>
          {recording && (
            <span className="flow-rec-indicator" aria-label="Recording">
              <span className="flow-rec-dot" />
              live
            </span>
          )}
        </div>
        <div className="flow-panel-meta">
          <span className="flow-engine-tag">
            {engine === "web-speech" ? "Web Speech" : "Grok STT"}
          </span>
          {suggestions.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="flow-clear-btn"
              aria-label="Очистить подсказки"
            >
              очистить
            </button>
          )}
        </div>
      </div>

      {error && <div className="flow-error">⚠ {error}</div>}

      {suggestions.length === 0 ? (
        <div className="flow-empty">
          {recording
            ? "Слушаю… скажи слово на русском или английском — подскажу как по-немецки."
            : "Нажми 🎧 Flow, говори — подсказки появятся здесь."}
        </div>
      ) : (
        <div className="flow-suggestions">
          {suggestions.map((s, idx) => {
            const flag = FLAG_BY_SOURCE[s.sourceLanguage] ?? "🌐";
            return (
              <div key={`${s.original}-${idx}`} className="flow-sugg">
                <span className="flow-sugg-from">
                  <span className="flow-sugg-flag">{flag}</span>
                  <span className="flow-sugg-orig">{s.original}</span>
                </span>
                <span className="flow-sugg-arrow">→</span>
                <span className="flow-sugg-to">{s.german}</span>
                <button
                  type="button"
                  onClick={() => handlePlay(idx, s.german)}
                  className={`flow-sugg-play ${playingIdx === idx ? "is-playing" : ""}`}
                  aria-label={`Озвучить «${s.german}»`}
                  title="Послушать немецкое произношение"
                >
                  {playingIdx === idx ? "♫" : "🔊"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
