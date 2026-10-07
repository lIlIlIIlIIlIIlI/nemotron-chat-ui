import type { AIAdapter, AIChunk, AIRequest } from '../types';
import { parseSSE } from '../sse';
import { maxTokens, modelsPage, option, requestStream } from './shared';
import { providerError } from '../errors';
export function openAIOptions(request: AIRequest) {
  const payload: Record<string, unknown> = {};
  const mapping = { temperature: 'temperature', topP: 'top_p', frequencyPenalty: 'frequency_penalty', presencePenalty: 'presence_penalty' } as const;
  for (const key of Object.keys(mapping) as (keyof typeof mapping)[]) if (option(request, key) !== undefined) payload[mapping[key]] = option(request, key);
  if (request.model.supportedOptions.includes('maxTokens')) payload[request.model.outputTokenParam] = maxTokens(request);
  if (request.model.capabilities.includes('reasoning')) {
    if (request.model.reasoningStyle === 'nvidia') payload.chat_template_kwargs = { enable_thinking: request.options.reasoningEffort !== 'off' };
    if (request.model.reasoningStyle === 'effort' && option(request, 'reasoningEffort') && request.options.reasoningEffort !== 'off') payload.reasoning_effort = request.options.reasoningEffort;
  }
  return payload;
}
type OpenAIEvent = { error?: unknown; choices?: { delta?: { content?: string; reasoning_content?: string }; finish_reason?: string }[]; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };
export const openAICompatible: AIAdapter = {
  async *stream(request): AsyncGenerator<AIChunk> {
    const messages: unknown[] = request.system ? [{ role: 'system', content: request.system }] : [];
    for (const message of request.messages) messages.push({ role: message.role, content: message.images?.length ? [{ type: 'text', text: message.text }, ...message.images.map(img => ({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.data}` } }))] : message.text });
    const stream = await requestStream(request, request.provider.chatEndpoint, { model: request.model.modelId, messages, stream: true, ...openAIOptions(request) });
    let ended = false;
    for await (const event of parseSSE(stream)) {
      if (event.data === '[DONE]') { ended = true; break; }
      const value = JSON.parse(event.data) as OpenAIEvent;
      if (value.error) throw providerError(502);
      const delta = value.choices?.[0]?.delta;
      // Raw reasoning_content is intentionally never retained or returned.
      if (delta?.reasoning_content) yield { type: 'thinking' };
      if (typeof delta?.content === 'string') yield { type: 'text', text: delta.content };
      if (value.choices?.[0]?.finish_reason) ended = true;
      if (value.usage) yield { type: 'usage', usage: { promptTokens: value.usage.prompt_tokens, completionTokens: value.usage.completion_tokens, totalTokens: value.usage.total_tokens } };
    }
    if (!ended && !request.signal.aborted) throw providerError(502);
  },
  async listModels(provider, signal) {
    const value = await modelsPage(provider, provider.modelsEndpoint, signal) as { data?: { id: string; name?: string }[] };
    return (value.data || []).filter(x => typeof x.id === 'string').slice(0, 2000).map(x => ({ id: x.id, name: x.name || x.id }));
  },
};
