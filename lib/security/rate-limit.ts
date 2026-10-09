import { sql } from 'drizzle-orm';
import { db } from '../db';
import { rateLimits } from '../db/schema';
import { AppError } from '../http';
import { digest } from './crypto';
export async function rateLimit(scope: string, identity: string, max: number, seconds = 60) {
  const key = digest(`${scope}:${identity}`);
  const now = Date.now(); const resetAt = now + seconds * 1000;
  const [result] = await db().insert(rateLimits).values({ key, count: 1, resetAt: new Date(resetAt) }).onConflictDoUpdate({
    target: rateLimits.key,
    set: { count: sql`case when ${rateLimits.resetAt} <= ${now} then 1 else ${rateLimits.count} + 1 end`,
      resetAt: sql`case when ${rateLimits.resetAt} <= ${now} then ${resetAt} else ${rateLimits.resetAt} end` },
  }).returning();
  if (result.count > max) throw new AppError('RATE_LIMIT', '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.', 429, Math.max(1, Math.ceil((result.resetAt.getTime() - now) / 1000)));
}
export function clientIdentity(request: Request) {
  // Only use a platform-authenticated IP header; self-hosted deployments default to a shared bucket.
  return process.env.VERCEL ? (request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || 'unknown') : 'self-hosted';
}
