import { env } from 'cloudflare:test';

import { clearTables, expectJsonResponse, requestJson } from './testUtils';

export const ENDPOINT_PATH = '/api/feed/addPost';

export const dummyFeed = {
  uri: 'at://did:plc:testuser/app.bsky.feed.generator/test-feed',
  is_active: 1,
};

export const dummyPost = {
  uri: 'at://did:plc:testuser/app.bsky.feed.post/test-post',
  cid: 'bafyreia3tbsfxe3cc6qxibc2pj4tcmxqyxupz3hajxuepz4g5qkdqxnx6y',
  languages: ['en', 'ja'],
  indexedAt: new Date().toISOString(),
};

export async function addPost(
  feed: string,
  post: {
    uri: string;
    cid: string;
    languages?: string[];
    indexedAt?: string | Date;
    reason?:
      | {
          $type: 'app.bsky.feed.defs#skeletonReasonRepost';
          repost: string;
        }
      | {
          $type: 'app.bsky.feed.defs#skeletonReasonPin';
        };
    feedContext?: string;
  },
  envOverrides?: Partial<Env>
) {
  return requestJson<{
    message?: string;
    feed?: string;
    post?: {
      uri: string;
      cid: string;
      languages?: string[];
      indexedAt: string;
      feedContext?: string;
      reason?: {
        $type: string;
        repost?: string;
      };
    };
    error?: string;
  }>({
    path: ENDPOINT_PATH,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ feed, post }),
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

export async function resetAddPostTables() {
  await clearTables(['posts', 'post_languages', 'feeds']);
}
