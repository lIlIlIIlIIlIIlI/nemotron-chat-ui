import { and, eq, asc } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { ownedConversation, ownedModel, ownedProject } from '@/lib/data';
import { api, body, json, resourceId, AppError } from '@/lib/http';
import { db } from '@/lib/db';
import { conversations, messages, attachments } from '@/lib/db/schema';
import { conversationPatch } from '@/lib/validation';
export const GET = api(async request => {
  const user = await requireUser(); const id = resourceId(request); const conversation = await ownedConversation(user.id, id);
  // A conversation is capped at 1000 message nodes by the chat service. Branches remain intact.
  const [rows, files] = await Promise.all([db().select().from(messages).where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt)), db().select({ id: attachments.id, name: attachments.name, mimeType: attachments.mimeType, size: attachments.size, messageId: attachments.messageId, projectId: attachments.projectId, conversationId: attachments.conversationId }).from(attachments).where(and(eq(attachments.conversationId, id), eq(attachments.userId, user.id)))]);
  return json({ conversation, messages: rows, attachments: files });
});
export const PATCH = api(async request => {
  const user = await requireUser(); const id = resourceId(request); await ownedConversation(user.id, id); const input = await body(request, conversationPatch);
  if (input.projectId) await ownedProject(user.id, input.projectId); if (input.defaultModelId) await ownedModel(user.id, input.defaultModelId);
  if (input.activeLeafId) { const [node] = await db().select({ id: messages.id }).from(messages).where(and(eq(messages.id, input.activeLeafId), eq(messages.conversationId, id))); if (!node) throw new AppError('INVALID_BRANCH', '대화에 속하지 않는 메시지입니다.'); }
  const [row] = await db().update(conversations).set({ ...input, updatedAt: new Date() }).where(eq(conversations.id, id)).returning(); return json(row);
});
export const DELETE = api(async request => { const user = await requireUser(); const id = resourceId(request); await ownedConversation(user.id, id); await db().delete(conversations).where(eq(conversations.id, id)); return json({ ok: true }); });
