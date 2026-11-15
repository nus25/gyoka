import { parseCanonicalResourceUri } from '@atcute/lexicons/syntax';
import { InternalServerError } from 'shared/src/errors/core';

import { getFeed } from './postMutation.shared';
import { deletePostsLastWriteWins } from './postPruning.shared';

type RemovePostsByAuthorInput = {
  feed: string;
  author: string;
};

export async function removePostsByAuthor(
  db: Env['DB'],
  input: RemovePostsByAuthorInput,
  context?: Record<string, unknown>
): Promise<Response> {
  if (context) context.stage = 'read';
  const feed = await getFeed(db, input.feed);
  if (context) Object.assign(context, { feed: input.feed, previousRevision: feed.order_revision });
  const selected = await db
    .prepare('SELECT post_id, uri FROM posts WHERE feed_id = ?')
    .bind(feed.feed_id)
    .all<{ post_id: number; uri: string }>();
  if (!selected.success) throw new InternalServerError('Failed to select posts by author.');

  const postIds = selected.results
    .filter((post) => parseCanonicalResourceUri(post.uri).repo === input.author)
    .map((post) => post.post_id);
  if (context)
    Object.assign(context, {
      candidateCount: postIds.length,
      scannedCount: selected.results.length,
      stage: 'write',
    });
  const result = await deletePostsLastWriteWins(db, feed, postIds);
  if (context) Object.assign(context, result);
  return Response.json({ feed: input.feed, author: input.author, ...result });
}
