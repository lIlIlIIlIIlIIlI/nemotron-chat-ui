import { eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, memories } from '@/lib/db/schema';
import { listModels, listProviders, getSettings } from '@/lib/data';
import { api, json } from '@/lib/http';
export const GET = api(async () => {
  const user = await requireUser();
  const [providerRows, modelRows, projectRows, settings, memoryRows] = await Promise.all([listProviders(user.id), listModels(user.id), db().select().from(projects).where(eq(projects.userId, user.id)), getSettings(user.id), db().select().from(memories).where(eq(memories.userId, user.id))]);
  return json({ user, providers: providerRows, models: modelRows, projects: projectRows, settings, memories: memoryRows });
});
