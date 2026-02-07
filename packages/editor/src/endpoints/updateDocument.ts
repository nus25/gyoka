import { contentJson } from 'chanfana';
import * as z from 'zod';
import { BaseOpenAPIRoute } from 'shared/src/routes';
import { DOCUMENT_TYPES } from 'shared/src/constants';
import { AppContext } from 'shared/src/types';
import {
  UnauthorizedError,
  BadRequestError,
  InternalServerError,
} from 'shared/src/errors';
const SQL_UPDATE_DOCUMENT =
  'INSERT OR REPLACE INTO documents (type, url, content) VALUES (?, ?, ?)';

export class UpdateDocument extends BaseOpenAPIRoute {
  schema = {
    tags: ['Documents'],
    summary: 'Update document content and URL',
    request: {
      body: contentJson(
        z.object({
          type: z.enum([DOCUMENT_TYPES.TOS, DOCUMENT_TYPES.PRIVACY_POLICY]),
          url: z.url().nullable().optional(),
          content: z.string().nullable().optional(),
        })
      ),
    },
    responses: {
      '200': {
        description: 'Document updated successfully',
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
      ...InternalServerError.schema(),
    },
  };

  async handle(c: AppContext): Promise<Response> {
    const db: D1Database = c.env.DB;
    const data = await this.getValidatedData<typeof this.schema>();
    const { type, url = null, content = null } = data.body;

    try {
      const result = await db.prepare(SQL_UPDATE_DOCUMENT).bind(type, url, content).run();

      if (!result.success) {
        throw new InternalServerError('Failed to update document');
      }

      return Response.json({
        type,
        url,
        content,
      });
    } catch (error) {
      console.error('Failed to update document:', error);
      throw new InternalServerError('Failed to update document');
    }
  }
}
