/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║ 📄  app/api/flow/route.ts                                          ║
 * ║ 🏷️  version:  2.3.0                                                ║
 * ║ 📅  created:  2026-04-23                                           ║
 * ║ 👥  author:   Solar Team · Leanid + Claude                         ║
 * ║                                                                    ║
 * ║ 🎯  PURPOSE — Dashka Flow backend                                  ║
 * ║     Принимает смешанный текст (RU/EN + DE)                         ║
 * ║     Возвращает список "дыр" — слов которые нужно перевести на DE   ║
 * ║                                                                    ║
 * ║ 🔄 CHANGELOG                                                       ║
 * ║   v2.3 — initial: OpenAI analyze mixed-language text               ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */
import { NextRequest, NextResponse } from "next/server";

type FlowSuggestion = {
  original: string;           // "переговорить"
  sourceLanguage: "ru" | "en" | "unknown";
  german: string;             // "sprechen mit"
  context?: string;           // optional: "business meeting"
};

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { status: "error", message: "OPENAI_API_KEY is missing" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const text = (body?.text ?? "").trim();
    const targetLanguage = (body?.targetLanguage ?? "DE").toString().toUpperCase();

    if (!text) {
      return NextResponse.json(
        { status: "error", message: "Text is required" },
        { status: 400 }
      );
    }
    if (text.length > 2000) {
      return NextResponse.json(
        { status: "error", message: "Text too long (max 2000 chars)" },
        { status: 400 }
      );
    }

    // Map target language to native name for prompt
    const langNames: Record<string, string> = {
      DE: "German", EN: "English", PL: "Polish", ZH: "Chinese",
      FR: "French", IT: "Italian", ES: "Spanish",
      LV: "Latvian", LT: "Lithuanian", UA: "Ukrainian",
    };
    const targetName = langNames[targetLanguage] ?? "German";

    const systemPrompt = `You are a language assistant for a bilingual Russian speaker who is learning ${targetName}.

The user is speaking or writing mixed-language text, mostly in ${targetName} but inserting Russian or English words when they forget the ${targetName} equivalent.

Your job: identify NON-${targetName} words (Russian or English) and provide the BEST SINGLE ${targetName} translation for each, considering the surrounding context.

Rules:
- Only include words that are NOT already in ${targetName}
- Do NOT include ${targetName} words in your output
- Provide ONE best translation per word (not a list of alternatives)
- For nouns, include article/gender hint: "Zugang (m.)", "Quittung (f.)", "Programm (n.)"
- Keep translations short — single word or short phrase
- If context suggests business/formal language, use formal register
- If the text is entirely in ${targetName}, return empty array

Return ONLY valid JSON in this exact format:
{
  "suggestions": [
    {
      "original": "переговорить",
      "sourceLanguage": "ru",
      "german": "sprechen mit",
      "context": "business meeting"
    }
  ]
}`;

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 800,
      }),
    });

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text().catch(() => "");
      return NextResponse.json(
        {
          status: "error",
          message: `OpenAI error: ${openaiResponse.status}`,
          details: errText.slice(0, 500),
        },
        { status: openaiResponse.status }
      );
    }

    const data = await openaiResponse.json();
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { suggestions?: FlowSuggestion[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { suggestions: [] };
    }

    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];

    return NextResponse.json({
      status: "ok",
      suggestions: suggestions.slice(0, 10), // safety cap
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { status: "error", message },
      { status: 500 }
    );
  }
}
