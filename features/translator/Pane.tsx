/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║ 📄  features/translator/Pane.tsx                                   ║
 * ║ 🏷️  version:  3.0.2                                                ║
 * ║ 📅  changed:  2026-04-26                                           ║
 * ║ 👥  author:   Solar Team · Leanid + Claude + Dashka                ║
 * ║                                                                    ║
 * ║ 🎯  v3.0.2 — Share dropdown (text / audio / both)                  ║
 * ║                                                                    ║
 * ║     UX evolution (Dashka):                                          ║
 * ║       Before: 1 Share button (audio + text together)                ║
 * ║       Now:    Share ▾ dropdown:                                     ║
 * ║                 ├─ 📝 Text only                                     ║
 * ║                 ├─ 🔊 Audio only                                    ║
 * ║                 └─ 📦 Text + Audio                                  ║
 * ║                                                                    ║
 * ║     Total: 3 quick buttons + dropdown =                             ║
 * ║       [🔊 Speak]  [📋 Copy]  [📤 Share ▾]                           ║
 * ║                                                                    ║
 * ║ 🔄 CHANGELOG                                                       ║
 * ║   v3.0.2 — Share dropdown (text/audio/both) — Dashka UX            ║
 * ║          — onShareRequest signature: + shareType param             ║
 * ║          — click-outside dismissal for dropdown                    ║
 * ║   v2.5.2 — REMOVED mic mutex — Pane mic always works               ║
 * ║   v2.3.1 — added flowActive prop (mic mutex with Sufler) — REMOVED ║
 * ║   v2.2   — Share button + copy feedback                             ║
 * ║   v2.1   — initial Pane                                             ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */
"use client";

import { useEffect, useRef, useState } from "react";
import type { LangCode, TtsVoice } from "./types";
import { LANG_META, TTS_VOICES } from "./types";
import { usePane } from "./usePane";

export type ShareType = "text" | "audio" | "both";

interface PaneProps {
  pane: ReturnType<typeof usePane>;
  onPlay: (text: string, lang: LangCode, voice: TtsVoice) => void;
  onStop: () => void;
  isPlaying: boolean;
  onShareRequest: (
    text: string,
    lang: LangCode,
    voice: TtsVoice,
    shareType: ShareType
  ) => Promise<void>;
  isSharing: boolean;
  flowActive?: boolean;   // v2.5.2: kept for compat but UNUSED
}

export default function Pane({
  pane,
  onPlay,
  onStop,
  isPlaying,
  onShareRequest,
  isSharing,
}: PaneProps) {
  const fromMeta = LANG_META[pane.config.from];
  const toMeta = LANG_META[pane.config.to];
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const shareWrapperRef = useRef<HTMLDivElement>(null);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 400)}px`;
  }, [pane.inputText]);

  // Click-outside dismisses Share dropdown
  useEffect(() => {
    if (!shareMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        shareWrapperRef.current &&
        !shareWrapperRef.current.contains(e.target as Node)
      ) {
        setShareMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [shareMenuOpen]);

  // Escape closes dropdown
  useEffect(() => {
    if (!shareMenuOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShareMenuOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [shareMenuOpen]);

  const copy = () => {
    if (pane.translatedText && typeof navigator !== "undefined") {
      navigator.clipboard?.writeText(pane.translatedText).catch(() => {});
      setCopyFeedback(true);
      window.setTimeout(() => setCopyFeedback(false), 1200);
    }
  };

  const playThis = () => {
    if (!pane.translatedText) return;
    if (isPlaying) {
      onStop();
    } else {
      onPlay(pane.translatedText, pane.config.to, pane.voice);
    }
  };

  const handleShareAs = (type: ShareType) => {
    setShareMenuOpen(false);
    if (!pane.translatedText || isSharing) return;
    void onShareRequest(pane.translatedText, pane.config.to, pane.voice, type);
  };

  return (
    <section className="pane">
      <header className="pane-header">
        <div className="pane-direction">
          <span className="pane-flag">{fromMeta.flag}</span>
          <span className="pane-arrow">→</span>
          <span className="pane-flag">{toMeta.flag}</span>
          <span className="pane-direction-label">
            {fromMeta.code}→{toMeta.code}
          </span>
        </div>
        <select
          value={pane.voice}
          onChange={(e) => pane.setVoice(e.target.value as TtsVoice)}
          className="voice-select"
          aria-label="Голос озвучки"
          title="Голос озвучки"
        >
          {TTS_VOICES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.gender === "F" ? "♀" : "♂"} {v.label}
            </option>
          ))}
        </select>
      </header>

      <div className="io-block">
        <div className="io-label">
          <span>{fromMeta.flag} {fromMeta.name}</span>
          {pane.inputText && (
            <button type="button" onClick={pane.clear} className="io-clear">
              очистить ✕
            </button>
          )}
        </div>
        <textarea
          ref={textareaRef}
          value={pane.inputText}
          onChange={(e) => pane.setInputText(e.target.value)}
          placeholder={fromMeta.placeholder}
          className="io-input"
        />
        <div className="io-counter">{pane.inputText.length} / 5000</div>
      </div>

      <div className="pane-actions">
        <button
          type="button"
          onClick={pane.translate}
          disabled={pane.isTranslating || pane.isProcessing || !pane.inputText.trim()}
          className="btn-translate"
        >
          {pane.isTranslating || pane.isProcessing ? (
            <span className="btn-spinner">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              {pane.isProcessing ? "Обработка…" : "Перевод…"}
            </span>
          ) : (
            <>→ {toMeta.name}</>
          )}
        </button>
        <button
          type="button"
          onClick={pane.toggleMic}
          disabled={pane.isProcessing}
          className={`btn-mic ${pane.isRecording ? "btn-mic-recording" : ""}`}
          aria-label={pane.isRecording ? "Остановить запись" : "Начать запись"}
          title={pane.isRecording ? "Остановить запись" : "Начать запись"}
        >
          {pane.isRecording ? "⏹" : "🎤"}
          {pane.isRecording && <span className="mic-pulse" />}
        </button>
      </div>

      {pane.error && <div className="pane-error">⚠ {pane.error}</div>}

      <div className="io-block io-block-output">
        <div className="io-label">
          <span className="io-label-accent">
            {toMeta.flag} {toMeta.name}
          </span>
          {pane.translatedText && (
            <div className="io-output-actions">
              {/* 1️⃣ Speak (TTS) */}
              <button
                type="button"
                onClick={playThis}
                className={`io-btn ${isPlaying ? "io-btn-active" : ""}`}
                title={isPlaying ? "Стоп" : "Озвучить"}
                aria-label={isPlaying ? "Стоп" : "Озвучить"}
              >
                {isPlaying ? "⏸" : "🔊"}
              </button>

              {/* 2️⃣ Copy text */}
              <button
                type="button"
                onClick={copy}
                className={`io-btn ${copyFeedback ? "io-btn-success" : ""}`}
                title={copyFeedback ? "Скопировано!" : "Копировать текст"}
                aria-label="Копировать текст"
              >
                {copyFeedback ? "✓" : "📋"}
              </button>

              {/* 3️⃣ Share dropdown */}
              <div className="share-wrapper" ref={shareWrapperRef}>
                <button
                  type="button"
                  onClick={() => setShareMenuOpen((v) => !v)}
                  disabled={isSharing}
                  className={`io-btn share-trigger ${
                    isSharing ? "io-btn-loading" : ""
                  } ${shareMenuOpen ? "io-btn-active" : ""}`}
                  title="Поделиться"
                  aria-label="Открыть меню отправки"
                  aria-expanded={shareMenuOpen}
                  aria-haspopup="menu"
                >
                  {isSharing ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="animate-spin">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <span className="share-trigger-content">
                      📤<span className="share-caret">▾</span>
                    </span>
                  )}
                </button>

                {shareMenuOpen && !isSharing && (
                  <div className="share-menu" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      className="share-menu-item"
                      onClick={() => handleShareAs("text")}
                    >
                      <span className="share-menu-icon">📝</span>
                      <span className="share-menu-label">
                        <strong>Текст</strong>
                        <small>только сообщение</small>
                      </span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="share-menu-item"
                      onClick={() => handleShareAs("audio")}
                    >
                      <span className="share-menu-icon">🎵</span>
                      <span className="share-menu-label">
                        <strong>Аудио</strong>
                        <small>только MP3 файл</small>
                      </span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="share-menu-item"
                      onClick={() => handleShareAs("both")}
                    >
                      <span className="share-menu-icon">📦</span>
                      <span className="share-menu-label">
                        <strong>Текст + Аудио</strong>
                        <small>сообщение и MP3</small>
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className={`io-output ${pane.translatedText ? "" : "io-output-empty"}`}>
          {pane.translatedText || "…"}
        </div>
      </div>
    </section>
  );
}
