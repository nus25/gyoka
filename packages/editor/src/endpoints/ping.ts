import { BaseOpenAPIRoute } from 'shared/src/routes';
import * as z from 'zod';
import { InternalServerError, UnauthorizedError } from 'shared/src/errors';

export class Ping extends BaseOpenAPIRoute {
  schema = {
    tags: ['Feed Editor'],
    summary: 'Ping system',
    request: {},
    responses: {
      '200': {
        description: 'respond ping request',
        content: {
          'application/json': {
            schema: z.object({
              message: z.string(),
            }),
          },
        },
      },
      ...UnauthorizedError.schema(),
      ...InternalServerError.schema(),
    },
  };

  async handle(): Promise<Response> {
    return Response.json({
      message: 'Gyoka is available',
    });
  }
}
