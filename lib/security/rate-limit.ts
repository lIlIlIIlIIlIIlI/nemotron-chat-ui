import { sql } from 'drizzle-orm';
import { db } from '../db';
import { AppError } from '../http';
import { digest } from './crypto';
export async function rateLimit(scope: string, identity: string, max: number, seconds = 60) {
  const key = digest(`${scope}:${identity}`);
  const result = await db().execute(sql`INSERT INTO rate_limits(key,count,reset_at) VALUES(${key},1,now()+${seconds}*interval '1 second')
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.reset_at<=now() THEN 1 ELSE rate_limits.count+1 END,
    reset_at=CASE WHEN rate_limits.reset_at<=now() THEN now()+${seconds}*interval '1 second' ELSE rate_limits.reset_at END RETURNING count`);
  if (Number(result.rows[0]?.count) > max) throw new AppError('RATE_LIMIT', '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.', 429);
}
export function clientIdentity(request: Request) {
  // Only use a platform-authenticated IP header; self-hosted deployments default to a shared bucket.
  return process.env.VERCEL ? (request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || 'unknown') : 'self-hosted';
}
