import { defineConfig, devices } from '@playwright/test';

const env = {
  CLOUDFLARE_D1_URL: 'http://127.0.0.1:8788',
  CLOUDFLARE_D1_SECRET: 'ci-only-disposable-database-secret-never-for-production',
  AUTH_SECRET: 'ci-only-disposable-auth-secret-never-for-production',
  APP_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  APP_TEST_MODE: '1', APP_URL: 'http://127.0.0.1:3000',
};
Object.assign(process.env, env);
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1, timeout: 180000, retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: env.APP_URL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }],
  webServer: [
    { command: 'node --import tsx tests/serve-database.ts', url: `${env.CLOUDFLARE_D1_URL}/health`, env, timeout: 60000 },
    { command: 'node --import tsx tests/fixture-provider.ts', url: 'http://127.0.0.1:4010/health', env, timeout: 30000 },
    { command: 'npm run dev -- --hostname 127.0.0.1', url: `${env.APP_URL}/login`, env, timeout: 120000 },
  ],
});
