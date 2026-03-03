import { createLogger, type LogLevel } from '../logger';

const sharedLogger = createLogger({});

export type ErrorResponse = {
  error: string;
  message?: string;
};

type ErrorResponseLogOptions = {
  event?: string;
  level?: LogLevel;
  details?: Record<string, unknown>;
};

export function createErrorResponse(
  error: string,
  message: string,
  status: number,
  logOptions?: ErrorResponseLogOptions
): Response {
  const responseBody: ErrorResponse = { error, message };

  if (logOptions) {
    const level = logOptions.level ?? (status >= 500 ? 'error' : 'warn');
    const event = logOptions.event ?? 'api.respond.error.failed';
    const details = {
      status,
      errorCode: error,
      message,
      ...(logOptions.details ?? {}),
    };
    sharedLogger[level](event, details);
  }

  return new Response(JSON.stringify(responseBody), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export class GyokaBaseError extends Error {
  errorCode = 'GyokaBaseError';
  status = 500;
  constructor(message = '') {
    super(message);
    this.message = message;
  }
}

export class InternalServerError extends GyokaBaseError {
  errorCode = 'InternalServerError';
  status = 500;
}

export class NotFoundError extends GyokaBaseError {
  errorCode = 'NotFound';
  status = 404;
}

export class BadRequestError extends GyokaBaseError {
  errorCode = 'BadRequest';
  status = 400;
}

export class UnknownFeedError extends GyokaBaseError {
  errorCode = 'UnknownFeed';
  status = 404;
}

export class UnauthorizedError extends GyokaBaseError {
  errorCode = 'Unauthorized';
  status = 401;
}

export class ConflictError extends GyokaBaseError {
  errorCode = 'Conflict';
  status = 409;
}
