import { compare } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { api, body, json, AppError } from '@/lib/http';
import { loginInput } from '@/lib/validation';
import { createSession } from '@/lib/auth';
import { clientIdentity, rateLimit } from '@/lib/security/rate-limit';
export const POST = api(async request => {
  await rateLimit('login-ip', clientIdentity(request), 50, 900);
  const input = await body(request, loginInput); await rateLimit('login-account', input.email, 10, 900);
  const [user] = await db().select().from(users).where(eq(users.email, input.email));
  const valid = await compare(input.password, user?.passwordHash || '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6Ttxg0HGNnPkCLsx/Mkg.Q30Ya9Lu');
  if (!user || !valid) throw new AppError('INVALID_LOGIN', '이메일 또는 비밀번호가 올바르지 않습니다.', 401);
  await createSession(user.id); return json({ ok: true });
});
