import { providerFetch, providerUrl } from '../../security/provider-network';
import { providerError } from '../errors';
import type { AIProvider, AIRequest } from '../types';
export function headers(provider: AIProvider) {
  if (provider.type === 'anthropic') return { 'Content-Type': 'application/json', 'x-api-key': provider.apiKey, 'anthropic-version': '2023-06-01' };
  if (provider.type === 'gemini') return { 'Content-Type': 'application/json', 'x-goog-api-key': provider.apiKey };
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` };
}
export async function requestStream(request: AIRequest, path: string, payload: unknown) {
  const response = await providerFetch(providerUrl(request.provider.baseUrl, path), { method: 'POST', headers: headers(request.provider), body: JSON.stringify(payload), signal: request.signal });
  if (!response.ok) { await response.body?.cancel(); throw providerError(response.status); }
  if (!response.body) throw providerError(502);
  return response.body;
}
export async function modelsPage(provider: AIProvider, path: string, signal: AbortSignal): Promise<unknown> {
  const response = await providerFetch(providerUrl(provider.baseUrl, path), { headers: headers(provider), signal, timeoutMs: 20000 });
  if (!response.ok) { await response.body?.cancel(); throw providerError(response.status); }
  const reader = response.body?.getReader(); if (!reader) throw providerError(502);
  const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 4 * 1024 * 1024) throw providerError(502); chunks.push(value); } }
  finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}
export function option(request: AIRequest, name: keyof AIRequest['options']) {
  return request.model.supportedOptions.includes(name) ? request.options[name] : undefined;
}
export function maxTokens(request: AIRequest) { return Math.min(request.options.maxTokens || request.model.maxOutputTokens, request.model.maxOutputTokens); }
