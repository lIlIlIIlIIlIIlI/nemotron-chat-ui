import { test, expect } from '@playwright/test';

test('D1 workspace: bulk models, streaming, files, search, artifacts and isolation', async ({ playwright }) => {
  const baseURL = 'http://127.0.0.1:3000';
  const owner = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
  const other = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
  const password = 'Workspace-test-password-42';
  try {
    for (const [index, client] of [owner, other].entries()) {
      expect((await client.post('/api/auth/register', { data: { email: `workspace-${index}-${Date.now()}@example.test`, name: 'Test', password } })).status()).toBe(201);
    }
    const providerResponse = await owner.post('/api/providers', { data: { name: 'Fixture', type: 'openai-compatible', baseUrl: 'http://127.0.0.1:4010/v1', apiKey: 'fixture-valid-key' } });
    expect(providerResponse.status()).toBe(201); const provider = await providerResponse.json();
    const imported = await owner.post(`/api/providers/${provider.id}/models/import`, { data: { models: Array.from({ length: 100 }, (_, n) => ({ modelId: `fixture-${n}`, displayName: `Fixture ${n}` })) } });
    expect(imported.status()).toBe(201); const models = await imported.json(); expect(models).toHaveLength(100);
    const projectResponse = await owner.post('/api/projects', { data: { name: 'D1 Project', instructions: 'Use TypeScript.' } });
    expect(projectResponse.status()).toBe(201); const project = await projectResponse.json();
    const fileResponse = await owner.post('/api/files', { multipart: { file: { name: 'notes.md', mimeType: 'text/markdown', buffer: Buffer.from('Project requirements: TypeScript') } } });
    expect(fileResponse.status()).toBe(201); const file = await fileResponse.json();
    expect(await (await owner.get(`/api/files/${file.id}`)).text()).toBe('Project requirements: TypeScript');
    const chat = await owner.post('/api/chat', { data: { content: 'Find 100%_literal', modelId: models[0].id, projectId: project.id, attachmentIds: [file.id] } });
    expect(chat.status()).toBe(200);
    const stream = await chat.text(); expect(stream).not.toContain('DO_NOT_DISPLAY_RAW_REASONING');
    const events = stream.split('\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)));
    const start = events.find(event => event.type === 'start'); const done = events.find(event => event.type === 'done');
    expect(done?.message.status).toBe('complete'); expect(done.message.content).toContain('테스트 답변');
    const saved = await (await owner.get(`/api/conversations/${start.conversation.id}`)).json(); expect(saved.messages).toHaveLength(2);
    const search = await (await owner.get('/api/conversations?q=100%25_literal')).json(); expect(search.items).toHaveLength(1);
    const wildcard = await (await owner.get('/api/conversations?q=100%25Xliteral')).json(); expect(wildcard.items).toHaveLength(0);
    const usage = await owner.get('/api/usage'); expect(usage.status()).toBe(200); expect((await usage.json())[0].completionTokens).toBe(24);
    const artifactResponse = await owner.post('/api/artifacts', { data: { messageId: done.message.id, name: 'answer.ts', language: 'typescript', content: 'const answer = 42;' } });
    expect(artifactResponse.status()).toBe(201); const artifact = await artifactResponse.json();
    const updates = await Promise.all([43, 44].map(n => owner.patch(`/api/artifacts/${artifact.id}`, { data: { content: `const answer = ${n};` } })));
    expect(updates.every(response => response.ok())).toBe(true);
    const artifacts = await (await owner.get(`/api/artifacts?messageId=${done.message.id}`)).json(); expect(artifacts[0].versions).toHaveLength(3);
    const shared = await owner.post(`/api/conversations/${start.conversation.id}/share`, { data: {} }); expect(shared.status()).toBe(200);
    const snapshot = await shared.json(); expect((await other.get(`/share/${snapshot.id}`)).status()).toBe(200);
    for (const path of [`/api/conversations/${start.conversation.id}`, `/api/files/${file.id}`, `/api/providers/${provider.id}/models`]) expect((await other.get(path)).status()).toBe(404);
    expect((await other.patch(`/api/artifacts/${artifact.id}`, { data: { content: 'hijack' } })).status()).toBe(404);
    expect((await owner.delete(`/api/conversations/${start.conversation.id}`)).status()).toBe(200);
    expect((await owner.get(`/api/files/${file.id}`)).status()).toBe(404);
    expect((await other.get(`/share/${snapshot.id}`)).status()).toBe(404);
  } finally { await owner.dispose(); await other.dispose(); }
});
