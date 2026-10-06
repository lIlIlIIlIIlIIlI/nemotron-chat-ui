# Nemotron Chat

A responsive, ChatGPT-style chat interface powered by the NVIDIA NIM OpenAI-compatible API. The NVIDIA request runs in a server route, and the browser receives only the assistant's answer text; provider credentials and reasoning fields stay server-side.

## Run locally

1. Install Node.js 24 and run `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Add an NVIDIA API key, a login username and password, and a random `AUTH_SECRET` of at least 32 characters.
4. Run `npm run dev` and open `http://localhost:3000`.

The login is a single shared account configured through environment variables. This starter does not include public registration or a user database. Chat history is stored in the current browser's local storage.

## Deploy on Vercel

Import this repository as a Next.js project and add `NVIDIA_API_KEY`, `NVIDIA_MODEL`, `APP_LOGIN_USERNAME`, `APP_LOGIN_PASSWORD`, and `AUTH_SECRET` to the Production and Preview environments in Project Settings. Use a newly rotated NVIDIA key. Keep these variables server-only and redeploy after changing them.

`AUTH_SECRET` can be generated with `openssl rand -base64 48`. The exposed key from the original prompt is intentionally not included anywhere in this project.
