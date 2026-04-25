/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║ 📄  app/api/stt/route.ts                                           ║
 * ║ 🏷️  version:  2.5.0                                                ║
 * ║ 📅  changed:  2026-04-25                                           ║
 * ║ 👥  author:   Solar Team · Leanid + Claude + Solana                ║
 * ║                                                                    ║
 * ║ 🎯  PURPOSE — Speech-to-Text via OpenAI Whisper                    ║
 * ║                                                                    ║
 * ║     Why Whisper instead of Grok:                                   ║
 * ║     - Grok rejects browser webm/opus (400: corrupt audio format)   ║
 * ║     - Even after webm→ogg rename, Grok refuses                     ║
 * ║     - Whisper natively accepts webm without conversion             ║
 * ║     - Better multilingual support (RU+EN mix)                      ║
 * ║                                                                    ║
 * ║ 💰 Cost: $0.006/min (vs Grok $0.10/hr = $0.00167/min)              ║
 * ║          ~10min meeting = $0.06 (negligible)                       ║
 * ║                                                                    ║
 * ║ 🔄 CHANGELOG                                                       ║
 * ║   v2.5.0 — switched from Grok to OpenAI Whisper                    ║
 * ║          — accepts webm directly, no repackaging needed            ║
 * ║          — kept XAI_API_KEY for TTS (Leo voice still works)        ║
 * ║   v2.4.2 — Grok webm→ogg rename (FAILED — Grok rejects ogg too)    ║
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

    // Skip silent/empty chunks (Whisper handles them, but save API calls)
    if (file.size < 4096) {
      return NextResponse.json({ status: "ok", text: "", duration: 0 });
    }

    // OpenAI Whisper accepts: m4a, mp3, mp4, mpeg, mpga, wav, webm, oga, ogg, flac
    // Browser MediaRecorder gives us webm/opus — Whisper takes it directly.
    const whisperForm = new FormData();
    whisperForm.append("file", file, file.name || "audio.webm");
    whisperForm.append("model", "whisper-1");

    // Language hint helps Whisper, but it auto-detects mixed RU/EN well.
    // For Sufler we send "" to let Whisper decide (it handles code-switching).
    if (language && language !== "auto" && language.length === 2) {
      whisperForm.append("language", language.toLowerCase());
    }

    // response_format=json gives us {"text": "..."}
    // verbose_json adds duration + segments (useful for word-level later)
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
