import { AppError } from '../http';
export function providerError(status: number) {
  const map: Record<number, [string, string]> = {
    400: ['INVALID_REQUEST', '요청 옵션 또는 컨텍스트 길이를 확인해 주세요.'],
    401: ['UNAUTHORIZED', '401 Unauthorized · API Key가 유효하지 않습니다.'],
    403: ['FORBIDDEN', '403 Forbidden · 모델 또는 API 접근 권한이 없습니다.'],
    404: ['MODEL_NOT_FOUND', '404 Not Found · 모델 ID와 Endpoint를 확인해 주세요.'],
    413: ['CONTEXT_LENGTH', '컨텍스트가 너무 큽니다. 메시지나 파일을 줄여 주세요.'],
    429: ['RATE_LIMIT', '429 Rate Limit · Provider 사용량 또는 요청 한도를 확인해 주세요.'],
  };
  const [code, message] = map[status] || ['PROVIDER_ERROR', `Provider Error (${status}) · 잠시 후 다시 시도해 주세요.`];
  return new AppError(code, message, status === 429 ? 429 : 502);
}
export function safeAIError(error: unknown) {
  if (error instanceof AppError) return error;
  if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) return new AppError('STOPPED', '응답 생성이 중단되었습니다.');
  return new AppError('NETWORK_ERROR', 'Network Error · Provider 연결을 확인해 주세요.', 502);
}
