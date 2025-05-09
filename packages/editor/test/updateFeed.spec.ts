import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/index';

const BASE_URL = 'http://localhost:8787';
const ENDPOINT_PATH = '/api/feed/updateFeed';

// request helper
async function updateFeed(request: { uri: string; langFilter?: boolean; isActive?: boolean }) {
  const req = new Request(`${BASE_URL}${ENDPOINT_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  const ctx = createExecutionContext();
  const response = await app.fetch(req, env, ctx);
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

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    const db = env.DB;
    await db.prepare('DELETE FROM feeds').run();
    await db
      .prepare('INSERT INTO feeds (feed_uri,lang_filter, is_active) VALUES (?, ?, ?)')
      .bind('at://did:plc:testuser/app.bsky.feed.generator/feed1rkey', 1, 1)
      .run();
  });

  it('updates feed with all fields specified', async () => {
    const request = {
      uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed1rkey',
      langFilter: false,
      isActive: false,
    };

    const { response, json } = await updateFeed(request);
    assertValidResponse(response);
    expect(json).toEqual({
      message: 'Feed updated successfully',
      feed: {
        uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed1rkey',
        langFilter: false,
        isActive: false,
      },
    });

    // Verify database state
    const db = env.DB;
    const { results } = await db
      .prepare('SELECT * FROM feeds WHERE feed_uri = ?')
      .bind(request.uri)
      .all();
    expect(results.length).toBe(1);
    expect(results[0].feed_uri).toBe(request.uri);
    expect(results[0].lang_filter).toBe(request.langFilter ? 1 : 0);
    expect(results[0].is_active).toBe(request.isActive ? 1 : 0);
  });
  it('updates feed with langFilter fields specified', async () => {
    const request = {
      uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed1rkey',
      langFilter: false,
    };

    const { response, json } = await updateFeed(request);
    assertValidResponse(response);
    expect(json).toEqual({
      message: 'Feed updated successfully',
      feed: {
        uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed1rkey',
        langFilter: false,
        isActive: true,
      },
    });

    // Verify database state
    const db = env.DB;
    const { results } = await db
      .prepare('SELECT * FROM feeds WHERE feed_uri = ?')
      .bind(request.uri)
      .all();
    expect(results.length).toBe(1);
    expect(results[0].feed_uri).toBe(request.uri);
    expect(results[0].lang_filter).toBe(0);
    expect(results[0].is_active).toBe(1); // not change
  });
  it('updates feed with isActive fields specified', async () => {
    const request = {
      uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed1rkey',
      isActive: false,
    };

    const { response, json } = await updateFeed(request);
    assertValidResponse(response);
    expect(json).toEqual({
      message: 'Feed updated successfully',
      feed: {
        uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed1rkey',
        langFilter: true,
        isActive: false,
      },
    });

    // Verify database state
    const db = env.DB;
    const { results } = await db
      .prepare('SELECT * FROM feeds WHERE feed_uri = ?')
      .bind(request.uri)
      .all();
    expect(results.length).toBe(1);
    expect(results[0].feed_uri).toBe(request.uri);
    expect(results[0].lang_filter).toBe(1); //not change
    expect(results[0].is_active).toBe(0);
  });
  it('rejects request with no fields specified', async () => {
    const request = {
      uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed1rkey',
    };

    const { response, json } = await updateFeed(request);
    expect(response.status).toBe(400);
    expect(json).toEqual({
      error: 'BadRequest',
      message: 'No value for update in request',
    });

    // Verify database state
    const db = env.DB;
    const { results } = await db
      .prepare('SELECT * FROM feeds WHERE feed_uri = ?')
      .bind(request.uri)
      .all();
    expect(results.length).toBe(1);
    expect(results[0].feed_uri).toBe(request.uri);
    expect(results[0].lang_filter).toBe(1); // not change
    expect(results[0].is_active).toBe(1); // not change
  });
});
