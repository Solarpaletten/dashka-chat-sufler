# 📜 Dashka CHANGELOG

## v2.3.0 — Flow Edition · 2026-04-23

### 🆕 Added — Dashka Flow (Code-Switch Assistant)
- 🎧 **Live word-suggestion mode** — "живой суфлёр" для билингвов
- 🎙️ **Hybrid STT engine** — автоматически выбирает:
  - `Web Speech API` на Chrome/Edge Desktop + Chrome Android (БЕСПЛАТНО)
  - `Grok STT` на Safari iPhone/iPad/Mac + Firefox ($0.20/час)
- 💡 **Smart analysis** — OpenAI gpt-4o-mini находит русские/английские слова
  в немецкой речи и даёт контекстный перевод (с артиклем и родом для существительных)
- 📋 **LRU panel** — последние 3 подсказки всегда на экране
- 🔊 **Individual playback** — озвучка каждой подсказки через Grok TTS
- 🎨 **Amber UI theme** — не отвлекает, не мешает основной работе
- 💾 **Persistent toggle** — состояние 🎧 Flow сохраняется в localStorage
- 📱 **Mobile-optimized** — крупные touch targets на маленьких экранах

### 🏗️ Architecture
- `app/api/flow/route.ts` — analyze mixed-language text (new)
- `app/api/stt/route.ts` — Grok STT proxy (new)
- `features/translator/useFlow.ts` — hybrid STT hook (new)
- `features/translator/FlowPanel.tsx` — bottom suggestion panel (new)
- `app/page.tsx` — integrated Flow toggle + panel
- `app/globals.css` — Flow styles (`.flow-*` classes, amber theme)
- `features/translator/types.ts` — `FlowSuggestion`, `SttEngine` types

### 🎯 Product Positioning Change
This is NOT a translator feature. This is a **new product class**:
- ❌ NOT: "Translate everything for me"
- ✅ YES: "Fill in missing words while I speak"

Target: bilingual immigrants/expats at B1-B2 language level who know
most of the target language but forget specific vocabulary.

### 📊 Estimated Cost Per Session
~$0.05 for a 10-minute business conversation (STT + Flow analysis + TTS)

### 📝 Files NOT changed (identical to v2.2)
- `config.ts`, `app/layout.tsx`, `app/api/tts/route.ts`,
  `app/api/translate/route.ts`, `app/api/health/route.ts`,
  `features/translator/Pane.tsx`, `features/translator/usePane.ts`,
  `features/translator/useTTS.ts`, `features/translator/useTheme.ts`,
  `features/translator/paneConfigs.ts`, `features/translator/types-runtime.ts`

---

## v2.2.0 — Share Edition · 2026-04-22

### 🆕 Added
- 📤 Web Share API L2 — MP3 озвучка в WhatsApp/Telegram/Viber
- ✓ Copy feedback — зелёная галочка 1.2s
- 🍞 Toast notifications — auto-dismiss 3.5s
- ♿ Accessibility — aria-labels

### 🔧 Changed
- Split TTS cache: urlCache (play) + blobCache (share)
- Unified button classes `.io-btn`
- `useTTS.getBlob()` — новый экспорт

### 📝 4 changed files
- `app/page.tsx`, `app/globals.css`,
- `features/translator/Pane.tsx`, `features/translator/useTTS.ts`

---

## v2.1.0 — Multi-language Template · 2026-04-22

### 🆕 Added
- 🌐 10 языков: DE, EN, PL, ZH, FR, IT, ES, LV, LT, UA
- 🎯 Single Source of Truth — `config.ts` с `PARTNER_LANG`
- 🏗️ Template architecture — `cp -r`, поменять язык, deploy

---

## v2.0.0 — Dual Pane + Grok TTS · 2026-04-21

- 🔀 Dual pane architecture
- 🎙️ Grok TTS integration
- 🎭 Voice picker: Eve/Ara/Leo/Rex/Sal
- ⚡ LRU cache 50 items

---

## v1.3.0 — Theme + Polish · 2026-04-20

- 🌓 Dark/Light theme toggle
- 🎤 Mic state machine
- 💚 Online indicator (health-ping)

---

## v1.0.0 — First Production · 2026-04-19

- 🌐 Single-pane RU↔DE translator (OpenAI gpt-4o-mini)
- 🎤 Web Speech API input
- 📋 Copy to clipboard
