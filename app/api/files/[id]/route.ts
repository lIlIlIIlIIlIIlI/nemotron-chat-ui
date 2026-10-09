import { and, eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { api, json, resourceId, AppError } from '@/lib/http';
import { db } from '@/lib/db';
import { attachments } from '@/lib/db/schema';
import { attachmentData } from '@/lib/db/files';
export const GET = api(async request => { const user = await requireUser(); const [file] = await db().select().from(attachments).where(and(eq(attachments.id, resourceId(request)), eq(attachments.userId, user.id))); if (!file) throw new AppError('NOT_FOUND', '파일을 찾을 수 없습니다.', 404); return new Response(Buffer.from(file.data || await attachmentData(file.id, user.id), 'base64'), { headers: { 'Content-Type': file.mimeType.startsWith('image/') ? file.mimeType : 'application/octet-stream', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store', 'Content-Security-Policy': "default-src 'none'; sandbox" } }); });
export const DELETE = api(async request => { const user = await requireUser(); await db().delete(attachments).where(and(eq(attachments.id, resourceId(request)), eq(attachments.userId, user.id))); return json({ ok: true }); });
