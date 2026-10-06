import { compare, hash } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users, sessions } from '@/lib/db/schema';
import { requireUser, createSession } from '@/lib/auth';
import { api, body, json, AppError } from '@/lib/http';
import { password } from '@/lib/validation';
import { rateLimit } from '@/lib/security/rate-limit';
export const POST = api(async request => {
  const user = await requireUser(); await rateLimit('password', user.id, 5, 900);
  const input = await body(request, z.object({ currentPassword: z.string().max(128), newPassword: password }));
  const [record] = await db().select().from(users).where(eq(users.id, user.id));
  if (!await compare(input.currentPassword, record.passwordHash)) throw new AppError('INVALID_PASSWORD', '현재 비밀번호가 올바르지 않습니다.', 403);
  await db().transaction(async tx => { await tx.update(users).set({ passwordHash: await hash(input.newPassword, 12) }).where(eq(users.id, user.id)); await tx.delete(sessions).where(eq(sessions.userId, user.id)); });
  await createSession(user.id); return json({ ok: true });
});
