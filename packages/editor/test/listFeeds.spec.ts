import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { clearTables, expectJsonResponse, requestJson } from './testUtils';

const ENDPOINT_PATH = '/api/feed/listFeeds';

const dummyFeeds = [
  { uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed1', lang_filter: 1, is_active: 1 },
  { uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed2', lang_filter: 1, is_active: 0 },
  { uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed3', lang_filter: 0, is_active: 1 },
];

// request helper
async function getFeedList(envOverrides?: Partial<Env>) {
  return requestJson<{ feeds?: Array<{ uri: string; langFilter: boolean; isActive: boolean }> }>(
    {
      path: ENDPOINT_PATH,
      envOverrides,
    }
  );
}

// database helper
async function insertFeeds(feeds: Array<{ uri: string; lang_filter: number; is_active: number }>) {
  const db = env.DB;
  const placeholders = feeds.map(() => '(?, ?, ?)').join(', ');
  const values = feeds.flatMap(({ uri, lang_filter, is_active }) => [uri, lang_filter, is_active]);
  await db
    .prepare(`INSERT INTO feeds (feed_uri, lang_filter, is_active) VALUES ${placeholders}`)
    .bind(...values)
    .run();
}

describe(ENDPOINT_PATH, async () => {
  beforeEach(async () => {
    await clearTables(['feeds']);
  });

  it('returns a list of all feeds', async () => {
    await insertFeeds(dummyFeeds);

    const { response, json } = await getFeedList();
    expectJsonResponse(response);
    expect(json).toEqual({
      feeds: expect.arrayContaining([
        { uri: dummyFeeds[0].uri, langFilter: true, isActive: true },
        { uri: dummyFeeds[1].uri, langFilter: true, isActive: false },
        { uri: dummyFeeds[2].uri, langFilter: false, isActive: true },
      ]),
    });
  });

  it('returns an empty list when no feeds exist', async () => {
    const { response, json } = await getFeedList();
    expectJsonResponse(response);
    expect(json).toEqual({
      feeds: [],
    });
  });

  it('handles database errors gracefully', async () => {
    const db = env.DB;
    await db.prepare('DROP TABLE feeds').run(); // Simulate a database error

    const { response } = await getFeedList();
    expect(response.status).toBe(500);
  });

  it('returns InternalServerError when feed query reports failure', async () => {
    const failingDb = {
      prepare: () => ({
        all: async () => ({ success: false, meta: {}, error: 'Database error' }),
      }),
    } as unknown as D1Database;

    const failingEnv: Partial<Env> = {
      DB: failingDb,
    };

    const { response, json } = await getFeedList(failingEnv);

    expect(response.status).toBe(500);
    expect(json).toEqual({
      error: 'InternalServerError',
      message: 'Failed to fetch feeds',
    });
  });
});
