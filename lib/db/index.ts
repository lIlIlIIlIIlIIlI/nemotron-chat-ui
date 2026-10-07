import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
const globalDb = globalThis as unknown as { nemotronPool?: Pool };
export function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const pool = globalDb.nemotronPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 10000 });
  return drizzle({ client: pool, schema });
}
