import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { api, body, json, resourceId, AppError } from '@/lib/http';
import { db } from '@/lib/db';
import { memories } from '@/lib/db/schema';
export const PATCH = api(async request => { const user = await requireUser(); const input = await body(request, z.object({ content: z.string().min(1).max(2000).optional(), enabled: z.boolean().optional() })); const [row] = await db().update(memories).set(input).where(and(eq(memories.id, resourceId(request)), eq(memories.userId, user.id))).returning(); if (!row) throw new AppError('NOT_FOUND', '메모리를 찾을 수 없습니다.', 404); return json(row); });
export const DELETE = api(async request => { const user = await requireUser(); await db().delete(memories).where(and(eq(memories.id, resourceId(request)), eq(memories.userId, user.id))); return json({ ok: true }); });
