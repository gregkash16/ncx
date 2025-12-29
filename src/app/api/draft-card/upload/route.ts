import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, reason: "NO_FILE" }, { status: 400 });
    }

    // Basic type check
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ ok: false, reason: "NOT_IMAGE" }, { status: 400 });
    }

    // Keep it reasonably sized (optional)
    const maxBytes = 8 * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json({ ok: false, reason: "FILE_TOO_LARGE" }, { status: 400 });
    }

    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `draft-cards/headshots/${Date.now()}_${safeName}`;

    const blob = await put(path, file, {
      access: "public",
      contentType: file.type,
    });

    return NextResponse.json({ ok: true, url: blob.url });
  } catch (err: any) {
    console.error("POST /api/draft-card/upload error:", err);
    return NextResponse.json(
      { ok: false, reason: err?.message ?? "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
