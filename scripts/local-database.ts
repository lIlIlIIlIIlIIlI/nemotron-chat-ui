import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
async function main() {
  if (!process.env.CLOUDFLARE_D1_SECRET || process.env.CLOUDFLARE_D1_SECRET.length < 32) throw new Error('Set CLOUDFLARE_D1_SECRET in .env.local (at least 32 characters)');
  const worker = new Miniflare(convertV4MiniflareOptions({
    modules: true, scriptPath: 'cloudflare/worker.mjs', compatibilityDate: '2026-08-01',
    host: '127.0.0.1', port: 8787, d1Databases: { DB: 'd1d6b722-9946-42a4-80c4-6cb491549e23' },
    resourcePersistencePath: '.wrangler/state/v3/d1', bindings: { D1_PROXY_SECRET: process.env.CLOUDFLARE_D1_SECRET },
  }));
  await worker.ready;
  console.info('Local D1 Worker: http://127.0.0.1:8787 (signed requests required)');
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { void worker.dispose().then(() => process.exit(0)); });
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
