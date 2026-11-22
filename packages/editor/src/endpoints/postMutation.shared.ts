import { All_LANGS } from 'shared/src/constants';
import { BadRequestError, UnknownFeedError } from 'shared/src/errors/core';
import { rankBetweenN, type OrderRank } from 'shared/src/gyokaRank';

import { assertAtUriCollection } from '../validation/atUri';

export const MAX_POSTS = 25;
export const MAX_MOVE_POSTS = 25;
export const MAX_REMOVE_POSTS = 1_000;
export const MAX_PUT_POSTS = 1_000;
export const MAX_LANGUAGES = 5;
export const DEFAULT_MAX_REBALANCE_POSTS = 2_000;

export type FeedRow = {
  feed_id: number;
  order_revision: number;
};
export type PostInput = {
  uri: string;
  cid: string;
  languages?: string[] | null;
  indexedAt?: string;
  reason?: import('shared/src/reason').EditorReason;
};
export type Placement = { position: 'append' | 'prepend' | 'before' | 'after'; anchor?: string };

export function normalizeLanguages(languages?: string[] | null): string[] {
  if ((languages?.length ?? 0) > MAX_LANGUAGES) {
    throw new BadRequestError(`languages must contain at most ${MAX_LANGUAGES} values.`);
  }
  const values = (languages ?? [])
    .map((language) => language.trim().toLowerCase().split('-')[0]!)
    .filter(Boolean);
  if (values.length === 0 || values.includes(All_LANGS)) return [All_LANGS];
  if (values.some((language) => !/^[a-z]{2,3}$/.test(language))) {
    throw new BadRequestError(
      'All primary language tags must be two or three alphabetic characters.'
    );
  }
  const normalized = [...new Set(values)];
  if (normalized.length > MAX_LANGUAGES) {
    throw new BadRequestError(
      `languages must contain at most ${MAX_LANGUAGES} unique primary language tags.`
    );
  }
  return normalized;
}

export function requirePostUris(uris: string[], maxPosts = MAX_POSTS) {
  if (uris.length === 0 || uris.length > maxPosts || new Set(uris).size !== uris.length) {
    throw new BadRequestError(`posts must contain between 1 and ${maxPosts} unique URIs.`);
  }
  for (const uri of uris) assertAtUriCollection(uri, 'app.bsky.feed.post', 'post URI');
}

export async function getFeed(db: Env['DB'], uri: string): Promise<FeedRow> {
  assertAtUriCollection(uri, 'app.bsky.feed.generator', 'feed URI');
  const result = await db
    .prepare('SELECT feed_id, order_revision FROM feeds WHERE feed_uri = ?')
    .bind(uri)
    .first<FeedRow>();
  if (!result) throw new UnknownFeedError(`Feed with URI ${uri} does not exist.`);
  return result;
}

export async function getFeedAndRanks(db: Env['DB'], uri: string) {
  assertAtUriCollection(uri, 'app.bsky.feed.generator', 'feed URI');
  const [feedResult, ranksResult] = await db.batch([
    db.prepare('SELECT feed_id, order_revision FROM feeds WHERE feed_uri = ?').bind(uri),
    db
      .prepare(
        `SELECT uri, order_rank
         FROM posts
         WHERE feed_id = (SELECT feed_id FROM feeds WHERE feed_uri = ?)
         ORDER BY order_rank ASC`
      )
      .bind(uri),
  ]);
  const feed = feedResult!.results[0] as FeedRow | undefined;
  if (!feed) throw new UnknownFeedError(`Feed with URI ${uri} does not exist.`);
  return {
    feed,
    ranks: ranksResult!.results as Array<{ uri: string; order_rank: OrderRank }>,
  };
}

export async function getFeedAndPlacementBounds(
  db: Env['DB'],
  uri: string,
  placement: Placement,
  excludedUris: string[]
) {
  assertAtUriCollection(uri, 'app.bsky.feed.generator', 'feed URI');
  const excludedUrisJson = JSON.stringify(excludedUris);
  const feedStatement = db
    .prepare('SELECT feed_id, order_revision FROM feeds WHERE feed_uri = ?')
    .bind(uri);
  const eligiblePost = `
    feed_id = (SELECT feed_id FROM feeds WHERE feed_uri = ?)
    AND NOT EXISTS (
      SELECT 1 FROM json_each(?) WHERE value = posts.uri
    )`;

  if (placement.position === 'append' || placement.position === 'prepend') {
    const direction = placement.position === 'append' ? 'DESC' : 'ASC';
    const [feedResult, boundResult] = await db.batch([
      feedStatement,
      db
        .prepare(
          `SELECT order_rank
           FROM posts
           WHERE ${eligiblePost}
           ORDER BY order_rank ${direction}
           LIMIT 1`
        )
        .bind(uri, excludedUrisJson),
    ]);
    const feed = feedResult!.results[0] as FeedRow | undefined;
    if (!feed) throw new UnknownFeedError(`Feed with URI ${uri} does not exist.`);
    const bound = boundResult!.results[0] as { order_rank: OrderRank } | undefined;
    return placement.position === 'append'
      ? { feed, lower: bound?.order_rank, upper: undefined }
      : { feed, lower: undefined, upper: bound?.order_rank };
  }

  const anchor = placement.anchor!;
  const comparison = placement.position === 'before' ? '<' : '>';
  const direction = placement.position === 'before' ? 'DESC' : 'ASC';
  const [feedResult, anchorResult, boundResult] = await db.batch([
    feedStatement,
    db
      .prepare(
        `SELECT order_rank
         FROM posts
         WHERE feed_id = (SELECT feed_id FROM feeds WHERE feed_uri = ?)
           AND uri = ?`
      )
      .bind(uri, anchor),
    db
      .prepare(
        `SELECT order_rank
         FROM posts
         WHERE ${eligiblePost}
           AND order_rank ${comparison} (
             SELECT order_rank
             FROM posts
             WHERE feed_id = (SELECT feed_id FROM feeds WHERE feed_uri = ?)
               AND uri = ?
           )
         ORDER BY order_rank ${direction}
         LIMIT 1`
      )
      .bind(uri, excludedUrisJson, uri, anchor),
  ]);
  const feed = feedResult!.results[0] as FeedRow | undefined;
  if (!feed) throw new UnknownFeedError(`Feed with URI ${uri} does not exist.`);
  const anchorRow = anchorResult!.results[0] as { order_rank: OrderRank } | undefined;
  if (!anchorRow) throw new BadRequestError('Placement anchor does not exist.');
  const bound = boundResult!.results[0] as { order_rank: OrderRank } | undefined;
  return placement.position === 'before'
    ? { feed, lower: bound?.order_rank, upper: anchorRow.order_rank }
    : { feed, lower: anchorRow.order_rank, upper: bound?.order_rank };
}

export async function ranksByOrder(db: Env['DB'], feedId: number) {
  const { results } = await db
    .prepare('SELECT uri, order_rank FROM posts WHERE feed_id = ? ORDER BY order_rank ASC')
    .bind(feedId)
    .all<{ uri: string; order_rank: OrderRank }>();
  return results;
}

export function ranksForPlacement(
  rows: Array<{ uri: string; order_rank: OrderRank }>,
  placement: Placement,
  count: number
) {
  let index = rows.length;
  if (placement.position === 'prepend') index = 0;
  if (placement.position === 'before' || placement.position === 'after') {
    const anchorIndex = rows.findIndex((row) => row.uri === placement.anchor);
    if (anchorIndex < 0) throw new BadRequestError('Placement anchor does not exist.');
    index = placement.position === 'before' ? anchorIndex : anchorIndex + 1;
  }
  return rankBetweenN(
    { lower: rows[index - 1]?.order_rank, upper: rows[index]?.order_rank },
    count
  );
}

export function isSuccessful(result: D1Result<unknown>, expectedChanges = 1) {
  return result.meta.changes === expectedChanges;
}
