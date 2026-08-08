import { DOCUMENT_TYPES } from 'shared/src/constants';
import {
  UnauthorizedError,
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from 'shared/src/errors';
import { createLogger } from 'shared/src/logger';
import { BaseOpenAPIRoute } from 'shared/src/routes';
import { AppContext } from 'shared/src/types';
import * as z from 'zod';

const SQL_SELECT_DOCUMENT = 'SELECT url, content FROM documents WHERE type = ? LIMIT 1';
const logger = createLogger({ service: 'editor' });

export class GetDocument extends BaseOpenAPIRoute {
  schema = {
    tags: ['Documents'],
    summary: 'Get document content and URL',
    request: {
      query: z.object({
        type: z.enum([DOCUMENT_TYPES.TOS, DOCUMENT_TYPES.PRIVACY_POLICY]),
      }),
    },
    responses: {
      '200': {
        description: 'Document fetched successfully',
        content: {
          'application/json': {
            schema: z.object({
              type: z.enum([DOCUMENT_TYPES.TOS, DOCUMENT_TYPES.PRIVACY_POLICY]),
              url: z.url().nullable(),
              content: z.string().nullable(),
            }),
          },
        },
      },
      ...UnauthorizedError.schema(),
      ...BadRequestError.schema(),
      ...NotFoundError.schema(),
      ...InternalServerError.schema(),
    },
  };

  async handle(c: AppContext): Promise<Response> {
    const db: D1Database = c.env.DB;
    const data = await this.getValidatedData<typeof this.schema>();
    const { type } = data.query;

    try {
      const { success, results } = await db
        .prepare(SQL_SELECT_DOCUMENT)
        .bind(type)
        .all<{ url: string | null; content: string | null }>();

      if (!success) {
        throw new InternalServerError('Failed to fetch document');
      }
      if (results.length === 0) {
        throw new NotFoundError('Document not found');
      }

      return Response.json({
        type,
        url: results[0].url,
        content: results[0].content,
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof InternalServerError) {
        throw error;
      }

      logger.error('db.query.document.failed', {
        type,
        error,
      });
      throw new InternalServerError('Failed to fetch document');
    }
  }
}
