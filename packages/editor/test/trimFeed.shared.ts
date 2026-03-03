import { env } from 'cloudflare:test';
import { expect } from 'vitest';
import { clearTables, expectJsonResponse, requestJson } from './testUtils';

export const ENDPOINT_PATH = '/api/feed/trimPosts';

export const dummyFeed = {
  uri: 'at://did:plc:testuser/app.bsky.feed.generator/test-feed',
  is_active: 1,
};

export interface TrimFeedResponse {
  message: string;
  feed: string;
  deletedCount: number;
}

export interface ErrorResponse {
  error: string;
  message: string;
}

export function assertTrimFeedResponse(
  response: TrimFeedResponse | ErrorResponse
): asserts response is TrimFeedResponse {
  expect(response).toHaveProperty('deletedCount');
}

export async function trimFeed(feed: string, remain: number, envOverrides?: Partial<Env>) {
  return requestJson<TrimFeedResponse | ErrorResponse>({
    path: ENDPOINT_PATH,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ feed, remain }),
    },
    envOverrides,
  });
}

export function assertValidResponse(response: Response) {
  expectJsonResponse(response);
}

export async function insertFeed(feed: { uri: string; is_active: number }) {
  const db = env.DB;
  const result = await db
    .prepare('INSERT INTO feeds (feed_uri, is_active) VALUES (?, ?)')
    .bind(feed.uri, feed.is_active)
    .run();
  return result.meta.last_row_id;
}

export async function insertPost(
  feedId: number,
  post: { id: number; uri: string; cid: string; indexedAt: string; langs: string[] }
) {
  const db = env.DB;
  const did = post.uri.split('/')[2];

  await db
    .prepare(
      'INSERT INTO posts (post_id, feed_id, did, uri, cid, indexed_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind(post.id, feedId, did, post.uri, post.cid, post.indexedAt)
    .run();

  for (const lang of post.langs) {
    await db
      .prepare('INSERT INTO post_languages (post_id, language) VALUES (?, ?)')
      .bind(post.id, lang)
      .run();
  }
}

export async function countPosts(feedId: number): Promise<number> {
  const db = env.DB;
  const { results } = await db
    .prepare('SELECT COUNT(*) as count FROM posts WHERE feed_id = ?')
    .bind(feedId)
    .all();
  return Number(results[0].count);
}

export async function resetTrimFeedTables() {
  await clearTables(['posts', 'post_languages', 'feeds']);
}
