import { loadEnvConfig } from '@next/env';
import { databaseRequest } from '../lib/db/transport';
import { requiredSecret } from '../lib/config';
import { encryptSecret } from '../lib/security/crypto';
import { knownError } from '../lib/errors';
loadEnvConfig(process.cwd());
async function main() {
  requiredSecret('AUTH_SECRET');
  encryptSecret('configuration-check', 'configuration-check');
  const result = await databaseRequest('/health');
  console.info('D1 connection, schema, AUTH_SECRET and APP_ENCRYPTION_KEY: OK', { schema: result.schema });
}
main().catch(error => { console.error('Configuration check failed', { code: knownError(error)?.code || 'CHECK_FAILED' }); process.exitCode = 1; });
