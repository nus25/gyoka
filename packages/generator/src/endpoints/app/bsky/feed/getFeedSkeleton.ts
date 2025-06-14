import { OpenAPIRoute, ApiException, InputValidationException } from 'chanfana';
import { z } from 'zod';
import { feedUri, postUri, repostUri } from 'shared/src/validators';
import {
  InternalServerErrorSchema,
  UnknownFeedErrorSchema,
  BadRequestErrorSchema,
} from 'shared/src/constants';
import { AppContext, createErrorResponse } from 'shared/src/types';

// https://github.com/bluesky-social/atproto/blob/main/lexicons/app/bsky/feed/getFeedSkeleton.json

export class GetFeedSkeleton extends OpenAPIRoute {
  schema = {
    tags: ['Feed Generator'],
    summary: 'Get a skeleton of a feed',
    request: {
      query: z.object({
        feed: feedUri.openapi({
          description: 'Feed generator URI',
        }),
        limit: z.number().int().min(1).max(100).default(50).openapi({
          description: 'Maximum number of feed items to return.',
          example: 50,
        }),
        cursor: z.string().optional().openapi({
          description: 'Pagination cursor for fetching the next set of results.',
          example: 'next-page-cursor',
        }),
      }),
    },
    responses: {
      '200': {
        description: 'Feed skeleton response',
        content: {
          'application/json': {
            schema: z.object({
              cursor: z.string().optional().openapi({
                description: 'Pagination cursor for the next set of results.',
                example: 'next-page-cursor',
              }),
              feed: z
                .array(
                  z.object({
                    post: postUri,
                    reason: z
                      .union([
                        z.object({
                          repost: repostUri,
                        }),
                        z.object({}).openapi({
                          description: 'Pinned post reason.(currentry not used in bluesky)',
                        }),
                      ])
                      .optional()
                      .openapi({
                        description: 'Reason for including the post in the feed skeleton.',
                      }),
                    feedContext: z.string().max(2000).optional().openapi({
                      description: 'Context passed through to the client and feed generator.',
                      example: 'Some feed context',
                    }),
                  })
                )
                .openapi({
                  description: 'Array of feed posts in the skeleton.',
                }),
            }),
          },
        },
      },
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
    const {
      feed: feedUri,
      limit,
      cursor,
    } = (await this.getValidatedData<typeof this.schema>()).query;
    // cursor check
    let cursorIndexedAt: string | null = null;
    let cursorCid: string | null = null;
    if (cursor) {
      const cursorParts = cursor ? cursor.split('::') : [];
      if (
        cursorParts.length !== 2 ||
        cursorParts.some((part) => part === '') ||
        isNaN(parseInt(cursorParts[0], 10))
      ) {
        throw new InputValidationException('Malformed cursor');
      }
      cursorIndexedAt = new Date(parseInt(cursorParts[0], 10)).toISOString();
      cursorCid = cursorParts[1];
    }

    // get feed
    const SQL_SELECT_FEED = `
        SELECT * 
        FROM feeds 
        WHERE feed_uri = ?1 
        AND is_active = 1
        LIMIT 1;`;

    const { success: feedCheckSuccess, results: feedResults } = await c.env.DB.prepare(
      SQL_SELECT_FEED
    )
      .bind(feedUri)
      .all();
    if (!feedCheckSuccess) {
      throw new ApiException('Failed to check feed existence');
    }
    if (feedResults.length === 0 || !feedResults[0].is_active) {
      return createErrorResponse('UnknownFeed', `Feed with URI ${feedUri} does not exist.`, 404);
    }
    const feedId = feedResults[0].feed_id;
    const lang_filter = feedResults[0].lang_filter;

    // get posts
    // language codes for filter
    const acceptLanguage = c.req.header('Accept-Language') || '';
    let languageCodes = [];
    if (lang_filter) {
      languageCodes = [
        ...new Set(
          acceptLanguage
            .split(',')
            .map((lang) => lang.split(';')[0].trim())
            .map((lang) => lang.split('-')[0]) // Extract language code (e.g., "en" from "en-US")
            .map((lang) => lang.toLowerCase())
            .filter((lang) => lang)
        ),
      ].slice(0, 10); // Limit to first 10 primary language tags
    }

    const SQL_TEMPLATE_SELECT_POST_WITH_LANGUAGE = `
        SELECT p.*
        FROM posts p
            WHERE
                p.feed_id = ?
                AND (
                    ? IS NULL OR
                    (p.indexed_at < ? OR (p.indexed_at = ? AND p.cid < ?))
                )
                :ENABLE_LANGS AND EXISTS (SELECT 1 FROM post_languages pl WHERE pl.post_id = p.post_id  AND pl.language IN :ARRAY_LANGS)
            ORDER BY p.indexed_at DESC, p.cid DESC, p.post_id DESC
            LIMIT ?
        `;

    const query = SQL_TEMPLATE_SELECT_POST_WITH_LANGUAGE.replace(
      ':ARRAY_LANGS',
      `(${languageCodes.map(() => '?').join(',')},'*')` // '*' is used to match posts without language
    ).replace(
      ':ENABLE_LANGS',
      languageCodes.length > 0 ? '' : '--' //comment out if languageCodes is unnecessary
    );
    if (c.env.DEVELOPER_MODE === 'enabled') {
      console.log('Generated query:', query);
      console.log('Bindings:', [
        feedId,
        cursor || null,
        cursorIndexedAt,
        cursorIndexedAt,
        cursorCid,
        ...languageCodes,
        limit,
      ]);
    }
    const { success, results } = await c.env.DB.prepare(query)
      .bind(
        feedId,
        cursor || null,
        cursorIndexedAt,
        cursorIndexedAt,
        cursorCid,
        ...languageCodes,
        limit
      )
      .all();

    if (!success) {
      throw new ApiException('Failed to fetch feed skeleton');
    }

    const feed = results.map((post) => ({
      post: post.uri,
      reason: post.reason ? JSON.parse(post.reason as string) : undefined, // Decode JSON string to object
      feedContext: post.feed_context ?? undefined,
    }));
    const nextCursor =
      results.length == limit
        ? `${new Date(results[results.length - 1].indexed_at as string).getTime()}::${
            results[results.length - 1].cid
          }`
        : undefined;

    // create response body
    const responseBody = {
      cursor: nextCursor,
      feed,
    };

    // Create headers
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');

    // Set Content-Language header if language codes are available
    if (languageCodes.length > 0) {
      headers.set('Content-Language', Array.from(languageCodes).join(', '));
    }

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers,
    });
  }
}
