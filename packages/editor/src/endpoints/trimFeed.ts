import { OpenAPIRoute, ApiException, contentJson } from 'chanfana';
import { z } from 'zod';
import {
  BadRequestErrorSchema,
  InternalServerErrorSchema,
  UnknownFeedErrorSchema,
  UnauthorizedErrorSchema,
} from 'shared/src/constants';
import { feedUri } from 'shared/src/validators';
import { AppContext, createErrorResponse } from 'shared/src/types';

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
export class TrimFeed extends OpenAPIRoute {
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
              deletedCount: z.number(),
            }),
          },
        },
      },
      ...UnauthorizedErrorSchema,
      ...BadRequestErrorSchema,
      ...UnknownFeedErrorSchema,
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
    const { feed: feed_uri, remain } = data.body;

    // Check if the feed exists
    const { success: selectFeedSuccess, results: feedResults } = await db
      .prepare(SQL_SELECT_FEED_AND_COUNT)
      .bind(feed_uri)
      .all();
    if (!selectFeedSuccess) {
      throw new ApiException('Failed to query the database');
    }
    if (feedResults.length === 0) {
      return createErrorResponse('UnknownFeed', `Feed with URI ${feed_uri} does not exist.`, 404);
    }
    const feedId = feedResults[0].feed_id;
    const feedPosts = parseInt(feedResults[0].post_count as string);
    if (c.env.DEVELOPER_MODE === 'enabled') {
      console.log({ feedID: feedId, remain: remain, feedPosts: feedPosts });
    }
    const deletePostStmt = db.prepare(SQL_DELETE_POST).bind(feedId, remain);
    const deleteResult = await deletePostStmt.run();

    if (!deleteResult.success) {
      throw new ApiException('Failed to remove post from the database');
    }

    return Response.json({
      message: 'Posts trimed successfully',
      feed: feed_uri,
      deletedCount: feedPosts > remain ? feedPosts - remain : 0,
    });
  }
}
