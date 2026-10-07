import { requireUser } from '@/lib/auth';
import { ownedProvider, listModels } from '@/lib/data';
import { api, body, json } from '@/lib/http';
import { db } from '@/lib/db';
import { models } from '@/lib/db/schema';
import { modelInput } from '@/lib/validation';
export const GET = api(async () => json(await listModels((await requireUser()).id)));
export const POST = api(async request => { const user = await requireUser(); const input = await body(request, modelInput); await ownedProvider(user.id, input.providerId); const [row] = await db().insert(models).values(input).onConflictDoNothing().returning(); return json(row || { error: '이미 등록한 모델입니다.' }, row ? 201 : 409); });
