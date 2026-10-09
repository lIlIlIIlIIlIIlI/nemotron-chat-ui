import { requireUser } from '@/lib/auth';
import { api, json, resourceId } from '@/lib/http';
import { imageProviderConfig } from '@/lib/ai/image-providers';
import { checkImageProvider } from '@/lib/ai/image-service';
import { rateLimit } from '@/lib/security/rate-limit';
export const POST = api(async request => {
  const user = await requireUser(); await rateLimit('image-provider-test', user.id, 5, 60);
  return json(await checkImageProvider(await imageProviderConfig(user.id, resourceId(request, 1))));
});
