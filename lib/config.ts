import { AppError } from './errors';

export function requiredSecret(name: string) {
  const value = process.env[name];
  if (!value || value.length < 32) throw new AppError('CONFIGURATION', `${name} 서버 설정을 확인해 주세요.`, 503);
  return value;
}

export function databaseConfig() {
  const value = process.env.CLOUDFLARE_D1_URL;
  let url: URL;
  try { url = new URL(value || ''); } catch { throw new AppError('DATABASE_CONFIG', '데이터베이스 연결 주소가 설정되지 않았습니다.', 503); }
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && local && process.env.NODE_ENV !== 'production'))) {
    throw new AppError('DATABASE_CONFIG', '데이터베이스 연결 주소 설정이 올바르지 않습니다.', 503);
  }
  return { origin: url.origin, secret: requiredSecret('CLOUDFLARE_D1_SECRET') };
}

export function allowedOrigins(request: Request) {
  const configured = process.env.APP_URL;
  if (process.env.NODE_ENV === 'production' && !configured) throw new AppError('CONFIGURATION', 'APP_URL 서버 설정을 확인해 주세요.', 503);
  const origins = new Set<string>();
  try {
    origins.add(new URL(configured || request.url).origin);
    // Vercel injects this exact deployment hostname; never trust arbitrary Host headers.
    if (process.env.VERCEL && process.env.VERCEL_URL) origins.add(new URL(`https://${process.env.VERCEL_URL}`).origin);
  } catch { throw new AppError('CONFIGURATION', 'APP_URL 서버 설정을 확인해 주세요.', 503); }
  return origins;
}
