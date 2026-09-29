import { InternalServerError, UnknownFeedError } from 'shared/src/errors/core';

import { assertAtUriCollection } from '../validation/atUri';

const SQL_SELECT_FEED_AND_COUNT = `
  SELECT
      feed_id,
      (SELECT COUNT(*) FROM posts WHERE feed_id = feeds.feed_id AND indexed_at < ?) AS post_count
  FROM feeds
  WHERE feed_uri = ?
`;
const SQL_DELETE_POSTS_BEFORE = `
  DELETE FROM posts
  WHERE feed_id = ?
  AND indexed_at < ?
`;

export async function trimFeedBefore(
  db: Env['DB'],
  input: { feed: string; before: string }
): Promise<Response> {
  const { feed, before } = input;

  assertAtUriCollection(feed, 'app.bsky.feed.generator', 'feed URI');

  const normalizedBefore = new Date(before).toISOString();
  const { success: selectFeedSuccess, results: feedResults } = await db
    .prepare(SQL_SELECT_FEED_AND_COUNT)
    .bind(normalizedBefore, feed)
    .all();

  if (!selectFeedSuccess) {
    throw new InternalServerError('Failed to query the database');
  }
  if (feedResults.length === 0) {
    throw new UnknownFeedError(`Feed with URI ${feed} does not exist.`);
  }

  const feedId = feedResults[0].feed_id;
  const deletedCount = Number(feedResults[0].post_count);
  const deleteResult = await db
    .prepare(SQL_DELETE_POSTS_BEFORE)
    .bind(feedId, normalizedBefore)
    .run();

  if (!deleteResult.success) {
    throw new InternalServerError('Failed to remove posts from the database');
  }

  return Response.json({
    message: 'Posts before timestamp trimmed successfully',
    feed,
    before: normalizedBefore,
    deletedCount,
  });
}