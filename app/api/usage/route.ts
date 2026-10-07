import { eq, sql } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { api, json } from '@/lib/http';
import { db } from '@/lib/db';
import { conversations, messages, models } from '@/lib/db/schema';
export const GET = api(async () => {
  const user = await requireUser();
  return json(await db().select({ model: models.displayName, responses: sql<number>`count(*)::int`, promptTokens: sql<number>`coalesce(sum((${messages.metadata}->>'promptTokens')::bigint),0)::float`, completionTokens: sql<number>`coalesce(sum((${messages.metadata}->>'completionTokens')::bigint),0)::float`, latencyMs: sql<number>`coalesce(avg((${messages.metadata}->>'latencyMs')::float),0)` }).from(messages).innerJoin(conversations, eq(conversations.id, messages.conversationId)).leftJoin(models, eq(models.id, messages.modelId)).where(sql`${conversations.userId}=${user.id} and ${messages.role}='assistant'`).groupBy(models.displayName));
});
