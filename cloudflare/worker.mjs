const encoder = new TextEncoder();
const LIMIT = 4 * 1024 * 1024;
const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

async function readBody(request) {
  if (Number(request.headers.get('content-length')) > LIMIT) throw new Error('BODY_LIMIT');
  const reader = request.body?.getReader();
  if (!reader) return '';
  const parts = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > LIMIT) { await reader.cancel(); throw new Error('BODY_LIMIT'); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  return new TextDecoder().decode(bytes);
}

async function authenticate(request, env, body) {
  if (!env.D1_PROXY_SECRET || env.D1_PROXY_SECRET.length < 32) return false;
  const timestamp = request.headers.get('X-D1-Timestamp') || '';
  const signature = request.headers.get('X-D1-Signature') || '';
  if (!/^\d{13}$/.test(timestamp) || Math.abs(Date.now() - Number(timestamp)) > 60000 || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const key = await crypto.subtle.importKey('raw', encoder.encode(env.D1_PROXY_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const bytes = Uint8Array.from(signature.match(/../g), x => parseInt(x, 16));
  return crypto.subtle.verify('HMAC', key, bytes, encoder.encode(`${timestamp}\n${request.method}\n${new URL(request.url).pathname}\n${body}`));
}

function validQuery(query) {
  return query && typeof query.sql === 'string' && query.sql.length <= 100000 &&
    /^(select|insert|update|delete)\b/i.test(query.sql.trim()) &&
    ['all', 'get', 'run', 'values'].includes(query.method) && Array.isArray(query.params) && query.params.length <= 100 &&
    query.params.every(p => p === null || typeof p === 'string' || typeof p === 'number' && Number.isFinite(p));
}

export function classifyDatabaseError(error) {
  const message = `${error?.message || ''} ${error?.cause?.message || ''}`;
  if (/no such (table|column)/i.test(message)) return 'SCHEMA_MISSING';
  if (/UNIQUE constraint failed: users.email/i.test(message)) return 'ACCOUNT_UNAVAILABLE';
  for (const code of ['GENERATING', 'CONFLICT', 'STORAGE_LIMIT', 'CONVERSATION_LIMIT', 'VERSION_LIMIT', 'MEMORY_LIMIT']) {
    if (message.includes(code)) return code;
  }
  if (/constraint failed/i.test(message)) return 'CONFLICT';
  if (/overloaded|timed out|unavailable|D1_ERROR.*(reset|internal)/i.test(message)) return 'DATABASE_UNAVAILABLE';
  return 'DATABASE_QUERY';
}

const worker = {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (!['/query', '/batch', '/health'].includes(path)) return reply({ code: 'NOT_FOUND' }, 404);
    if (request.method !== (path === '/health' ? 'GET' : 'POST')) return reply({ code: 'METHOD_NOT_ALLOWED' }, 405);
    try {
      const body = await readBody(request);
      if (!await authenticate(request, env, body)) return reply({ code: 'DATABASE_AUTH' }, 401);
      // Primary reads avoid stale sessions, ownership checks and read-after-write surprises.
      const database = env.DB.withSession('first-primary');
      if (path === '/health') {
        await database.prepare('SELECT id FROM users LIMIT 0').raw();
        const row = await database.prepare("SELECT name FROM d1_migrations WHERE name = '0002_guards.sql'").first();
        return row ? reply({ ok: true, schema: 2 }) : reply({ code: 'SCHEMA_MISSING' }, 503);
      }
      let input;
      try { input = JSON.parse(body); } catch { return reply({ code: 'INVALID_REQUEST' }, 400); }
      if (path === '/query') {
        if (!validQuery(input)) return reply({ code: 'INVALID_REQUEST' }, 400);
        const rows = await database.prepare(input.sql).bind(...input.params).raw();
        return reply({ rows: input.method === 'get' ? rows[0] || [] : rows });
      }
      const queries = input?.queries;
      // Batch writes are one D1 transaction. Joins use /query.raw(), preserving duplicate column names.
      if (!Array.isArray(queries) || !queries.length || queries.length > 90 || !queries.every(q => validQuery(q) && /^(insert|update|delete)\b/i.test(q.sql.trim()))) return reply({ code: 'INVALID_REQUEST' }, 400);
      const results = await database.batch(queries.map(q => database.prepare(q.sql).bind(...q.params)));
      return reply(results.map((result, i) => {
        const rows = (result.results || []).map(row => Object.values(row));
        return { rows: queries[i].method === 'get' ? rows[0] || [] : rows };
      }));
    } catch (error) {
      const code = error?.message === 'BODY_LIMIT' ? 'BODY_LIMIT' : classifyDatabaseError(error);
      console.error('d1_request_failed', { code });
      return reply({ code }, code === 'BODY_LIMIT' ? 413 : 503);
    }
  },
  async scheduled(_event, env) {
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now),
      env.DB.prepare('DELETE FROM rate_limits WHERE reset_at <= ?').bind(now),
      env.DB.prepare("UPDATE messages SET status = 'error' WHERE status = 'streaming' AND created_at < ?").bind(now - 180000),
    ]);
  },
};

export default worker;
