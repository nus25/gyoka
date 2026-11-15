import type { Logger } from 'shared/src/logger';

import { isCid } from '@atcute/lexicons/syntax';
import {
  BadRequestError,
  InternalServerError,
  RevisionConflictError,
} from 'shared/src/errors/core';
import { rankBetweenN } from 'shared/src/gyokaRank';
import { toGeneratorReason } from 'shared/src/reason';

import { assertAtUriCollection } from '../validation/atUri';
import {
  getFeedAndPlacementBounds,
  isSuccessful,
  MAX_PUT_POSTS,
  normalizeLanguages,
  requirePostUris,
  type Placement,
  type PostInput,
} from './postMutation.shared';

export async function putPosts(
  db: Env['DB'],
  input: { feed: string; posts: PostInput[]; placement?: Placement },
  context?: Record<string, unknown>,
  logger?: Logger
) {
  if (context) {
    Object.assign(context, {
      operation: 'putPosts',
      stage: 'validation',
      postCount: input.posts.length,
      placement: input.placement?.type ?? 'append',
    });
  }
  requirePostUris(
    input.posts.map((post) => post.uri),
    MAX_PUT_POSTS
  );
  const preparedPosts = input.posts.map((post) => {
    const indexedAt = post.indexedAt ? new Date(post.indexedAt).toISOString() : undefined;
    if (post.indexedAt && Number.isNaN(Date.parse(indexedAt!))) {
      throw new BadRequestError('indexedAt must be a valid ISO 8601 timestamp.');
    }
    if (!isCid(post.cid)) {
      throw new BadRequestError('cid must be a valid content identifier.');
    }
    return {
      ...post,
      indexedAt,
      languages: normalizeLanguages(post.languages),
      reason: post.reason ? JSON.stringify(toGeneratorReason(post.reason)) : null,
    };
  });
  const placement = input.placement ?? { type: 'append' as const };
  if ((placement.type === 'before' || placement.type === 'after') && !placement.anchor) {
    throw new BadRequestError('before and after placement require an anchor.');
  }
  if (placement.anchor)
    assertAtUriCollection(placement.anchor, 'app.bsky.feed.post', 'placement anchor');
  if (placement.anchor && input.posts.some((post) => post.uri === placement.anchor)) {
    throw new BadRequestError('Placement anchor cannot be a new input URI.');
  }
  if (context) context.stage = 'placement';
  const { feed, lower, upper } = await getFeedAndPlacementBounds(
    db,
    input.feed,
    placement,
    preparedPosts.map((post) => post.uri)
  );
  if (context) Object.assign(context, { feed: input.feed, previousRevision: feed.order_revision });
  const ranks = rankBetweenN({ lower, upper }, preparedPosts.length);
  const postPayload = JSON.stringify(
    preparedPosts.map((post, index) => ({
      uri: post.uri,
      cid: post.cid,
      indexedAt: post.indexedAt ?? new Date().toISOString(),
      reason: post.reason,
      orderRank: ranks[index]!,
      languages: post.languages,
    }))
  );

  const languageCount = preparedPosts.reduce((count, post) => count + post.languages.length, 0);
  if (context) context.languageCount = languageCount;
  const condition = `EXISTS (
    SELECT 1 FROM feeds WHERE feed_id = ? AND order_revision = ?
  )`;
  const statements = [
    db
      .prepare(
        `DELETE FROM posts
         WHERE feed_id = ?
           AND uri IN (SELECT json_extract(value, '$.uri') FROM json_each(?))
           AND ${condition}`
      )
      .bind(feed.feed_id, postPayload, feed.feed_id, feed.order_revision),
    db
      .prepare(
        `INSERT INTO posts (feed_id, uri, cid, indexed_at, reason, order_rank)
         SELECT
           ?,
           json_extract(value, '$.uri'),
           json_extract(value, '$.cid'),
           json_extract(value, '$.indexedAt'),
           json_extract(value, '$.reason'),
           json_extract(value, '$.orderRank')
         FROM json_each(?)
         WHERE ${condition}`
      )
      .bind(feed.feed_id, postPayload, feed.feed_id, feed.order_revision),
    db
      .prepare(
        `INSERT INTO post_languages (post_id, language)
         SELECT posts.post_id, language.value
         FROM json_each(?) AS input
         CROSS JOIN posts
         CROSS JOIN json_each(json_extract(input.value, '$.languages')) AS language
         WHERE posts.feed_id = ? AND posts.uri = json_extract(input.value, '$.uri')
           AND ${condition}`
      )
      .bind(postPayload, feed.feed_id, feed.feed_id, feed.order_revision),
    db
      .prepare(
        'UPDATE feeds SET order_revision = order_revision + 1 WHERE feed_id = ? AND order_revision = ?'
      )
      .bind(feed.feed_id, feed.order_revision),
  ];
  if (context) context.stage = 'write';
  const writeResult = await db.batch(statements);
  if (context) context.changes = writeResult.map((result) => result.meta?.changes);
  if (!isSuccessful(writeResult.at(-1)!)) {
    throw new RevisionConflictError('The feed revision changed.');
  }
  if (
    !isSuccessful(writeResult[1]!, preparedPosts.length) ||
    !isSuccessful(writeResult[2]!, languageCount)
  ) {
    throw new InternalServerError('Failed to replace posts.');
  }
  if (context) context.orderRevision = feed.order_revision + 1;
  logger?.debug('feed.put.posts.success', context);
  return Response.json({ feed: input.feed, orderRevision: feed.order_revision + 1 });
}
