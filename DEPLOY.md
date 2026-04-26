# 🎯 Dashka v3.0 — Stabilization (Flow → Bottom Module)

> **Architectural decision (Dashka):**  
> Pane = инструмент (top, stable)  
> Flow = наблюдатель (bottom, optional)

## 🎯 Что поменялось

```
ДО (v2.7.1):
  HEADER:  [Auto] [🎧 Flow] [Theme]
                       ↑ Flow toggle в шапке (отвлекает)
  
  PANES:   ┌─Левый──┬─Правый─┐
           └────────┴────────┘
  
  CleanBar внизу всегда
  
  FlowPanel внизу всегда (если Flow ON)

ПОСЛЕ (v3.0):
  HEADER:  [Auto] [Theme] [Online]
           ↑ Flow toggle УДАЛЁН
  
  PANES:   ┌─Левый──┬─Правый─┐
           └────────┴────────┘
           ↑ STABLE, НЕ ТРОГАЕМ
  
  ┌─ 🎧 Streaming ──────── [📚 Learning] [▶ ON] ─┐
  │                                                │
  │  CleanBar (если ON)                            │
  │  FlowPanel (если Learning Mode opt-in)         │
  └────────────────────────────────────────────────┘
  ↑ Новый отдельный модуль внизу
```

## 📋 Файлы (2)

```
🟢 app/page.tsx         — UI restructure (Flow → bottom)
🟢 app/globals.css      — стили для .flow-section
```

**0 logic changes.** Только UI rearrangement.

## 🚀 Команды

```bash
cd ~/Documents/ITproject/Dashka-chat-sufler/Dashka-chat-sufler-api

unzip -o ~/Downloads/dashka-v30.zip -d /tmp/

cp /tmp/dashka-v30/files/app/page.tsx      app/page.tsx
cp /tmp/dashka-v30/files/app/globals.css   app/globals.css

# Verify
grep "v3\.0\.0" app/page.tsx | head -1
grep "v3\.0\.0" app/globals.css | head -1
grep "flow-section" app/page.tsx           # >= 5
grep "flow-section" app/globals.css        # >= 5

# Build
npx tsc --noEmit && echo "TS OK"
pnpm run build 2>&1 | tail -5

# Deploy
git add app/page.tsx app/globals.css
git commit -m "feat: v3.0 — Stabilization (Flow → bottom module)"
git push
vercel --prod

open "https://dashka-chat-sufler.vercel.app"
```

## 🧪 После deploy + Cmd+Shift+R

### Сценарий 1 — обычный переводчик (Flow OFF)
```
HEADER: [Auto] [Theme] [Online]      ← чисто, без Flow toggle

PANES — работают как обычно:
  Click левый mic → говорю по-русски → перевод EN
  Click правый mic → говорю по-английски → перевод RU

Внизу:
  ┌─ 🎧 Streaming ───────────────── [▶ ON] ─┐
  │ Включите чтобы постоянно слушать речь  │
  │ и получать готовые фразы на английском │
  └─────────────────────────────────────────┘
  
  ↑ Свёрнуто, не отвлекает
```

### Сценарий 2 — включаем Streaming
```
Click [▶ ON] во Flow секции

  ┌─ 🎧 Streaming  ● live ───── [📚 Learning] [⏸ OFF] ─┐
  │                                                     │
  │ УСЛЫШАНО:    (real-time RAW transcript)            │
  │ ГОТОВАЯ ФРАЗА: (CLEAN English)                     │
  │              [🔊 Speak] [📋 Copy]                  │
  │                                                     │
  └─────────────────────────────────────────────────────┘

PANES сверху продолжают работать независимо!
```

### Сценарий 3 — Learning mode (opt-in внутри Streaming)
```
Streaming ON + Learning ON →
  + FlowPanel suggestions появляются (учебный режим)
  
По умолчанию Learning OFF → нет шума
```

## 💎 Преимущества нового layout

```
✅ Pane стабильны, не путаемся "куда жать"
✅ Flow = опциональная фича (как Дашка задумала)
✅ Чище выглядит когда Flow OFF
✅ Toggle переехал из шапки → не отвлекает
✅ Learning mode вынесен в opt-in (не загромождает UI)
✅ Готовая база для будущего "Solar Flow" продукта
```

## 🎯 Solar Team Architectural Principle (v3.0)

```
===============================================================
  Pane = инструмент (action)
  Flow = наблюдатель (passive)
  
  Они НЕ должны конфликтовать
  Они НЕ должны мешать друг другу
  Они РАБОТАЮТ независимо
===============================================================
```

## 🚀 Что дальше — Solar Flow Project

После стабилизации v3.0:

```
solar-flow/                        ← новый отдельный продукт
├── docs/
│   ├── README_SYSTEM.md
│   ├── ARCHITECTURE.md
│   ├── PRINCIPLES.md
│   └── ROADMAP.md
└── apps/flow-mvp/                 ← новый Next.js app
    └── один экран:
        🎧 RECORD
        УСЛЫШАНО (стрим)
        ГОТОВАЯ ФРАЗА
        [Speak] [Copy]
```

Но **сначала** — фиксируем v3.0, проверяем что всё работает в production.

## ⚪ Что НЕ меняется

- STT (Whisper)
- Translate API  
- TTS (Grok Leo)
- cleanEngine.ts (Brain v2.7.1)
- usePane.ts (Whisper STT)
- useFlow.ts (Sufler logic)
- All other components

**Только page.tsx + globals.css.** Чистое UI restructure.
