import { OpenAPIRoute, NotFoundException } from 'chanfana';
import { z } from 'zod';
import {
  InternalServerErrorSchema,
  NotFoundErrorSchema,
  DOCUMENT_TYPES,
} from 'shared/src/constants';
import { AppContext, createErrorResponse } from 'shared/src/types';

// get service document from D1 documents table

export class GetDocument extends OpenAPIRoute {
  schema = {
    tags: ['Document'],
    summary: 'Get service document',
    request: {
      params: z.object({
        type: z
          .string()
          .describe(
            'Type of document to retrieve. Supported types: ' +
              Object.values(DOCUMENT_TYPES).join(', ')
          ),
      }),
    },
    responses: {
      '200': {
        description: 'document of service',
        content: {
          'application/text': {
            schema: z.string(),
          },
        },
      },
      ...NotFoundErrorSchema,
      ...InternalServerErrorSchema,
    },
  };

  handleValidationError(): Response {
    return createErrorResponse('NotFound', 'content not found', 404);
  }

  async handle(c: AppContext): Promise<Response> {
    const { type } = (await this.getValidatedData<typeof this.schema>()).params;
    if (!type || (type !== DOCUMENT_TYPES.PRIVACY_POLICY && type !== DOCUMENT_TYPES.TOS)) {
      return this.handleValidationError();
    }
    const SQL_SELECT_DOCUMENT = `
        SELECT url, content
        FROM documents
        WHERE type = ?
        LIMIT 1
    `;
    const result = await c.env.DB.prepare(SQL_SELECT_DOCUMENT).bind(type).first();
    // check if result is null or empty
    if (result === null || (result.url === null && result.content === null)) {
      throw new NotFoundException('Document not found');
    }
    // url only: show url
    let text: string;
    if (result.url && result.url !== '' && (result.content === null || result.content === '')) {
      text = `See document at ${result.url as string}`;
    }
    // content only: show content
    if (result.url === null || result.url === '') {
      text = result.content as string;
    }
    // url and content: show url and content
    if (result.url && result.url !== '' && result.content && result.content !== '') {
      text = (`You can view the document at ${result.url}\n` + result.content) as string;
    }
    return c.text(text, 200);
  }
}
