import { requireUser } from '@/lib/auth';
import { getSettings, ownedModel, ownedProject } from '@/lib/data';
import { api, body, json } from '@/lib/http';
import { db } from '@/lib/db';
import { userSettings } from '@/lib/db/schema';
import { settingsInput } from '@/lib/validation';
export const GET = api(async () => json(await getSettings((await requireUser()).id)));
export const PUT = api(async request => { const user = await requireUser(); const input = await body(request, settingsInput); if (input.defaultModelId) await ownedModel(user.id, input.defaultModelId); if (input.defaultProjectId) await ownedProject(user.id, input.defaultProjectId); await db().insert(userSettings).values({ userId: user.id, value: input }).onConflictDoUpdate({ target: userSettings.userId, set: { value: input } }); return json(input); });
