import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { executeQuery, executeBatch } from './transport';
import * as schema from './schema';
export function db() {
  return drizzle((sql, params, method) => executeQuery({ sql, params, method }), executeBatch, { schema });
}
