import { BadRequestError, RevisionConflictError } from 'shared/src/errors/core';

import {
  MAX_MOVE_POSTS,
  getFeed,
  isSuccessful,
  ranksByOrder,
  ranksForPlacement,
  requirePostUris,
  type Placement,
} from './postMutation.shared';

export async function movePosts(
  db: Env['DB'],
  input: { feed: string; posts: string[]; placement: Placement; expectedRevision: number },
  context?: Record<string, unknown>
) {
  if (context) context.stage = 'validation';
  requirePostUris(input.posts, MAX_MOVE_POSTS);
  if (
    (input.placement.position === 'before' || input.placement.position === 'after') &&
    !input.placement.anchor
  )
    throw new BadRequestError('before and after placement require an anchor.');
  if (context) context.stage = 'read';
  const feed = await getFeed(db, input.feed);
  if (context) Object.assign(context, { feed: input.feed, previousRevision: feed.order_revision });
  if (feed.order_revision !== input.expectedRevision)
    throw new RevisionConflictError('The feed revision changed.');
  if (input.placement.anchor && input.posts.includes(input.placement.anchor))
    throw new BadRequestError('Placement anchor cannot be moved.');
  const rows = await ranksByOrder(db, feed.feed_id);
  const movedByUri = new Map(rows.map((row) => [row.uri, row]));
  const moved = input.posts.map((uri) => movedByUri.get(uri)).filter((row) => row !== undefined);
  if (moved.length !== input.posts.length)
    throw new BadRequestError('All posts to move must exist.');
  const remaining = rows.filter((row) => !input.posts.includes(row.uri));
  if (
    (input.placement.position === 'before' || input.placement.position === 'after') &&
    !remaining.some((row) => row.uri === input.placement.anchor)
  ) {
    throw new BadRequestError('Placement anchor does not exist.');
  }
  const ranks = ranksForPlacement(remaining, input.placement, moved.length);
  const condition = `EXISTS (
    SELECT 1 FROM feeds
    WHERE feed_id = ? AND order_revision = ?
  )`;
  const statements = [
    db
      .prepare(`UPDATE posts SET order_rank = '!move:' || post_id
        WHERE feed_id = ? AND uri IN (${moved.map(() => '?').join(', ')}) AND ${condition}`)
      .bind(feed.feed_id, ...moved.map((row) => row.uri), feed.feed_id, input.expectedRevision),
    db
      .prepare(
        `WITH new_ranks(uri, order_rank) AS (
          SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]')
          FROM json_each(?)
        )
        UPDATE posts
        SET order_rank = (
          SELECT new_ranks.order_rank FROM new_ranks WHERE new_ranks.uri = posts.uri
        )
        WHERE feed_id = ?
          AND uri IN (SELECT uri FROM new_ranks)
          AND ${condition}`
      )
      .bind(
        JSON.stringify(moved.map((row, index) => [row.uri, ranks[index]!])),
        feed.feed_id,
        feed.feed_id,
        input.expectedRevision
      ),
    db
      .prepare(
        `UPDATE feeds SET order_revision = order_revision + 1
          WHERE feed_id = ? AND order_revision = ?`
      )
      .bind(feed.feed_id, input.expectedRevision),
  ];
  if (context) context.stage = 'write';
  const result = await db.batch(statements);
  if (context) context.changes = result.map((item) => item.meta?.changes);
  if (
    !isSuccessful(result[0]!, moved.length) ||
    !isSuccessful(result[1]!, moved.length) ||
    !isSuccessful(result[2]!)
  )
    throw new RevisionConflictError('The feed revision changed.');
  if (context)
    Object.assign(context, { movedCount: moved.length, orderRevision: input.expectedRevision + 1 });
  return Response.json({
    feed: input.feed,
    orderRevision: input.expectedRevision + 1,
    movedCount: moved.length,
  });
}
