/** Application error with an HTTP status and a stable machine-readable code. */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const BadRequest = (message = 'Bad request', details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, details);
export const Unauthorized = (message = 'Not authenticated') =>
  new AppError(401, 'UNAUTHORIZED', message);
export const Forbidden = (message = 'You do not have permission to do that') =>
  new AppError(403, 'FORBIDDEN', message);
export const NotFound = (message = 'Not found') => new AppError(404, 'NOT_FOUND', message);
export const Conflict = (message = 'Conflict', details?: unknown) =>
  new AppError(409, 'CONFLICT', message, details);
