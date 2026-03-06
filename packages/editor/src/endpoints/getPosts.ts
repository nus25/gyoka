import {
  UnauthorizedError,
  UnknownFeedError,
  BadRequestError,
  InternalServerError,
} from 'shared/src/errors';
import { createLogger } from 'shared/src/logger';
import { BaseOpenAPIRoute } from 'shared/src/routes';
import { AppContext } from 'shared/src/types';
import { feedUri, postUri, repostUri, cid } from 'shared/src/validators';
import * as z from 'zod';

// note: cidが一致すればlanguagesの結果は等しくなるのでパフォーマンスのためにindexed_atとfeed_idはJOINに使用しない。
const SQL_SELECT_POSTS = `
SELECT 
    p.uri, 
    p.cid, 
    p.indexed_at, 
    p.reason,
    p.feed_context,
    GROUP_CONCAT(pl.language) AS langs
FROM posts p
JOIN post_languages pl ON p.post_id = pl.post_id
WHERE p.feed_id = ?
    AND (? IS NULL OR (p.indexed_at < ? OR (p.indexed_at = ? AND p.cid < ?)))
GROUP BY pl.post_id
ORDER BY p.indexed_at DESC, p.cid DESC, p.post_id DESC
LIMIT ?`;
const logger = createLogger({ service: 'editor', minLevel: 'debug' });

export class GetPosts extends BaseOpenAPIRoute {
  schema = {
    tags: ['Feed Editor'],
    summary: 'Get posts from a feed',
    request: {
      query: z.object({
        feed: feedUri,
        limit: z.number().int().positive().max(3000).default(1000),
        cursor: z.string().optional(),
      }),
    },
    responses: {
      '200': {
        description: 'List of posts with pagination cursor',
        content: {
          'application/json': {
            schema: z.object({
              feed: feedUri,
              posts: z.array(
                z.object({
                  uri: postUri,
                  cid: cid,
                  langs: z.array(z.string()),
                  indexedAt: z.iso.datetime(),
                  reason: z
                    .object({
                      repost: repostUri,
                    })
                    .optional(),
                  feedContext: z.string().optional(),
                })
              ),
              cursor: z.string().optional(),
            }),
          },
        },
      },
      ...UnauthorizedError.schema(),
      ...UnknownFeedError.schema(),
      ...BadRequestError.schema(),
      ...InternalServerError.schema(),
    },
  };

  async handle(c: AppContext): Promise<Response> {
    const data = await this.getValidatedData<typeof this.schema>();
    const db: D1Database = c.env.DB;
    const { feed, limit, cursor } = data.query;
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
    // Validate feed existence
    const { success: feedCheckSuccess, results: feedResults } = await db
      .prepare('SELECT feed_id FROM feeds WHERE feed_uri = ?')
      .bind(feed)
      .all();
    if (!feedCheckSuccess) {
      throw new InternalServerError('Failed to query the database');
    }
    if (feedResults.length === 0) {
      throw new UnknownFeedError(`Feed with URI ${feed} does not exist.`);
    }
    const feed_id = feedResults[0].feed_id;

    // Fetch posts

    if (c.env.DEVELOPER_MODE === 'enabled') {
      logger.debug('db.query.posts.start', {
        query: SQL_SELECT_POSTS,
        bindings: [feed_id, cursor || null, cursorIndexedAt, cursorIndexedAt, cursorCid, limit],
      });
    }
    const { success: postsSuccess, results: postsResults } = await db
      .prepare(SQL_SELECT_POSTS)
      .bind(feed_id, cursor || null, cursorIndexedAt, cursorIndexedAt, cursorCid, limit)
      .all();
    if (!postsSuccess) {
      throw new InternalServerError('Failed to fetch posts');
    }

    // Determine next cursor
    const nextCursor =
      postsResults.length === limit
        ? `${new Date(postsResults[postsResults.length - 1].indexed_at as string).getTime()}::${
            postsResults[postsResults.length - 1].cid
          }`
        : undefined;

    return Response.json({
      posts: postsResults.map((post) => ({
        uri: post.uri,
        cid: post.cid,
        langs: post.langs !== '*' ? (post.langs as string).split(',') : undefined,
        indexedAt: post.indexed_at,
        reason: post.reason ? JSON.parse(post.reason as string) : undefined, // Decode JSON string to object
        feedContext: post.feed_context ?? undefined,
      })),
      cursor: nextCursor,
    });
  }
}
