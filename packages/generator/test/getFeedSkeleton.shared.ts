import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';

import app from '../src/index';

export const BASE_URL = 'http://localhost:8787';
export const ENDPOINT_PATH = '/xrpc/app.bsky.feed.getFeedSkeleton';
export const ACTIVE_FEED_URI = 'at://did:plc:testuser/app.bsky.feed.generator/getfeedskeleton';
export const INACTIVE_FEED_URI = 'at://did:plc:testuser/app.bsky.feed.generator/inactivefeed';
export const NO_LANG_FILTER_FEED_URI = 'at://did:plc:testuser/app.bsky.feed.generator/nolangfilter';

export type FeedSkeletonResponse = {
  feed: Array<{
    post: string;
    reason?: {
      repost?: string;
    };
    feedContext?: string;
  }>;
  cursor?: string;
};

export type ErrorResponse = {
  error: string;
  message?: string;
};

export async function resetAndSeedFeeds() {
  await env.DB.prepare('DELETE FROM post_languages').run();
  await env.DB.prepare('DELETE FROM posts').run();
  await env.DB.prepare('DELETE FROM feeds').run();

  await env.DB.prepare('INSERT INTO feeds (feed_uri, is_active) VALUES (?, ?)')
    .bind(ACTIVE_FEED_URI, 1)
    .run();
  await env.DB.prepare('INSERT INTO feeds (feed_uri, is_active) VALUES (?, ?)')
    .bind(INACTIVE_FEED_URI, 0)
    .run();
  await env.DB.prepare('INSERT INTO feeds (feed_uri, lang_filter, is_active) VALUES (?, ?, ?)')
    .bind(NO_LANG_FILTER_FEED_URI, 0, 1)
    .run();
}

export async function getFeedId(feedUri: string): Promise<number> {
  const { results } = await env.DB.prepare(
    'SELECT feed_id FROM feeds WHERE feed_uri = ? AND is_active = 1'
  )
    .bind(feedUri)
    .all();
  return parseInt(results[0].feed_id as string, 10);
}

export async function insertPost(
  feedId: number,
  post: { id: number; uri: string; cid: string; indexedAt: string; langs: string[] }
) {
  const did = post.uri.split('/')[2];
  await env.DB.prepare(
    'INSERT INTO posts (post_id, feed_id, did, uri, cid, indexed_at) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(post.id, feedId, did, post.uri, post.cid, post.indexedAt)
    .run();

  for (const lang of post.langs) {
    await env.DB.prepare('INSERT INTO post_languages (post_id, language) VALUES (?, ?)')
      .bind(post.id, lang)
      .run();
  }
}

export async function requestFeedSkeleton(
  queryParams: string,
  headers: Record<string, string> = {},
  requestEnv = env
) {
  const request = new Request(`${BASE_URL}${ENDPOINT_PATH}?${queryParams}`, { headers });
  const ctx = createExecutionContext();
  const response = await app.fetch(request, requestEnv, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}
