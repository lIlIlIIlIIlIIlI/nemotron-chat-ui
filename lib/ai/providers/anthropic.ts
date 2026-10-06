import type { AIAdapter, AIChunk } from '../types';
import { parseSSE } from '../sse';
import { maxTokens, modelsPage, option, requestStream } from './shared';
import { providerError } from '../errors';
type AnthropicEvent = { type: string; delta?: { type?: string; text?: string; stop_reason?: string }; usage?: { input_tokens?: number; output_tokens?: number }; message?: { usage?: { input_tokens?: number; output_tokens?: number } } };
export const anthropic: AIAdapter = {
  async *stream(request): AsyncGenerator<AIChunk> {
    const stream = await requestStream(request, request.provider.chatEndpoint, {
      model: request.model.modelId, system: request.system || undefined, max_tokens: maxTokens(request), stream: true,
      // Anthropic models can reject temperature + top_p together. Prefer explicit temperature.
      ...(option(request, 'temperature') !== undefined ? { temperature: option(request, 'temperature') } : { top_p: option(request, 'topP') }),
      messages: request.messages.map(message => ({ role: message.role, content: [...(message.images || []).map(img => ({ type: 'image', source: { type: 'base64', media_type: img.mimeType, data: img.data } })), { type: 'text', text: message.text || '첨부 파일을 분석해 주세요.' }] })),
    });
    let ended = false; let input = 0;
    for await (const event of parseSSE(stream)) {
      const value = JSON.parse(event.data) as AnthropicEvent;
      if (value.type === 'error') throw providerError(502);
      if (value.type === 'message_start') input = value.message?.usage?.input_tokens || 0;
      if (value.delta?.type === 'text_delta' && value.delta.text) yield { type: 'text', text: value.delta.text };
      if (value.delta?.type === 'thinking_delta') yield { type: 'thinking' };
      if (value.usage) yield { type: 'usage', usage: { promptTokens: input, completionTokens: value.usage.output_tokens, totalTokens: input + (value.usage.output_tokens || 0) } };
      if (value.type === 'message_stop') ended = true;
    }
    if (!ended && !request.signal.aborted) throw providerError(502);
  },
  async listModels(provider, signal) {
    const result: { id: string; name: string }[] = []; let after = '';
    for (let page = 0; page < 10; page++) {
      const value = await modelsPage(provider, `${provider.modelsEndpoint}?limit=100${after ? `&after_id=${encodeURIComponent(after)}` : ''}`, signal) as { data?: { id: string; display_name: string }[]; has_more?: boolean; last_id?: string };
      result.push(...(value.data || []).filter(x => typeof x.id === 'string').map(x => ({ id: x.id, name: x.display_name || x.id })));
      if (!value.has_more || !value.last_id) break; after = value.last_id;
    }
    return result;
  },
};
