import { OpenAPIRoute, ApiException, contentJson } from 'chanfana';
import { z } from 'zod';
import {
  BadRequestErrorSchema,
  InternalServerErrorSchema,
  UnauthorizedErrorSchema,
  DOCUMENT_TYPES,
} from 'shared/src/constants';
import { AppContext, createErrorResponse } from 'shared/src/types';

const SQL_UPDATE_DOCUMENT =
  'INSERT OR REPLACE INTO documents (type, url, content) VALUES (?, ?, ?)';

export class UpdateDocument extends OpenAPIRoute {
  schema = {
    tags: ['Documents'],
    summary: 'Update document content and URL',
    request: {
      body: contentJson(
        z.object({
          type: z.enum([DOCUMENT_TYPES.TOS, DOCUMENT_TYPES.PRIVACY_POLICY]),
          url: z.string().url().nullable().optional(),
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
              url: z.string().url().nullable(),
              content: z.string().nullable(),
            }),
          },
        },
      },
      ...UnauthorizedErrorSchema,
      ...BadRequestErrorSchema,
      ...InternalServerErrorSchema,
    },
  };

  handleValidationError(errors: z.ZodIssue[]): Response {
    return createErrorResponse(
      'BadRequest',
      JSON.stringify(
        errors.map((error) => ({
          message: error.message,
          path: error.path,
        }))
      ),
      400
    );
  }

  async handle(c: AppContext): Promise<Response> {
    const db: D1Database = c.env.DB;
    const data = await this.getValidatedData<typeof this.schema>();
    const { type, url = null, content = null } = data.body;

    try {
      const result = await db.prepare(SQL_UPDATE_DOCUMENT).bind(type, url, content).run();

      if (!result.success) {
        throw new ApiException('Failed to update document');
      }

      return Response.json({
        type,
        url,
        content,
      });
    } catch (error) {
      console.error('Failed to update document:', error);
      throw error;
    }
  }
}
