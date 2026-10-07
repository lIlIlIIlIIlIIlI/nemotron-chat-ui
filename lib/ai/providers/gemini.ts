import type { AIAdapter, AIChunk } from '../types';
import { parseSSE } from '../sse';
import { maxTokens, modelsPage, option, requestStream } from './shared';
import { providerError } from '../errors';
type GeminiEvent = { error?: unknown; candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[]; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }; promptFeedback?: { blockReason?: string } };
export const gemini: AIAdapter = {
  async *stream(request): AsyncGenerator<AIChunk> {
    const model = request.model.modelId.replace(/^models\//, '');
    const stream = await requestStream(request, `${request.provider.chatEndpoint}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
      systemInstruction: request.system ? { parts: [{ text: request.system }] } : undefined,
      contents: request.messages.map(message => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.text || '첨부 파일을 분석해 주세요.' }, ...(message.images || []).map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } }))] })),
      generationConfig: { temperature: option(request, 'temperature'), topP: option(request, 'topP'), maxOutputTokens: maxTokens(request) },
    });
    let ended = false;
    for await (const event of parseSSE(stream)) {
      const value = JSON.parse(event.data) as GeminiEvent;
      if (value.error || value.promptFeedback?.blockReason) throw providerError(400);
      for (const part of value.candidates?.[0]?.content?.parts || []) {
        if (part.thought) { yield { type: 'thinking' }; continue; }
        if (part.text) yield { type: 'text', text: part.text };
      }
      if (value.candidates?.[0]?.finishReason) ended = true;
      if (value.usageMetadata) yield { type: 'usage', usage: { promptTokens: value.usageMetadata.promptTokenCount, completionTokens: value.usageMetadata.candidatesTokenCount, totalTokens: value.usageMetadata.totalTokenCount } };
    }
    if (!ended && !request.signal.aborted) throw providerError(502);
  },
  async listModels(provider, signal) {
    const result: { id: string; name: string }[] = []; let token = '';
    for (let page = 0; page < 10; page++) {
      const value = await modelsPage(provider, `${provider.modelsEndpoint}?pageSize=100${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`, signal) as { models?: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[]; nextPageToken?: string };
      result.push(...(value.models || []).filter(x => x.supportedGenerationMethods?.includes('generateContent')).map(x => ({ id: x.name.replace(/^models\//, ''), name: x.displayName || x.name })));
      if (!value.nextPageToken) break; token = value.nextPageToken;
    }
    return result;
  },
};
