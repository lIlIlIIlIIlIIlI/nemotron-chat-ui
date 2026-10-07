import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { api, json, body, resourceId, AppError } from '@/lib/http';
import { db } from '@/lib/db';
import { artifacts } from '@/lib/db/schema';
export const PATCH = api(async request => {
  const user = await requireUser(); const input = await body(request, z.object({ content: z.string().max(200000) }));
  const row = await db().transaction(async tx => { const [item] = await tx.select().from(artifacts).where(and(eq(artifacts.id, resourceId(request)), eq(artifacts.userId, user.id))).for('update'); if (!item) throw new AppError('NOT_FOUND', 'Artifact를 찾을 수 없습니다.', 404); if (item.versions.length >= 50) throw new AppError('VERSION_LIMIT', 'Artifact 버전은 최대 50개입니다. 새 Artifact로 저장해 주세요.'); const [updated] = await tx.update(artifacts).set({ versions: [...item.versions, input.content], updatedAt: new Date() }).where(eq(artifacts.id, item.id)).returning(); return updated; }); return json(row);
});
