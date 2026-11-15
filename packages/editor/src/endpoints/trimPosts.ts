import { InternalServerError } from 'shared/src/errors/core';

import { getFeed } from './postMutation.shared';
import { deletePostsAfterOffset } from './postPruning.shared';

type TrimPostsInput = {
  feed: string;
  remain: number;
};

export async function trimPosts(
  db: Env['DB'],
  input: TrimPostsInput,
  context?: Record<string, unknown>
): Promise<Response> {
  if (context) context.stage = 'read';
  const feed = await getFeed(db, input.feed);
  if (context) Object.assign(context, { feed: input.feed, previousRevision: feed.order_revision });
  const selected = await db
    .prepare(
      `SELECT 1 FROM posts
       WHERE feed_id = ?
       ORDER BY order_rank DESC
       LIMIT 1 OFFSET ?`
    )
    .bind(feed.feed_id, input.remain)
    .all();
  if (!selected.success) throw new InternalServerError('Failed to select posts to trim.');

  if (selected.results.length === 0) {
    if (context) Object.assign(context, { deletedCount: 0, orderRevision: feed.order_revision });
    return Response.json({
      feed: input.feed,
      deletedCount: 0,
      orderRevision: feed.order_revision,
    });
  }

  if (context) context.stage = 'write';
  const result = await deletePostsAfterOffset(db, feed, input.remain, feed.order_revision);
  if (context) Object.assign(context, result);
  return Response.json({ feed: input.feed, ...result });
}
