import { createHmac } from 'node:crypto';
import { databaseConfig } from '../config';
import { AppError } from '../errors';

export type Query = { sql: string; params: unknown[]; method: 'all' | 'get' | 'run' | 'values' };
export type QueryResult = { rows: unknown[] };
const errors: Record<string, [string, number]> = {
  SCHEMA_MISSING: ['데이터베이스 초기화가 필요합니다. 관리자에게 문의해 주세요.', 503],
  DATABASE_AUTH: ['데이터베이스 인증 설정을 확인해 주세요.', 503],
  DATABASE_UNAVAILABLE: ['데이터베이스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.', 503],
  ACCOUNT_UNAVAILABLE: ['이 이메일로 계정을 만들 수 없습니다. 로그인해 주세요.', 409],
  GENERATING: ['이 대화에서 이미 응답을 생성하고 있습니다.', 409],
  CONFLICT: ['데이터가 변경되었습니다. 새로고침 후 다시 시도해 주세요.', 409],
  STORAGE_LIMIT: ['계정 파일 저장 한도(50MB)를 초과했습니다.', 413],
  CONVERSATION_LIMIT: ['대화가 길어졌습니다. 새 대화를 시작해 주세요.', 409],
  VERSION_LIMIT: ['Artifact 버전 개수 또는 저장 크기 한도에 도달했습니다.', 413],
  MEMORY_LIMIT: ['메모리는 최대 100개입니다.', 409],
  DATABASE_QUERY: ['데이터 저장 요청을 완료하지 못했습니다.', 500],
};

export async function databaseRequest(path: '/query' | '/batch' | '/health', payload?: unknown) {
  const config = databaseConfig();
  const body = payload === undefined ? '' : JSON.stringify(payload);
  const timestamp = String(Date.now());
  const method = path === '/health' ? 'GET' : 'POST';
  const signature = createHmac('sha256', config.secret).update(`${timestamp}\n${method}\n${path}\n${body}`).digest('hex');
  let response: Response;
  try {
    response = await fetch(`${config.origin}${path}`, {
      method, body: body || undefined, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', 'X-D1-Timestamp': timestamp, 'X-D1-Signature': signature },
    });
  } catch { throw new AppError('DATABASE_UNAVAILABLE', errors.DATABASE_UNAVAILABLE[0], 503); }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const code = response.status === 401 ? 'DATABASE_AUTH' : typeof data?.code === 'string' && errors[data.code] ? data.code : 'DATABASE_UNAVAILABLE';
    const [message, status] = errors[code];
    throw new AppError(code, message, status);
  }
  return data;
}

export async function executeQuery(query: Query): Promise<QueryResult> {
  return databaseRequest('/query', query);
}
export async function executeBatch(queries: Query[]): Promise<QueryResult[]> {
  return databaseRequest('/batch', { queries });
}
