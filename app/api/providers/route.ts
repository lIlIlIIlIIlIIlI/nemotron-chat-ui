import { db } from '@/lib/db';
import { providers, credentials } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { listProviders } from '@/lib/data';
import { api, body, json } from '@/lib/http';
import { providerInput } from '@/lib/validation';
import { encryptSecret } from '@/lib/security/crypto';
import { validateProviderUrl } from '@/lib/security/provider-network';
import { rateLimit } from '@/lib/security/rate-limit';
export const GET = api(async () => json(await listProviders((await requireUser()).id)));
export const POST = api(async request => {
  const user = await requireUser(); await rateLimit('provider-write', user.id, 20);
  const { apiKey, ...input } = await body(request, providerInput); validateProviderUrl(input.baseUrl);
  const id = crypto.randomUUID();
  const database = db();
  await database.batch([
    database.insert(providers).values({ ...input, id, userId: user.id }),
    database.insert(credentials).values({ providerId: id, encryptedApiKey: encryptSecret(apiKey, `${user.id}:${id}`), keyLastFour: apiKey.slice(-4) }),
  ]);
  return json((await listProviders(user.id)).find(x => x.id === id), 201);
});
