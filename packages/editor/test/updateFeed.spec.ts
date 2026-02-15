import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { clearTables, expectJsonResponse, requestJson } from './testUtils';

const ENDPOINT_PATH = '/api/feed/updateFeed';

// request helper
async function updateFeed(
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

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    const db = env.DB;
    await clearTables(['feeds']);
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
    expectJsonResponse(response);
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
  it('updates feed from false values to true', async () => {
    const uri = 'at://did:plc:testuser/app.bsky.feed.generator/feed1rkey';

    // Prepare feed state as false/false
    const db = env.DB;
    await db.prepare('UPDATE feeds SET lang_filter = ?, is_active = ? WHERE feed_uri = ?').bind(0, 0, uri).run();

    const request = {
      uri,
      langFilter: true,
      isActive: true,
    };

    const { response, json } = await updateFeed(request);
    expectJsonResponse(response);
    expect(json).toEqual({
      message: 'Feed updated successfully',
      feed: {
        uri,
        langFilter: true,
        isActive: true,
      },
    });

    // Verify database state
    const { results } = await db.prepare('SELECT * FROM feeds WHERE feed_uri = ?').bind(uri).all();
    expect(results.length).toBe(1);
    expect(results[0].feed_uri).toBe(uri);
    expect(results[0].lang_filter).toBe(1);
    expect(results[0].is_active).toBe(1);
  });
  it('updates feed with langFilter fields specified', async () => {
    const request = {
      uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed1rkey',
      langFilter: false,
    };

    const { response, json } = await updateFeed(request);
    expectJsonResponse(response);
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
    expectJsonResponse(response);
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
  it('handles non-existent feed', async () => {
    const request = {
      uri: 'at://did:plc:nonexistent/app.bsky.feed.generator/feed',
      langFilter: true,
      isActive: true,
    };

    const { response, json } = await updateFeed(request);
    expect(response.status).toBe(404);
    expect(json).toEqual({
      error: 'UnknownFeed',
      message: 'Feed with URI at://did:plc:nonexistent/app.bsky.feed.generator/feed does not exist',
    });
  });

  it('returns InternalServerError when feed select query fails', async () => {
    const failingEnv = {
      DB: {
        prepare: () => ({
          bind: () => ({
            all: async () => ({ success: false, results: [] }),
          }),
        }),
      } as unknown as D1Database,
    };

    const { response, json } = await updateFeed(
      {
        uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed1rkey',
        langFilter: false,
      },
      failingEnv
    );

    expect(response.status).toBe(500);
    expect(json).toEqual({
      error: 'InternalServerError',
      message: 'Failed to query the database',
    });
  });

  it('returns InternalServerError when feed update batch fails', async () => {
    const failingBatchEnv = {
      DB: {
        prepare: (sql: string) => {
          if (sql === 'SELECT * FROM feeds WHERE feed_uri = ?') {
            return {
              bind: () => ({
                all: async () => ({
                  success: true,
                  results: [
                    {
                      feed_uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed1rkey',
                      lang_filter: 1,
                      is_active: 1,
                    },
                  ],
                }),
              }),
            };
          }

          return {
            bind: () => ({}),
          };
        },
        batch: async () => [{ success: false }],
      } as unknown as D1Database,
    };

    const { response, json } = await updateFeed(
      {
        uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed1rkey',
        langFilter: false,
      },
      failingBatchEnv
    );

    expect(response.status).toBe(500);
    expect(json).toEqual({
      error: 'InternalServerError',
      message: 'Failed to update feed',
    });
  });
});
