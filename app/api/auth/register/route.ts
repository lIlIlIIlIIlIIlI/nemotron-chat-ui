import { hash } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users, sessions } from '@/lib/db/schema';
import { api, body, json } from '@/lib/http';
import { registerInput } from '@/lib/validation';
import { newSession, setSessionCookie, currentSessionId } from '@/lib/auth';
import { clientIdentity, rateLimit } from '@/lib/security/rate-limit';
export const POST = api(async request => {
  const input = await body(request, registerInput);
  await rateLimit('register', clientIdentity(request), 10, 3600);
  const id = crypto.randomUUID(); const session = newSession(id); const database = db();
  const passwordHash = await hash(input.password, 12);
  await database.batch([
    database.insert(users).values({ id, email: input.email, name: input.name, passwordHash }),
    database.delete(sessions).where(eq(sessions.id, await currentSessionId())),
    database.insert(sessions).values(session.record),
  ]);
  await setSessionCookie(session.token);
  return json({ ok: true }, 201);
});
