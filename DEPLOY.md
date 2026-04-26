# 🎯 Dashka v2.6.1 — Brain Fix (Dashka's Architecture)

> **CLEAN — единый источник истины для ВСЕХ слоёв UI**

Архитектурный принцип Solar Team, зафиксированный Дашкой v2.6.1.

## 🧠 Проблема которую решаем

```
БЫЛО (v2.6.0 — broken):
  mic → Whisper RAW → translate → каша

  Пример:
  Сказал:    "hello how are you здравствуйте как дела"
  Whisper:   "hello how are you здравствуйте как дела"
  Translate: "Hello, how are you?"  ← теряет половину!
                ↑ запутался на mixed input
```

```
СТАЛО (v2.6.1 — Dashka's vision):
  mic → Whisper RAW → analyzeAndClean → CLEAN → translate

  Пример:
  Сказал:    "hello how are you здравствуйте как дела"
  Whisper:   "hello how are you здравствуйте как дела"
  CLEAN:     "Hello how are you hello how are you."
                ↑ нормализованный English
  Translate: "Hello how are you, hello how are you."
```

## 📋 Файлы (3)

```
🆕 features/translator/cleanEngine.ts   — НОВЫЙ! Shared CLEAN brain
🟢 features/translator/useFlow.ts       — Импорт buildCleanSentence (refactor)
🟢 features/translator/usePane.ts       — STT → CLEAN → translate pipeline
```

## 🏗 Архитектура

```
┌──────────────────────────────────────────────────┐
│ cleanEngine.ts (NEW)                             │
│                                                   │
│  buildCleanSentence(raw, suggestions)            │
│  ──────────────────────────────────────          │
│  Pure function: text + suggestions → CLEAN       │
│                                                   │
│  analyzeAndClean(raw)                            │
│  ──────────────────────                          │
│  Full pipeline: raw → /api/flow → CLEAN          │
│  (для Pane — независимо от Sufler)               │
└──────────────────────────────────────────────────┘
              ↑                      ↑
              │                      │
         imports                imports
              │                      │
┌─────────────┴────────┐  ┌─────────┴──────────────┐
│ useFlow.ts (Sufler)  │  │ usePane.ts (Pane)      │
│                      │  │                        │
│ Использует           │  │ Использует             │
│ buildCleanSentence   │  │ analyzeAndClean        │
│ напрямую             │  │ перед translate        │
└──────────────────────┘  └────────────────────────┘
```

## 🚀 Команды

```bash
cd ~/Documents/ITproject/Dashka-chat-sufler/Dashka-chat-sufler-api

unzip -o ~/Downloads/dashka-v261.zip -d /tmp/

cp /tmp/dashka-v261/files/features/translator/cleanEngine.ts  features/translator/cleanEngine.ts
cp /tmp/dashka-v261/files/features/translator/useFlow.ts      features/translator/useFlow.ts
cp /tmp/dashka-v261/files/features/translator/usePane.ts      features/translator/usePane.ts

# Verify
grep "v2\.6\.1" features/translator/cleanEngine.ts | head -1
grep "v2\.6\.1" features/translator/useFlow.ts | head -1
grep "v2\.6\.1" features/translator/usePane.ts | head -1
grep "analyzeAndClean" features/translator/usePane.ts                # ≥2
grep "from \"./cleanEngine\"" features/translator/useFlow.ts          # 1
grep "from \"./cleanEngine\"" features/translator/usePane.ts          # 1

# Build
npx tsc --noEmit && echo "✓ TS OK"
pnpm run build 2>&1 | tail -5

# Deploy
git add features/translator/cleanEngine.ts \
        features/translator/useFlow.ts \
        features/translator/usePane.ts
git commit -m "feat: v2.6.1 — Brain Fix (CLEAN before translate, shared engine)"
git push
vercel --prod

open "https://dashka-chat-sufler.vercel.app"
```

## 🧪 После deploy + Cmd+Shift+R

### Тест 1 — Левый Pane (Beginner, прежнее поведение)
```
Click левый 🎤
Скажи: "Здравствуйте, я хотел бы обсудить доступ"
Click ⏹

input:       "Здравствуйте, я хотел бы обсудить доступ"
translation: "Hello, I would like to discuss access"  
                  ↑ работает как раньше (left pane не меняется)
```

### Тест 2 — Правый Pane (mixed input — теперь корректно!)
```
Click правый 🎤
Скажи: "I want to обсудить the access to наш account"
Click ⏹

[STT]    raw: "I want to обсудить the access to наш account"
[CLEAN]  → /api/flow находит обсудить→discuss, наш→our
[CLEAN]  → "I want to discuss the access to our account."
[INPUT]  показывается CLEAN: "I want to discuss the access to our account."
[XLAT]   → "Я хочу обсудить доступ к нашему аккаунту"

         ⭐ БОЛЬШЕ НЕТ КАШИ!
```

### Тест 3 — Правый Pane чистый русский
```
Click правый 🎤
Скажи: "Здравствуйте, как дела"
Click ⏹

[STT]    raw: "Здравствуйте, как дела"
[CLEAN]  → /api/flow найдёт здравствуйте→hello, как→how, дела→are you
[CLEAN]  → "Hello how are you."
[INPUT]  "Hello how are you."
[XLAT]   "Привет, как дела"
```

### Тест 4 — Правый Pane чистый английский (no Cyrillic)
```
Click правый 🎤
Скажи: "How are you doing today"
Click ⏹

[STT]    raw: "How are you doing today"
[CLEAN]  → no Cyrillic detected → skip /api/flow
[CLEAN]  → just format: "How are you doing today."
[INPUT]  "How are you doing today."
[XLAT]   "Как ты сегодня?"
```

## 🎓 Архитектурный принцип (зафиксирован в Solar Team)

```
═══════════════════════════════════════════════════════════════
  CLEAN — единый источник истины для ВСЕХ слоёв UI
═══════════════════════════════════════════════════════════════
  
  RAW  = шум (output of STT, может быть mixed)
  CLEAN = signal (нормализован, готов к использованию)
  
  ВСЕГДА:  RAW → CLEAN → дальнейшие операции
  НИКОГДА: RAW → дальнейшие операции напрямую
═══════════════════════════════════════════════════════════════
```

Это применимо ко всем будущим компонентам: новые UI, новые фичи, новые провайдеры.

## ⚪ Что НЕ меняется

- ✅ STT (Whisper) — остаётся
- ✅ Translate API — остаётся (просто получает чистый CLEAN)
- ✅ TTS (Grok Leo) — остаётся  
- ✅ Sufler — работает как был (теперь импортирует buildCleanSentence)
- ✅ All UI components

**3 файла. Архитектурный refactor + Brain Fix.**

## 🚀 Что дальше после v2.6.1

```
v2.7  — CLEAN как primary UI
        Pane становится secondary tool
        Главное окно — большой CleanBar
        
v2.8  — Personal vocabulary tracking
        "Ты забыл 'discuss' уже 3 раза"
        Spaced repetition по forgotten words
        
v2.9  — AI rewrite вместо word replace
        CLEAN использует gpt для grammatical perfection
```

Но сначала — проверим что v2.6.1 даёт **rock solid** behavior.
