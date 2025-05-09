import { OpenAPIRoute, ApiException, contentJson } from 'chanfana';
import { z } from 'zod';
import {
  BadRequestErrorSchema,
  InternalServerErrorSchema,
  UnauthorizedErrorSchema,
} from 'shared/src/constants';
import { feedUri } from 'shared/src/validators';
import { AppContext, createErrorResponse } from 'shared/src/types';

const SQL_INSERT_FEED = 'INSERT INTO feeds (feed_uri, lang_filter, is_active) VALUES (?, ?, ?)';

export class RegisterFeed extends OpenAPIRoute {
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
      ...UnauthorizedErrorSchema,
      ...BadRequestErrorSchema,
      ...InternalServerErrorSchema,
      '409': {
        description: 'Conflict',
        content: {
          'application/json': {
            schema: z.object({
              error: z.literal('Conflict'),
              message: z.string(),
            }),
          },
        },
      },
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
    const { uri: feed_uri, langFilter, isActive } = data.body;
    try {
      const { success } = await db
        .prepare(SQL_INSERT_FEED)
        .bind(feed_uri, langFilter, isActive)
        .run();
      if (!success) {
        throw new ApiException('Failed to register feed');
      }
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        return createErrorResponse('Conflict', `Feed with URI ${feed_uri} already exists.`, 409);
      }
      throw error; // rethrow the error if it's not a unique constraint violation
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
