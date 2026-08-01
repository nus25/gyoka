import { BadRequestError, InternalServerError, UnknownFeedError } from 'shared/src/errors/core';

import { assertAtUriCollection } from '../validation/atUri';

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

export async function getPosts(
  db: Env['DB'],
  input: { feed: string; limit?: number; cursor?: string }
): Promise<Response> {
  const limit = input.limit ?? 1000;
  const { feed, cursor } = input;

  assertAtUriCollection(feed, 'app.bsky.feed.generator', 'feed URI');

  let cursorIndexedAt: string | null = null;
  let cursorCid: string | null = null;

  if (cursor) {
    const cursorParts = cursor.split('::');
    if (
      cursorParts.length !== 2 ||
      cursorParts.some((part) => part === '') ||
      Number.isNaN(parseInt(cursorParts[0], 10))
    ) {
      throw new BadRequestError('Malformed cursor');
    }
    cursorIndexedAt = new Date(parseInt(cursorParts[0], 10)).toISOString();
    cursorCid = cursorParts[1];
  }

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

  const feedId = feedResults[0].feed_id;

  const { success: postsSuccess, results: postsResults } = await db
    .prepare(SQL_SELECT_POSTS)
    .bind(feedId, cursor || null, cursorIndexedAt, cursorIndexedAt, cursorCid, limit)
    .all();

  if (!postsSuccess) {
    throw new InternalServerError('Failed to fetch posts');
  }

  const nextCursor =
    postsResults.length === limit
      ? `${new Date(postsResults[postsResults.length - 1].indexed_at as string).getTime()}::${
          postsResults[postsResults.length - 1].cid
        }`
      : undefined;

  return Response.json({
    feed,
    posts: postsResults.map((post) => {
      const values = ((post.langs as string) || '')
        .split(',')
        .map((lang) => lang.trim().toLowerCase())
        .filter((lang) => lang.length > 0);
      const normalizedLanguages = values.includes('*') || values.length === 0 ? ['*'] : values;

      return {
        uri: post.uri,
        cid: post.cid,
        languages: normalizedLanguages,
        langs: normalizedLanguages,
        indexedAt: post.indexed_at,
        reason: post.reason ? JSON.parse(post.reason as string) : undefined,
        feedContext: post.feed_context ?? undefined,
      };
    }),
    cursor: nextCursor,
  });
}
