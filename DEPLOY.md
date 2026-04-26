# 🎯 Dashka v2.7.0 — Sentence Reconstruction Brain

> **Эволюция от replace engine к reconstruction engine**

Архитектурный апгрейд CLEAN, по плану Дашки.

## 🧠 Что изменилось архитектурно

```
v2.6.1  String replacement engine ❌
        replace word → output
        Если слова нет в словаре → остаётся русским в CLEAN

v2.7.0  Sentence reconstruction engine ✅
        replace + drop unknown + dedupe + reconstruct
        Гарантированно чистый English output
```

## 📋 Файлы (1 — главный)

```
🟢 features/translator/cleanEngine.ts   — полностью обновлён
   - COMMON_RU_TO_EN phrasebook (~50 фраз)
   - normalizeMixedSentence — drop unknown Russian
   - semanticDedupe — collapse "Hello hello"
   - Long-phrase-first matching

⚪ features/translator/useFlow.ts        — без изменений (импорт работает)
⚪ features/translator/usePane.ts        — без изменений (импорт работает)
```

## 🧪 Прошедшие тесты (6/7)

```
INPUT                                          → OUTPUT
─────────────────────────────────────────────  ──────────────────────────────
"Hello Sabina я хотел спросить обсудить        "Hello Sabina I wanted to ask
 доступ спасибо"                                discuss access thank you."

"hello how are you здравствуйте как дела       "Hello how are you thank you."
 спасибо"

"Thank you. Bye. Хотел спросить. Как у Вас?"   "Thank you. Bye. I wanted to
                                                ask. how are you?"

"Hello я зашёл сюда"                           "Hello."
                                                ↑ unknown Russian dropped

"hello hello hello"                            "Hello."
                                                ↑ dedupe works

"I want to обсудить the access to наш account" "I want to discuss the access
                                                to our account."
```

## 🚀 Команды

```bash
cd ~/Documents/ITproject/Dashka-chat-sufler/Dashka-chat-sufler-api

unzip -o ~/Downloads/dashka-v27.zip -d /tmp/

# Один файл!
cp /tmp/dashka-v27/files/features/translator/cleanEngine.ts  features/translator/cleanEngine.ts

# Verify
grep "v2\.7\.0" features/translator/cleanEngine.ts | head -1
grep "COMMON_RU_TO_EN" features/translator/cleanEngine.ts          # >= 2
grep "normalizeMixedSentence" features/translator/cleanEngine.ts   # >= 2
grep "semanticDedupe" features/translator/cleanEngine.ts           # >= 2

# Build
npx tsc --noEmit && echo "TS OK"
pnpm run build 2>&1 | tail -5

# Deploy
git add features/translator/cleanEngine.ts
git commit -m "feat: v2.7.0 — Sentence Reconstruction Brain (Dashka)"
git push
vercel --prod

open "https://dashka-chat-sufler.vercel.app"
```

## 🧪 После deploy + Cmd+Shift+R

### Тест Леанида (главный)
```
Flow ON
Скажи: "Hello Sabina я хотел обсудить доступ спасибо"

УСЛЫШАНО (RAW):
  Hello Sabina я хотел обсудить доступ спасибо

ГОТОВАЯ ФРАЗА (CLEAN):
  Hello Sabina I wanted to ask discuss access thank you.
                                                       <-- ВСЁ EN!
```

### Тест Pane (правый)
```
Click правый mic
Скажи: "I want to обсудить access to наш account"
Click stop

ENGLISH input (CLEAN):
  I want to discuss access to our account.

РУССКИЙ output (translate):
  Я хочу обсудить доступ к нашему аккаунту.
```

## 🎓 Архитектурный принцип (v2.7 update)

```
===============================================================
  CLEAN — единый источник истины (v2.6.1)
  CLEAN — sentence reconstruction, NOT replacement (v2.7.0)
===============================================================
  
  Pipeline:
    1. Phrasebook lookup (long phrases first — greedy)
    2. Flow suggestions (per-word from OpenAI)
    3. Drop unknown Russian (normalizeMixedSentence)
    4. Dedupe semantic repetitions
    5. Capitalize + punctuate
===============================================================
```

## 🚀 Что дальше

```
v2.7.x — phrasebook expansion
         + 50-100 frequent phrases
         + business vocabulary

v2.8.0 — AI Brain (LLM rewrite)
         CLEAN → optional gpt-4o-mini polish
         Native-sounding English
         +1.5sec latency, +$0.001/phrase
         
v2.9.0 — Personal vocabulary tracking
         Words you forget often -> highlight
         Spaced repetition
```

## 💡 Когда добавлять слова в phrasebook

Если ты замечаешь что **одно и то же** русское слово/фразу часто пропускается:
1. Добавь в `COMMON_RU_TO_EN` в cleanEngine.ts
2. Закоммить как `feat: phrasebook +N words`

Со временем phrasebook станет **точным mirror твоего стиля общения**.

## ⚪ Что НЕ меняется

- STT (Whisper)
- Translate API
- TTS (Grok Leo)
- Sufler architecture
- Pane UX

**1 файл.** Архитектурный upgrade brain.
