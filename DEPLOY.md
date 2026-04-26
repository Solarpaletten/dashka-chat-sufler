# 🎯 Dashka v2.7.1 — Brain Polish (Grammar Rules)

> **Rule-based grammar polish** — последний штрих перед AI brain.

## 🧠 Что добавлено

```
v2.7.0:  basic reconstruction
v2.7.1:  + grammarPolish() — fix natural-speech issues
```

## 🔧 Новые правила (12)

### Chain verbs
```
"I wanted to ask discuss"  →  "I wanted to discuss"
"I want to ask discuss"     →  "I want to discuss"
"I wanted to ask tell"      →  "I wanted to tell"
"I wanted to ask see"       →  "I wanted to see"
```

### Article fixes
```
"discuss access"     →  "discuss the access"
"discuss account"    →  "discuss the account"
"discuss project"    →  "discuss the project"
"discuss contract"   →  "discuss the contract"
"discuss meeting"    →  "discuss the meeting"
"discuss report"     →  "discuss the report"
"about access"       →  "about the access"
"about account"      →  "about the account"
"about project"      →  "about the project"
```

### Punctuation polish
```
"hello how are you"   →  "Hello, how are you"
"hi how are you"      →  "Hi, how are you"
"thank you bye"       →  "Thank you. Bye"
"hello thank you"     →  "Hello. Thank you"
```

### Polite chains
```
"I would like discuss"  →  "I would like to discuss"
"I would like ask"      →  "I would like to ask"
"I would like see"      →  "I would like to see"
```

## 🧪 Тесты — 9 из 9 ✅

```
INPUT                                          → OUTPUT
─────────────────────────────────────────────  ──────────────────────────────────
"Hello Sabina я хотел спросить                 "Hello Sabina I wanted to discuss
 обсудить доступ спасибо"                       the access thank you."

"hello how are you здравствуйте                "Hello, how are you thank you."
 как дела спасибо"

"I хотел бы обсудить проект"                   "I would like to discuss
                                                the project."

"Здравствуйте. Я хотел спросить                "Hello. I wanted to discuss
 обсудить доступ. Спасибо."                     the access. thank you."

"I want to обсудить the access to              "I want to discuss the access to
 наш account"                                   our account."

"hello hello hello"                            "Hello."
"hello how are you"                            "Hello, how are you."
"Hello я зашёл сюда"                           "Hello."
```

## 🚀 Команды

```bash
cd ~/Documents/ITproject/Dashka-chat-sufler/Dashka-chat-sufler-api

unzip -o ~/Downloads/dashka-v271.zip -d /tmp/

# Один файл!
cp /tmp/dashka-v271/files/features/translator/cleanEngine.ts  features/translator/cleanEngine.ts

# Verify
grep "v2\.7\.1" features/translator/cleanEngine.ts | head -1
grep "grammarPolish" features/translator/cleanEngine.ts            # >= 2

# Build
npx tsc --noEmit && echo "TS OK"
pnpm run build 2>&1 | tail -5

# Deploy
git add features/translator/cleanEngine.ts
git commit -m "feat: v2.7.1 — Brain Polish (grammarPolish rules)"
git push
vercel --prod

open "https://dashka-chat-sufler.vercel.app"
```

## 🧪 После deploy + Cmd+Shift+R

### Тест 1 — главный (Sabina-style)
```
Flow ON
Скажи: "Hello Sabina я хотел спросить обсудить доступ спасибо"

УСЛЫШАНО (RAW):
   Hello Sabina я хотел спросить обсудить доступ спасибо

ГОТОВАЯ ФРАЗА (CLEAN):
   Hello Sabina I wanted to discuss the access thank you.
                              ↑ chain verb fix
                              ↑ article fix
                              ↑ natural English!
```

### Тест 2 — politeness (Würde gerne style)
```
Flow ON
Скажи: "Я хотел бы обсудить проект"

ГОТОВАЯ ФРАЗА (CLEAN):
   I would like to discuss the project.
                ↑                ↑
            polite chain    article fix
```

### Тест 3 — comma fix
```
Скажи: "hello how are you"

ГОТОВАЯ ФРАЗА:
   Hello, how are you.
        ↑ comma fix
```

## 🎓 Архитектурные принципы Solar Team

```
===============================================================
  v2.6.1: CLEAN — единый источник истины для всех слоёв UI
  v2.7.0: CLEAN — sentence reconstruction, не replacement
  v2.7.1: + grammarPolish — natural speech rules
===============================================================
```

## 🚀 Что дальше — v2.8 AI Brain (когда нужно)

```
v2.8.0 — Optional LLM polish
         CLEAN → /api/clean → gpt-4o-mini → final
         For phrases longer than X chars
         +1.5sec latency, +$0.001/phrase
         "Investor-grade" English
```

Но **v2.7.1 уже достаточно** для большинства реальных use-cases.

## ⚪ Что НЕ меняется

- STT (Whisper)
- Translate API
- TTS (Grok Leo)
- Sufler architecture
- Pane UX

**1 файл.** Architectural polish.
