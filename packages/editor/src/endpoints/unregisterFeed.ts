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

const SQL_DELETE_FEED = 'DELETE FROM feeds WHERE feed_uri = ?';
const SQL_DELETE_POSTS =
  'DELETE FROM posts WHERE feed_id = (SELECT feed_id FROM feeds WHERE feed_uri = ?)';
const SQL_SELECT_FEED = 'SELECT * FROM feeds WHERE feed_uri = ?';

export class UnregisterFeed extends OpenAPIRoute {
  schema = {
    tags: ['Feed Editor'],
    summary: 'Unregister a feed',
    request: {
      body: contentJson(
        z.object({
          uri: feedUri,
        })
      ),
    },
    responses: {
      '200': {
        description: 'Feed unregistered successfully',
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
    const { uri } = data.body;

    // Check if the feed exists
    const { success: selectSuccess, results } = await db.prepare(SQL_SELECT_FEED).bind(uri).all();
    if (!selectSuccess) {
      throw new ApiException('Failed to query the database');
    }
    if (results.length === 0) {
      return createErrorResponse('UnknownFeed', `Feed with URI ${uri} does not exist.`, 404);
    }
    // Use a batch statement to delete posts and the feed
    const deletePostsStmt = db.prepare(SQL_DELETE_POSTS).bind(uri);
    const deleteFeedStmt = db.prepare(SQL_DELETE_FEED).bind(uri);

    const batchResult = await db.batch([deletePostsStmt, deleteFeedStmt]);

    if (!batchResult.every((result) => result.success)) {
      throw new ApiException('Failed to unregister feed and associated posts');
    }

    return Response.json({
      message: 'Feed unregistered successfully',
    });
  }
}
