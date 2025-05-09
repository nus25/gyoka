import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/index';


const BASE_URL = 'http://localhost:8787';
const ENDPOINT_PATH = '/api/feed/listFeeds';

const dummyFeeds = [
  { uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed1', lang_filter: 1, is_active: 1 },
  { uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed2', lang_filter: 1, is_active: 0 },
  { uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed3', lang_filter: 0, is_active: 1 },
];

// request helper
async function getFeedList() {
  const request = new Request(`${BASE_URL}${ENDPOINT_PATH}`);
  const ctx = createExecutionContext();
  const response = await app.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return {
    response,
    json: await response.json(),
  };
}

// response validation helper
function assertValidResponse(response: Response) {
  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Type')).toBe('application/json');
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
    const db = env.DB;
    await db.prepare('DELETE FROM feeds').run();
  });

  it('returns a list of all feeds', async () => {
    await insertFeeds(dummyFeeds);

    const { response, json } = await getFeedList();
    assertValidResponse(response);
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
    assertValidResponse(response);
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
});
