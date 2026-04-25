# 🎯 Dashka v2.5.3 — Wide Layout

> **CSS only. Один файл.** Расширяет UI на широкие экраны (MacBook 15"/16"/desktop monitor).

## 🔍 Что меняется

```
                           v2.4              v2.5.3
                           ─────             ─────
page-inner-dual max-width  82rem (1312px)    110rem (1760px) 
io-input max-height        400px             700px           
io-output max-height       400px             700px           
```

## 💡 Зачем

Леанид тестировал на **реальной BBC News** (8 минут видео, 4133 символов перевода). На MacBook 15" свободного места по краям было много, а текст рос только вниз. Теперь:

```
БЫЛО:                                СТАНЕТ:
┌────────────────────────────────┐   ┌────────────────────────────────────────┐
│       ┌─Pane┬─Pane──┐           │   │  ┌─────Pane──────┬─────Pane─────────┐ │
│       │     │      │            │   │  │               │                  │ │
│       │     │      │            │   │  │   широкая     │     широкая      │ │
│       │     │      │            │   │  │   удобно      │     удобно       │ │
│       │     │      │            │   │  │   читать      │     читать       │ │
│       └─────┴──────┘            │   │  └───────────────┴──────────────────┘ │
│  ←  пустота слева ─►            │   │                                       │
└────────────────────────────────┘   └────────────────────────────────────────┘
   1312px container                     1760px container (max)
```

## 📋 Файлы (1)

```
🟢 app/globals.css   — 3 значения CSS изменены
```

## 🚀 Команды

```bash
cd ~/Documents/ITproject/Dashka-chat-sufler/Dashka-chat-sufler-api

unzip -o ~/Downloads/dashka-v253.zip -d /tmp/

# Один файл!
cp /tmp/dashka-v253/files/app/globals.css  app/globals.css

# Verify
grep "v2\.5\.3" app/globals.css | head -1
grep "max-width: 110rem" app/globals.css     # ≥1
grep "max-height: 700px" app/globals.css     # ≥2

# Build
npx tsc --noEmit && echo "✓ TS OK"
pnpm run build 2>&1 | tail -5

# Deploy
git add app/globals.css
git commit -m "feat: v2.5.3 — wide layout for big screens (110rem container)"
git push
vercel --prod

open "https://dashka-chat-sufler.vercel.app"
```

## 🧪 После deploy + Cmd+Shift+R

### На MacBook 15"/16" Pro:
- Панели **шире** — больше места для текста
- BBC News перевод (4000+ символов) показывается **без скролла**
- Свободное место по краям меньше — экран используется эффективнее

### На обычном ноутбуке (1280px и меньше):
- Layout остаётся прежним
- max-width просто не достигается, дальше width: 100%

### На мобильном:
- Не затронуто (media query 640px преобладает)

## ⚪ Что НЕ меняется

- ✅ Whisper STT (v2.5.1)
- ✅ Pane mic (v2.5.2)
- ✅ CleanBar (v2.4)
- ✅ Sufler учебный режим (v2.4)
- ✅ Все остальные стили

**Только 3 CSS значения** — самый минимальный безопасный изменение.
