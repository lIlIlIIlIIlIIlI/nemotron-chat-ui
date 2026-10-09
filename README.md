# Nemotron Workspace

Next.js + TypeScript AI workspace. The website and application APIs run on **Vercel**, persistent data lives in **Cloudflare D1**, and source/verification live in **GitHub**.

## Architecture

Browser → Vercel Next.js API → HMAC-authenticated Cloudflare Worker → D1.

The browser never receives the database secret, Cloudflare API token, encrypted provider credential, or decrypted provider key. Vercel needs only a narrowly scoped Worker shared secret; a Cloudflare account API token is **not** required at application runtime. PostgreSQL/Neon and `DATABASE_URL` are no longer used by the application.

- Email/password accounts with bcrypt, hashed sessions, secure HTTP-only production cookies, CSRF checks and database-backed rate limits.
- Atomic account + session creation, credential writes and chat preparation using D1 batches.
- Per-user providers/models, streamed responses, branching, projects, memory, shared snapshots, artifacts and settings.
- Files: up to 2MB each, 50MB/account. D1 stores payloads in 100KB base64 chunks, with cascading deletion; file metadata and all chunks commit together.
- Database triggers enforce concurrent storage quotas, memory limits, conversation limits, a single active generation and artifact version limits.
- Hourly Worker maintenance removes expired sessions/rate limits and marks abandoned generations as failed.
- Errors have stable codes and `X-Request-Id`. Logs omit SQL, query parameters, passwords, email addresses, cookies and provider payloads.

## Local development

Requires Node.js 24.

```sh
npm ci
cp .env.example .env.local
```

Set `AUTH_SECRET` and `CLOUDFLARE_D1_SECRET` to separate random values (at least 32 characters). Set `APP_ENCRYPTION_KEY` to a base64-encoded 32-byte random key. Keep these values in your local env file, never in Git. Use `CLOUDFLARE_D1_URL=http://127.0.0.1:8787` and `APP_URL=http://localhost:3000`.

```sh
npm run db:migrate -- --local
npm run db:dev
```

In another terminal:

```sh
npm run db:check
npm run dev
```

Open `/login`, select 회원가입, and create an account. Passwords require 12–64 characters and at most 72 UTF-8 bytes. There are no seeded accounts, shared admin passwords or implicit administrator roles. An account created through Neon Auth is separate from this application's account database.

## Cloudflare deployment

The repository's `cloudflare/wrangler.jsonc` targets:

- Account: `63a3fad90d64d00e037bca8c63d60948`
- D1: `nemotron-workspace` (`d1d6b722-9946-42a4-80c4-6cb491549e23`)
- Worker: `nemotron-database`
- Endpoint: `https://nemotron-database.nmseu486.workers.dev`

Use a separate database, Worker and secret for Preview. Never point unreviewed preview deployments at production data. When forking this repository, replace account/database identifiers first.

With an authorized Cloudflare CLI session, apply migrations **before** switching the Vercel application:

```sh
npm run db:migrate -- --remote
npm run db:deploy
npx wrangler secret put D1_PROXY_SECRET --config cloudflare/wrangler.jsonc
```

`D1_PROXY_SECRET` must match Vercel's `CLOUDFLARE_D1_SECRET`. Enter it through the CLI prompt or your secrets manager. The Worker returns 401 for unsigned requests; this is expected when opening its URL in a browser. Schema changes use the Cloudflare admin API/CLI, not the runtime query endpoint. Migrations are tracked in `d1_migrations`; applied migration files must not be edited.

## Vercel configuration

Import this GitHub repository as a Next.js project with Node.js 24, repository root, and `npm run build`. The configured Function region is `icn1`, near the APAC D1 primary. Set these **server-side** variables in the appropriate environment:

| Variable | Value / purpose |
| --- | --- |
| `CLOUDFLARE_D1_URL` | HTTPS origin of the matching database Worker |
| `CLOUDFLARE_D1_SECRET` | Same secret as Worker `D1_PROXY_SECRET` |
| `AUTH_SECRET` | Random secret, at least 32 characters |
| `APP_ENCRYPTION_KEY` | Base64-encoded 32-byte encryption key |
| `APP_URL` | Exact public website origin, e.g. `https://your-domain.example` |
| `AI_ALLOWED_HOSTS` | Optional comma-separated additional provider hostnames |

Never prefix any secret with `NEXT_PUBLIC_`. `APP_TEST_MODE` must not be enabled in deployment environments. Production requires HTTPS. The exact `VERCEL_URL` hostname supplied by Vercel is also allowed for that deployment's same-origin API requests.

The build does not mutate a database. Environment changes require a new Vercel deployment. Verify `npm run db:check` in an environment with the matching server-side configuration, then test registration, login, provider setup, chat, logout and account isolation before promoting a deployment.

## Moving existing PostgreSQL data

This change creates a **new D1 database**; it does not erase, automatically copy, or verify existing Neon data. The old SQL schema remains under `db/migrations` only as an export reference and is not executed by the new migration command.

Before cutover, determine whether the old database contains real accounts or conversations. If it does, take an export and migrate it in a separate controlled step: preserve IDs/password hashes, convert timestamps to epoch milliseconds, booleans to 0/1 and JSON to text, split attachment base64 into `attachment_chunks`, and import parent tables before their children. Keep the old `APP_ENCRYPTION_KEY` to retain access to imported provider keys. Discard old sessions and have users sign in again. Compare counts, ownership relationships and a sample of restored data before switching traffic; retain the original database until verification is complete.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

Tests run against a disposable local D1 Worker, with no production credentials. The integration suite checks migrations, driver mapping, atomic rollback, duplicate email handling, 2MB file reconstruction, concurrent generation and rate limits, ownership and cascading deletions. HTTP tests cover registration/login, CSRF, password/session rotation, bulk model import, streamed chat, usage, search, sharing and artifact updates. Browser tests cover the workspace UI and mobile layout. To run only HTTP tests when a browser binary is unavailable:

```sh
npx playwright test auth-api.spec.ts workspace-api.spec.ts
```

## Diagnosing a failed request

| Code | Action |
| --- | --- |
| `DATABASE_CONFIG` / `CONFIGURATION` | Check required environment keys and formats |
| `DATABASE_AUTH` | Match the Vercel and Worker shared secrets |
| `SCHEMA_MISSING` | Apply D1 migrations to the Worker-bound database |
| `DATABASE_UNAVAILABLE` | Check Worker availability and Cloudflare logs |
| `ACCOUNT_UNAVAILABLE` | The normalized email already exists; sign in |
| `RATE_LIMIT` | Wait for the response's `Retry-After` interval |
| `GENERATING` | Let the active response finish or stop it |

Use the displayed request ID to correlate Vercel logs. Extension-injected HTML attributes such as `bis_skin_checked` should be checked in a clean browser profile; hiding hydration errors globally does not fix the underlying extension behavior.
