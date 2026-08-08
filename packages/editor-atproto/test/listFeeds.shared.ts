import { env } from 'cloudflare:workers';

import { clearTables, expectJsonResponse, requestPath } from './index.shared';

export const ENDPOINT_PATH = '/xrpc/net.nusno.gyoka.feed.listFeeds';

export const dummyFeeds = [
  { uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed1', lang_filter: 1, is_active: 1 },
  { uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed2', lang_filter: 1, is_active: 0 },
  { uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed3', lang_filter: 0, is_active: 1 },
];

export async function getFeedList(envOverrides?: Partial<Env>) {
  const response = await requestPath(ENDPOINT_PATH, undefined, {
    ...env,
    ...envOverrides,
  });

  return {
    response,
    json: (await response.json()) as {
      feeds?: Array<{ uri: string; langFilter: boolean; isActive: boolean }>;
      error?: string;
      message?: string;
    },
  };
}

export function assertValidResponse(response: Response) {
  expectJsonResponse(response);
}

export async function insertFeeds(
  feeds: Array<{ uri: string; lang_filter: number; is_active: number }>
) {
  const placeholders = feeds.map(() => '(?, ?, ?)').join(', ');
  const values = feeds.flatMap(({ uri, lang_filter, is_active }) => [uri, lang_filter, is_active]);
  await env.DB.prepare(
    `INSERT INTO feeds (feed_uri, lang_filter, is_active) VALUES ${placeholders}`
  )
    .bind(...values)
    .run();
}

export async function resetListFeedsTable() {
  await clearTables(['feeds']);
}
