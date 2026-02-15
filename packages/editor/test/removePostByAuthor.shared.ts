import { env } from 'cloudflare:test';
import type { ErrorResponse } from 'shared/src/types';
import { clearTables, expectJsonResponse, requestJson } from './testUtils';

export const ENDPOINT_PATH = '/api/feed/removePostByAuthor';

export const dummyFeed = {
  uri: 'at://did:plc:testuser/app.bsky.feed.generator/test-feed',
  is_active: 1,
};

export const author1Did = 'did:plc:author1';
export const author2Did = 'did:plc:author2';

export const dummyPosts = [
  {
    id: 1,
    uri: `at://${author1Did}/app.bsky.feed.post/post1`,
    cid: 'bafyreia3tbsfxe3cc6qxibc2pj4tcmxqyxupz3hajxuepz4g5qkdqxnx6y',
    indexedAt: new Date().toISOString(),
    langs: ['en'],
  },
  {
    id: 2,
    uri: `at://${author1Did}/app.bsky.feed.post/post2`,
    cid: 'bafyreia4ubsfxe3cc6qxibc2pj4tcmxqyxupz3hajxuepz4g5qkdqxnx7z',
    indexedAt: new Date().toISOString(),
    langs: ['ja'],
  },
  {
    id: 3,
    uri: `at://${author2Did}/app.bsky.feed.post/post3`,
    cid: 'bafyreia5vcsfxe3cc6qxibc2pj4tcmxqyxupz3hajxuepz4g5qkdqxnx8a',
    indexedAt: new Date().toISOString(),
    langs: ['en', 'ja'],
  },
];

export interface RemovePostByAuthorResponse {
  message: string;
  feed: string;
  author: string;
  deletedCount: number;
}

export function assertRemovePostByAuthorResponse(
  response: RemovePostByAuthorResponse | ErrorResponse
): asserts response is RemovePostByAuthorResponse {
  if (!('deletedCount' in response)) {
    throw new Error('Response does not have deletedCount');
  }
}

export async function removePostByAuthor(feed: string, author: string, envOverrides?: Partial<Env>) {
  return requestJson<RemovePostByAuthorResponse | ErrorResponse>({
    path: ENDPOINT_PATH,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ feed, author }),
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
    .prepare('INSERT INTO posts (post_id, feed_id, did, uri, cid, indexed_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(post.id, feedId, did, post.uri, post.cid, post.indexedAt)
    .run();

  for (const lang of post.langs) {
    await db
      .prepare('INSERT INTO post_languages (post_id, language) VALUES (?, ?)')
      .bind(post.id, lang)
      .run();
  }
}

export async function countPostsByAuthor(did: string): Promise<number> {
  const db = env.DB;
  const { results } = await db
    .prepare('SELECT COUNT(*) as count FROM posts WHERE did = ?')
    .bind(did)
    .all();
  return (results[0] as { count: number }).count;
}

export async function countTotalPosts(): Promise<number> {
  const db = env.DB;
  const { results } = await db.prepare('SELECT COUNT(*) as count FROM posts').all();
  return (results[0] as { count: number }).count;
}

export async function resetRemovePostByAuthorTables() {
  await clearTables(['posts', 'post_languages', 'feeds']);
}
