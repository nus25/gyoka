import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { ErrorResponse } from 'shared/src/types';
import { clearTables, expectJsonResponse, requestJson } from './testUtils';

const ENDPOINT_PATH = '/api/feed/unregisterFeed';

// request helper
async function unregisterFeed(feedUri: string, envOverrides?: Partial<Env>) {
  return requestJson<{ message?: string; error?: string; messageDetail?: string }>(
    {
      path: ENDPOINT_PATH,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uri: feedUri }),
      },
      envOverrides,
    }
  );
}

describe(ENDPOINT_PATH, async () => {
  beforeEach(async () => {
    const db = env.DB;
    await clearTables(['feeds']);
    await db
      .prepare('INSERT INTO feeds (feed_uri, is_active) VALUES (?, ?)')
      .bind('at://did:plc:testuser/app.bsky.feed.generator/feed1', 1)
      .run();
  });

  it('unregisters an existing feed successfully', async () => {
    const feedUri = 'at://did:plc:testuser/app.bsky.feed.generator/feed1';
    const { response, json } = await unregisterFeed(feedUri);
    expectJsonResponse(response);
    expect(json).toEqual({
      message: 'Feed unregistered successfully',
    });

    const db = env.DB;
    const { success, results } = await db
      .prepare('SELECT * FROM feeds WHERE feed_uri = ?')
      .bind(feedUri)
      .all();
    expect(success).toBe(true);
    expect(results.length).toBe(0);
  });

  it('returns a not found error when trying to unregister a non-existent feed', async () => {
    const feedUri = 'at://did:plc:testuser/app.bsky.feed.generator/nonexistent';
    const { response, json } = await unregisterFeed(feedUri);
    const resp = json as ErrorResponse;
    expect(response.status).toBe(404);
    expect(resp.error).toBe('UnknownFeed');
    expect(resp.message).toContain('does not exist');
    expect(resp.message).toContain(feedUri);
  });

  it('returns a bad request error for invalid feed URI', async () => {
    const feedUri = 'invalid-uri';
    const { response, json } = await unregisterFeed(feedUri);
    const resp = json as ErrorResponse;
    expect(response.status).toBe(400);
    expect(resp.error).toBe('BadRequest');
    expect(resp.message).toBeDefined();
  });

  it('handles database errors gracefully', async () => {
    const db = env.DB;
    await db.prepare('DROP TABLE feeds').run(); // Simulate a database error
    const feedUri = 'at://did:plc:testuser/app.bsky.feed.generator/feed1';
    const { response, json } = await unregisterFeed(feedUri);
    const resp = json as ErrorResponse;
    expect(response.status).toBe(500);
    expect(resp.error).toBe('InternalServerError');
    expect(resp.message).toBeDefined();
  });

  it('handles database query failure when checking if feed exists', async () => {
    // Mock a database that will fail on the SELECT query
    const mockDb = {
      prepare: () => ({
        bind: () => ({
          all: async () => ({ success: false, results: [] }),
        }),
      }),
    };

    // Create a custom environment with the mock database
    const feedUri = 'at://did:plc:testuser/app.bsky.feed.generator/feed1';
    const { response, json } = await unregisterFeed(feedUri, {
      DB: mockDb as unknown as D1Database,
    });
    const resp = json as ErrorResponse;
    expect(response.status).toBe(500);
    expect(resp.error).toBe('InternalServerError');
    expect(resp.message).toContain('Failed to query the database');
  });

  it('handles batch operation failure', async () => {
    // Mock a database that will succeed on SELECT but fail on batch
    const mockDb = {
      prepare: (query: string) => {
        if (query.includes('SELECT')) {
          return {
            bind: () => ({
              all: async () => ({
                success: true,
                results: [
                  {
                    feed_id: 1,
                    feed_uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed1',
                    is_active: 1,
                  },
                ],
              }),
            }),
          };
        } else {
          return {
            bind: () => ({}),
          };
        }
      },
      batch: async () => [{ success: false }],
    };

    // Create a custom environment with the mock database
    const feedUri = 'at://did:plc:testuser/app.bsky.feed.generator/feed1';
    const { response, json } = await unregisterFeed(feedUri, {
      DB: mockDb as unknown as D1Database,
    });
    const resp = json as ErrorResponse;
    expect(response.status).toBe(500);
    expect(resp.error).toBe('InternalServerError');
    expect(resp.message).toContain('Failed to unregister feed and associated posts');
  });

  it('deletes posts associated with the unregistered feed', async () => {
    const feedUri = 'at://did:plc:testuser/app.bsky.feed.generator/feed1';

    // Insert posts associated with the feed
    const db = env.DB;
    await db
      .prepare(
        'INSERT INTO posts (cid, did, uri, indexed_at, feed_id) VALUES (?, ?, ?, ?, (SELECT feed_id FROM feeds WHERE feed_uri = ?))'
      )
      .bind(
        'test-cid',
        'did:plc:testuser',
        'at://did:plc:testuser/app.bsky.feed.post/post1',
        new Date().toISOString(),
        feedUri
      )
      .run();

    // Unregister the feed
    const { response, json } = await unregisterFeed(feedUri);
    expectJsonResponse(response);
    expect(json).toEqual({
      message: 'Feed unregistered successfully',
    });

    // Verify posts are deleted
    const { success, results } = await db
      .prepare('SELECT * FROM posts WHERE feed_id = (SELECT feed_id FROM feeds WHERE feed_uri = ?)')
      .bind(feedUri)
      .all();
    expect(success).toBe(true);
    expect(results.length).toBe(0);
  });
});
