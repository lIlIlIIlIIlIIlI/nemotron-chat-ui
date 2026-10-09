import { eq, sql } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { api, json } from '@/lib/http';
import { db } from '@/lib/db';
import { conversations, messages, models } from '@/lib/db/schema';
export const GET = api(async () => {
  const user = await requireUser();
  return json(await db().select({ model: models.displayName, responses: sql<number>`count(*)`, promptTokens: sql<number>`coalesce(sum(json_extract(${messages.metadata}, '$.promptTokens')),0)`, completionTokens: sql<number>`coalesce(sum(json_extract(${messages.metadata}, '$.completionTokens')),0)`, latencyMs: sql<number>`coalesce(avg(json_extract(${messages.metadata}, '$.latencyMs')),0)` }).from(messages).innerJoin(conversations, eq(conversations.id, messages.conversationId)).leftJoin(models, eq(models.id, messages.modelId)).where(sql`${conversations.userId}=${user.id} and ${messages.role}='assistant'`).groupBy(models.displayName));
});
