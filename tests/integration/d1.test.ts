import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { startDatabase } from '../d1-fixture';
import { db } from '../../lib/db';
import { users, sessions, providers, credentials, attachments, attachmentChunks, conversations, messages } from '../../lib/db/schema';
import { databaseRequest } from '../../lib/db/transport';
import { knownError } from '../../lib/errors';
import { fileChunks, attachmentData } from '../../lib/db/files';
import { rateLimit } from '../../lib/security/rate-limit';

test('D1 driver, atomic writes, limits, isolation and chunked files', async t => {
  const fixture = await startDatabase();
  t.after(() => fixture.worker.dispose());
  process.env.AUTH_SECRET = 'test-only-auth-secret-with-at-least-32-characters';
  const database = db(); const id = randomUUID();
  const insertUser = (userId: string, email: string) => database.insert(users).values({ id: userId, email, name: 'Tester', passwordHash: 'fixture-hash' });
  assert.equal((await fetch(`${fixture.url.origin}/health`)).status, 401);
  assert.deepEqual(await databaseRequest('/health'), { ok: true, schema: 2 });
  await database.batch([insertUser(id, 'owner@example.test'), database.insert(sessions).values({ id: 'session-hash', userId: id, expiresAt: new Date(Date.now() + 100000) })]);
  const [joined] = await database.select({ user: users, session: sessions }).from(users).innerJoin(sessions, eq(users.id, sessions.userId));
  assert.equal(joined.user.id, id); assert.equal(joined.session.id, 'session-hash');
  assert.ok(joined.user.createdAt instanceof Date);
  const failedUser = randomUUID();
  await assert.rejects(database.batch([insertUser(failedUser, 'rollback@example.test'), database.insert(sessions).values({ id: 'session-hash', userId: failedUser, expiresAt: new Date() })]));
  assert.equal((await database.select().from(users).where(eq(users.id, failedUser))).length, 0);
  await assert.rejects(insertUser(randomUUID(), 'OWNER@example.test'), error => knownError(error)?.code === 'ACCOUNT_UNAVAILABLE');
  const providerId = randomUUID();
  await database.batch([
    database.insert(providers).values({ id: providerId, userId: id, name: 'Test', type: 'openai', baseUrl: 'https://api.openai.com/v1' }),
    database.insert(credentials).values({ providerId, encryptedApiKey: 'encrypted-fixture', keyLastFour: 'ture' }),
  ]);
  assert.equal((await database.select().from(providers))[0].isEnabled, true);
  const fileId = randomUUID(); const bytes = Buffer.alloc(2 * 1024 * 1024, 65);
  const [files] = await database.batch([
    database.insert(attachments).values({ id: fileId, userId: id, name: '2mb.txt', mimeType: 'text/plain', size: bytes.length }).returning(),
    ...fileChunks(fileId, bytes).map(chunk => database.insert(attachmentChunks).values(chunk)),
  ]);
  assert.equal(files[0].id, fileId);
  assert.deepEqual(Buffer.from(await attachmentData(fileId, id), 'base64'), bytes);
  assert.equal(await attachmentData(fileId, randomUUID()), '');
  const convoId = randomUUID();
  await database.insert(conversations).values({ id: convoId, userId: id });
  const starts = await Promise.allSettled([1, 2].map(() => database.batch([
    database.insert(messages).values({ conversationId: convoId, role: 'user', content: 'Hello' }),
    database.insert(messages).values({ conversationId: convoId, role: 'assistant', status: 'streaming' }),
  ])));
  assert.equal(starts.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal((await database.select().from(messages).where(eq(messages.conversationId, convoId))).length, 2);
  const limited = await Promise.allSettled(Array.from({ length: 5 }, () => rateLimit('test', id, 3, 60)));
  assert.equal(limited.filter(x => x.status === 'fulfilled').length, 3);
  assert.equal(limited.filter(x => x.status === 'rejected' && knownError(x.reason)?.code === 'RATE_LIMIT').length, 2);
  await database.delete(users).where(eq(users.id, id));
  for (const table of [sessions, providers, credentials, attachments, attachmentChunks, conversations, messages]) assert.equal((await database.select().from(table)).length, 0);
});
