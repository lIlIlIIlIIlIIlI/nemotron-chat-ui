import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from './index';
import { attachments, attachmentChunks } from './schema';

export async function attachmentData(id: string, userId: string) {
  const rows = await db().select({ data: attachmentChunks.data }).from(attachmentChunks)
    .innerJoin(attachments, eq(attachments.id, attachmentChunks.attachmentId))
    .where(and(eq(attachments.id, id), eq(attachments.userId, userId))).orderBy(asc(attachmentChunks.part));
  return rows.map(row => row.data).join('');
}

export function fileChunks(id: string, bytes: Buffer) {
  const base64 = bytes.toString('base64');
  const rows = [];
  for (let offset = 0; offset < base64.length; offset += 100000) rows.push({ attachmentId: id, part: rows.length, data: base64.slice(offset, offset + 100000) });
  return rows;
}

export async function ownedAttachments(ids: string[], userId: string) {
  const rows: typeof attachments.$inferSelect[] = [];
  for (let start = 0; start < ids.length; start += 20) {
    rows.push(...await db().select().from(attachments).where(and(inArray(attachments.id, ids.slice(start, start + 20)), eq(attachments.userId, userId))));
  }
  return rows;
}
