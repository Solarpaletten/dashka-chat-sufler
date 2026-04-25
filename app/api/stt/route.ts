/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║ 📄  app/api/stt/route.ts                                           ║
 * ║ 🏷️  version:  2.4.2                                                ║
 * ║ 📅  changed:  2026-04-25                                           ║
 * ║ 👥  author:   Solar Team · Leanid + Claude                         ║
 * ║                                                                    ║
 * ║ 🎯  PURPOSE — Grok STT proxy with smart audio format handling      ║
 * ║                                                                    ║
 * ║ 🔄 CHANGELOG                                                       ║
 * ║   v2.4.2 — webm → ogg rename (Grok rejects webm container,         ║
 * ║            but accepts opus codec inside ogg)                      ║
 * ║          — explicit content-type forwarding                        ║
 * ║          — better error logging with full Grok response            ║
 * ║   v2.3.1 — current Grok API: format=true + language                ║
 * ║   v2.3   — initial Grok STT integration                            ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */
import { NextRequest, NextResponse } from "next/server";

/**
 * Map browser audio mime types to filenames Grok will accept.
 * Grok rejects "audio/webm" but accepts the same opus payload as "audio.ogg".
 * Both webm and ogg are containers around opus codec — Grok parses ogg cleanly.
 */
function pickGrokFilename(file: File): string {
  const mime = (file.type || "").toLowerCase();

  // mp4 / m4a / aac → keep as-is
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) {
    return file.name?.endsWith(".m4a") ? file.name : "audio.m4a";
  }
  // mp3
  if (mime.includes("mpeg") || mime.includes("mp3")) {
    return file.name?.endsWith(".mp3") ? file.name : "audio.mp3";
  }
  // wav
  if (mime.includes("wav") || mime.includes("wave")) {
    return file.name?.endsWith(".wav") ? file.name : "audio.wav";
  }
  // ogg native
  if (mime.includes("ogg")) {
    return file.name?.endsWith(".ogg") ? file.name : "audio.ogg";
  }
  // webm with opus codec (Chrome default) — rename to ogg
  // The opus packets inside are valid ogg/opus
  if (mime.includes("webm") || mime.includes("opus")) {
    return "audio.ogg";
  }
  // Fallback — try ogg
  return "audio.ogg";
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { status: "error", message: "XAI_API_KEY is missing" },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const language = (formData.get("language")?.toString() ?? "en").trim();

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

    // Skip silent/empty chunks (Grok rejects them with 400 anyway)
    if (file.size < 4096) {
      return NextResponse.json({ status: "ok", text: "", duration: 0 });
    }

    // Re-wrap blob with Grok-friendly filename + content-type
    const grokFilename = pickGrokFilename(file);
    const grokMime = grokFilename.endsWith(".ogg") ? "audio/ogg"
                  : grokFilename.endsWith(".m4a") ? "audio/mp4"
                  : grokFilename.endsWith(".mp3") ? "audio/mpeg"
                  : grokFilename.endsWith(".wav") ? "audio/wav"
                  : "audio/ogg";

    const audioBuffer = await file.arrayBuffer();
    const repackagedBlob = new Blob([audioBuffer], { type: grokMime });

    // Per Grok docs: file MUST come after all other parameters.
    const grokForm = new FormData();
    grokForm.append("format", "true");
    grokForm.append("language", language);
    grokForm.append("file", repackagedBlob, grokFilename);

    const grokResponse = await fetch("https://api.x.ai/v1/stt", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        // Do NOT set Content-Type — fetch sets multipart boundary automatically
      },
      body: grokForm,
    });

    if (!grokResponse.ok) {
      const errText = await grokResponse.text().catch(() => "");
      console.error(
        `[STT] Grok ${grokResponse.status} for ${grokFilename} (${file.size}b orig=${file.type}):`,
        errText.slice(0, 300)
      );
      return NextResponse.json(
        {
          status: "error",
          message: `Grok STT error: ${grokResponse.status}`,
          details: errText.slice(0, 500),
          debug: {
            origMime: file.type,
            sentAs: grokFilename,
            sentMime: grokMime,
            sizeBytes: file.size,
          },
        },
        { status: grokResponse.status }
      );
    }

    const result = await grokResponse.json();
    return NextResponse.json({
      status: "ok",
      text: result?.text ?? "",
      duration: result?.duration ?? 0,
      words: result?.words ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[STT] Internal error:", message);
    return NextResponse.json(
      { status: "error", message },
      { status: 500 }
    );
  }
}
