import { InternalServerError, UnknownFeedError } from 'shared/src/errors/core';

const SQL_SELECT_FEED_AND_COUNT = `
SELECT 
  f.feed_id,
  (SELECT COUNT(*) FROM posts p WHERE p.feed_id = f.feed_id AND p.uri LIKE ?) as count
FROM feeds f
WHERE f.feed_uri = ?`;
const SQL_DELETE_POSTS_BY_AUTHOR = 'DELETE FROM posts WHERE feed_id = ? AND uri LIKE ?';

export async function removePostByAuthor(
  db: Env['DB'],
  input: { feed: string; author: string }
): Promise<Response> {
  const { feed, author } = input;

  const { success: selectSuccess, results } = await db
    .prepare(SQL_SELECT_FEED_AND_COUNT)
    .bind(`at://${author}/%`, feed)
    .all();

  if (!selectSuccess) {
    throw new InternalServerError('Failed to query the database');
  }
  if (results.length === 0) {
    throw new UnknownFeedError(`Feed with URI ${feed} does not exist.`);
  }

  const feedId = results[0].feed_id;
  const deletedCount = results[0].count as number;

  const deleteResult = await db
    .prepare(SQL_DELETE_POSTS_BY_AUTHOR)
    .bind(feedId, `at://${author}/%`)
    .run();

  if (!deleteResult.success) {
    throw new InternalServerError('Failed to remove posts from the database');
  }

  return Response.json({
    message: 'Posts by author removed successfully',
    feed,
    author,
    deletedCount,
  });
}
