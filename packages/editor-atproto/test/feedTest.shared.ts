import { env } from 'cloudflare:workers';

import { clearTables, requestPath } from './index.shared';

export const CID = 'bafyreia3tbsfxe3cc6qxibc2pj4tcmxqyxupz3hajxuepz4g5qkdqxnx6y';
export const FEED_URI = 'at://did:plc:testuser/app.bsky.feed.generator/feed1';
export const FEED_URI_2 = 'at://did:plc:testuser/app.bsky.feed.generator/feed2';
export const POST_URI = 'at://did:plc:testuser/app.bsky.feed.post/post1';
export const POST_URI_2 = 'at://did:plc:testuser/app.bsky.feed.post/post2';
export const AUTHOR_DID = 'did:plc:testuser';

export type JsonObject = Record<string, unknown>;

export async function callProcedure(path: string, body: unknown, envOverrides?: Partial<Env>) {
  const response = await requestPath(
    path,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    {
      ...env,
      ...envOverrides,
    }
  );

  return {
    response,
    json: (await response.json()) as JsonObject,
  };
}

export async function callQuery(path: string, envOverrides?: Partial<Env>) {
  const response = await requestPath(path, undefined, {
    ...env,
    ...envOverrides,
  });

  return {
    response,
    json: (await response.json()) as JsonObject,
  };
}

export async function resetFeedTables() {
  await clearTables(['posts', 'post_languages', 'feeds', 'documents']);
}

export async function insertFeed(
  feedUri: string,
  langFilter = 1,
  isActive = 1
): Promise<{ feedId: number }> {
  const result = await env.DB.prepare(
    'INSERT INTO feeds (feed_uri, lang_filter, is_active) VALUES (?, ?, ?)'
  )
    .bind(feedUri, langFilter, isActive)
    .run();

  return { feedId: Number(result.meta.last_row_id) };
}

export async function insertPost(
  feedId: number,
  post: {
    uri: string;
    cid?: string;
    indexedAt?: string;
    languages?: string[];
  }
): Promise<void> {
  const cid = post.cid ?? CID;
  const indexedAt = post.indexedAt ?? new Date().toISOString();
  const languages = post.languages ?? ['*'];

  const postResult = await env.DB.prepare(
    'INSERT INTO posts (feed_id, uri, cid, indexed_at) VALUES (?, ?, ?, ?)'
  )
    .bind(feedId, post.uri, cid, indexedAt)
    .run();

  const postId = Number(postResult.meta.last_row_id);
  for (const language of languages) {
    await env.DB.prepare('INSERT INTO post_languages (post_id, language) VALUES (?, ?)')
      .bind(postId, language)
      .run();
  }
}

export async function findFeedRowByUri(uri: string) {
  const { success, results } = await env.DB.prepare(
    'SELECT feed_uri, lang_filter, is_active FROM feeds WHERE feed_uri = ?'
  )
    .bind(uri)
    .all<{
      feed_uri: string;
      lang_filter: number;
      is_active: number;
    }>();

  if (!success || results.length === 0) {
    return null;
  }

  return results[0];
}

export async function countFeedRowsByUri(uri: string): Promise<number> {
  const { success, results } = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM feeds WHERE feed_uri = ?'
  )
    .bind(uri)
    .all<{ count: number | string }>();

  if (!success || results.length === 0) {
    return 0;
  }

  return Number(results[0].count);
}

export async function countPostsByFeedUri(feedUri: string): Promise<number> {
  const { success, results } = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM posts WHERE feed_id = (SELECT feed_id FROM feeds WHERE feed_uri = ?)'
  )
    .bind(feedUri)
    .all<{ count: number | string }>();

  if (!success || results.length === 0) {
    return 0;
  }

  return Number(results[0].count);
}

export async function countPostsByUriInFeed(feedUri: string, postUri: string): Promise<number> {
  const { success, results } = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM posts WHERE feed_id = (SELECT feed_id FROM feeds WHERE feed_uri = ?) AND uri = ?'
  )
    .bind(feedUri, postUri)
    .all<{ count: number | string }>();

  if (!success || results.length === 0) {
    return 0;
  }

  return Number(results[0].count);
}

export async function findDocumentByType(type: 'tos' | 'privacy_policy') {
  const { success, results } = await env.DB.prepare(
    'SELECT type, url, content FROM documents WHERE type = ?'
  )
    .bind(type)
    .all<{
      type: string;
      url: string | null;
      content: string | null;
    }>();

  if (!success || results.length === 0) {
    return null;
  }

  return results[0];
}
