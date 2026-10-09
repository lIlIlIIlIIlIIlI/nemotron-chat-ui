export type ProviderType = 'openai' | 'openai-compatible' | 'anthropic' | 'gemini';
export type Capability = 'text' | 'vision' | 'code' | 'tools' | 'reasoning' | 'image' | 'audio';
export type ModelOption = 'temperature' | 'topP' | 'maxTokens' | 'frequencyPenalty' | 'presencePenalty' | 'reasoningEffort';
export type GenerationOptions = {
  temperature?: number; topP?: number; maxTokens?: number; frequencyPenalty?: number;
  presencePenalty?: number; reasoningEffort?: 'off' | 'low' | 'medium' | 'high';
};
export type Provider = {
  id: string; name: string; type: ProviderType; baseUrl: string; chatEndpoint: string;
  modelsEndpoint: string; isEnabled: boolean; keyHint: string; icon: string | null;
};
export type AIModel = {
  id: string; providerId: string; modelId: string; displayName: string; description: string;
  contextWindow: number; maxOutputTokens: number; capabilities: Capability[];
  supportedOptions: ModelOption[]; outputTokenParam: 'max_tokens' | 'max_completion_tokens';
  reasoningStyle: 'none' | 'nvidia' | 'effort' | 'native';
  isEnabled: boolean; isFavorite: boolean; lastUsedAt: string | null;
};
export type Conversation = {
  id: string; title: string; projectId: string | null; defaultModelId: string | null;
  systemPrompt: string; activeLeafId: string | null; isPinned: boolean; isArchived: boolean;
  createdAt: string; updatedAt: string;
};
export type Usage = { promptTokens?: number; completionTokens?: number; totalTokens?: number; latencyMs?: number };
export type Message = {
  id: string; conversationId: string; parentMessageId: string | null;
  role: 'system' | 'user' | 'assistant' | 'tool'; content: string;
  modelId: string | null; providerId: string | null;
  status: 'complete' | 'streaming' | 'stopped' | 'error'; createdAt: string;
  metadata: Usage & { error?: string; feedback?: 'up' | 'down' | null; contextTrimmed?: boolean; mode?: 'chat' | 'code'; attachmentIds?: string[]; generatedImageId?: string };
};
export type Project = { id: string; name: string; description: string; instructions: string; createdAt: string };
export type Attachment = { id: string; name: string; mimeType: string; size: number; projectId: string | null; messageId: string | null; conversationId: string | null };
export type Memory = { id: string; content: string; enabled: boolean };
export type Settings = {
  language: 'ko' | 'en'; theme: 'system' | 'light' | 'dark'; fontSize: number;
  compact: boolean; codeTheme: 'dark' | 'light'; enterToSend: boolean;
  defaultModelId: string | null; defaultProjectId: string | null;
  aboutYou: string; responseStyle: string; memoryEnabled: boolean; options: GenerationOptions;
};
export const defaultSettings: Settings = {
  language: 'ko', theme: 'system', fontSize: 15, compact: false, codeTheme: 'dark', enterToSend: true,
  defaultModelId: null, defaultProjectId: null, aboutYou: '', responseStyle: '', memoryEnabled: true,
  options: { temperature: 1, topP: 0.95, maxTokens: 4096, reasoningEffort: 'off' },
};
export type ChatEvent =
  | { type: 'start'; conversation: Conversation; userMessage: Message | null; assistantMessage: Message }
  | { type: 'delta'; text: string }
  | { type: 'status'; status: 'connecting' | 'thinking' | 'generating' }
  | { type: 'warning'; message: string }
  | { type: 'error'; message: string; code: string }
  | { type: 'done'; message: Message };
export type Artifact = { id: string; messageId: string; name: string; language: string; versions: string[]; updatedAt: string };
export type Bootstrap = { user: { id: string; name: string; email: string }; providers: Provider[]; models: AIModel[]; projects: Project[]; settings: Settings; memories: Memory[] };
