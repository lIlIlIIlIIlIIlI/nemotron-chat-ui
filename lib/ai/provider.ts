import { openAICompatible } from './providers/openai-compatible';
import { openAI } from './providers/openai';
import { anthropic } from './providers/anthropic';
import { gemini } from './providers/gemini';
import type { ProviderType } from '../types';
import type { AIAdapter, AIRequest } from './types';
const adapters: Record<ProviderType, AIAdapter> = { openai: openAI, 'openai-compatible': openAICompatible, anthropic, gemini };
export function adapter(type: ProviderType) { return adapters[type]; }
export function streamChat(request: AIRequest) { return adapter(request.provider.type).stream(request); }
