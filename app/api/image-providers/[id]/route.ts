import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { imageProviders } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { api, body, json, resourceId } from '@/lib/http';
import { imageProviderPatch } from '@/lib/validation';
import { encryptSecret } from '@/lib/security/crypto';
import { validateImageApi } from '@/lib/ai/image-service';
import { listImageProviders, ownedImageProvider } from '@/lib/ai/image-providers';
export const PATCH = api(async request => {
  const user = await requireUser(); const id = resourceId(request);
  const existing = await ownedImageProvider(user.id, id); const patch = await body(request, imageProviderPatch);
  validateImageApi(patch.type || existing.type, patch.baseUrl || existing.baseUrl, patch.modelId || existing.modelId);
  const { apiKey, ...fields } = patch;
  await db().update(imageProviders).set({ ...fields, ...(apiKey ? { encryptedApiKey: encryptSecret(apiKey, `${user.id}:image:${id}`), keyLastFour: apiKey.slice(-4) } : {}) }).where(eq(imageProviders.id, id));
  return json((await listImageProviders(user.id)).find(x => x.id === id));
});
export const DELETE = api(async request => { const user = await requireUser(); const id = resourceId(request); await ownedImageProvider(user.id, id); await db().delete(imageProviders).where(eq(imageProviders.id, id)); return json({ ok: true }); });
