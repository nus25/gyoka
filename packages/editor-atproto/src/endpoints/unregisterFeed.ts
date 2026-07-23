import { InternalServerError, UnknownFeedError } from 'shared/src/errors/core';
import { FeedRow } from 'shared/src/types';

const SQL_DELETE_FEED = 'DELETE FROM feeds WHERE feed_uri = ?';
const SQL_DELETE_POSTS =
  'DELETE FROM posts WHERE feed_id = (SELECT feed_id FROM feeds WHERE feed_uri = ?)';
const SQL_SELECT_FEED = 'SELECT * FROM feeds WHERE feed_uri = ?';

export async function unregisterFeed(db: Env['DB'], input: { uri: string }): Promise<Response> {
  const { uri } = input;

  const { success: selectSuccess, results } = await db
    .prepare(SQL_SELECT_FEED)
    .bind(uri)
    .all<FeedRow>();
  if (!selectSuccess) {
    throw new InternalServerError('Failed to query the database');
  }
  if (results.length === 0) {
    throw new UnknownFeedError(`Feed with URI ${uri} does not exist.`);
  }

  const deletePostsStmt = db.prepare(SQL_DELETE_POSTS).bind(uri);
  const deleteFeedStmt = db.prepare(SQL_DELETE_FEED).bind(uri);
  const batchResult = await db.batch([deletePostsStmt, deleteFeedStmt]);

  if (!batchResult.every((result) => result.success)) {
    throw new InternalServerError('Failed to unregister feed and associated posts');
  }

  return Response.json({
    message: 'Feed unregistered successfully',
  });
}
