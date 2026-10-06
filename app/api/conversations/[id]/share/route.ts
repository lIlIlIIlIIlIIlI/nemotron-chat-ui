import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { requireUser } from '@/lib/auth';
import { ownedConversation } from '@/lib/data';
import { api, json, resourceId } from '@/lib/http';
import { db } from '@/lib/db';
import { messages, sharedConversations } from '@/lib/db/schema';
import { activeBranch } from '@/lib/branches';
export const GET = api(async request => { const user = await requireUser(); const id = resourceId(request, 1); await ownedConversation(user.id, id); const [row] = await db().select({ id: sharedConversations.id }).from(sharedConversations).where(eq(sharedConversations.conversationId, id)); return json(row || { id: null }); });
export const POST = api(async request => {
  const user = await requireUser(); const id = resourceId(request, 1); const conversation = await ownedConversation(user.id, id);
  const nodes = await db().select().from(messages).where(eq(messages.conversationId, id));
  const snapshot = activeBranch(nodes, conversation.activeLeafId).filter(x => x.role === 'user' || x.role === 'assistant').map(x => ({ role: x.role as 'user' | 'assistant', content: x.content }));
  const [row] = await db().insert(sharedConversations).values({ id: randomBytes(24).toString('base64url'), conversationId: id, title: conversation.title, snapshot }).onConflictDoUpdate({ target: sharedConversations.conversationId, set: { title: conversation.title, snapshot } }).returning({ id: sharedConversations.id });
  return json(row);
});
export const DELETE = api(async request => { const user = await requireUser(); const id = resourceId(request, 1); await ownedConversation(user.id, id); await db().delete(sharedConversations).where(eq(sharedConversations.conversationId, id)); return json({ ok: true }); });
