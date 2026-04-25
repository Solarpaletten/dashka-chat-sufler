# 📦 Dashka v2.3 Flow Edition — Deploy Instructions

**7 файлов** для применения v2.3 поверх v2.2 (или v2.1).

## 🎯 Что это

Патч добавляет **Dashka Flow** — новый режим "живого суфлёра" для билингвов:
- 🎧 **Кнопка Flow** в header — включает непрерывное слушание микрофона
- 🎙 **Hybrid STT** — Web Speech API на Chrome/Edge, Grok STT на Safari/Firefox
- 💡 **Нижняя панель** — показывает последние 3 подсказки слов которые ты сказал на RU/EN
- 🔊 **Озвучка** — каждая подсказка имеет кнопку "послушать"

## 📋 Файлы

### 🆕 НОВЫЕ файлы (4)
```
🆕 app/api/flow/route.ts                   — backend: анализ смешанного текста (OpenAI)
🆕 app/api/stt/route.ts                    — backend: Grok STT proxy (для Safari)
🆕 features/translator/useFlow.ts          — hook: микрофон → STT → suggestions
🆕 features/translator/FlowPanel.tsx       — UI: нижняя панель подсказок
```

### 🟢 МОДИФИЦИРОВАННЫЕ файлы (3)
```
🟢 app/page.tsx                            — добавлена кнопка 🎧 Flow + <FlowPanel/>
🟢 app/globals.css                         — стили .flow-panel, .flow-toggle-btn, .flow-sugg
🟢 features/translator/types.ts            — + FlowSuggestion, SttEngine types
```

### ⚪ НЕ МЕНЯЮТСЯ (identical to v2.2)
```
⚪ config.ts                               — свой язык у каждого проекта
⚪ app/layout.tsx                          — identical
⚪ app/api/translate/route.ts              — identical
⚪ app/api/tts/route.ts                    — identical
⚪ app/api/health/route.ts                 — identical
⚪ features/translator/Pane.tsx            — identical (v2.2)
⚪ features/translator/usePane.ts          — identical
⚪ features/translator/useTTS.ts           — identical (v2.2)
⚪ features/translator/useTheme.ts         — identical
⚪ features/translator/paneConfigs.ts      — identical
⚪ features/translator/types-runtime.ts    — identical
⚪ package.json, tsconfig.json              — identical
```

## 🚀 Процедура развёртывания

```bash
# 1. Перейти в нужный проект (например немецкий)
cd ~/Documents/ITproject/Dashka-dual-chatde/Dashka-dual-chatde-api

# 2. Проверить какой язык
grep "^export const PARTNER_LANG" config.ts
# должно быть: export const PARTNER_LANG: LangCode = "DE";

# 3. Распаковать патч
unzip -o ~/Downloads/dashka-v23-patch.zip -d /tmp/

# 4. Создать новые API endpoint-папки
mkdir -p app/api/flow app/api/stt

# 5. Применить 4 НОВЫХ файла
cp /tmp/dashka-v23-patch/files/app/api/flow/route.ts       app/api/flow/route.ts
cp /tmp/dashka-v23-patch/files/app/api/stt/route.ts        app/api/stt/route.ts
cp /tmp/dashka-v23-patch/files/features/translator/useFlow.ts    features/translator/useFlow.ts
cp /tmp/dashka-v23-patch/files/features/translator/FlowPanel.tsx features/translator/FlowPanel.tsx

# 6. Применить 3 МОДИФИЦИРОВАННЫХ файла
cp /tmp/dashka-v23-patch/files/app/page.tsx              app/page.tsx
cp /tmp/dashka-v23-patch/files/app/globals.css           app/globals.css
cp /tmp/dashka-v23-patch/files/features/translator/types.ts  features/translator/types.ts

# 7. Быстрая проверка что всё применилось
grep -c "useFlow"        app/page.tsx                        # ≥ 2
grep -c "FlowPanel"      app/page.tsx                        # ≥ 2
grep -c "flow-panel"     app/globals.css                     # ≥ 1
grep -c "FlowSuggestion" features/translator/types.ts        # ≥ 1
ls app/api/flow/route.ts app/api/stt/route.ts                # оба существуют

# 8. Компиляция (локально — опционально)
npx tsc --noEmit
# Должно пройти БЕЗ ошибок

# 9. Deploy
git add .
git commit -m "feat: v2.3 Flow Edition - Code-Switch Assistant"
git push
vercel --prod

# 10. Test
open "https://dashka-chatde.vercel.app"
```

## 🧪 Как проверить что Flow работает

### Desktop Chrome (FREE Web Speech API)
1. Открыть сайт → сказать "Yes" на разрешение микрофона
2. Нажать **🎧 Flow** — кнопка становится янтарной, красная точка пульсирует
3. Внизу появляется блок `Dashka Flow` с подсказкой "Слушаю…"
4. Говорить в микрофон: *"Ich möchte переговорить со Steuerberater"*
5. Через 1-2 секунды внизу должно появиться: 
   - **🇷🇺 переговорить → sprechen mit 🔊**
6. Нажать 🔊 — Grok TTS произносит "sprechen mit"

### iPhone Safari (Grok STT $0.20/hr)
1. Та же последовательность
2. Значок в Flow-панели будет "Grok STT · live"
3. Произношение может быть чуть менее точным но работает с **любыми языками одновременно**

## 💰 Стоимость

**Web Speech (Chrome Desktop):** БЕСПЛАТНО

**Grok STT (Safari/Firefox):** $0.20/час streaming = **~$0.03 за 10-минутный разговор**

**OpenAI Flow analysis:** gpt-4o-mini, ~$0.003 за вызов = $0.01 за 10 минут

**TTS подсказок (Grok):** $4.20/1M chars — копейки

**Итого на одну Dashka Flow сессию** (10 мин Грок+анализ+TTS) ≈ **$0.05**

## 🎯 Test-Then-Deploy Strategy

1. **Сначала** применить на ОДИН проект (DE)
2. Протестировать в реальной ситуации — **идёшь к бухгалтеру, включаешь Flow**
3. Убедиться что подсказки адекватные
4. **Потом** раскатать на остальные (EN, PL, ZH) — те же 7 команд `cp`

## 🛡 Requirements

- `OPENAI_API_KEY` — для `/api/flow` (уже есть в production)
- `XAI_API_KEY` — для `/api/stt` (уже есть в production)
- Микрофон в браузере — нужен HTTPS (Vercel production автоматически)
