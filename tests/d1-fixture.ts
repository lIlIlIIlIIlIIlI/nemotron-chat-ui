import { Miniflare } from 'miniflare';
import { readdir, readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

export async function startDatabase(port = 0) {
  const secret = process.env.CLOUDFLARE_D1_SECRET || randomBytes(32).toString('hex');
  const worker = new Miniflare({ modules: true, scriptPath: 'cloudflare/worker.mjs', compatibilityDate: '2026-08-01',
    host: '127.0.0.1', port, d1Databases: { DB: 'test-database' }, bindings: { D1_PROXY_SECRET: secret },
  });
  try {
  const url = await worker.ready;
  process.env.CLOUDFLARE_D1_URL = url.origin;
  process.env.CLOUDFLARE_D1_SECRET = secret;
  const database = await worker.getD1Database('DB');
  await database.prepare("CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();
  for (const name of (await readdir('cloudflare/migrations')).filter(x => x.endsWith('.sql')).sort()) {
    const source = await readFile(`cloudflare/migrations/${name}`, 'utf8');
    const statements = source.split('--> statement-breakpoint').map(sql => sql.replace(/^--.*$/gm, '').trim()).filter(Boolean);
    await database.batch([...statements.map(sql => database.prepare(sql)), database.prepare('INSERT INTO d1_migrations(name) VALUES (?)').bind(name)]);
  }
  return { worker, database, url, secret };
  } catch (error) { await worker.dispose(); throw error; }
}
