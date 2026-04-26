/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║ 📄  app/page.tsx                                                   ║
 * ║ 🏷️  version:  3.0.2                                                ║
 * ║ 📅  changed:  2026-04-26                                           ║
 * ║ 👥  author:   Solar Team · Leanid + Claude + Dashka                ║
 * ║                                                                    ║
 * ║ 🎯  v3.0.2 — Share dropdown (text / audio / both)                  ║
 * ║                                                                    ║
 * ║ 🔄 CHANGELOG                                                       ║
 * ║   v3.0.2 — handleShare(paneId, text, lang, voice, shareType)       ║
 * ║          — shareType: "text" | "audio" | "both"                    ║
 * ║          — Web Share API: text-only / files-only / text+files     ║
 * ║          — Fallback: clipboard for text, download for audio        ║
 * ║   v3.0   — Flow toggle moved from header to dedicated section      ║
 * ║   v2.4   — added <CleanBar/> as main layer                         ║
 * ║   v2.3.1 — Grok STT only, mic mutex, bidirectional EN↔RU           ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */
"use client";

import CleanBar from "@/features/translator/CleanBar";
import FlowPanel from "@/features/translator/FlowPanel";
import Pane, { type ShareType } from "@/features/translator/Pane";
import { LEFT_PANE, PARTNER_LANG, RIGHT_PANE } from "@/features/translator/paneConfigs";
import {
  type LangCode,
  type TtsVoice,
  LANG_META,
} from "@/features/translator/types";
import { useFlow } from "@/features/translator/useFlow";
import { usePane } from "@/features/translator/usePane";
import { useTheme } from "@/features/translator/useTheme";
import { useTTS } from "@/features/translator/useTTS";
import { useCallback, useEffect, useState } from "react";

export default function Home() {
  const { theme, toggle: toggleTheme, mounted } = useTheme();
  const { play, stop, getBlob, isPlaying, error: ttsError } = useTTS();
  const [autoTTS, setAutoTTS] = useState(true);
  const [activePlayingPane, setActivePlayingPane] = useState<"left" | "right" | "clean" | null>(null);
  const [sharingPane, setSharingPane] = useState<"left" | "right" | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  // v3.0: Learning mode (FlowPanel suggestions) — opt-in inside Flow section
  const [learningMode, setLearningMode] = useState(false);

  // Restore autoTTS pref
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("dashka-auto-tts");
    if (saved === "0") setAutoTTS(false);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("dashka-auto-tts", autoTTS ? "1" : "0");
  }, [autoTTS]);

  // Restore Learning mode pref
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("dashka-learning-mode");
    if (saved === "1") setLearningMode(true);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("dashka-learning-mode", learningMode ? "1" : "0");
  }, [learningMode]);

  /* ─── Dashka Sufler v2.3.1 ─────────────────────────────────────── */
  const flow = useFlow();
  // Restore Flow toggle pref
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("dashka-flow-enabled");
    if (saved === "1") flow.setEnabled(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("dashka-flow-enabled", flow.enabled ? "1" : "0");
  }, [flow.enabled]);
  /* ──────────────────────────────────────────────────────────────── */

  // Health ping
  useEffect(() => {
    let mounted2 = true;
    const ping = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (mounted2) setOnline(res.ok);
      } catch {
        if (mounted2) setOnline(false);
      }
    };
    ping();
    const id = window.setInterval(ping, 30_000);
    return () => {
      mounted2 = false;
      window.clearInterval(id);
    };
  }, []);

  // Автоматически убирать share-статус
  useEffect(() => {
    if (!shareStatus) return;
    const id = window.setTimeout(() => setShareStatus(null), 3500);
    return () => window.clearTimeout(id);
  }, [shareStatus]);

  const playFor = useCallback(
    (paneId: "left" | "right", text: string, lang: LangCode, voice: TtsVoice) => {
      setActivePlayingPane(paneId);
      void play({ text, language: lang, voice });
    },
    [play]
  );
  const onStop = useCallback(() => {
    stop();
    setActivePlayingPane(null);
  }, [stop]);

  useEffect(() => {
    if (!isPlaying) setActivePlayingPane(null);
  }, [isPlaying]);

  /* ─── SHARE HANDLER (v3.0.2 — Dashka Share dropdown) ──────────── */
  const handleShare = useCallback(
    async (
      paneId: "left" | "right",
      text: string,
      lang: LangCode,
      voice: TtsVoice,
      shareType: ShareType
    ) => {
      if (!text) return;
      setSharingPane(paneId);
      setShareStatus(null);
      try {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
        const filename = `dashka-${lang.toLowerCase()}-${stamp}.mp3`;

        // Get audio blob only when needed (audio | both)
        let file: File | null = null;
        if (shareType === "audio" || shareType === "both") {
          const blob = await getBlob({ text, language: lang, voice });
          file = new File([blob], filename, { type: "audio/mpeg" });
        }

        const wantsText = shareType === "text" || shareType === "both";
        const wantsFile = shareType === "audio" || shareType === "both";

        // Build share payload
        const sharePayload: ShareData = {
          title: "Dashka Translation",
        };
        if (wantsText) sharePayload.text = text;
        if (wantsFile && file) sharePayload.files = [file];

        // Check Web Share API support
        const canShare =
          typeof navigator !== "undefined" &&
          typeof navigator.share === "function";

        const canShareWithFiles =
          canShare &&
          typeof navigator.canShare === "function" &&
          file !== null
            ? navigator.canShare({ files: [file] })
            : false;

        // Decide path: native share vs fallback
        const useNative =
          canShare && (!wantsFile || canShareWithFiles);

        if (useNative) {
          try {
            await navigator.share(sharePayload);
            setShareStatus(
              shareType === "text"
                ? "✓ Текст отправлен"
                : shareType === "audio"
                ? "✓ Аудио отправлено"
                : "✓ Отправлено"
            );
          } catch (err) {
            if (err instanceof Error && err.name !== "AbortError") {
              setShareStatus(`⚠ ${err.message}`);
            }
          }
        } else {
          // Fallback path
          if (wantsText && typeof navigator !== "undefined") {
            try {
              await navigator.clipboard?.writeText(text);
            } catch {}
          }
          if (wantsFile && file) {
            const url = URL.createObjectURL(file);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 5000);
          }
          setShareStatus(
            shareType === "text"
              ? "✓ Текст скопирован"
              : shareType === "audio"
              ? "⬇ Аудио сохранено"
              : "✓ Текст скопирован, аудио сохранено"
          );
        }
      } catch (err) {
        setShareStatus(
          err instanceof Error ? `⚠ ${err.message}` : "⚠ Ошибка отправки"
        );
      } finally {
        setSharingPane(null);
      }
    },
    [getBlob]
  );

  const leftPane = usePane({
    config: LEFT_PANE,
    autoTTS,
    onTranslated: (text, _lang, voice) => {
      playFor("left", text, LEFT_PANE.to, voice);
    },
  });

  const rightPane = usePane({
    config: RIGHT_PANE,
    autoTTS,
    onTranslated: (text, _lang, voice) => {
      playFor("right", text, RIGHT_PANE.to, voice);
    },
  });

  const partnerMeta = LANG_META[PARTNER_LANG];

  return (
    <div className="page-wrap">
      <div className="page-inner-dual">
        {/* ─── HEADER ──────────────────────────────────────────────── */}
        <header className="app-header">
          <div className="app-title-block">
            <h1 className="app-title">
              <span>{partnerMeta.flag}</span>
              <span>Dashka</span>
            </h1>
            <p className="app-subtitle">
              Dual · {partnerMeta.nativeName} ↔ Русский · v3.0.2
            </p>
          </div>
          <div className="app-actions">
            <label className="auto-tts-toggle" title="Авто-озвучка перевода">
              <input
                type="checkbox"
                checked={autoTTS}
                onChange={(e) => setAutoTTS(e.target.checked)}
              />
              <span>🔊 Auto</span>
            </label>
            {/* v3.0: Flow toggle MOVED to bottom Flow Section */}
            {mounted && (
              <button
                type="button"
                onClick={toggleTheme}
                className="pill-btn"
                aria-label="Переключить тему"
                title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
              >
                {theme === "dark" ? "☀️" : "🌙"}
              </button>
            )}
            <span className="status-badge">
              <span className={`status-dot ${online ? "status-dot-on" : "status-dot-off"}`} />
              {online === null ? "…" : online ? "Online" : "Offline"}
            </span>
          </div>
        </header>

        {ttsError && <div className="tts-error">⚠ TTS: {ttsError}</div>}
        {shareStatus && <div className="share-toast">{shareStatus}</div>}

        {/* ─── PANE TRANSLATOR (TOP — UNCHANGED, STABLE) ──────────── */}
        <div className="dual-grid">
          <Pane
            pane={leftPane}
            onPlay={(text, lang, voice) => playFor("left", text, lang, voice)}
            onStop={onStop}
            isPlaying={isPlaying && activePlayingPane === "left"}
            onShareRequest={(text, lang, voice, shareType) =>
              handleShare("left", text, lang, voice, shareType)
            }
            isSharing={sharingPane === "left"}
          />
          <Pane
            pane={rightPane}
            onPlay={(text, lang, voice) => playFor("right", text, lang, voice)}
            onStop={onStop}
            isPlaying={isPlaying && activePlayingPane === "right"}
            onShareRequest={(text, lang, voice, shareType) =>
              handleShare("right", text, lang, voice, shareType)
            }
            isSharing={sharingPane === "right"}
          />
        </div>

        {/* ─── FLOW SECTION (BOTTOM — independent module, v3.0) ──── */}
        <section className={`flow-section ${flow.enabled ? "is-on" : ""}`}>
          {/* Section header with toggle */}
          <div className="flow-section-header">
            <div className="flow-section-title">
              <span className="flow-section-icon">🎧</span>
              <span className="flow-section-name">Streaming</span>
              {flow.enabled && flow.recording && (
                <span className="flow-section-live">
                  <span className="flow-section-dot" />
                  live
                </span>
              )}
            </div>
            <div className="flow-section-controls">
              {flow.enabled && (
                <label className="flow-learning-toggle" title="Учебный режим — подсказки забытых слов">
                  <input
                    type="checkbox"
                    checked={learningMode}
                    onChange={(e) => setLearningMode(e.target.checked)}
                  />
                  <span>📚 Learning</span>
                </label>
              )}
              <button
                type="button"
                onClick={() => flow.setEnabled(!flow.enabled)}
                className={`flow-section-toggle ${flow.enabled ? "is-on" : ""}`}
                aria-pressed={flow.enabled}
                title={flow.enabled ? "Выключить streaming" : "Включить streaming"}
              >
                {flow.enabled ? "⏸ OFF" : "▶ ON"}
              </button>
            </div>
          </div>

          {/* Section subtitle (when off) */}
          {!flow.enabled && (
            <div className="flow-section-subtitle">
              Включите чтобы постоянно слушать речь и получать готовые фразы на английском.
            </div>
          )}

          {/* Section content (only when ON) */}
          {flow.enabled && (
            <div className="flow-section-body">
              {/* CLEAN bar (RAW + готовая фраза + Speak/Copy) */}
              <CleanBar
                raw={flow.transcript}
                clean={flow.cleanText}
                recording={flow.recording}
                voiceEN={leftPane.voice}
                isPlaying={isPlaying && activePlayingPane === "clean"}
                onSpeak={(text, lang, voice) => {
                  setActivePlayingPane("clean");
                  void play({ text, language: lang, voice });
                }}
                onStop={onStop}
              />

              {/* Learning mode: show suggestions (opt-in) */}
              {learningMode && (
                <FlowPanel
                  suggestions={flow.suggestions}
                  recording={flow.recording}
                  voiceEN={leftPane.voice}
                  voiceRU={rightPane.voice}
                  error={flow.error}
                  onPlaySuggestion={(text, lang, voice) => {
                    setActivePlayingPane(null);
                    void play({ text, language: lang, voice });
                  }}
                  onClear={flow.clear}
                />
              )}
            </div>
          )}
        </section>

        <footer className="app-footer">
          Dashka · v3.0.2 · {partnerMeta.flag} {partnerMeta.nativeName} · Grok TTS+STT · Solar Team 🚀
        </footer>
      </div>
    </div>
  );
}
