import { test, expect } from '@playwright/test';

test('registration, login, CSRF, session rotation and account deletion', async ({ playwright }) => {
  const baseURL = 'http://127.0.0.1:3000';
  const first = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
  const second = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
  const email = `auth-${Date.now()}@example.test`;
  const password = 'Initial-password-42'; const newPassword = 'Changed-password-43';
  try {
    expect((await first.get('/api/bootstrap')).status()).toBe(401);
    const invalid = await first.post('/api/auth/register', { data: { email, password: 'short', name: 'Test' } });
    expect(invalid.status()).toBe(400);
    expect((await invalid.json()).code).toBe('VALIDATION');
    const csrf = await first.post('/api/auth/register', { headers: { Origin: 'https://evil.example' }, data: { email, password, name: 'Test' } });
    expect(csrf.status()).toBe(403);
    const registered = await first.post('/api/auth/register', { data: { email: `  ${email.toUpperCase()}  `, password, name: 'Test' } });
    expect(registered.status()).toBe(201);
    expect(registered.headers()['x-request-id']).toBeTruthy();
    expect(registered.headers()['set-cookie']).toContain('HttpOnly');
    expect((await first.get('/api/bootstrap')).status()).toBe(200);
    const duplicate = await second.post('/api/auth/register', { data: { email, password, name: 'Duplicate' } });
    expect(duplicate.status()).toBe(409);
    expect((await duplicate.json()).code).toBe('ACCOUNT_UNAVAILABLE');
    expect((await second.post('/api/auth/login', { data: { email, password: 'incorrect-password' } })).status()).toBe(401);
    expect((await second.post('/api/auth/login', { data: { email, password } })).status()).toBe(200);
    expect((await first.post('/api/auth/password', { data: { currentPassword: password, newPassword } })).status()).toBe(200);
    expect((await first.get('/api/bootstrap')).status()).toBe(200);
    expect((await second.get('/api/bootstrap')).status()).toBe(401);
    expect((await second.post('/api/auth/login', { data: { email, password } })).status()).toBe(401);
    expect((await second.post('/api/auth/login', { data: { email, password: newPassword } })).status()).toBe(200);
    expect((await first.delete('/api/auth/account', { data: { password: newPassword, confirmation: 'DELETE' } })).status()).toBe(200);
    expect((await second.get('/api/bootstrap')).status()).toBe(401);
    expect((await second.post('/api/auth/login', { data: { email, password: newPassword } })).status()).toBe(401);
  } finally { await first.dispose(); await second.dispose(); }
});
