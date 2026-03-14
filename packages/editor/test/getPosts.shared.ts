import type { ErrorResponse } from 'shared/src/types';

import { env } from 'cloudflare:workers';

import { clearTables, expectJsonResponse, requestJson } from './testUtils';

export const ENDPOINT_PATH = '/api/feed/getPosts';

export const dummyFeed = {
  uri: 'at://did:plc:testuser/app.bsky.feed.generator/test-feed',
  is_active: 1,
};

export interface GetPostsResponse {
  feed: string;
  posts: Array<{
    uri: string;
    cid: string;
    languages: string[];
    langs?: string[];
    indexedAt: string;
  }>;
  cursor?: string;
}

export function assertGetPostsResponse(
  response: GetPostsResponse | ErrorResponse
): asserts response is GetPostsResponse {
  if (!('feed' in response) || !('posts' in response)) {
    throw new Error('Response does not have posts');
  }
}

export async function getPosts(
  feed: string,
  limit?: number,
  cursor?: string,
  envOverrides?: Partial<Env>
) {
  const params = new URLSearchParams({ feed });
  if (limit) params.set('limit', limit.toString());
  if (cursor) params.set('cursor', cursor);

  return requestJson<GetPostsResponse | ErrorResponse>({
    path: `${ENDPOINT_PATH}?${params.toString()}`,
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
  post: {
    id: number;
    uri: string;
    cid: string;
    indexedAt: string;
    languages?: string[];
    langs?: string[];
  }
) {
  const db = env.DB;
  const languages = post.languages ?? post.langs ?? ['*'];

  await db
    .prepare('INSERT INTO posts (post_id, feed_id, uri, cid, indexed_at) VALUES (?, ?, ?, ?, ?)')
    .bind(post.id, feedId, post.uri, post.cid, post.indexedAt)
    .run();

  for (const lang of languages) {
    await db
      .prepare('INSERT INTO post_languages (post_id, language) VALUES (?, ?)')
      .bind(post.id, lang)
      .run();
  }
}

export async function resetGetPostsTables() {
  await clearTables(['posts', 'post_languages', 'feeds']);
}
