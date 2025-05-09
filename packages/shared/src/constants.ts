import { z } from 'zod';
import { extendZodWithOpenApi } from '@hono/zod-openapi';
extendZodWithOpenApi(z);

export const All_LANGS = '*';

export const DOCUMENT_TYPES = {
  TOS: 'tos' as const,
  PRIVACY_POLICY: 'privacy_policy' as const,
} as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[keyof typeof DOCUMENT_TYPES];
export const InternalServerErrorSchema = {
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
export const BadRequestErrorSchema = {
  400: {
    description: 'Bad Request',
    content: {
      'application/json': {
        schema: z.object({
          error: z.literal('BadRequest'),
          message: z
            .string()
            .optional()
            .openapi({
              example: 'The request could not be understood or was missing required parameters',
            }),
        }),
      },
    },
  },
};

export const NotFoundErrorSchema = {
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

export const UnknownFeedErrorSchema = {
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

export const UnauthorizedErrorSchema = {
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
