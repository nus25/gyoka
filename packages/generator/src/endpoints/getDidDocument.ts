import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import { InternalServerErrorSchema } from 'shared/src/constants';
import { AppContext } from 'shared/src/types';
import { did } from 'shared/src/validators';

// https://www.w3.org/TR/did-spec-registries/#did-document-properties

export class GetDidDocument extends OpenAPIRoute {
  schema = {
    tags: ['DID'],
    summary: 'Get DID document',
    request: {},
    responses: {
      '200': {
        description: 'DID document of service endpoint',
        content: {
          'application/did+json': {
            schema: z.object({
              '@context': z.literal('https://www.w3.org/ns/did/v1').array(),
              id: did.openapi({
                description: 'The DID of the service endpoint.',
                example: 'did:web:feed-generator.example.com',
              }),
              service: z
                .array(
                  z.object({
                    id: z.literal('#bsky_fg'),
                    type: z.literal('BskyFeedGenerator'),
                    serviceEndpoint: z.string().url().openapi({
                      description: 'The service endpoint URL.',
                      example: 'https://feed-generator.example.com',
                    }),
                  })
                )
                .optional(),
            }),
          },
        },
      },
      ...InternalServerErrorSchema,
    },
  };

  async handle(c: AppContext): Promise<Response> {
    const response = {
      '@context': ['https://www.w3.org/ns/did/v1'],
      id: `did:web:${c.env.FEEDGEN_HOST}`,
      service: [
        {
          id: '#bsky_fg', //@see :https://github.com/did-method-plc/did-method-plc/issues/90
          type: 'BskyFeedGenerator',
          serviceEndpoint: `https://${c.env.FEEDGEN_HOST}`,
        },
      ],
    };

    return new Response(JSON.stringify(response), {
      headers: {
        'Content-Type': 'application/did+json',
      },
    });
  }
}
