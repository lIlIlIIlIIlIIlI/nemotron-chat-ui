import { ZodError, type ZodType } from 'zod';
import { AppError, knownError } from './errors';
import { allowedOrigins } from './config';
export { AppError } from './errors';
export function assertOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || !allowedOrigins(request).has(origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new AppError('CSRF', '요청 출처를 확인할 수 없습니다. 페이지를 새로고침해 주세요.', 403);
}
export async function readLimited(request: Request, limit: number) {
  if (Number(request.headers.get('content-length')) > limit) throw new AppError('TOO_LARGE', '요청 크기가 너무 큽니다.', 413);
  const reader = request.body?.getReader(); if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length;
      if (size > limit) { await reader.cancel(); throw new AppError('TOO_LARGE', '요청 크기가 너무 큽니다.', 413); } chunks.push(value); }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
export async function body<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder().decode(await readLimited(request, 256 * 1024))); }
  catch (error) { if (error instanceof AppError) throw error; throw new AppError('INVALID_JSON', '올바른 JSON 요청이 필요합니다.'); }
  return schema.parse(parsed);
}
export function json(value: unknown, status = 200) { return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } }); }
export function api(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    const requestId = crypto.randomUUID();
    const start = Date.now();
    try {
      if (!['GET', 'HEAD'].includes(request.method)) assertOrigin(request);
      const response = await handler(request);
      response.headers.set('X-Request-Id', requestId);
      return response;
    }
    catch (error) {
      const safe = knownError(error);
      const status = safe?.status || (error instanceof ZodError ? 400 : 500);
      const code = safe?.code || (error instanceof ZodError ? 'VALIDATION' : 'SERVER_ERROR');
      if (status >= 500) console.error('request_failed', { requestId, code, method: request.method, durationMs: Date.now() - start });
      const response = json({ error: safe?.message || (error instanceof ZodError ? error.issues[0]?.message || '입력값을 확인해 주세요.' : '요청을 완료하지 못했습니다. 요청 ID로 관리자에게 문의해 주세요.'), code, requestId,
        ...(error instanceof ZodError ? { fields: error.issues.map(x => ({ path: x.path.join('.'), message: x.message })) } : {}),
      }, status);
      response.headers.set('X-Request-Id', requestId);
      if (safe?.retryAfter) response.headers.set('Retry-After', String(safe.retryAfter));
      return response;
    }
  };
}
export function resourceId(request: Request, suffix = 0) { return new URL(request.url).pathname.split('/').filter(Boolean).at(-1 - suffix)!; }
