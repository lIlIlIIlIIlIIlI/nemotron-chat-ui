import { requireUser } from '@/lib/auth';
import { api, AppError, json, readLimited } from '@/lib/http';
import { rateLimit } from '@/lib/security/rate-limit';
import { z } from 'zod';
import { decodeGeneratedImage } from '@/lib/ai/generated-image';

export const runtime = 'nodejs';
export const maxDuration = 120;

const inputSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  width: z.number().int().min(256).max(1920).default(1024),
  height: z.number().int().min(256).max(1920).default(1024),
  image: z.string().regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/).max(2_900_000).optional(),
});

export const POST = api(async request => {
  const user = await requireUser();
  await rateLimit('image-generation', user.id, 5, 60);
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder().decode(await readLimited(request, 3 * 1024 * 1024))); }
  catch (error) { if (error instanceof AppError) throw error; throw new AppError('INVALID_JSON', '올바른 JSON 요청이 필요합니다.', 400); }
  const input = inputSchema.parse(parsed);
  const endpoint = process.env.FLUX_WORKER_URL;
  const key = process.env.FLUX_WORKER_API_KEY;
  if (!endpoint || !key) throw new AppError('CONFIGURATION', 'FLUX Worker 연결 설정이 필요합니다.', 503);
  let base: URL;
  try { base = new URL(endpoint); } catch { throw new AppError('CONFIGURATION', 'FLUX Worker 주소가 올바르지 않습니다.', 503); }
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
    throw new AppError('CONFIGURATION', 'FLUX Worker에는 HTTPS 기본 URL을 설정해 주세요.', 503);
  }
  const payload: Record<string, unknown> = { prompt: input.prompt, width: input.width, height: input.height, response_format: 'json' };
  if (input.image) payload.input_image_0 = input.image;
  let response: Response;
  try {
    response = await fetch(new URL(input.image ? '/api/edit' : '/api/generate', base), {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(105000),
      cache: 'no-store',
    });
  } catch {
    throw new AppError('IMAGE_UNAVAILABLE', '이미지 생성 서버에 연결하지 못했습니다.', 502);
  }
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AppError('IMAGE_FAILED', response.status === 429 ? '이미지 생성 요청이 많습니다. 잠시 후 다시 시도해 주세요.' : '이미지 생성에 실패했습니다. Worker 설정 및 로그를 확인해 주세요.', 502);
  }
  let image: ReturnType<typeof decodeGeneratedImage>;
  try { image = decodeGeneratedImage(result); }
  catch (error) { throw new AppError('IMAGE_INVALID', error instanceof Error ? error.message : '이미지 생성 결과가 올바르지 않습니다.', 502); }
  return json({ image: `data:${image.mimeType};base64,${image.base64}`, mimeType: image.mimeType });
});
