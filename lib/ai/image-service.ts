import { AppError } from '../http';
import { providerFetch, providerUrl, validateProviderUrl } from '../security/provider-network';

export type ImageApiType = 'openai' | 'openai-compatible' | 'gemini';
export type ImageApiConfig = { type: ImageApiType; baseUrl: string; modelId: string; apiKey: string; name: string };
export type GeneratedImage = { bytes: Buffer; mimeType: 'image/png' | 'image/jpeg' | 'image/webp'; extension: 'png' | 'jpg' | 'webp' };

export function validateImageApi(type: ImageApiType, baseUrl: string, modelId: string) {
  const url = validateProviderUrl(baseUrl);
  if (url.search || url.hash || url.username || url.password) throw new AppError('IMAGE_PROVIDER_URL', 'API URL에 인증 정보를 포함할 수 없습니다.', 400);
  if (type === 'openai' && (url.origin !== 'https://api.openai.com' || url.pathname.replace(/\/$/, '') !== '/v1')) {
    throw new AppError('IMAGE_PROVIDER_URL', 'OpenAI API 주소는 https://api.openai.com/v1 이어야 합니다.', 400);
  }
  if (type === 'gemini' && (url.origin !== 'https://generativelanguage.googleapis.com' || !['/v1beta','/v1'].includes(url.pathname.replace(/\/$/, '')))) {
    throw new AppError('IMAGE_PROVIDER_URL', 'Gemini API 주소는 generativelanguage.googleapis.com/v1beta 또는 /v1 이어야 합니다.', 400);
  }
  if (!/^[a-zA-Z0-9_.\/-]{1,160}$/.test(modelId) || modelId.includes('..')) {
    throw new AppError('IMAGE_MODEL', '모델 ID가 올바르지 않습니다.', 400);
  }
  if (type === 'gemini' && modelId.includes('/')) throw new AppError('IMAGE_MODEL', 'Gemini 모델 ID 형식을 확인해 주세요.', 400);
  return url;
}

export function imageIntent(text: string) {
  const prompt = text.trim().toLowerCase();
  if (!prompt || prompt.length > 4000) return false;
  if (/(그리는 법|그리는 방법|만드는 법|만드는 방법|이미지 생성 (api|코드|방법)|how (to|do i) (draw|generate|create)|image generation (api|code|tutorial))/.test(prompt)) return false;
  return /(그려\s*줘|그려\s*주세요|그림\s*(?:을\s*)?(?:그려|만들어)|이미지\s*(?:를|하나)?\s*(?:만들어|생성해|그려)|사진\s*(?:을|하나)?\s*(?:만들어|생성해)|일러스트\s*(?:를)?\s*(?:그려|만들어|생성해)|포스터\s*(?:를)?\s*(?:만들어|제작해)|썸네일\s*(?:을)?\s*(?:만들어|제작해)|배경화면\s*(?:을)?\s*(?:만들어|생성해)|(?:generate|create|draw|paint|make)\s+(?:me\s+)?(?:an?\s+)?(?:image|picture|illustration|poster|thumbnail|wallpaper))/i.test(prompt);
}

export function decodeImage(base64: unknown): GeneratedImage {
  if (typeof base64 !== 'string') throw new AppError('IMAGE_INVALID', 'API에서 이미지 데이터가 반환되지 않았습니다.', 502);
  const text = base64.replace(/^data:image\/(?:png|jpeg|webp);base64,/i, '').trim();
  if (!text || text.length > 8_000_000 || !/^[a-zA-Z0-9+/]+={0,2}$/.test(text) || text.length % 4 === 1) throw new AppError('IMAGE_INVALID', 'Base64 이미지 데이터가 올바르지 않거나 너무 큽니다.', 502);
  const bytes = Buffer.from(text, 'base64');
  if (bytes.toString('base64').replace(/=+$/, '') !== text.replace(/=+$/, '') || bytes.length > 5 * 1024 * 1024) throw new AppError('IMAGE_TOO_LARGE', '생성한 이미지가 저장 가능한 크기(5MB)를 초과했습니다.', 413);
  if (bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return { bytes, mimeType:'image/png', extension:'png' };
  if (bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { bytes, mimeType:'image/jpeg', extension:'jpg' };
  if (bytes.length > 12 && bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP') return { bytes, mimeType:'image/webp', extension:'webp' };
  throw new AppError('IMAGE_INVALID', 'PNG, JPEG, WebP 이미지 형식만 지원합니다.', 502);
}

async function parseProviderResponse(response: Response) {
  const length = Number(response.headers.get('content-length') || 0);
  if (length > 8_000_000) throw new AppError('IMAGE_TOO_LARGE', '이미지 API 응답이 너무 큽니다.', 413);
  const reader = response.body?.getReader();
  if (!reader) throw new AppError('IMAGE_FAILED', '이미지 API에서 빈 응답을 받았습니다.', 502);
  const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 8_000_000) { await reader.cancel(); throw new AppError('IMAGE_TOO_LARGE', '이미지 API 응답이 너무 큽니다.', 413); } chunks.push(value); } }
  finally { reader.releaseLock(); }
  const data: unknown = (() => { try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return null; } })();
  if (!response.ok) {
    const status = response.status;
    const description = status === 401 || status === 403 ? 'API 키 또는 사용 권한을 확인해 주세요.' : status === 429 ? 'API 사용량 또는 크레딧 제한에 도달했습니다.' : '이미지 생성 API 호출에 실패했습니다.';
    throw new AppError('IMAGE_PROVIDER_ERROR', description, status === 429 ? 429 : 502);
  }
  if (!data || typeof data !== 'object') throw new AppError('IMAGE_FAILED', '이미지 API 응답이 JSON 형식이 아닙니다.', 502);
  return data as Record<string, unknown>;
}

export async function generateImage(config: ImageApiConfig, prompt: string, signal: AbortSignal): Promise<GeneratedImage> {
  validateImageApi(config.type, config.baseUrl, config.modelId);
  let path: string;
  let payload: unknown;
  let headers: Record<string,string>;
  if (config.type === 'gemini') {
    path = `/models/${config.modelId}:generateContent`;
    payload = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'] } };
    headers = { 'x-goog-api-key': config.apiKey, 'content-type': 'application/json' };
  } else {
    path = '/images/generations';
    payload = { model: config.modelId, prompt, size: '1024x1024', n: 1, ...(config.type === 'openai-compatible' ? { response_format: 'b64_json' } : {}) };
    headers = { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json' };
  }
  // Provider URL is pre-validated and DNS-pinned; no redirects to private hosts.
  const result = await parseProviderResponse(await providerFetch(providerUrl(config.baseUrl, path), {
    method: 'POST', headers, body: JSON.stringify(payload), signal, timeoutMs: 100000,
  }));
  if (config.type === 'gemini') {
    const candidates = result.candidates;
    const content = Array.isArray(candidates) ? (candidates[0] as {content?:{parts?: unknown[]}})?.content : null;
    const part = content?.parts?.find(p => Boolean(p && typeof p === 'object' && ('inlineData' in p || 'inline_data' in p))) as {inlineData?: {data?: unknown}; inline_data?: {data?: unknown}} | undefined;
    return decodeImage(part?.inlineData?.data ?? part?.inline_data?.data);
  }
  const data = Array.isArray(result.data) ? result.data[0] as { b64_json?: unknown } | undefined : undefined;
  if (!data?.b64_json) throw new AppError('IMAGE_INVALID', 'API가 Base64 이미지를 반환하지 않았습니다. b64_json 지원 모델인지 확인해 주세요.', 502);
  return decodeImage(data.b64_json);
}

export async function checkImageProvider(config: ImageApiConfig) {
  validateImageApi(config.type, config.baseUrl, config.modelId);
  const path = config.type === 'gemini' ? `/models/${config.modelId}` : '/models';
  const headers: Record<string, string> = config.type === 'gemini' ? { 'x-goog-api-key': config.apiKey } : { authorization: `Bearer ${config.apiKey}` };
  const response = await providerFetch(providerUrl(config.baseUrl, path), { headers, timeoutMs: 12000 });
  if (!response.ok) throw new AppError('IMAGE_TEST_FAILED', response.status === 401 || response.status === 403 ? 'API 키를 확인해 주세요.' : '모델 조회에 실패했습니다. 일부 호환 API는 모델 조회를 지원하지 않습니다.', 502);
  await response.body?.cancel();
  return { ok: true, message: 'API 연결 및 인증 확인에 성공했습니다. 이미지 생성은 별도로 테스트해야 하며 요금이 발생할 수 있습니다.' };
}
