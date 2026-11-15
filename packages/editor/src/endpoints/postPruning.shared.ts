import { RevisionConflictError } from 'shared/src/errors/core';

import { isSuccessful, type FeedRow } from './postMutation.shared';

export async function deletePostsAfterOffset(
  db: Env['DB'],
  feed: FeedRow,
  offset: number,
  expectedRevision: number | undefined
): Promise<{ deletedCount: number; orderRevision: number }> {
  const condition = ` AND EXISTS (
      SELECT 1 FROM feeds
      WHERE feed_id = ? AND order_revision = ?
    )`;
  const conditionBindings = [feed.feed_id, expectedRevision!];
  const selectedPostIds = `SELECT post_id FROM posts
      WHERE feed_id = ?
      ORDER BY order_rank DESC
      LIMIT -1 OFFSET ?`;
  const statements = [
    db
      .prepare(
        `DELETE FROM post_languages
         WHERE post_id IN (
           SELECT post_id FROM posts
           WHERE feed_id = ? AND post_id IN (${selectedPostIds})${condition}
         )`
      )
      .bind(feed.feed_id, feed.feed_id, offset, ...conditionBindings),
    db
      .prepare(`DELETE FROM posts
      WHERE feed_id = ? AND post_id IN (${selectedPostIds})${condition}`)
      .bind(feed.feed_id, feed.feed_id, offset, ...conditionBindings),
    db
      .prepare(
        `UPDATE feeds SET order_revision = order_revision + 1
          WHERE feed_id = ? AND order_revision = ?`
      )
      .bind(feed.feed_id, expectedRevision!),
  ];

  const results = await db.batch(statements);
  const deletedCount = results[1]!.meta.changes;
  if (!isSuccessful(results[2]!)) throw new RevisionConflictError('The feed revision changed.');
  return {
    deletedCount,
    orderRevision: feed.order_revision + 1,
  };
}

export async function deletePostsLastWriteWins(
  db: Env['DB'],
  feed: FeedRow,
  postIds: number[]
): Promise<{ deletedCount: number; orderRevision: number }> {
  if (postIds.length === 0) {
    return { deletedCount: 0, orderRevision: feed.order_revision };
  }

  const postIdsJson = JSON.stringify(postIds);
  const results = await db.batch([
    db
      .prepare(
        `DELETE FROM post_languages
         WHERE post_id IN (
           SELECT post_id FROM posts
           WHERE feed_id = ? AND post_id IN (SELECT value FROM json_each(?))
         )`
      )
      .bind(feed.feed_id, postIdsJson),
    db
      .prepare(
        'DELETE FROM posts WHERE feed_id = ? AND post_id IN (SELECT value FROM json_each(?))'
      )
      .bind(feed.feed_id, postIdsJson),
    db
      .prepare('UPDATE feeds SET order_revision = order_revision + 1 WHERE feed_id = ?')
      .bind(feed.feed_id),
  ]);
  return {
    deletedCount: results[1]!.meta.changes,
    orderRevision: feed.order_revision + 1,
  };
}
