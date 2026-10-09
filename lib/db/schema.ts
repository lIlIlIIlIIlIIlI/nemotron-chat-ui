import { sqliteTable, text, integer, index, uniqueIndex, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
const timestamp = (name: string) => integer(name, { mode: 'timestamp_ms' });
const boolean = (name: string) => integer(name, { mode: 'boolean' });
const json = (name: string) => text(name, { mode: 'json' });
import type { Capability, ModelOption, Message, Settings, ProviderType } from '../types';
const id = () => text('id').primaryKey().$defaultFn(() => crypto.randomUUID());
const created = () => timestamp('created_at').notNull().default(sql`(unixepoch() * 1000)`);
export const users = sqliteTable('users', {
  id: id(), email: text('email').notNull().unique(), name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(), createdAt: created(),
});
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(), userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(), createdAt: created(),
}, t => [index('sessions_user_idx').on(t.userId)]);
export const providers = sqliteTable('providers', {
  id: id(), userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), type: text('type').$type<ProviderType>().notNull(), baseUrl: text('base_url').notNull(),
  chatEndpoint: text('chat_endpoint').notNull().default('/chat/completions'), modelsEndpoint: text('models_endpoint').notNull().default('/models'),
  icon: text('icon'), isEnabled: boolean('is_enabled').notNull().default(true), createdAt: created(),
}, t => [index('providers_user_idx').on(t.userId)]);
export const credentials = sqliteTable('api_credentials', {
  providerId: text('provider_id').primaryKey().references(() => providers.id, { onDelete: 'cascade' }),
  encryptedApiKey: text('encrypted_api_key').notNull(), keyLastFour: text('key_last_four').notNull(), createdAt: created(),
});
export const models = sqliteTable('ai_models', {
  id: id(), providerId: text('provider_id').notNull().references(() => providers.id, { onDelete: 'cascade' }),
  modelId: text('model_id').notNull(), displayName: text('display_name').notNull(), description: text('description').notNull().default(''),
  contextWindow: integer('context_window').notNull().default(32768), maxOutputTokens: integer('max_output_tokens').notNull().default(4096),
  capabilities: json('capabilities').$type<Capability[]>().notNull().default(['text']),
  supportedOptions: json('supported_options').$type<ModelOption[]>().notNull().default(['temperature', 'topP', 'maxTokens']),
  outputTokenParam: text('output_token_param').$type<'max_tokens' | 'max_completion_tokens'>().notNull().default('max_tokens'),
  reasoningStyle: text('reasoning_style').$type<'none' | 'nvidia' | 'effort' | 'native'>().notNull().default('none'),
  isEnabled: boolean('is_enabled').notNull().default(true), isFavorite: boolean('is_favorite').notNull().default(false),
  lastUsedAt: timestamp('last_used_at'), createdAt: created(),
}, t => [uniqueIndex('model_provider_unique').on(t.providerId, t.modelId)]);
export const projects = sqliteTable('projects', {
  id: id(), userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), description: text('description').notNull().default(''), instructions: text('instructions').notNull().default(''), createdAt: created(),
}, t => [index('projects_user_idx').on(t.userId)]);
export const conversations = sqliteTable('conversations', {
  id: id(), userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
  title: text('title').notNull().default('새 대화'), defaultModelId: text('default_model_id').references(() => models.id, { onDelete: 'set null' }),
  systemPrompt: text('system_prompt').notNull().default(''), activeLeafId: text('active_leaf_id'),
  isPinned: boolean('is_pinned').notNull().default(false), isArchived: boolean('is_archived').notNull().default(false),
  createdAt: created(), updatedAt: timestamp('updated_at').notNull().default(sql`(unixepoch() * 1000)`),
}, t => [index('conversations_user_date_idx').on(t.userId, t.updatedAt)]);
export const messages = sqliteTable('messages', {
  id: id(), conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  parentMessageId: text('parent_message_id'), role: text('role').$type<Message['role']>().notNull(), content: text('content').notNull().default(''),
  modelId: text('model_id').references(() => models.id, { onDelete: 'set null' }), providerId: text('provider_id').references(() => providers.id, { onDelete: 'set null' }),
  status: text('status').$type<Message['status']>().notNull().default('complete'), metadata: json('metadata').$type<Message['metadata']>().notNull().default({}), createdAt: created(),
}, t => [index('messages_conversation_idx').on(t.conversationId), index('messages_parent_idx').on(t.parentMessageId)]);
export const attachments = sqliteTable('attachments', {
  id: id(), userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  conversationId: text('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }),
  messageId: text('message_id').references(() => messages.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), mimeType: text('mime_type').notNull(), size: integer('size').notNull(),
  data: text('data').notNull().default(''), extractedText: text('extracted_text'), createdAt: created(),
}, t => [index('attachments_user_idx').on(t.userId)]);
export const userSettings = sqliteTable('user_settings', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  value: json('value').$type<Settings>().notNull(),
});
export const memories = sqliteTable('memories', {
  id: id(), userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(), enabled: boolean('enabled').notNull().default(true), createdAt: created(),
});
export const sharedConversations = sqliteTable('shared_conversations', {
  id: text('id').primaryKey(), conversationId: text('conversation_id').notNull().unique().references(() => conversations.id, { onDelete: 'cascade' }),
  title: text('title').notNull(), snapshot: json('snapshot').$type<{ role: 'user' | 'assistant'; content: string }[]>().notNull(), createdAt: created(),
});
export const artifacts = sqliteTable('artifacts', {
  id: id(), userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  messageId: text('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), language: text('language').notNull(), versions: json('versions').$type<string[]>().notNull(),
  updatedAt: timestamp('updated_at').notNull().default(sql`(unixepoch() * 1000)`),
});
export const rateLimits = sqliteTable('rate_limits', {
  key: text('key').primaryKey(), count: integer('count').notNull(), resetAt: timestamp('reset_at').notNull(),
});

export const attachmentChunks = sqliteTable('attachment_chunks', {
  attachmentId: text('attachment_id').notNull().references(() => attachments.id, { onDelete: 'cascade' }),
  part: integer('part').notNull(), data: text('data').notNull(),
}, t => [primaryKey({ columns: [t.attachmentId, t.part] })]);
