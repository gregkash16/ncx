import { NextRequest, NextResponse } from "next/server";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SYSTEM_PROMPT = "You are a helpful voice assistant displayed on a Corsair Xeneon Edge gaming monitor. Keep all responses short and conversational — 1 to 3 sentences maximum. Never use markdown, bullet points, headers, asterisks, or any special formatting. Plain text only.";

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid messages" }, { status: 400 });
    }

    const maxRetries = 3;
    let lastError = "";

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) await sleep(1500 * attempt);

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY || "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.content?.[0]?.text || "";
        return NextResponse.json({ response: text });
      }

      lastError = `${response.status}: ${await response.text()}`;

      if (response.status !== 529 && response.status !== 503) {
        return NextResponse.json({ error: lastError }, { status: response.status });
      }
    }

    return NextResponse.json({ error: `Overloaded after retries: ${lastError}` }, { status: 529 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
