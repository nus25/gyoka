import { env } from 'cloudflare:test';

import { clearTables, expectJsonResponse, requestJson } from './testUtils';

export const ENDPOINT_PATH = '/api/feed/updateFeed';
export const DEFAULT_FEED_URI = 'at://did:plc:testuser/app.bsky.feed.generator/feed1rkey';

export async function updateFeed(
  request: { uri: string; langFilter?: boolean; isActive?: boolean },
  envOverrides?: Partial<Env>
) {
  return requestJson<{
    message?: string;
    feed?: { uri: string; langFilter: boolean; isActive: boolean };
    error?: string;
  }>({
    path: ENDPOINT_PATH,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    },
    envOverrides,
  });
}

export function assertValidResponse(response: Response) {
  expectJsonResponse(response);
}

export async function seedDefaultFeed() {
  const db = env.DB;
  await clearTables(['feeds']);
  await db
    .prepare('INSERT INTO feeds (feed_uri,lang_filter, is_active) VALUES (?, ?, ?)')
    .bind(DEFAULT_FEED_URI, 1, 1)
    .run();
}
