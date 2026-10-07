import { eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { api, body, json } from '@/lib/http';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { projectInput } from '@/lib/validation';
export const GET = api(async () => json(await db().select().from(projects).where(eq(projects.userId, (await requireUser()).id))));
export const POST = api(async request => { const user = await requireUser(); const input = await body(request, projectInput); const [row] = await db().insert(projects).values({ ...input, userId: user.id }).returning(); return json(row, 201); });
