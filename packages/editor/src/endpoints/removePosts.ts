import { getFeed, MAX_REMOVE_POSTS, requirePostUris } from './postMutation.shared';

export async function removePosts(
  db: Env['DB'],
  input: { feed: string; uris: string[] },
  context?: Record<string, unknown>
) {
  if (context) context.stage = 'validation';
  requirePostUris(input.uris, MAX_REMOVE_POSTS);
  if (context) context.stage = 'read';
  const feed = await getFeed(db, input.feed);
  if (context)
    Object.assign(context, {
      feed: input.feed,
      previousRevision: feed.order_revision,
      stage: 'write',
    });

  const uris = JSON.stringify(input.uris);
  const result = await db.batch([
    db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM posts WHERE feed_id = ? AND uri IN (SELECT value FROM json_each(?))`
      )
      .bind(feed.feed_id, uris),
    db
      .prepare(
        `UPDATE feeds
         SET order_revision = order_revision + 1
         WHERE feed_id = ? AND EXISTS (
           SELECT 1 FROM posts
           WHERE feed_id = ? AND uri IN (SELECT value FROM json_each(?))
         )`
      )
      .bind(feed.feed_id, feed.feed_id, uris),
    db
      .prepare('DELETE FROM posts WHERE feed_id = ? AND uri IN (SELECT value FROM json_each(?))')
      .bind(feed.feed_id, uris),
    db.prepare('SELECT order_revision FROM feeds WHERE feed_id = ?').bind(feed.feed_id),
  ]);
  const deletedCount = Number((result[0]!.results[0] as { count: number | string }).count);
  const orderRevision = Number(
    (result[3]!.results[0] as { order_revision: number | string }).order_revision
  );
  if (context) Object.assign(context, { deletedCount, orderRevision });
  return Response.json({
    feed: input.feed,
    deletedCount,
    orderRevision,
  });
}
