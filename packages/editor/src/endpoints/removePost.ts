import { OpenAPIRoute, ApiException, contentJson } from 'chanfana';
import { z } from 'zod';
import {
  BadRequestErrorSchema,
  InternalServerErrorSchema,
  NotFoundErrorSchema,
  UnauthorizedErrorSchema,
} from 'shared/src/constants';
import { feedUri, postUri } from 'shared/src/validators';
import { AppContext, createErrorResponse } from 'shared/src/types';

const SQL_DELETE_POST = `
DELETE FROM posts 
WHERE feed_id = (SELECT feed_id FROM feeds WHERE feed_uri = ?)
  AND uri = ? 
  AND (? IS NULL OR indexed_at = ?)`;
const SQL_CHECK_FEED = 'SELECT feed_id FROM feeds WHERE feed_uri = ?';

export class RemovePost extends OpenAPIRoute {
  schema = {
    tags: ['Feed Editor'],
    summary: 'Remove a post from a feed',
    request: {
      body: contentJson(
        z.object({
          feed: feedUri,
          post: z
            .object({
              uri: postUri,
              indexedAt: z.string().datetime({ offset: true }).optional(),
            })
            .openapi('removePostPostParam'),
        })
      ),
    },
    responses: {
      '200': {
        description: 'Post removed successfully',
        content: {
          'application/json': {
            schema: z.object({
              message: z.string(),
              feed: feedUri,
              post: z.object({
                uri: postUri,
                indexedAt: z.string().datetime({ offset: true }),
              }),
            }),
          },
        },
      },
      ...UnauthorizedErrorSchema,
      ...BadRequestErrorSchema,
      ...NotFoundErrorSchema,
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
    const { feed: feed_uri, post } = data.body;

    // Delete the post from the database using subquery for feed_id
    const indexed_at = post.indexedAt ? new Date(post.indexedAt).toISOString() : null;
    if (c.env.DEVELOPER_MODE === 'enabled') {
      console.log('feed uri:', feed_uri, 'post:', post);
    }
    const deleteResult = await db
      .prepare(SQL_DELETE_POST)
      .bind(feed_uri, post.uri, indexed_at, indexed_at)
      .run();

    if (!deleteResult.success) {
      throw new ApiException('Failed to remove post from the database');
    }

    // If no rows deleted, check if it's because feed doesn't exist or post doesn't exist
    if (!deleteResult.meta.changed_db) {
      const { success: checkFeedSuccess, results: feedResults } = await db
        .prepare(SQL_CHECK_FEED)
        .bind(feed_uri)
        .all();
      if (!checkFeedSuccess) {
        throw new ApiException('Failed to query the database');
      }
      if (feedResults.length === 0) {
        return createErrorResponse('UnknownFeed', `Feed with URI ${feed_uri} does not exist.`, 404);
      }
      return createErrorResponse(
        'NotFound',
        `Post not found feed:${feed_uri}, post:{uri:${post.uri} ${
          post.indexedAt ? 'indexedAt:' + post.indexedAt : ''
        }}`,
        404
      );
    }

    return Response.json({
      message: 'Post removed successfully',
      feed: feed_uri,
      post: post,
    });
  }
}
