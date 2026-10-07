import type { ProviderType } from '../types';
export const providerPresets: { name: string; type: ProviderType; baseUrl: string; chatEndpoint: string; modelsEndpoint: string }[] = [
  { name: 'NVIDIA NIM', type: 'openai-compatible', baseUrl: 'https://integrate.api.nvidia.com/v1', chatEndpoint: '/chat/completions', modelsEndpoint: '/models' },
  { name: 'OpenAI', type: 'openai', baseUrl: 'https://api.openai.com/v1', chatEndpoint: '/chat/completions', modelsEndpoint: '/models' },
  { name: 'Anthropic', type: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', chatEndpoint: '/messages', modelsEndpoint: '/models' },
  { name: 'Google Gemini', type: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', chatEndpoint: '/models', modelsEndpoint: '/models' },
  { name: 'Groq', type: 'openai-compatible', baseUrl: 'https://api.groq.com/openai/v1', chatEndpoint: '/chat/completions', modelsEndpoint: '/models' },
  { name: 'OpenRouter', type: 'openai-compatible', baseUrl: 'https://openrouter.ai/api/v1', chatEndpoint: '/chat/completions', modelsEndpoint: '/models' },
  { name: 'Together AI', type: 'openai-compatible', baseUrl: 'https://api.together.xyz/v1', chatEndpoint: '/chat/completions', modelsEndpoint: '/models' },
  { name: 'Cerebras', type: 'openai-compatible', baseUrl: 'https://api.cerebras.ai/v1', chatEndpoint: '/chat/completions', modelsEndpoint: '/models' },
  { name: 'Mistral', type: 'openai-compatible', baseUrl: 'https://api.mistral.ai/v1', chatEndpoint: '/chat/completions', modelsEndpoint: '/models' },
  { name: 'xAI', type: 'openai-compatible', baseUrl: 'https://api.x.ai/v1', chatEndpoint: '/chat/completions', modelsEndpoint: '/models' },
  { name: 'Custom OpenAI Compatible', type: 'openai-compatible', baseUrl: '', chatEndpoint: '/chat/completions', modelsEndpoint: '/models' },
];
export const nemotronPreset = { modelId: 'nvidia/nemotron-3-ultra-550b-a55b', displayName: 'Nemotron 3 Ultra 550B' };
