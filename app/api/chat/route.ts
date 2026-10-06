import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidSessionToken, sessionCookie } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) {
        return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 403 });
    }
  }

  const cookieStore = await cookies();
  if (!isValidSessionToken(cookieStore.get(sessionCookie.name)?.value)) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "서버에 NVIDIA_API_KEY 환경 변수를 설정해 주세요." },
      { status: 503 },
    );
  }

  let input: { messages?: unknown };
  try {
    input = (await request.json()) as typeof input;
  } catch {
    return NextResponse.json({ error: "대화 형식을 확인해 주세요." }, { status: 400 });
  }

  if (!Array.isArray(input.messages) || input.messages.length === 0 || input.messages.length > 40) {
    return NextResponse.json({ error: "대화 메시지를 확인해 주세요." }, { status: 400 });
  }

  const messages: ChatMessage[] = [];
  let characterCount = 0;
  for (const entry of input.messages) {
    if (
      !entry ||
      typeof entry !== "object" ||
      !("role" in entry) ||
      !("content" in entry) ||
      (entry.role !== "user" && entry.role !== "assistant") ||
      typeof entry.content !== "string"
    ) {
      return NextResponse.json({ error: "메시지 형식을 확인해 주세요." }, { status: 400 });
    }

    const content = entry.content.slice(0, 20_000);
    characterCount += content.length;
    if (characterCount > 80_000) {
      return NextResponse.json({ error: "대화가 너무 깁니다. 새 채팅을 시작해 주세요." }, { status: 413 });
    }
    messages.push({ role: entry.role, content });
  }

  let upstream: Response;
  try {
    upstream = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.NVIDIA_MODEL || "nvidia/nemotron-3-ultra-550b-a55b",
        messages,
        temperature: 1,
        top_p: 0.95,
        max_tokens: 16384,
        chat_template_kwargs: { enable_thinking: true },
        stream: true,
      }),
      cache: "no-store",
      signal: request.signal,
    });
  } catch {
    return NextResponse.json({ error: "NVIDIA API에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    let detail = "NVIDIA API에서 응답을 받지 못했습니다.";
    try {
      const errorBody = (await upstream.json()) as { error?: { message?: string } };
      if (errorBody.error?.message) detail = errorBody.error.message.slice(0, 300);
    } catch {
      // Keep the generic message if the provider response is not JSON.
    }
    return NextResponse.json({ error: detail }, { status: upstream.status >= 400 ? upstream.status : 502 });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      let pending = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          pending += decoder.decode(value, { stream: true });
          const lines = pending.split(/\r?\n/);
          pending = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const event = JSON.parse(data) as {
                choices?: Array<{ delta?: { content?: unknown } }>;
              };
              const text = event.choices?.[0]?.delta?.content;
              if (typeof text === "string" && text) controller.enqueue(encoder.encode(text));
            } catch {
              // Ignore incomplete or provider-specific SSE events.
            }
          }
        }
        pending += decoder.decode();
        if (pending.startsWith("data:")) {
          const data = pending.slice(5).trim();
          if (data && data !== "[DONE]") {
            try {
              const event = JSON.parse(data) as {
                choices?: Array<{ delta?: { content?: unknown } }>;
              };
              const text = event.choices?.[0]?.delta?.content;
              if (typeof text === "string" && text) controller.enqueue(encoder.encode(text));
            } catch {
              // Ignore an incomplete final event.
            }
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
    cancel() {
      void upstream.body!.cancel();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
