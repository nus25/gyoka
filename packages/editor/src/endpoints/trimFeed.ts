import { contentJson } from 'chanfana';
import {
  BadRequestError,
  InternalServerError,
  UnknownFeedError,
  UnauthorizedError,
} from 'shared/src/errors';
import { createLogger } from 'shared/src/logger';
import { BaseOpenAPIRoute } from 'shared/src/routes';
import { AppContext } from 'shared/src/types';
import { feedUri } from 'shared/src/validators';
import * as z from 'zod';

const SQL_SELECT_FEED_AND_COUNT = `
    SELECT 
        feed_id, 
        (SELECT COUNT(*) 
            FROM posts 
            WHERE feed_id = feeds.feed_id) AS post_count
    FROM feeds 
    WHERE feed_uri = ?
`;
const SQL_DELETE_POST = `
    DELETE FROM posts
    WHERE feed_id = ?1
    AND rowid NOT IN (
        SELECT rowid
        FROM posts
        WHERE feed_id = ?1
        ORDER BY indexed_at DESC
        LIMIT ?2
    )
`;
const logger = createLogger({ service: 'editor', minLevel: 'debug' });
export class TrimFeed extends BaseOpenAPIRoute {
  schema = {
    tags: ['Feed Editor'],
    summary: 'Remove a post from a feed',
    request: {
      body: contentJson(
        z.object({
          feed: feedUri,
          remain: z.number().int().min(0).openapi({
            description: 'Number of posts remain in the feed.',
          }),
        })
      ),
    },
    responses: {
      '200': {
        description: 'Feed trimed successfully',
        content: {
          'application/json': {
            schema: z.object({
              message: z.string(),
              feed: feedUri,
              deletedCount: z.number(),
            }),
          },
        },
      },
      ...UnauthorizedError.schema(),
      ...BadRequestError.schema(),
      ...UnknownFeedError.schema(),
      ...InternalServerError.schema(),
    },
  };

  async handle(c: AppContext): Promise<Response> {
    const db: D1Database = c.env.DB;
    const data = await this.getValidatedData<typeof this.schema>();
    const { feed: feed_uri, remain } = data.body;

    // Check if the feed exists
    const { success: selectFeedSuccess, results: feedResults } = await db
      .prepare(SQL_SELECT_FEED_AND_COUNT)
      .bind(feed_uri)
      .all();
    if (!selectFeedSuccess) {
      throw new InternalServerError('Failed to query the database');
    }
    if (feedResults.length === 0) {
      throw new UnknownFeedError(`Feed with URI ${feed_uri} does not exist.`);
    }
    const feedId = feedResults[0].feed_id;
    const feedPosts = parseInt(feedResults[0].post_count as string);
    if (c.env.DEVELOPER_MODE === 'enabled') {
      logger.debug('db.trim.feed.start', {
        feedId,
        remain,
        feedPosts,
      });
    }
    const deletePostStmt = db.prepare(SQL_DELETE_POST).bind(feedId, remain);
    const deleteResult = await deletePostStmt.run();

    if (!deleteResult.success) {
      throw new InternalServerError('Failed to remove post from the database');
    }

    return Response.json({
      message: 'Posts trimed successfully',
      feed: feed_uri,
      deletedCount: feedPosts > remain ? feedPosts - remain : 0,
    });
  }
}
