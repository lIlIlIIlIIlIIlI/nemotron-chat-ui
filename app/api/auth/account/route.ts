import { compare } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { requireUser, destroySession } from '@/lib/auth';
import { api, body, json, AppError } from '@/lib/http';
import { rateLimit } from '@/lib/security/rate-limit';
export const DELETE = api(async request => {
  const user = await requireUser(); await rateLimit('delete-account', user.id, 5, 900);
  const input = await body(request, z.object({ password: z.string().max(128), confirmation: z.literal('DELETE') }));
  const [record] = await db().select().from(users).where(eq(users.id, user.id));
  if (!await compare(input.password, record.passwordHash)) throw new AppError('INVALID_PASSWORD', '비밀번호가 올바르지 않습니다.', 403);
  await db().delete(users).where(eq(users.id, user.id)); await destroySession(); return json({ ok: true });
});
