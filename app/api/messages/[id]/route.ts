import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { ownedMessage } from '@/lib/data';
import { api, body, json, resourceId } from '@/lib/http';
import { db } from '@/lib/db';
import { messages } from '@/lib/db/schema';
export const PATCH = api(async request => { const user = await requireUser(); const message = await ownedMessage(user.id, resourceId(request)); const input = await body(request, z.object({ feedback: z.enum(['up','down']).nullable() })); await db().update(messages).set({ metadata: { ...message.metadata, feedback: input.feedback } }).where(eq(messages.id, message.id)); return json({ ok: true }); });
