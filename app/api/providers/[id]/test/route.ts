import { requireUser } from '@/lib/auth';
import { ownedProvider, listModels } from '@/lib/data';
import { api, json, resourceId } from '@/lib/http';
import { adapter } from '@/lib/ai/provider';
import { safeAIError } from '@/lib/ai/errors';
import { rateLimit } from '@/lib/security/rate-limit';
export const POST = api(async request => {
  const user = await requireUser(); await rateLimit('provider-test', user.id, 5);
  const provider = await ownedProvider(user.id, resourceId(request, 1), true);
  const model = (await listModels(user.id)).find(x => x.providerId === provider.id && x.isEnabled);
  const controller = new AbortController(); const signal = AbortSignal.any([request.signal, controller.signal, AbortSignal.timeout(30000)]);
  try {
    if (model) { for await (const chunk of adapter(provider.type).stream({ provider, model, system: '', messages: [{ role: 'user', text: 'Reply OK' }], options: { maxTokens: 16 }, signal })) if (chunk.type === 'text') break; controller.abort(); return json({ ok: true, message: '연결됨 · 실제 채팅 요청 성공 (소량의 토큰이 사용됩니다).' }); }
    const models = await adapter(provider.type).listModels(provider, signal);
    return json({ ok: true, message: `모델 API 연결됨 · ${models.length}개. 모델 등록 후 다시 테스트하면 채팅 권한도 확인합니다.` });
  } catch (error) { throw safeAIError(error); }
});
