import * as z from 'zod';
import { extendZodWithOpenApi } from '@hono/zod-openapi';
import { createLogger, type LogLevel } from './logger';
extendZodWithOpenApi(z);

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

  constructor(message = '') {
    super(message);
    this.message = message;
  }

  static schema() {
    return {
      500: {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: z.object({
              error: z.literal('InternalServerError'),
              message: z.string().optional().openapi({ example: 'An unexpected error occurred' }),
            }),
          },
        },
      },
    };
  }
}

export class NotFoundError extends GyokaBaseError {
  errorCode = 'NotFound';
  status = 404;

  constructor(message = '') {
    super(message);
    this.message = message;
  }

  static schema() {
    return {
      404: {
        description: 'Not Found',
        content: {
          'application/json': {
            schema: z.object({
              error: z.literal('NotFound'),
              message: z
                .string()
                .optional()
                .openapi({ example: 'The requested resource was not found' }),
            }),
          },
        },
      },
    };
  }
}

export class BadRequestError extends GyokaBaseError {
  errorCode = 'BadRequest';
  status = 400;

  constructor(message = '') {
    super(message);
    this.message = message;
  }

  static schema() {
    return {
      400: {
        description: 'Bad Request',
        content: {
          'application/json': {
            schema: z.object({
              error: z.literal('BadRequest'),
              message: z.string().optional().openapi({
                example: 'The request could not be understood or was missing required parameters',
              }),
            }),
          },
        },
      },
    };
  }
}

export class UnknownFeedError extends GyokaBaseError {
  errorCode = 'UnknownFeed';
  status = 404;

  constructor(message = '') {
    super(message);
    this.message = message;
  }
  static schema() {
    return {
      404: {
        description: 'Unknown Feed',
        content: {
          'application/json': {
            schema: z.object({
              error: z.literal('UnknownFeed'),
              message: z
                .string()
                .optional()
                .openapi({ example: 'Feed with URI {feedUri} does not exist.' }),
            }),
          },
        },
      },
    };
  }
}

export class UnauthorizedError extends GyokaBaseError {
  errorCode = 'Unauthorized';
  status = 401;

  constructor(message = '') {
    super(message);
    this.message = message;
  }
  static schema() {
    return {
      401: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: z.object({
              error: z.literal('Unauthorized'),
              message: z
                .string()
                .optional()
                .openapi({ example: 'Authentication credentials were missing or invalid.' }),
            }),
          },
        },
      },
    };
  }
}

export class ConflictError extends GyokaBaseError {
  errorCode = 'Conflict';
  status = 409;

  constructor(message = '') {
    super(message);
    this.message = message;
  }

  static schema() {
    return {
      409: {
        description: 'Conflict',
        content: {
          'application/json': {
            schema: z.object({
              error: z.literal('Conflict'),
              message: z
                .string()
                .optional()
                .openapi({ example: 'The requested resource already exists.' }),
            }),
          },
        },
      },
    };
  }
}
