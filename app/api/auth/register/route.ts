import { hash } from 'bcryptjs';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { api, body, json, AppError } from '@/lib/http';
import { registerInput } from '@/lib/validation';
import { createSession } from '@/lib/auth';
import { clientIdentity, rateLimit } from '@/lib/security/rate-limit';
export const POST = api(async request => {
  await rateLimit('register', clientIdentity(request), 10, 3600);
  const input = await body(request, registerInput);
  const [user] = await db().insert(users).values({ email: input.email, name: input.name, passwordHash: await hash(input.password, 12) }).onConflictDoNothing().returning({ id: users.id });
  if (!user) throw new AppError('ACCOUNT_UNAVAILABLE', '이 이메일로 계정을 만들 수 없습니다.');
  await createSession(user.id); return json({ ok: true }, 201);
});
