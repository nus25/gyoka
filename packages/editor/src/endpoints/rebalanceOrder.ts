import type { Logger } from 'shared/src/logger';

import { RebalanceTooLargeError, RevisionConflictError } from 'shared/src/errors/core';
import { rankBetweenN } from 'shared/src/gyokaRank';

import { DEFAULT_MAX_REBALANCE_POSTS, getFeedAndRanks, isSuccessful } from './postMutation.shared';

export async function rebalanceOrder(
  db: Env['DB'],
  input: { feed: string; expectedRevision: number },
  context?: Record<string, unknown>,
  logger?: Logger
) {
  if (context) Object.assign(context, { stage: 'read', expectedRevision: input.expectedRevision });
  const { feed, ranks: rows } = await getFeedAndRanks(db, input.feed);
  if (context)
    Object.assign(context, {
      feed: input.feed,
      previousRevision: feed.order_revision,
      postCount: rows.length,
    });
  if (feed.order_revision !== input.expectedRevision)
    throw new RevisionConflictError('The feed revision changed.');
  if (rows.length > DEFAULT_MAX_REBALANCE_POSTS)
    throw new RebalanceTooLargeError('The feed exceeds MAX_REBALANCE_POSTS.');
  if (rows.length === 0) {
    if (context) Object.assign(context, { changed: false, orderRevision: feed.order_revision });
    logger?.debug('feed.rebalance.order.success', context);
    return Response.json({ feed: input.feed, orderRevision: feed.order_revision, postCount: 0 });
  }
  const ranks = rankBetweenN({}, rows.length);
  if (rows.every((row, index) => row.order_rank === ranks[index])) {
    if (context) Object.assign(context, { changed: false, orderRevision: feed.order_revision });
    logger?.debug('feed.rebalance.order.success', context);
    return Response.json({
      feed: input.feed,
      orderRevision: feed.order_revision,
      postCount: rows.length,
    });
  }
  const condition = `EXISTS (
      SELECT 1 FROM feeds WHERE feed_id = ? AND order_revision = ?
    )`;
  const statements = [
    db
      .prepare(`UPDATE posts SET order_rank = '!rebalance:' || post_id
          WHERE feed_id = ? AND ${condition}`)
      .bind(feed.feed_id, feed.feed_id, feed.order_revision),
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
        JSON.stringify(rows.map((row, index) => [row.uri, ranks[index]!])),
        feed.feed_id,
        feed.feed_id,
        feed.order_revision
      ),
    db
      .prepare(
        `UPDATE feeds
           SET order_revision = order_revision + 1
           WHERE feed_id = ? AND order_revision = ?`
      )
      .bind(feed.feed_id, feed.order_revision),
  ];
  if (context) context.stage = 'write';
  const result = await db.batch(statements);
  if (context) context.changes = result.map((item) => item.meta?.changes);
  if (
    !isSuccessful(result[0]!, rows.length) ||
    !isSuccessful(result[1]!, rows.length) ||
    !isSuccessful(result[2]!)
  ) {
    throw new RevisionConflictError('The feed revision changed.');
  }
  if (context) Object.assign(context, { changed: true, orderRevision: feed.order_revision + 1 });
  logger?.debug('feed.rebalance.order.success', context);
  return Response.json({
    feed: input.feed,
    orderRevision: feed.order_revision + 1,
    postCount: rows.length,
  });
}
