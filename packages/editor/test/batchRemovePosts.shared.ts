import { env } from 'cloudflare:test';
import { expectJsonResponse, requestJson, clearTables } from './testUtils';

export const ENDPOINT_PATH = '/api/feed/batchRemovePosts';

export const dummyFeed1 = {
  uri: 'at://did:plc:testuser1/app.bsky.feed.generator/test-feed-1',
  is_active: 1,
};

export const dummyFeed2 = {
  uri: 'at://did:plc:testuser2/app.bsky.feed.generator/test-feed-2',
  is_active: 1,
};

export const dummyPost1 = {
  id: 1,
  uri: 'at://did:plc:author1/app.bsky.feed.post/test-post-1',
  cid: 'bafyreia3tbsfxe3cc6qxibc2pj4tcmxqyxupz3hajxuepz4g5qkdqxnx6y',
  indexedAt: new Date('2024-01-15T12:00:00Z').toISOString(),
  langs: ['en'],
};

export const dummyPost2 = {
  id: 2,
  uri: 'at://did:plc:author2/app.bsky.feed.post/test-post-2',
  cid: 'bafyreibcd456example789cid012xyz123456789012345678901234567890',
  indexedAt: new Date('2024-01-15T13:00:00Z').toISOString(),
  langs: ['ja'],
};

export const dummyPost3 = {
  id: 3,
  uri: 'at://did:plc:author3/app.bsky.feed.post/test-post-3',
  cid: 'bafyreicde789example012cid345xyz123456789012345678901234567890',
  indexedAt: new Date('2024-01-15T14:00:00Z').toISOString(),
  langs: ['en', 'ja'],
};

interface BatchRemovePostsResultItem {
  uri: string;
  status: 'removed' | 'error';
  error?: string;
}

interface BatchRemovePostsResult {
  feed: string;
  results: BatchRemovePostsResultItem[];
}

type BatchRemovePostsResponse = {
  results?: BatchRemovePostsResult[];
  error?: string;
  message?: string;
};

export async function batchRemovePosts(entries: any[], envOverrides?: Partial<Env>) {
  return requestJson<BatchRemovePostsResponse>({
    path: ENDPOINT_PATH,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ entries }),
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

export async function verifyPostExists(uri: string, indexedAt?: string): Promise<boolean> {
  const db = env.DB;
  let query = 'SELECT 1 FROM posts WHERE uri = ?';
  const bindings: any[] = [uri];

  if (indexedAt) {
    query += ' AND indexed_at = ?';
    bindings.push(indexedAt);
  }

  const { results } = await db
    .prepare(query)
    .bind(...bindings)
    .all();
  return results.length > 0;
}

export async function verifyPostLanguagesExist(postId: number): Promise<boolean> {
  const db = env.DB;
  const { results } = await db
    .prepare('SELECT 1 FROM post_languages WHERE post_id = ?')
    .bind(postId)
    .all();
  return results.length > 0;
}

export async function resetBatchRemoveTables() {
  await clearTables(['posts', 'post_languages', 'feeds']);
}
