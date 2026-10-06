import type { AIModel, GenerationOptions, ProviderType, Usage } from '../types';
export type AIContent = { role: 'user' | 'assistant'; text: string; images?: { mimeType: string; data: string }[] };
export type AIProvider = { id: string; name: string; type: ProviderType; baseUrl: string; chatEndpoint: string; modelsEndpoint: string; apiKey: string };
export type AIRequest = { provider: AIProvider; model: Omit<AIModel, 'lastUsedAt'>; system: string; messages: AIContent[]; options: GenerationOptions; signal: AbortSignal };
export type AIChunk = { type: 'text'; text: string } | { type: 'thinking' } | { type: 'usage'; usage: Usage };
export interface AIAdapter { stream(request: AIRequest): AsyncGenerator<AIChunk>; listModels(provider: AIProvider, signal: AbortSignal): Promise<{ id: string; name: string }[]> }
