import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { ownedProvider } from '@/lib/data';
import { api, body, json, resourceId } from '@/lib/http';
import { db } from '@/lib/db';
import { models } from '@/lib/db/schema';
import { modelInput } from '@/lib/validation';
export const POST = api(async request => {
  const user = await requireUser(); const providerId = resourceId(request, 2); await ownedProvider(user.id, providerId);
  const input = await body(request, z.object({ models: z.array(modelInput.omit({ providerId: true })).min(1).max(100) }));
  const rows = await db().insert(models).values(input.models.map(model => ({ ...model, providerId }))).onConflictDoNothing().returning(); return json(rows, 201);
});
