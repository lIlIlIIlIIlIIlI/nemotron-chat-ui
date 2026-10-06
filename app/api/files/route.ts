import { and, eq, sql, inArray } from 'drizzle-orm';
import { extractText } from 'unpdf';
import { requireUser } from '@/lib/auth';
import { ownedProject } from '@/lib/data';
import { api, json, readLimited, AppError } from '@/lib/http';
import { db } from '@/lib/db';
import { attachments, users } from '@/lib/db/schema';
import { MAX_FILE_SIZE, validateFile } from '@/lib/files';
import { rateLimit } from '@/lib/security/rate-limit';
const projection = { id: attachments.id, name: attachments.name, mimeType: attachments.mimeType, size: attachments.size, projectId: attachments.projectId, messageId: attachments.messageId, conversationId: attachments.conversationId };
export const GET = api(async request => {
  const user = await requireUser(); const projectId = new URL(request.url).searchParams.get('projectId');
  if (projectId) await ownedProject(user.id, projectId);
  return json(await db().select(projection).from(attachments).where(and(eq(attachments.userId, user.id), projectId ? eq(attachments.projectId, projectId) : undefined)).limit(200));
});
export const POST = api(async request => {
  const user = await requireUser(); await rateLimit('upload', user.id, 20);
  const raw = await readLimited(request, MAX_FILE_SIZE + 16384);
  const form = await new Response(raw, { headers: { 'Content-Type': request.headers.get('content-type') || '' } }).formData();
  const file = form.get('file'); const projectId = form.get('projectId');
  if (!(file instanceof File)) throw new AppError('FILE_REQUIRED', '파일을 선택해 주세요.');
  if (typeof projectId === 'string' && projectId) await ownedProject(user.id, projectId);
  const name = file.name.replace(/[\x00-\x1f/\\]/g, '_').slice(0,180); const bytes = Buffer.from(await file.arrayBuffer());
  const checked = validateFile(name, bytes, file.type);
  if (checked.mimeType === 'application/pdf') {
    try { const result = await extractText(new Uint8Array(bytes), { mergePages: true }); checked.text = result.text.slice(0,200000); if (!checked.text.trim()) throw new Error(); }
    catch { throw new AppError('PDF_TEXT', 'PDF에서 텍스트를 읽을 수 없습니다. 스캔 문서는 이미지로 첨부해 주세요.'); }
  }
  const row = await db().transaction(async tx => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, user.id)).for('update');
    const [size] = await tx.select({ total: sql<number>`coalesce(sum(${attachments.size}),0)::int` }).from(attachments).where(eq(attachments.userId, user.id));
    if (size.total + bytes.length > 50 * 1024 * 1024) throw new AppError('STORAGE_LIMIT', '계정 파일 저장 한도(50MB)를 초과했습니다. 기존 파일을 삭제해 주세요.');
    const [item] = await tx.insert(attachments).values({ userId: user.id, name, mimeType: checked.mimeType, size: bytes.length, data: bytes.toString('base64'), extractedText: checked.text?.slice(0,200000), projectId: typeof projectId === 'string' && projectId ? projectId : null }).returning(projection); return item;
  }); return json(row, 201);
});
export const DELETE = api(async () => { const user = await requireUser(); const ids = await db().select({ id: attachments.id }).from(attachments).where(eq(attachments.userId, user.id)); if (ids.length) await db().delete(attachments).where(inArray(attachments.id, ids.map(x => x.id))); return json({ ok: true }); });
