import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import { feedUri } from 'shared/src/validators';
import { AppContext } from 'shared/src/types';
import { UnauthorizedError, InternalServerError } from 'shared/src/errors';

const SQL_SELECT_FEED = 'SELECT * FROM feeds';

export class ListFeeds extends OpenAPIRoute {
  security = [{ ApiKeyAuth: [] }];
  schema = {
    tags: ['Feed Editor'],
    summary: 'Get feed list',
    request: {},
    responses: {
      '200': {
        description: 'Feed list',
        content: {
          'application/json': {
            schema: z.object({
              feeds: z.array(
                z.object({
                  uri: feedUri,
                  langFilter: z.boolean(),
                  isActive: z.boolean(),
                })
              ),
            }),
          },
        },
      },
      ...UnauthorizedError.schema(),
      ...InternalServerError.schema(),
    },
  };

  async handle(c: AppContext): Promise<Response> {
    const db: D1Database = c.env.DB;
    // get feed info
    const { success: feedSuccess, results: feedResults } = await db.prepare(SQL_SELECT_FEED).all();
    if (!feedSuccess) {
      throw new InternalServerError('Failed to fetch feeds');
    }
    const response = {
      feeds: [
        ...feedResults.map((feed) => ({
          uri: feed.feed_uri,
          langFilter: feed.lang_filter == 1 ? true : false,
          isActive: feed.is_active == 1 ? true : false,
        })),
      ],
    };

    return Response.json(response);
  }
}
