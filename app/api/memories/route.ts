import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { api, body, json, AppError } from '@/lib/http';
import { db } from '@/lib/db';
import { memories } from '@/lib/db/schema';
export const POST = api(async request => { const user = await requireUser(); const input = await body(request, z.object({ content: z.string().trim().min(1).max(2000), enabled: z.boolean().default(true) })); const [count] = await db().select({ count: sql<number>`count(*)` }).from(memories).where(eq(memories.userId, user.id)); if (count.count >= 100) throw new AppError('MEMORY_LIMIT', '메모리는 최대 100개입니다.'); const [row] = await db().insert(memories).values({ ...input, userId: user.id }).returning(); return json(row, 201); });
