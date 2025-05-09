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

const SQL_SELECT_FEED = 'SELECT feed_id FROM feeds WHERE feed_uri = ?';
const SQL_DELETE_POST =
  'DELETE FROM posts WHERE feed_id = ? AND uri = ? AND ( ? is NULL OR indexed_at = ?)';
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

    // Check if the feed exists
    const { success: selectFeedSuccess, results: feedResults } = await db
      .prepare(SQL_SELECT_FEED)
      .bind(feed_uri)
      .all();
    if (!selectFeedSuccess) {
      throw new ApiException('Failed to query the database');
    }
    if (feedResults.length === 0) {
      return createErrorResponse('UnknownFeed', `Feed with URI ${feed_uri} does not exist.`, 404);
    }
    const feed_id = feedResults[0].feed_id;

    // Delete the post from the database
    const indexed_at = post.indexedAt ? new Date(post.indexedAt).toISOString() : null;
    if (c.env.DEVELOPER_MODE === 'enabled') {
      console.log('feed id:', feed_id, 'post:', post);
    }
    const deletePostStmt = db
      .prepare(SQL_DELETE_POST)
      .bind(feed_id, post.uri, indexed_at, indexed_at);

    const deleteResult = await deletePostStmt.run();

    if (!deleteResult.success) {
      throw new ApiException('Failed to remove post from the database');
    }
    if (!deleteResult.meta.changed_db) {
      return createErrorResponse(
        'NotFound',
        `Post not found feed:${feed_uri}, post:{uri:${post.uri} ${
          post.indexedAt ? 'post:' + post.indexedAt : ''
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
