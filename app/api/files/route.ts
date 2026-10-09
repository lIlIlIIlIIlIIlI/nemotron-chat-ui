import { and, eq } from 'drizzle-orm';
import { extractText } from 'unpdf';
import { requireUser } from '@/lib/auth';
import { ownedProject } from '@/lib/data';
import { api, json, readLimited, AppError } from '@/lib/http';
import { db } from '@/lib/db';
import { attachments, attachmentChunks } from '@/lib/db/schema';
import { fileChunks } from '@/lib/db/files';
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
  const id = crypto.randomUUID(); const database = db();
  // Chunk the payload so a 2MB upload cannot exceed D1's per-row size limit.
  const [rows] = await database.batch([
    database.insert(attachments).values({ id, userId: user.id, name, mimeType: checked.mimeType, size: bytes.length, extractedText: checked.text?.slice(0,200000), projectId: typeof projectId === 'string' && projectId ? projectId : null }).returning(projection),
    ...fileChunks(id, bytes).map(chunk => database.insert(attachmentChunks).values(chunk)),
  ]);
  return json(rows[0], 201);
});
export const DELETE = api(async () => { const user = await requireUser(); await db().delete(attachments).where(eq(attachments.userId, user.id)); return json({ ok: true }); });
