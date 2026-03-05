import { env } from 'cloudflare:test';

import { clearTables, expectJsonResponse, requestJson } from './testUtils';

export const ENDPOINT_PATH = '/api/feed/listFeeds';

export const dummyFeeds = [
  { uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed1', lang_filter: 1, is_active: 1 },
  { uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed2', lang_filter: 1, is_active: 0 },
  { uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed3', lang_filter: 0, is_active: 1 },
];

export async function getFeedList(envOverrides?: Partial<Env>) {
  return requestJson<{ feeds?: Array<{ uri: string; langFilter: boolean; isActive: boolean }> }>({
    path: ENDPOINT_PATH,
    envOverrides,
  });
}

export function assertValidResponse(response: Response) {
  expectJsonResponse(response);
}

export async function insertFeeds(
  feeds: Array<{ uri: string; lang_filter: number; is_active: number }>
) {
  const db = env.DB;
  const placeholders = feeds.map(() => '(?, ?, ?)').join(', ');
  const values = feeds.flatMap(({ uri, lang_filter, is_active }) => [uri, lang_filter, is_active]);
  await db
    .prepare(`INSERT INTO feeds (feed_uri, lang_filter, is_active) VALUES ${placeholders}`)
    .bind(...values)
    .run();
}

export async function resetListFeedsTable() {
  await clearTables(['feeds']);
}
