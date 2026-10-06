// No demo users, passwords or credentials are seeded in production.
import { Pool } from 'pg';
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try { await pool.query('SELECT 1 FROM users LIMIT 1'); console.info('Database ready. Register your account; provider presets are built into Settings.'); }
  finally { await pool.end(); }
}
main().catch(() => { console.error('Run db:migrate and check DATABASE_URL first.'); process.exit(1); });
