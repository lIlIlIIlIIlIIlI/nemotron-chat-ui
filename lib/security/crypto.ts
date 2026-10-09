import { requiredSecret } from '../config';
import { AppError } from '../errors';
import { createCipheriv, createDecipheriv, randomBytes, createHmac } from 'node:crypto';
function masterKey() {
  const value = process.env.APP_ENCRYPTION_KEY;
  if (!value || !/^[A-Za-z0-9+/]{43}=$/.test(value)) throw new AppError('CONFIGURATION', 'APP_ENCRYPTION_KEY 서버 설정을 확인해 주세요.', 503);
  return Buffer.from(value, 'base64');
}
export function encryptSecret(value: string, owner: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', masterKey(), iv);
  cipher.setAAD(Buffer.from(owner));
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.');
}
export function decryptSecret(value: string, owner: string) {
  const [version, iv, tag, data] = value.split('.');
  if (version !== 'v1' || !data) throw new Error('Invalid credential envelope');
  const decipher = createDecipheriv('aes-256-gcm', masterKey(), Buffer.from(iv, 'base64'));
  decipher.setAAD(Buffer.from(owner)); decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}
export function digest(value: string) {
  const secret = requiredSecret('AUTH_SECRET');
  return createHmac('sha256', secret).update(value).digest('hex');
}
