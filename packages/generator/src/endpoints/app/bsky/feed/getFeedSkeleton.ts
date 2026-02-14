import * as z from 'zod';
import { BaseOpenAPIRoute } from 'shared/src/routes';
import { feedUri, postUri, repostUri } from 'shared/src/validators';
import { AppContext } from 'shared/src/types';
import { InternalServerError, BadRequestError, UnknownFeedError } from 'shared/src/errors';

// https://github.com/bluesky-social/atproto/blob/main/lexicons/app/bsky/feed/getFeedSkeleton.json

const MAX_ACCEPT_LANGUAGE_CODES = 10;
export class GetFeedSkeleton extends BaseOpenAPIRoute {
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
      ...BadRequestError.schema(),
      ...UnknownFeedError.schema(),
      ...InternalServerError.schema(),
    },
  };

  extractLanguageCodes(acceptLanguage: string): string[] {
    if (!acceptLanguage) return [];

    const maxCount = MAX_ACCEPT_LANGUAGE_CODES;
    const seen = new Set<string>();
    const parts = acceptLanguage.split(',');

    for (let i = 0; i < parts.length && seen.size < maxCount; i++) {
      const semicolonPos = parts[i].indexOf(';');
      const lang = semicolonPos === -1 ? parts[i] : parts[i].substring(0, semicolonPos);
      const trimmed = lang.trim();
      const dashPos = trimmed.indexOf('-');
      const langCode = (dashPos === -1 ? trimmed : trimmed.substring(0, dashPos)).toLowerCase();

      if (langCode) {
        seen.add(langCode);
      }
    }

    return Array.from(seen);
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
      const cursorParts = cursor.split('::');
      if (
        cursorParts.length !== 2 ||
        cursorParts.some((part) => part === '') ||
        isNaN(parseInt(cursorParts[0], 10))
      ) {
        throw new BadRequestError('Malformed cursor');
      }
      cursorIndexedAt = new Date(parseInt(cursorParts[0], 10)).toISOString();
      cursorCid = cursorParts[1];
    }

    // get posts
    // language codes for filter
    const acceptLanguage = c.req.header('Accept-Language') || '';
    const languageCodes = this.extractLanguageCodes(acceptLanguage);
    const SQL_TEMPLATE_SELECT_POST = `
SELECT p.uri, p.cid, p.indexed_at, p.reason, p.feed_context
FROM feeds f
INNER JOIN posts p ON p.feed_id = f.feed_id
WHERE f.feed_uri = ?
  AND f.is_active = 1
  AND (
    ? IS NULL
    OR (
      p.indexed_at < ?
      OR (
        p.indexed_at = ?
        AND p.cid < ?
      )
    )
  )
  AND (
    f.lang_filter = 0
    OR ${
      // if no language codes is send, always true
      languageCodes.length === 0
        ? '1=1'
        : `EXISTS (
            SELECT 1
            FROM post_languages pl
            WHERE pl.post_id = p.post_id
              AND pl.language IN (${languageCodes.map(() => '?').join(',')}, "*")
          )`
    }
  )
ORDER BY p.indexed_at DESC, p.cid DESC, p.post_id DESC
LIMIT ?;`;

    if (c.env.DEVELOPER_MODE === 'enabled') {
      console.log('Generated query:', SQL_TEMPLATE_SELECT_POST);
      console.log('Bindings:', [
        feedUri,
        cursor || null,
        cursorIndexedAt,
        cursorIndexedAt,
        cursorCid,
        ...languageCodes,
        limit,
      ]);
    }
    const { success, results } = await c.env.DB.prepare(SQL_TEMPLATE_SELECT_POST)
      .bind(
        feedUri,
        cursor || null,
        cursorIndexedAt,
        cursorIndexedAt,
        cursorCid,
        ...languageCodes,
        limit
      )
      .all();

    if (!success) {
      throw new InternalServerError('Failed to fetch feed skeleton');
    }

    if (results.length === 0) {
      // find out if feed exists
      const feedExistsQuery = `
      SELECT feed_id
      FROM feeds
      WHERE feed_uri = ?
        AND is_active = 1
      LIMIT 1;`;
      const feedExistsResult = await c.env.DB.prepare(feedExistsQuery).bind(feedUri).all();
      if (!feedExistsResult.success) {
        throw new InternalServerError('Failed to verify feed existence');
      }
      console.log(feedExistsResult);
      if (!feedExistsResult.results[0]?.feed_id) {
        throw new UnknownFeedError(`The feed generator with URI ${feedUri} does not existed.`);
      }
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
