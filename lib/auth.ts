import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "nemotron_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function constantTimeTextEqual(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

export function credentialsAreConfigured() {
  return Boolean(
    process.env.APP_LOGIN_USERNAME &&
      process.env.APP_LOGIN_PASSWORD &&
      getSecret(),
  );
}

export function verifyCredentials(username: string, password: string) {
  const expectedUsername = process.env.APP_LOGIN_USERNAME;
  const expectedPassword = process.env.APP_LOGIN_PASSWORD;
  if (!expectedUsername || !expectedPassword || !getSecret()) return false;
  return (
    constantTimeTextEqual(username, expectedUsername) &&
    constantTimeTextEqual(password, expectedPassword)
  );
}

export function createSessionToken() {
  const secret = getSecret();
  if (!secret) throw new Error("AUTH_SECRET must contain at least 32 characters.");
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS }),
  ).toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}

export function isValidSessionToken(token?: string) {
  const secret = getSecret();
  if (!secret || !token) return false;

  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return false;
  if (!constantTimeTextEqual(suppliedSignature, signature(payload, secret))) return false;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      exp?: number;
    };
    return typeof parsed.exp === "number" && parsed.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export async function hasValidSession() {
  const cookieStore = await cookies();
  return isValidSessionToken(cookieStore.get(COOKIE_NAME)?.value);
}

export const sessionCookie = {
  name: COOKIE_NAME,
  maxAge: SESSION_SECONDS,
};
