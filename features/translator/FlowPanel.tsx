/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║ 📄  features/translator/FlowPanel.tsx                              ║
 * ║ 🏷️  version:  2.4.0                                                ║
 * ║ 📅  changed:  2026-04-23                                           ║
 * ║ 👥  author:   Solar Team · Leanid + Claude                         ║
 * ║                                                                    ║
 * ║ 🎯  PURPOSE — Layer 2 (FLOW, optional learning panel)              ║
 * ║                                                                    ║
 * ║ 🔄 CHANGELOG                                                       ║
 * ║   v2.4   — added ● new indicator (auto-fades after 6s)             ║
 * ║          — subtitle "учебный режим" emphasizes optional nature     ║
 * ║   v2.3.1 — bidirectional EN↔RU, Grok-only                          ║
 * ║   v2.3   — initial 3-suggestion panel                              ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */
"use client";

import { useCallback, useState } from "react";
import type { FlowSuggestion, LangCode, TtsVoice } from "./types";

interface FlowPanelProps {
  suggestions: FlowSuggestion[];
  recording: boolean;
  voiceEN: TtsVoice;     // voice for EN playback
  voiceRU: TtsVoice;     // voice for RU playback
  error?: string | null;
  onPlaySuggestion: (text: string, lang: LangCode, voice: TtsVoice) => void;
  onClear: () => void;
}

const FLAGS = {
  ru: "🇷🇺",
  en: "🇺🇸",
} as const;

export default function FlowPanel({
  suggestions,
  recording,
  voiceEN,
  voiceRU,
  error,
  onPlaySuggestion,
  onClear,
}: FlowPanelProps) {
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);

  const handlePlay = useCallback((idx: number, s: FlowSuggestion) => {
    setPlayingIdx(idx);
    // Translation goes to OTHER language, so use that language's voice/lang
    const targetLang: LangCode = s.sourceLanguage === "ru" ? "EN" : "RU";
    const targetVoice = s.sourceLanguage === "ru" ? voiceEN : voiceRU;
    onPlaySuggestion(s.translation, targetLang, targetVoice);
    window.setTimeout(() => setPlayingIdx((p) => (p === idx ? null : p)), 1500);
  }, [onPlaySuggestion, voiceEN, voiceRU]);

  return (
    <section className="flow-panel" aria-label="Dashka Sufler — live suggestions">
      <div className="flow-panel-header">
        <div className="flow-panel-title">
          <span className="flow-panel-icon">🎧</span>
          <span>Dashka Sufler</span>
          <span className="flow-panel-subtitle">учебный режим</span>
          {recording && (
            <span className="flow-rec-indicator" aria-label="Recording">
              <span className="flow-rec-dot" />
              live
            </span>
          )}
        </div>
        <div className="flow-panel-meta">
          <span className="flow-engine-tag">Grok STT</span>
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
            ? "Слушаю смешанную речь… подскажу забытые слова на лету."
            : "Включи 🎧 Sufler — говори вперемешку RU/EN, а я подскажу слова которые ты забыл."}
        </div>
      ) : (
        <div className="flow-suggestions">
          {suggestions.map((s, idx) => {
            const fromFlag = FLAGS[s.sourceLanguage];
            const toFlag = s.sourceLanguage === "ru" ? FLAGS.en : FLAGS.ru;
            return (
              <div
                key={`${s.original}-${idx}`}
                className={`flow-sugg ${s.isNew ? "is-new" : ""}`}
              >
                <span className="flow-sugg-from">
                  <span className="flow-sugg-flag">{fromFlag}</span>
                  <span className="flow-sugg-orig">{s.original}</span>
                </span>
                <span className="flow-sugg-arrow">→</span>
                <span className="flow-sugg-to">
                  <span className="flow-sugg-flag">{toFlag}</span>
                  {s.translation}
                </span>
                {s.isNew && (
                  <span className="flow-sugg-new" aria-label="новое слово">● new</span>
                )}
                <button
                  type="button"
                  onClick={() => handlePlay(idx, s)}
                  className={`flow-sugg-play ${playingIdx === idx ? "is-playing" : ""}`}
                  aria-label={`Озвучить «${s.translation}»`}
                  title="Послушать произношение"
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
