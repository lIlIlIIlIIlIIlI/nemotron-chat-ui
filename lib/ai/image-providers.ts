import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { imageProviders } from '../db/schema';
import { AppError } from '../http';
import { decryptSecret } from '../security/crypto';
export function publicImageProvider(row: typeof imageProviders.$inferSelect) {
  return { id: row.id, name: row.name, type: row.type, baseUrl: row.baseUrl, modelId: row.modelId, isEnabled: row.isEnabled, keyHint: `••••••••${row.keyLastFour}` };
}
export async function listImageProviders(userId: string) {
  return (await db().select().from(imageProviders).where(eq(imageProviders.userId, userId))).map(publicImageProvider);
}
export async function ownedImageProvider(userId: string, id: string) {
  const [row] = await db().select().from(imageProviders).where(and(eq(imageProviders.id, id), eq(imageProviders.userId, userId))).limit(1);
  if (!row) throw new AppError('IMAGE_PROVIDER_NOT_FOUND', '이미지 API 설정을 찾을 수 없습니다.', 404);
  return row;
}
export async function imageProviderConfig(userId: string, id: string) {
  const row = await ownedImageProvider(userId, id);
  if (!row.isEnabled) throw new AppError('IMAGE_PROVIDER_DISABLED', '사용 중지된 이미지 API입니다.', 400);
  return { ...row, apiKey: decryptSecret(row.encryptedApiKey, `${userId}:image:${row.id}`) };
}
