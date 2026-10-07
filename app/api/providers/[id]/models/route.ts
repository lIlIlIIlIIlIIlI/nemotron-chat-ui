import { requireUser } from '@/lib/auth';
import { ownedProvider } from '@/lib/data';
import { api, json, resourceId } from '@/lib/http';
import { adapter } from '@/lib/ai/provider';
import { safeAIError } from '@/lib/ai/errors';
import { rateLimit } from '@/lib/security/rate-limit';
export const GET = api(async request => {
  const user = await requireUser(); await rateLimit('provider-discovery', user.id, 10);
  const provider = await ownedProvider(user.id, resourceId(request, 1), true);
  try { return json(await adapter(provider.type).listModels(provider, AbortSignal.any([request.signal, AbortSignal.timeout(30000)]))); }
  catch (error) { throw safeAIError(error); }
});
