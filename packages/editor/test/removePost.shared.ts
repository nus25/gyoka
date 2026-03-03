import { env } from 'cloudflare:test';
import { clearTables, expectJsonResponse, requestJson } from './testUtils';

export const ENDPOINT_PATH = '/api/feed/removePost';

export const dummyFeed = {
  uri: 'at://did:plc:testuser/app.bsky.feed.generator/test-feed',
  is_active: 1,
};

export const dummyPost = {
  id: 1,
  uri: 'at://did:plc:testuser/app.bsky.feed.post/test-post',
  cid: 'bafyreia3tbsfxe3cc6qxibc2pj4tcmxqyxupz3hajxuepz4g5qkdqxnx6y',
  indexedAt: new Date().toISOString(),
  langs: ['en'],
};

export interface RemovePostResponse {
  message: string;
  feed: string;
  post: {
    uri: string;
    indexedAt?: string;
  };
}

export interface ErrorResponse {
  error: string;
  message: string;
}

export async function removePost(
  feed: string,
  post: { uri: string; indexedAt?: string },
  envOverrides?: Partial<Env>
) {
  return requestJson<RemovePostResponse | ErrorResponse>({
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

export async function verifyPostExists(uri: string): Promise<boolean> {
  const db = env.DB;
  const { results } = await db.prepare('SELECT 1 FROM posts WHERE uri = ?').bind(uri).all();
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

export async function resetRemovePostTables() {
  await clearTables(['posts', 'post_languages', 'feeds']);
}
