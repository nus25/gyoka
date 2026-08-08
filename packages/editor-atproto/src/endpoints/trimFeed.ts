import { InternalServerError, UnknownFeedError } from 'shared/src/errors/core';

import { assertAtUriCollection } from '../validation/atUri';

const SQL_SELECT_FEED_AND_COUNT = `
  SELECT 
      feed_id, 
      (SELECT COUNT(*) FROM posts WHERE feed_id = feeds.feed_id) AS post_count
  FROM feeds 
  WHERE feed_uri = ?
`;
const SQL_DELETE_POST = `
  DELETE FROM posts
  WHERE feed_id = ?1
  AND rowid NOT IN (
      SELECT rowid
      FROM posts
      WHERE feed_id = ?1
      ORDER BY indexed_at DESC
      LIMIT ?2
  )
`;

export async function trimFeed(
  db: Env['DB'],
  input: { feed: string; remain: number }
): Promise<Response> {
  const { feed, remain } = input;

  assertAtUriCollection(feed, 'app.bsky.feed.generator', 'feed URI');

  const { success: selectFeedSuccess, results: feedResults } = await db
    .prepare(SQL_SELECT_FEED_AND_COUNT)
    .bind(feed)
    .all();

  if (!selectFeedSuccess) {
    throw new InternalServerError('Failed to query the database');
  }
  if (feedResults.length === 0) {
    throw new UnknownFeedError(`Feed with URI ${feed} does not exist.`);
  }

  const feedId = feedResults[0].feed_id;
  const feedPosts = parseInt(feedResults[0].post_count as string, 10);
  const deleteResult = await db.prepare(SQL_DELETE_POST).bind(feedId, remain).run();

  if (!deleteResult.success) {
    throw new InternalServerError('Failed to remove post from the database');
  }

  return Response.json({
    message: 'Posts trimed successfully',
    feed,
    deletedCount: feedPosts > remain ? feedPosts - remain : 0,
  });
}
