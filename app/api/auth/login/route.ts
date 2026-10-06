import { NextResponse } from "next/server";
import { createSessionToken, credentialsAreConfigured, sessionCookie, verifyCredentials } from "@/lib/auth";

export const runtime = "nodejs";

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

  if (!credentialsAreConfigured()) {
    return NextResponse.json(
      { error: "로그인 환경 변수를 설정한 뒤 다시 시도해 주세요." },
      { status: 503 },
    );
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "입력값을 확인해 주세요." }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username.slice(0, 200) : "";
  const password = typeof body.password === "string" ? body.password.slice(0, 500) : "";
  if (!verifyCredentials(username, password)) {
    return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie.name, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionCookie.maxAge,
  });
  return response;
}
