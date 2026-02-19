import * as z from 'zod';
import { extendZodWithOpenApi } from '@hono/zod-openapi';
import {
  BadRequestError as CoreBadRequestError,
  ConflictError as CoreConflictError,
  createErrorResponse,
  GyokaBaseError,
  InternalServerError as CoreInternalServerError,
  NotFoundError as CoreNotFoundError,
  type ErrorResponse,
  UnauthorizedError as CoreUnauthorizedError,
  UnknownFeedError as CoreUnknownFeedError,
} from './core';

extendZodWithOpenApi(z);

export { createErrorResponse, GyokaBaseError, type ErrorResponse };

export class InternalServerError extends CoreInternalServerError {
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

export class NotFoundError extends CoreNotFoundError {
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

export class BadRequestError extends CoreBadRequestError {
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

export class UnknownFeedError extends CoreUnknownFeedError {
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

export class UnauthorizedError extends CoreUnauthorizedError {
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

export class ConflictError extends CoreConflictError {
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
