import { and, eq, desc, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { ownedProject, ownedModel } from '@/lib/data';
import { api, body, json } from '@/lib/http';
import { db } from '@/lib/db';
import { conversations, messages, projects } from '@/lib/db/schema';
import { uuid } from '@/lib/validation';
export const GET = api(async request => {
  const user = await requireUser(); const params = new URL(request.url).searchParams;
  const query = (params.get('q') || '').slice(0, 150).replace(/[\\%_]/g, '\\$&');
  const offset = Math.max(0, Math.min(Number(params.get('offset')) || 0, 100000));
  const projectId = params.get('projectId');
  const rows = await db().select().from(conversations).where(and(eq(conversations.userId, user.id),
    params.get('archived') === 'all' ? undefined : eq(conversations.isArchived, params.get('archived') === 'true'),
    projectId ? eq(conversations.projectId, projectId) : undefined,
    query ? or(ilike(conversations.title, `%${query}%`), sql`exists(select 1 from ${messages} where ${messages.conversationId}=${conversations.id} and ${messages.content} ilike ${`%${query}%`})`, sql`exists(select 1 from ${projects} where ${projects.id}=${conversations.projectId} and ${projects.name} ilike ${`%${query}%`})`) : undefined,
  )).orderBy(desc(conversations.isPinned), desc(conversations.updatedAt), desc(conversations.id)).limit(41).offset(offset);
  return json({ items: rows.slice(0, 40), hasMore: rows.length > 40, nextOffset: offset + 40 });
});
export const POST = api(async request => {
  const user = await requireUser(); const input = await body(request, z.object({ title: z.string().min(1).max(120).default('새 대화'), projectId: uuid.nullable().optional(), defaultModelId: uuid.nullable().optional() }));
  if (input.projectId) await ownedProject(user.id, input.projectId); if (input.defaultModelId) await ownedModel(user.id, input.defaultModelId);
  const [row] = await db().insert(conversations).values({ ...input, userId: user.id }).returning(); return json(row, 201);
});
export const DELETE = api(async request => { const user = await requireUser(); await body(request, z.object({ confirmation: z.literal('DELETE_ALL_CHATS') })); await db().delete(conversations).where(eq(conversations.userId, user.id)); return json({ ok: true }); });
