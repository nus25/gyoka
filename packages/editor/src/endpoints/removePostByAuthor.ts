import { contentJson } from 'chanfana';
import {
  BadRequestError,
  InternalServerError,
  UnauthorizedError,
  UnknownFeedError,
} from 'shared/src/errors';
import { createLogger } from 'shared/src/logger';
import { BaseOpenAPIRoute } from 'shared/src/routes';
import { AppContext } from 'shared/src/types';
import { feedUri, did } from 'shared/src/validators';
import * as z from 'zod';

const SQL_SELECT_FEED_AND_COUNT = `
SELECT 
  f.feed_id,
  (SELECT COUNT(*) FROM posts p WHERE p.feed_id = f.feed_id AND p.did = ?) as count
FROM feeds f
WHERE f.feed_uri = ?`;
const SQL_DELETE_POSTS_BY_AUTHOR = 'DELETE FROM posts WHERE feed_id = ? AND did = ?';
const logger = createLogger({ service: 'editor', minLevel: 'debug' });

export class RemovePostByAuthor extends BaseOpenAPIRoute {
  schema = {
    tags: ['Feed Editor'],
    summary: 'Remove all posts by a specific author from a feed',
    request: {
      body: contentJson(
        z.object({
          feed: feedUri,
          author: did,
        })
      ),
    },
    responses: {
      '200': {
        description: 'Posts by author removed successfully',
        content: {
          'application/json': {
            schema: z.object({
              message: z.string(),
              feed: feedUri,
              author: did,
              deletedCount: z.number().int().min(0),
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
    const { feed: feed_uri, author } = data.body;

    // Check if the feed exists and count posts by author in single query
    const { success: selectSuccess, results } = await db
      .prepare(SQL_SELECT_FEED_AND_COUNT)
      .bind(author, feed_uri)
      .all();
    if (!selectSuccess) {
      throw new InternalServerError('Failed to query the database');
    }
    if (results.length === 0) {
      throw new UnknownFeedError(`Feed with URI ${feed_uri} does not exist.`);
    }
    const feed_id = results[0].feed_id;
    const deletedCount = results[0].count as number;

    // Delete all posts by the author from the database
    if (c.env.DEVELOPER_MODE === 'enabled') {
      logger.debug('db.remove.posts_by_author.start', {
        feedId: feed_id,
        author,
        deletedCount,
      });
    }
    const deleteResult = await db.prepare(SQL_DELETE_POSTS_BY_AUTHOR).bind(feed_id, author).run();
    if (!deleteResult.success) {
      throw new InternalServerError('Failed to remove posts from the database');
    }

    return Response.json({
      message: 'Posts by author removed successfully',
      feed: feed_uri,
      author: author,
      deletedCount: deletedCount,
    });
  }
}
