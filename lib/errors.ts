export class AppError extends Error {
  constructor(public code: string, message: string, public status = 400, public retryAfter?: number) {
    super(message);
    this.name = 'AppError';
  }
}

// Drizzle wraps driver errors in a query error. Never expose its SQL or parameters.
export function knownError(error: unknown): AppError | undefined {
  const seen = new Set<unknown>();
  while (error instanceof Error && !seen.has(error)) {
    if (error instanceof AppError) return error;
    seen.add(error);
    error = error.cause;
  }
}
