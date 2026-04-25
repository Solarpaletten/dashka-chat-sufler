/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║ 📄  app/api/stt/route.ts                                           ║
 * ║ 🏷️  version:  2.3.0                                                ║
 * ║ 📅  created:  2026-04-23                                           ║
 * ║ 👥  author:   Solar Team · Leanid + Claude                         ║
 * ║                                                                    ║
 * ║ 🎯  PURPOSE — Grok STT proxy for Dashka Flow                       ║
 * ║     Proxies audio blob → Grok STT → returns text                   ║
 * ║     Used as fallback when Web Speech API is unavailable            ║
 * ║     (Safari iPhone, Firefox, etc.)                                 ║
 * ║                                                                    ║
 * ║ 🔄 CHANGELOG                                                       ║
 * ║   v2.3 — initial: Grok STT integration                             ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { status: "error", message: "XAI_API_KEY is missing" },
        { status: 500 }
      );
    }

    // Receive audio as multipart/form-data
    const formData = await req.formData();
    const file = formData.get("file");

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

    // Forward to Grok STT (batch REST endpoint)
    const grokForm = new FormData();
    grokForm.append("file", file, file.name || "audio.webm");

    const grokResponse = await fetch("https://api.x.ai/v1/stt", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: grokForm,
    });

    if (!grokResponse.ok) {
      const errText = await grokResponse.text().catch(() => "");
      return NextResponse.json(
        {
          status: "error",
          message: `Grok STT error: ${grokResponse.status}`,
          details: errText.slice(0, 500),
        },
        { status: grokResponse.status }
      );
    }

    const result = await grokResponse.json();
    return NextResponse.json({
      status: "ok",
      text: result?.text ?? "",
      language: result?.language ?? "unknown",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { status: "error", message },
      { status: 500 }
    );
  }
}
