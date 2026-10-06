import { eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { ownedModel } from '@/lib/data';
import { api, body, json, resourceId } from '@/lib/http';
import { db } from '@/lib/db';
import { models } from '@/lib/db/schema';
import { modelInput } from '@/lib/validation';
export const PATCH = api(async request => { const user = await requireUser(); const id = resourceId(request); await ownedModel(user.id, id); const input = await body(request, modelInput.omit({ providerId: true }).partial()); const [row] = await db().update(models).set(input).where(eq(models.id, id)).returning(); return json(row); });
export const DELETE = api(async request => { const user = await requireUser(); const id = resourceId(request); await ownedModel(user.id, id); await db().delete(models).where(eq(models.id, id)); return json({ ok: true }); });
