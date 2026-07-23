import { InternalServerError, NotFoundError } from 'shared/src/errors/core';

const SQL_DELETE_POST = `
DELETE FROM posts 
WHERE feed_id = (SELECT feed_id FROM feeds WHERE feed_uri = ?)
  AND uri = ? 
  AND (? IS NULL OR indexed_at = ?)`;
const SQL_CHECK_FEED = 'SELECT feed_id FROM feeds WHERE feed_uri = ?';

type RemovePostInput = {
  feed: string;
  post: {
    uri: string;
    indexedAt?: string;
  };
};

export async function removePost(db: Env['DB'], input: RemovePostInput): Promise<Response> {
  const { feed, post } = input;
  const indexedAt = post.indexedAt ? new Date(post.indexedAt).toISOString() : null;

  const deleteResult = await db
    .prepare(SQL_DELETE_POST)
    .bind(feed, post.uri, indexedAt, indexedAt)
    .run();
  if (!deleteResult.success) {
    throw new InternalServerError('Failed to remove post from the database');
  }

  if (!deleteResult.meta.changed_db) {
    const { success: checkFeedSuccess, results: feedResults } = await db
      .prepare(SQL_CHECK_FEED)
      .bind(feed)
      .all();

    if (!checkFeedSuccess) {
      throw new InternalServerError('Failed to query the database');
    }
    if (feedResults.length === 0) {
      throw new NotFoundError(`Feed with URI ${feed} does not exist.`);
    }

    throw new NotFoundError(
      `Post not found feed:${feed}, post:{uri:${post.uri} ${
        post.indexedAt ? 'indexedAt:' + post.indexedAt : ''
      }}`
    );
  }

  return Response.json({
    message: 'Post removed successfully',
    feed,
    post,
  });
}
