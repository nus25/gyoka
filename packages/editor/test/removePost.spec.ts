import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/index';

const BASE_URL = 'http://localhost:8787';
const ENDPOINT_PATH = '/api/feed/removePost';

const dummyFeed = {
  uri: 'at://did:plc:testuser/app.bsky.feed.generator/test-feed',
  is_active: 1,
};

const dummyPost = {
  id: 1,
  uri: 'at://did:plc:testuser/app.bsky.feed.post/test-post',
  cid: 'bafyreia3tbsfxe3cc6qxibc2pj4tcmxqyxupz3hajxuepz4g5qkdqxnx6y',
  indexedAt: new Date().toISOString(),
  langs: ['en'],
};

interface RemovePostResponse {
  message: string;
  feed: string;
  post: {
    uri: string;
    indexedAt?: string;
  };
}

interface ErrorResponse {
  error: string;
  message: string;
}

// request helper
async function removePost(feed: string, post: { uri: string; indexedAt?: string }) {
  const request = new Request(`${BASE_URL}${ENDPOINT_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ feed, post }),
  });
  const ctx = createExecutionContext();
  const response = await app.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return {
    response,
    json: (await response.json()) as RemovePostResponse,
  };
}

// response validation helper
function assertValidResponse(response: Response) {
  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Type')).toBe('application/json');
}

// database helpers
async function insertFeed(feed: { uri: string; is_active: number }) {
  const db = env.DB;
  const result = await db
    .prepare('INSERT INTO feeds (feed_uri, is_active) VALUES (?, ?)')
    .bind(feed.uri, feed.is_active)
    .run();
  return result.meta.last_row_id;
}

async function insertPost(
  feedId: number,
  post: { id: number; uri: string; cid: string; indexedAt: string; langs: string[] }
) {
  const db = env.DB;
  const did = post.uri.split('/')[2];

  // Insert post
  await db
    .prepare(
      'INSERT INTO posts (post_id, feed_id, did, uri, cid, indexed_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind(post.id, feedId, did, post.uri, post.cid, post.indexedAt)
    .run();

  // Insert languages
  for (const lang of post.langs) {
    await db
      .prepare('INSERT INTO post_languages (post_id, language) VALUES (?, ?)')
      .bind(post.id, lang)
      .run();
  }
}

async function verifyPostExists(uri: string): Promise<boolean> {
  const db = env.DB;
  const { results } = await db.prepare('SELECT 1 FROM posts WHERE uri = ?').bind(uri).all();
  return results.length > 0;
}

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    const db = env.DB;
    await db.prepare('DELETE FROM posts').run();
    await db.prepare('DELETE FROM post_languages').run();
    await db.prepare('DELETE FROM feeds').run();
  });

  it('removes a post with URI only', async () => {
    const feedId = await insertFeed(dummyFeed);
    await insertPost(feedId, dummyPost);

    const { response, json } = await removePost(dummyFeed.uri, { uri: dummyPost.uri });
    assertValidResponse(response);
    expect(json).toEqual({
      message: 'Post removed successfully',
      feed: dummyFeed.uri,
      post: {
        uri: dummyPost.uri,
      },
    });

    // Verify post was removed
    const exists = await verifyPostExists(dummyPost.uri);
    expect(exists).toBe(false);
  });

  it('removes a post with specific indexedAt', async () => {
    const feedId = await insertFeed(dummyFeed);
    await insertPost(feedId, dummyPost);

    const { response, json } = await removePost(dummyFeed.uri, {
      uri: dummyPost.uri,
      indexedAt: new Date(dummyPost.indexedAt).toISOString(),
    });
    console.log(json);
    assertValidResponse(response);

    // Verify post was removed
    const exists = await verifyPostExists(dummyPost.uri);
    expect(exists).toBe(false);
  });

  it('handles non-existent feed', async () => {
    const { response } = await removePost('at://did:plc:nonexistent/app.bsky.feed.generator/feed', {
      uri: dummyPost.uri,
    });
    expect(response.status).toBe(404);
  });

  it('handles non-existent post', async () => {
    await insertFeed(dummyFeed);

    const { response, json } = await removePost(dummyFeed.uri, {
      uri: 'at://did:plc:testuser/app.bsky.feed.post/nonexistent',
    });
    console.log(json);
    expect(response.status).toBe(404);
  });

  it('handles invalid feed URI', async () => {
    const { response } = await removePost('invalid-uri', { uri: dummyPost.uri });
    expect(response.status).toBe(400);
  });

  it('handles invalid post URI', async () => {
    await insertFeed(dummyFeed);

    const { response } = await removePost(dummyFeed.uri, { uri: 'invalid-uri' });
    expect(response.status).toBe(400);
  });

  it('handles database errors gracefully', async () => {
    await insertFeed(dummyFeed);
    const db = env.DB;
    await db.prepare('DROP TABLE posts').run(); // Simulate a database error

    const { response } = await removePost(dummyFeed.uri, { uri: dummyPost.uri });
    expect(response.status).toBe(500);
  });

  it('handles database query failure when checking feed existence', async () => {
    // Mock a database that will fail on the SELECT query
    const mockDb = {
      prepare: (query: string) => {
        if (query.includes('SELECT')) {
          return {
            bind: () => ({
              all: async () => ({ success: false, results: [] }),
            }),
          };
        }
        return {
          bind: () => ({
            run: async () => ({ success: true, meta: { changed_db: true } }),
          }),
        };
      },
    };

    // Create a custom environment with the mock database
    const mockEnv = { ...env, DB: mockDb };

    const request = new Request(`${BASE_URL}${ENDPOINT_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feed: dummyFeed.uri, post: { uri: dummyPost.uri } }),
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(500);
    const json = (await response.json()) as ErrorResponse;
    expect(json.error).toBe('InternalServerError');
    expect(json.message).toBe('Failed to query the database');
  });

  it('handles database delete operation failure', async () => {
    // Mock a database that will succeed on SELECT but fail on DELETE
    const mockDb = {
      prepare: (query: string) => {
        if (query.includes('SELECT')) {
          return {
            bind: () => ({
              all: async () => ({
                success: true,
                results: [{ feed_id: 1 }],
              }),
            }),
          };
        } else if (query.includes('DELETE')) {
          return {
            bind: () => ({
              run: async () => ({ success: false }),
            }),
          };
        }
        return {
          bind: () => ({}),
        };
      },
    };

    // Create a custom environment with the mock database
    const mockEnv = { ...env, DB: mockDb };

    const request = new Request(`${BASE_URL}${ENDPOINT_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feed: dummyFeed.uri, post: { uri: dummyPost.uri } }),
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(500);
    const json = (await response.json()) as ErrorResponse;
    expect(json.error).toBe('InternalServerError');
    expect(json.message).toBe('Failed to remove post from the database');
  });

  it('handles post not found with specific indexedAt', async () => {
    const feedId = await insertFeed(dummyFeed);
    await insertPost(feedId, dummyPost);

    const wrongDate = new Date();
    wrongDate.setFullYear(wrongDate.getFullYear() - 1);

    const { response } = await removePost(dummyFeed.uri, {
      uri: dummyPost.uri,
      indexedAt: wrongDate.toISOString(),
    });
    expect(response.status).toBe(404);

    // Verify post still exists
    const exists = await verifyPostExists(dummyPost.uri);
    expect(exists).toBe(true);
  });
});
