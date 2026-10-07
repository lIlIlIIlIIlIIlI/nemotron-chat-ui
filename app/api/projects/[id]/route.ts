import { eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { ownedProject } from '@/lib/data';
import { api, body, json, resourceId } from '@/lib/http';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { projectInput } from '@/lib/validation';
export const PATCH = api(async request => { const user = await requireUser(); const id = resourceId(request); await ownedProject(user.id, id); const input = await body(request, projectInput.partial()); const [row] = await db().update(projects).set(input).where(eq(projects.id, id)).returning(); return json(row); });
export const DELETE = api(async request => { const user = await requireUser(); const id = resourceId(request); await ownedProject(user.id, id); await db().delete(projects).where(eq(projects.id, id)); return json({ ok: true }); });
