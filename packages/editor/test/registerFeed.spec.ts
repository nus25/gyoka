import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { assertErrorResponse, clearTables, expectJsonResponse, requestJson } from './testUtils';

const ENDPOINT_PATH = '/api/feed/registerFeed';

// request helper
async function registerFeed(
  feed: { uri: string; langFilter?: boolean; isActive?: boolean },
  envOverrides?: Partial<Env>
) {
  return requestJson<
    { message?: string; feed?: { uri: string; langFilter: boolean; isActive: boolean } } | { error: string; message?: string }
  >(
    {
      path: ENDPOINT_PATH,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feed),
      },
      envOverrides,
    }
  );
}

describe(ENDPOINT_PATH, async () => {
  beforeEach(async () => {
    await clearTables(['feeds']);
  });

  it('registers a new feed successfully', async () => {
    const feed = {
      uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed1',
      langFilter: false,
      isActive: true,
    };
    const { response, json } = await registerFeed(feed);
    expectJsonResponse(response);
    expect(json).toEqual({
      message: 'Feed registered successfully',
      feed: {
        uri: feed.uri,
        langFilter: feed.langFilter,
        isActive: feed.isActive,
      },
    });
  });

  it('registers a feed with default is_active value', async () => {
    const feed = { uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed2' };
    const { response, json } = await registerFeed(feed);
    expectJsonResponse(response);
    expect(json).toEqual({
      message: 'Feed registered successfully',
      feed: {
        uri: feed.uri,
        langFilter: true,
        isActive: true,
      },
    });
  });

  it('returns a conflict error when registering a duplicate feed', async () => {
    const feed = { uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed3', isActive: true };
    await registerFeed(feed); // First registration
    const { response, json } = await registerFeed(feed); // Duplicate registration
    expect(response.status).toBe(409);
    expect(json).toEqual({
      error: 'Conflict',
      message: `Feed with URI ${feed.uri} already exists.`,
    });
  });

  it('returns a bad request error for invalid feed URI', async () => {
    const feed = { uri: 'invalid-uri', isActive: true };
    const { response, json } = await registerFeed(feed);
    expect(response.status).toBe(400);
    assertErrorResponse(json);
    expect(json.error).toBe('BadRequest');
    expect(json.message).toBeDefined();
  });

  it('handles database errors gracefully', async () => {
    const db = env.DB;
    await db.prepare('DROP TABLE feeds').run(); // Simulate a database error
    const feed = { uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed4', isActive: true };
    const { response, json } = await registerFeed(feed);
    expect(response.status).toBe(500);
    expect(json).toEqual({
      error: 'InternalServerError',
      message: 'An unexpected error occurred.',
    });
  });

  it('handles database operation failure', async () => {
    // Mock a database that will return success: false for the insert operation
    const mockDb = {
      prepare: () => ({
        bind: () => ({
          run: async () => ({ success: false }),
        }),
      }),
    };

    // Create a custom environment with the mock database
    const feed = { uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed5', isActive: true };
    const { response, json } = await registerFeed(feed, {
      DB: mockDb as unknown as D1Database,
    });
    expect(response.status).toBe(500);
    expect(json).toEqual({
      error: 'InternalServerError',
      message: 'Failed to register feed',
    });
  });
});
