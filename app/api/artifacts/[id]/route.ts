import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { api, json, body, resourceId, AppError } from '@/lib/http';
import { db } from '@/lib/db';
import { artifacts } from '@/lib/db/schema';
export const PATCH = api(async request => {
  const user = await requireUser(); const input = await body(request, z.object({ content: z.string().max(200000) }));
  const [row] = await db().update(artifacts).set({ versions: sql`json_insert(${artifacts.versions}, '$[#]', ${input.content})`, updatedAt: new Date() })
    .where(and(eq(artifacts.id, resourceId(request)), eq(artifacts.userId, user.id))).returning();
  if (!row) throw new AppError('NOT_FOUND', 'Artifact를 찾을 수 없습니다.', 404);
  return json(row);
});
