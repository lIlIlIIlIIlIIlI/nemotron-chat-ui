import { Pool } from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(73421911)');
    await client.query('CREATE TABLE IF NOT EXISTS app_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz DEFAULT now())');
    for (const name of (await readdir('db/migrations')).filter(x => x.endsWith('.sql')).sort()) {
      const sql = await readFile(join('db/migrations', name), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const prior = await client.query('SELECT checksum FROM app_migrations WHERE name=$1', [name]);
      if (prior.rowCount) { if (prior.rows[0].checksum !== checksum) throw new Error(`Migration changed: ${name}`); continue; }
      await client.query('BEGIN');
      try { await client.query(sql); await client.query('INSERT INTO app_migrations(name,checksum) VALUES($1,$2)', [name, checksum]); await client.query('COMMIT'); }
      catch (error) { await client.query('ROLLBACK'); throw error; }
      console.info(`Applied ${name}`);
    }
  } finally { await client.query('SELECT pg_advisory_unlock(73421911)'); client.release(); await pool.end(); }
}
main().catch(() => { console.error('Migration failed. Check database connectivity and migration checksums.'); process.exit(1); });
