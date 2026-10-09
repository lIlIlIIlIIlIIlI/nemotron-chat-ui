import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { providers, credentials } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { listProviders, ownedProvider } from '@/lib/data';
import { api, body, json, resourceId } from '@/lib/http';
import { providerPatch } from '@/lib/validation';
import { encryptSecret } from '@/lib/security/crypto';
import { validateProviderUrl } from '@/lib/security/provider-network';
export const PATCH = api(async request => {
  const user = await requireUser(); const id = resourceId(request); await ownedProvider(user.id, id);
  const { apiKey, ...input } = await body(request, providerPatch); if (input.baseUrl) validateProviderUrl(input.baseUrl);
  const database = db();
  const update = database.update(providers).set(Object.keys(input).length ? input : { id }).where(eq(providers.id, id));
  if (apiKey) {
    const value = { encryptedApiKey: encryptSecret(apiKey, `${user.id}:${id}`), keyLastFour: apiKey.slice(-4) };
    await database.batch([update, database.insert(credentials).values({ providerId: id, ...value }).onConflictDoUpdate({ target: credentials.providerId, set: value })]);
  } else if (Object.keys(input).length) await update;
  return json((await listProviders(user.id)).find(x => x.id === id));
});
export const DELETE = api(async request => { const user = await requireUser(); const id = resourceId(request); await ownedProvider(user.id, id); await db().delete(providers).where(eq(providers.id, id)); return json({ ok: true }); });
