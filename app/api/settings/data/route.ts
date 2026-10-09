import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { api, body, json } from '@/lib/http';
import { db } from '@/lib/db';
import { credentials, providers, projects, attachments } from '@/lib/db/schema';
export const DELETE = api(async request => {
  const user = await requireUser(); const input = await body(request, z.object({ target: z.enum(['credentials','projects','files']), confirmation: z.literal('DELETE') }));
  if (input.target === 'credentials') await db().delete(credentials).where(inArray(credentials.providerId, db().select({ id: providers.id }).from(providers).where(eq(providers.userId, user.id))));
  if (input.target === 'projects') await db().delete(projects).where(eq(projects.userId, user.id));
  if (input.target === 'files') await db().delete(attachments).where(eq(attachments.userId, user.id));
  return json({ ok: true });
});
