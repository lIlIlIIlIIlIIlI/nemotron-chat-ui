import https from 'node:https';
import http from 'node:http';
import { lookup } from 'node:dns/promises';
import { Readable } from 'node:stream';
import ipaddr from 'ipaddr.js';
import { providerPresets } from '../ai/presets';
import { AppError } from '../http';
export function testNetworkEnabled() { return process.env.APP_TEST_MODE === '1' && process.env.NODE_ENV !== 'production'; }
export function isPublicAddress(address: string) {
  try { const parsed = ipaddr.process(address); return parsed.range() === 'unicast'; } catch { return false; }
}
export function validateProviderUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new AppError('PROVIDER_URL', 'Provider URL이 올바르지 않습니다.'); }
  if (testNetworkEnabled() && url.origin === 'http://127.0.0.1:4010' && !url.username && !url.password) return url;
  const allowed = new Set([...providerPresets.filter(x => x.baseUrl).map(x => new URL(x.baseUrl).hostname), ...(process.env.AI_ALLOWED_HOSTS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean)]);
  if (url.protocol !== 'https:' || url.username || url.password || url.port && url.port !== '443' || url.search || url.hash || !allowed.has(url.hostname)) {
    throw new AppError('PROVIDER_URL', 'HTTPS Provider 주소를 사용해 주세요. Custom 호스트는 서버의 AI_ALLOWED_HOSTS에 먼저 등록해야 합니다.');
  }
  return url;
}
export function providerUrl(base: string, path: string) {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('..')) throw new AppError('PROVIDER_URL', 'Endpoint 경로가 올바르지 않습니다.');
  return new URL(`${base.replace(/\/$/, '')}${path}`);
}
export async function providerFetch(url: URL, init: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal; timeoutMs?: number } = {}) {
  validateProviderUrl(url.origin + url.pathname);
  const test = testNetworkEnabled() && url.origin === 'http://127.0.0.1:4010';
  const addresses = test ? [{ address: '127.0.0.1', family: 4 }] : await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || !test && addresses.some(x => !isPublicAddress(x.address))) throw new AppError('PROVIDER_URL', '내부 네트워크 주소에는 연결할 수 없습니다.', 403);
  if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  // Pin the validated DNS result to the TLS request to prevent DNS rebinding. Never follow redirects.
  return new Promise<Response>((resolve, reject) => {
    const transport = test ? http : https;
    const req = transport.request(url, {
      method: init.method || 'GET', headers: init.headers,
      lookup: (_hostname, _options, callback) => callback(null, addresses[0].address, addresses[0].family),
      signal: init.signal, timeout: init.timeoutMs || 90000,
    }, res => {
      const status = res.statusCode || 502;
      if (status >= 300 && status < 400) { res.resume(); reject(new AppError('PROVIDER_REDIRECT', 'Provider의 리디렉션은 허용하지 않습니다.', 502)); return; }
      const headers = new Headers();
      for (const [key, value] of Object.entries(res.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(',') : value);
      resolve(new Response(Readable.toWeb(res) as ReadableStream<Uint8Array>, { status, headers }));
    });
    req.on('timeout', () => req.destroy(new AppError('TIMEOUT', 'Provider 응답 시간이 초과되었습니다.', 504)));
    req.on('error', reject);
    if (init.body) req.write(init.body); req.end();
  });
}
