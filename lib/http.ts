import { ZodError, type ZodType } from 'zod';
export class AppError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}
export function assertOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const expected = new URL(process.env.APP_URL || request.url).origin;
  if (!origin || origin !== expected || request.headers.get('sec-fetch-site') === 'cross-site') throw new AppError('CSRF', '요청 출처를 확인할 수 없습니다. 페이지를 새로고침해 주세요.', 403);
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
    try { if (!['GET', 'HEAD'].includes(request.method)) assertOrigin(request); return await handler(request); }
    catch (error) {
      if (error instanceof AppError) return json({ error: error.message, code: error.code }, error.status);
      if (error instanceof ZodError) return json({ error: '입력값을 확인해 주세요.', code: 'VALIDATION', fields: error.issues.map(x => ({ path: x.path.join('.'), message: x.message })) }, 400);
      // Never log upstream payloads, database query parameters, headers or secrets.
      console.error('request_failed', { category: error instanceof Error ? error.name : 'Error' });
      return json({ error: '서버 요청을 완료하지 못했습니다. 설정과 연결을 확인해 주세요.', code: 'SERVER_ERROR' }, 500);
    }
  };
}
export function resourceId(request: Request, suffix = 0) { return new URL(request.url).pathname.split('/').filter(Boolean).at(-1 - suffix)!; }
