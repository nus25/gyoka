import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import { InternalServerErrorSchema, UnauthorizedErrorSchema } from 'shared/src/constants';

export class Ping extends OpenAPIRoute {
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
      ...UnauthorizedErrorSchema,
      ...InternalServerErrorSchema,
    },
  };

  async handle(): Promise<Response> {
    return Response.json({
      message: 'Gyoka is available',
    });
  }
}
