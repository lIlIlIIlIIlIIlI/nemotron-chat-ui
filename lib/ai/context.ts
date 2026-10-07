import type { AIContent } from './types';
import { AppError } from '../http';
export function estimateTokens(text: string) {
  // Conservative multilingual heuristic; adapters can replace this with model tokenizers.
  let score = 0; for (const char of text) score += char.charCodeAt(0) > 127 ? 1.5 : 0.4;
  return Math.ceil(score);
}
export function fitContext(system: string, messages: AIContent[], contextWindow: number, outputTokens: number) {
  const budget = contextWindow - outputTokens - 512 - estimateTokens(system);
  const sizes = messages.map(x => estimateTokens(x.text) + (x.images?.length || 0) * 4096 + 8);
  if (budget < 0 || (sizes.at(-1) || 0) > budget) throw new AppError('CONTEXT_LENGTH', '현재 질문·파일·시스템 지침이 모델의 컨텍스트 한도를 넘습니다.');
  let total = sizes.reduce((a, b) => a + b, 0); let start = 0;
  while (total > budget && start < messages.length - 1) total -= sizes[start++];
  while (messages[start]?.role === 'assistant') { total -= sizes[start++]; }
  return { messages: messages.slice(start), trimmed: start > 0 };
}
