import { contentJson } from 'chanfana';
import {
  BadRequestError,
  ConflictError,
  InternalServerError,
  UnauthorizedError,
} from 'shared/src/errors';
import { BaseOpenAPIRoute } from 'shared/src/routes';
import { AppContext } from 'shared/src/types';
import { feedUri } from 'shared/src/validators';
import * as z from 'zod';

const SQL_INSERT_FEED = 'INSERT INTO feeds (feed_uri, lang_filter, is_active) VALUES (?, ?, ?)';

export class RegisterFeed extends BaseOpenAPIRoute {
  schema = {
    tags: ['Feed Editor'],
    summary: 'Register new feed',
    request: {
      body: contentJson(
        z.object({
          uri: feedUri,
          langFilter: z.boolean().default(true),
          isActive: z.boolean().default(true),
        })
      ),
    },
    responses: {
      '200': {
        description: 'Register feed',
        content: {
          'application/json': {
            schema: z.object({
              message: z.string(),
              feed: z.object({
                uri: feedUri,
                langFilter: z.boolean(),
                isActive: z.boolean(),
              }),
            }),
          },
        },
      },
      ...UnauthorizedError.schema(),
      ...BadRequestError.schema(),
      ...InternalServerError.schema(),
      ...ConflictError.schema(),
    },
  };

  async handle(c: AppContext): Promise<Response> {
    const db: D1Database = c.env.DB;
    const data = await this.getValidatedData<typeof this.schema>();
    const { uri: feed_uri, langFilter, isActive } = data.body;
    try {
      const { success } = await db
        .prepare(SQL_INSERT_FEED)
        .bind(feed_uri, langFilter, isActive)
        .run();
      if (!success) {
        throw new InternalServerError('Failed to register feed');
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        throw new ConflictError(`Feed with URI ${feed_uri} already exists.`);
      }
      throw error;
    }
    const response = {
      message: 'Feed registered successfully',
      feed: {
        uri: feed_uri,
        langFilter: langFilter,
        isActive: isActive,
      },
    };
    return Response.json(response);
  }
}
