import { spawnSync } from 'node:child_process';
const target = process.argv.slice(2);
if (target.length !== 1 || !['--local', '--remote'].includes(target[0])) {
  console.error('Choose a database explicitly: npm run db:migrate -- --local OR --remote');
  process.exit(1);
}
const result = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'd1', 'migrations', 'apply', 'DB', '--config', 'cloudflare/wrangler.jsonc', target[0], ...(target[0] === '--local' ? ['--persist-to', '.wrangler/state'] : [])], { stdio: 'inherit', env: process.env });
process.exit(result.status ?? 1);
