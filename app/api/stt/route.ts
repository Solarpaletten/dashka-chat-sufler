/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║ 📄  app/api/stt/route.ts                                           ║
 * ║ 🏷️  version:  2.6.0                                                ║
 * ║ 📅  changed:  2026-04-25                                           ║
 * ║ 👥  author:   Solar Team · Leanid + Claude                         ║
 * ║                                                                    ║
 * ║ 🎯  PURPOSE — Whisper STT proxy with anti-hallucination tweaks     ║
 * ║                                                                    ║
 * ║ 🔄 CHANGELOG                                                       ║
 * ║   v2.6.0 — temperature=0 (deterministic, fewer hallucinations)     ║
 * ║          — prompt parameter to anchor Whisper context              ║
 * ║          — stricter min size (4096 → 8192) to skip tiny chunks     ║
 * ║   v2.5.0 — switched from Grok to OpenAI Whisper                    ║
 * ║   v2.4.2 — Grok webm→ogg rename (FAILED)                           ║
 * ║   v2.3.1 — Grok STT integration                                    ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { status: "error", message: "OPENAI_API_KEY is missing" },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const language = (formData.get("language")?.toString() ?? "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json(
        { status: "error", message: "Audio file is required" },
        { status: 400 }
      );
    }

    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { status: "error", message: "Audio too large (max 25MB)" },
        { status: 400 }
      );
    }

    // Skip too-small chunks — broken WebM headers or just silence
    if (file.size < 8192) {
      return NextResponse.json({ status: "ok", text: "", duration: 0 });
    }

    // OpenAI Whisper accepts: m4a, mp3, mp4, mpeg, mpga, wav, webm, oga, ogg, flac
    const whisperForm = new FormData();
    whisperForm.append("file", file, file.name || "audio.webm");
    whisperForm.append("model", "whisper-1");

    // temperature=0 → deterministic output, fewer hallucinations on silence
    whisperForm.append("temperature", "0");

    // Optional prompt anchors Whisper context (improves accuracy)
    const prompt = (formData.get("prompt")?.toString() ?? "").trim();
    if (prompt) {
      whisperForm.append("prompt", prompt.slice(0, 200));
    }

    // Language hint helps Whisper, but it auto-detects mixed RU/EN well.
    // For Sufler we send "" to let Whisper decide (it handles code-switching).
    if (language && language !== "auto" && language.length === 2) {
      whisperForm.append("language", language.toLowerCase());
    }

    whisperForm.append("response_format", "json");

    const whisperResponse = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          // Do NOT set Content-Type — fetch sets multipart boundary
        },
        body: whisperForm,
      }
    );

    if (!whisperResponse.ok) {
      const errText = await whisperResponse.text().catch(() => "");
      console.error(
        `[STT Whisper] ${whisperResponse.status} for ${file.name} (${file.size}b ${file.type}):`,
        errText.slice(0, 300)
      );
      return NextResponse.json(
        {
          status: "error",
          message: `Whisper error: ${whisperResponse.status}`,
          details: errText.slice(0, 500),
          debug: {
            origMime: file.type,
            sizeBytes: file.size,
            engine: "whisper",
          },
        },
        { status: whisperResponse.status }
      );
    }

    const result = await whisperResponse.json();
    return NextResponse.json({
      status: "ok",
      text: result?.text ?? "",
      duration: result?.duration ?? 0,
      words: [],
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    console.error("[STT] Internal error:", message);
    return NextResponse.json(
      { status: "error", message },
      { status: 500 }
    );
  }
}
