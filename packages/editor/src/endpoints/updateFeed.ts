import { OpenAPIRoute, ApiException, contentJson } from 'chanfana';
import { z } from 'zod';
import {
  UnknownFeedErrorSchema,
  BadRequestErrorSchema,
  InternalServerErrorSchema,
  UnauthorizedErrorSchema,
} from 'shared/src/constants';
import { feedUri } from 'shared/src/validators';
import { AppContext, createErrorResponse } from 'shared/src/types';

const SQL_SELECT_FEED = 'SELECT * FROM feeds WHERE feed_uri = ?';
const SQL_UPDATE_LANG_FILTER = 'UPDATE feeds SET lang_filter = ? WHERE feed_uri = ?';
const SQL_UPDATE_IS_ACTIVE = 'UPDATE feeds SET is_active = ? WHERE feed_uri = ?';

export class UpdateFeed extends OpenAPIRoute {
  schema = {
    tags: ['Feed Editor'],
    summary: 'Update feed setting',
    request: {
      body: contentJson(
        z.object({
          uri: feedUri,
          langFilter: z.boolean().optional(),
          isActive: z.boolean().optional(),
        })
      ),
    },
    responses: {
      '200': {
        description: 'Feed update succeed',
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
      ...UnauthorizedErrorSchema,
      ...UnknownFeedErrorSchema,
      ...BadRequestErrorSchema,
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
    const { uri, langFilter, isActive } = data.body;
    if (langFilter === undefined && isActive === undefined) {
      return createErrorResponse('BadRequest', 'No value for update in request', 400);
    }

    // Check if the feed exists
    const { success: selectSuccess, results } = await db.prepare(SQL_SELECT_FEED).bind(uri).all();
    if (!selectSuccess) {
      throw new ApiException('Failed to query the database');
    }
    if (results.length === 0) {
      return createErrorResponse('UnknownFeed', `Feed with URI ${uri} does not exist.`, 404);
    }
    const feed = results[0];
    //update
    const stmt = [];
    if (langFilter !== undefined) {
      stmt.push(db.prepare(SQL_UPDATE_LANG_FILTER).bind(langFilter, uri));
      feed.lang_filter = langFilter ? 1 : 0;
    }
    if (isActive !== undefined) {
      stmt.push(db.prepare(SQL_UPDATE_IS_ACTIVE).bind(isActive, uri));
      feed.is_active = isActive ? 1 : 0;
    }
    const batchResult = await db.batch(stmt);
    if (!batchResult.every((result) => result.success)) {
      throw new ApiException('Failed to update feed');
    }

    const response = {
      message: 'Feed updated successfully',
      feed: {
        uri: feed.feed_uri,
        langFilter: feed.lang_filter == 1 ? true : false,
        isActive: feed.is_active == 1 ? true : false,
      },
    };
    return Response.json(response);
  }
}
