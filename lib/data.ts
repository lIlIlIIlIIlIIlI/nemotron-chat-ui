import { and, eq } from 'drizzle-orm';
import { db } from './db';
import { providers, credentials, models, projects, conversations, messages, userSettings } from './db/schema';
import { AppError } from './http';
import { decryptSecret } from './security/crypto';
import { defaultSettings, type Settings } from './types';
export const publicProvider = { id: providers.id, name: providers.name, type: providers.type, baseUrl: providers.baseUrl, chatEndpoint: providers.chatEndpoint, modelsEndpoint: providers.modelsEndpoint, icon: providers.icon, isEnabled: providers.isEnabled, keyLastFour: credentials.keyLastFour };
export async function listProviders(userId: string) {
  const rows = await db().select(publicProvider).from(providers).leftJoin(credentials, eq(credentials.providerId, providers.id)).where(eq(providers.userId, userId));
  return rows.map(({ keyLastFour, ...row }) => ({ ...row, keyHint: `••••••••${keyLastFour || ''}` }));
}
export async function ownedProvider(userId: string, id: string, withSecret = false) {
  const [row] = await db().select().from(providers).where(and(eq(providers.id, id), eq(providers.userId, userId))).limit(1);
  if (!row) throw new AppError('NOT_FOUND', 'Provider를 찾을 수 없습니다.', 404);
  let apiKey = '';
  if (withSecret) { const [key] = await db().select().from(credentials).where(eq(credentials.providerId, row.id)); if (!key) throw new AppError('NO_CREDENTIAL', 'API Key를 다시 등록해 주세요.'); apiKey = decryptSecret(key.encryptedApiKey, `${userId}:${id}`); }
  return { ...row, apiKey };
}
export async function listModels(userId: string) { return (await db().select({ model: models }).from(models).innerJoin(providers, eq(providers.id, models.providerId)).where(eq(providers.userId, userId))).map(x => x.model); }
export async function ownedModel(userId: string, id: string) {
  const [row] = await db().select({ model: models }).from(models).innerJoin(providers, eq(providers.id, models.providerId)).where(and(eq(models.id, id), eq(providers.userId, userId))).limit(1);
  if (!row) throw new AppError('NOT_FOUND', '모델을 찾을 수 없습니다.', 404); return row.model;
}
export async function ownedProject(userId: string, id: string) { const [row] = await db().select().from(projects).where(and(eq(projects.id, id), eq(projects.userId, userId))); if (!row) throw new AppError('NOT_FOUND', '프로젝트를 찾을 수 없습니다.', 404); return row; }
export async function ownedConversation(userId: string, id: string) { const [row] = await db().select().from(conversations).where(and(eq(conversations.id, id), eq(conversations.userId, userId))); if (!row) throw new AppError('NOT_FOUND', '대화를 찾을 수 없습니다.', 404); return row; }
export async function ownedMessage(userId: string, id: string) {
  const [row] = await db().select({ message: messages }).from(messages).innerJoin(conversations, eq(conversations.id, messages.conversationId)).where(and(eq(messages.id, id), eq(conversations.userId, userId))).limit(1);
  if (!row) throw new AppError('NOT_FOUND', '메시지를 찾을 수 없습니다.', 404); return row.message;
}
export async function getSettings(userId: string): Promise<Settings> { const [row] = await db().select().from(userSettings).where(eq(userSettings.userId, userId)); return { ...defaultSettings, ...row?.value }; }
export function serialized<T>(value: unknown): T { return JSON.parse(JSON.stringify(value)) as T; }
