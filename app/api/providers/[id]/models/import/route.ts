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
  const database = db();
  const queries = [];
  // Each model binds ~18 values; stay below D1's 100-variable statement limit.
  for (let start = 0; start < input.models.length; start += 4) queries.push(database.insert(models).values(input.models.slice(start, start + 4).map(model => ({ ...model, providerId }))).onConflictDoNothing().returning());
  const results = await database.batch([queries[0], ...queries.slice(1)]);
  return json(results.flat(), 201);
});
