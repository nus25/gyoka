import { env } from 'cloudflare:test';

import { expectJsonResponse, requestJson, clearTables } from './testUtils';

export const ENDPOINT_PATH = '/api/feed/batchAddPosts';

export const dummyFeed1 = {
  uri: 'at://did:plc:testuser1/app.bsky.feed.generator/test-feed-1',
  is_active: 1,
};

export const dummyFeed2 = {
  uri: 'at://did:plc:testuser2/app.bsky.feed.generator/test-feed-2',
  is_active: 1,
};

export const dummyPost1 = {
  uri: 'at://did:plc:author1/app.bsky.feed.post/test-post-1',
  cid: 'bafyreia3tbsfxe3cc6qxibc2pj4tcmxqyxupz3hajxuepz4g5qkdqxnx6y',
  languages: ['en'],
  indexedAt: new Date('2024-01-15T12:00:00Z').toISOString(),
};

export const dummyPost2 = {
  uri: 'at://did:plc:author2/app.bsky.feed.post/test-post-2',
  cid: 'bafyreibcd456example789cid012xyz123456789012345678901234567890',
  languages: ['ja'],
  indexedAt: new Date('2024-01-15T13:00:00Z').toISOString(),
};

export const dummyPost3 = {
  uri: 'at://did:plc:author3/app.bsky.feed.post/test-post-3',
  cid: 'bafyreicde789example012cid345xyz123456789012345678901234567890',
  languages: ['en', 'ja'],
  indexedAt: new Date('2024-01-15T14:00:00Z').toISOString(),
};

type BatchAddPostsResultItem = {
  status: 'added' | 'error';
  uri?: string;
  error?: string;
};

type BatchAddPostsResult = {
  feed: string;
  results: BatchAddPostsResultItem[];
};

export type BatchAddPostsResponse = {
  results?: BatchAddPostsResult[];
  error?: string;
  message?: string;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function batchAddPosts(entries: any[], envOverrides?: Partial<Env>) {
  return requestJson<BatchAddPostsResponse>({
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
  await db
    .prepare('INSERT INTO feeds (feed_uri, is_active) VALUES (?, ?)')
    .bind(feed.uri, feed.is_active)
    .run();
}

export async function resetBatchAddTables() {
  await clearTables(['posts', 'post_languages', 'feeds']);
}
