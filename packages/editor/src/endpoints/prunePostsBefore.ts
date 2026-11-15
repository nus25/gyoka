import { BadRequestError, InternalServerError } from 'shared/src/errors/core';

import { getFeed } from './postMutation.shared';
import { deletePostsLastWriteWins } from './postPruning.shared';

type PrunePostsBeforeInput = {
  feed: string;
  before: string;
};

export async function prunePostsBefore(
  db: Env['DB'],
  input: PrunePostsBeforeInput,
  context?: Record<string, unknown>
): Promise<Response> {
  if (context) context.stage = 'validation';
  const before = normalizeBefore(input.before);
  if (context) Object.assign(context, { before, stage: 'read' });
  const feed = await getFeed(db, input.feed);
  if (context) Object.assign(context, { feed: input.feed, previousRevision: feed.order_revision });
  const selected = await db
    .prepare('SELECT post_id FROM posts WHERE feed_id = ? AND indexed_at < ?')
    .bind(feed.feed_id, before)
    .all<{ post_id: number }>();
  if (!selected.success) throw new InternalServerError('Failed to select posts to prune.');

  if (context) Object.assign(context, { candidateCount: selected.results.length, stage: 'write' });
  const result = await deletePostsLastWriteWins(
    db,
    feed,
    selected.results.map((post) => post.post_id)
  );
  if (context) Object.assign(context, result);
  return Response.json({ feed: input.feed, before, ...result });
}

function normalizeBefore(before: string): string {
  const value = new Date(before);
  if (Number.isNaN(value.getTime())) {
    throw new BadRequestError('before must be a valid ISO 8601 timestamp.');
  }
  return value.toISOString();
}
