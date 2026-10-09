import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { db } from './db';
import { sessions, users } from './db/schema';
import { digest } from './security/crypto';
import { AppError } from './http';
export const SESSION_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-nemotron-session' : 'nemotron-session';
const duration = 60 * 60 * 24 * 14;
export async function getUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db().select({ id: users.id, email: users.email, name: users.name }).from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId)).where(and(eq(sessions.id, digest(token)), gt(sessions.expiresAt, new Date()))).limit(1);
  return row || null;
}
export async function requireUser() { const user = await getUser(); if (!user) throw new AppError('UNAUTHENTICATED', '로그인이 필요합니다.', 401); return user; }
export async function hasValidSession() { return Boolean(await getUser()); }
export function newSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  return { token, record: { id: digest(token), userId, expiresAt: new Date(Date.now() + duration * 1000) } };
}
export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: duration });
}
export async function currentSessionId() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? digest(token) : '';
}
export async function createSession(userId: string) {
  const session = newSession(userId); const database = db();
  await database.batch([
    database.delete(sessions).where(eq(sessions.id, await currentSessionId())),
    database.insert(sessions).values(session.record),
  ]);
  await setSessionCookie(session.token);
}
export async function destroySession() {
  const jar = await cookies(); const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db().delete(sessions).where(eq(sessions.id, digest(token)));
  jar.set(SESSION_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
}
