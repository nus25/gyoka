import { env } from 'cloudflare:workers';

import { clearTables, requestJson, expectJsonResponse } from './testUtils';

export const ENDPOINT_PATH = '/api/feed/unregisterFeed';
export const DEFAULT_FEED_URI = 'at://did:plc:testuser/app.bsky.feed.generator/feed1';

export async function unregisterFeed(feedUri: string, envOverrides?: Partial<Env>) {
  return requestJson<{ message?: string } | { error: string; message?: string }>({
    path: ENDPOINT_PATH,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uri: feedUri }),
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
    .prepare('INSERT INTO feeds (feed_uri, is_active) VALUES (?, ?)')
    .bind(DEFAULT_FEED_URI, 1)
    .run();
}
