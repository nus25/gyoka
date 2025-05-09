import { OpenAPIRoute, ApiException } from 'chanfana';
import { z } from 'zod';
import { DOCUMENT_TYPES, InternalServerErrorSchema } from 'shared/src/constants';
import { did, feedUri } from 'shared/src/validators';
import { AppContext } from 'shared/src/types';

// https://github.com/bluesky-social/atproto/blob/main/lexicons/app/bsky/feed/describeFeedGenerator.json

const SQL_SELECT_FEED = 'SELECT feed_uri FROM feeds WHERE is_active = 1';
const SQL_SELECT_DOCUMENT = 'SELECT type, url FROM documents';

export class DescribeFeedGenerator extends OpenAPIRoute {
  schema = {
    tags: ['Feed Generator'],
    summary: 'Get feed generator description',
    request: {},
    responses: {
      '200': {
        description: 'Feed generator description',
        content: {
          'application/json': {
            schema: z.object({
              did: did.openapi({
                description: 'DID of the publisher.',
                example: 'did:plc:publisher',
              }),
              feeds: z.array(
                z.object({
                  uri: feedUri,
                })
              ),
              links: z
                .object({
                  privacyPolicy: z.string().url().optional().openapi({
                    example: 'http://example.com/privacy-policy',
                  }),
                  termsOfService: z.string().url().optional().openapi({
                    example: 'http://example.com/terms-of-service',
                  }),
                })
                .optional(),
            }),
          },
        },
      },
      ...InternalServerErrorSchema,
    },
  };

  async handle(c: AppContext): Promise<Response> {
    const db: D1Database = c.env.DB;
    // get feed uris
    const { success: feedSuccess, results: feedResults } = await db.prepare(SQL_SELECT_FEED).all();
    if (!feedSuccess) {
      throw new ApiException('Failed to fetch feeds');
    }
    // get document links
    const { success: docSuccess, results: docResults } = await db
      .prepare(SQL_SELECT_DOCUMENT)
      .all();

    if (!docSuccess) {
      throw new ApiException('Failed to fetch links');
    }

    const linkMap = docResults.reduce((acc, row) => {
      const type = row.type;
      const url = row.url;
      if (type === DOCUMENT_TYPES.PRIVACY_POLICY) {
        // if url is null, use the default url
        if (!url) {
          acc.privacyPolicy = `https://${c.env.FEEDGEN_HOST}/doc/${DOCUMENT_TYPES.PRIVACY_POLICY}`;
        } else {
          acc.privacyPolicy = url;
        }
      } else if (type === DOCUMENT_TYPES.TOS) {
        // if url is null, use the default url
        if (!url) {
          acc.termsOfService = `https://${c.env.FEEDGEN_HOST}/doc/${DOCUMENT_TYPES.TOS}`;
        } else {
          acc.termsOfService = url;
        }
      }
      return acc;
    }, {});

    const response = {
      did: c.env.FEEDGEN_PUBLISHER_DID,
      feeds: [...feedResults.map((feed) => ({ uri: feed.feed_uri }))],
      links: undefined,
    };

    if (Object.keys(linkMap).length > 0) {
      response.links = linkMap as {
        privacyPolicy?: string;
        termsOfService?: string;
      };
    }
    return Response.json(response);
  }
}
