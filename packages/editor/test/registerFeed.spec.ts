import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { ErrorResponse } from 'shared/src/types';
import app from '../src/index';

const BASE_URL = 'http://localhost:8787';
const ENDPOINT_PATH = '/api/feed/registerFeed';

// request helper
async function registerFeed(feed: { uri: string; langFilter?: boolean; isActive?: boolean }) {
  const request = new Request(`${BASE_URL}${ENDPOINT_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(feed),
  });
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

describe(ENDPOINT_PATH, async () => {
  beforeEach(async () => {
    const db = env.DB;
    await db.prepare('DELETE FROM feeds').run();
  });

  it('registers a new feed successfully', async () => {
    const feed = {
      uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed1',
      langFilter: false,
      isActive: true,
    };
    const { response, json } = await registerFeed(feed);
    assertValidResponse(response);
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
    assertValidResponse(response);
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
    const resp = json as ErrorResponse;
    expect(response.status).toBe(400);
    expect(resp.error).toBe('BadRequest');
    expect(resp.message).toBeDefined();
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
    const mockEnv = { ...env, DB: mockDb };

    const feed = { uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed5', isActive: true };
    const request = new Request(`${BASE_URL}${ENDPOINT_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feed),
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    const json = await response.json();
    expect(response.status).toBe(500);
    expect(json).toEqual({
      error: 'InternalServerError',
      message: 'Failed to register feed',
    });
  });
});
