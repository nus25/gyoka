import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/index';

const BASE_URL = 'http://localhost:8787';
const ENDPOINT_PATH = '/api/feed/trimPosts';

const dummyFeed = {
  uri: 'at://did:plc:testuser/app.bsky.feed.generator/test-feed',
  is_active: 1,
};

interface TrimFeedResponse {
  message: string;
  feed: string;
  deletedCount: number;
}

interface ErrorResponse {
  error: string;
  message: string;
}

// request helper
async function trimFeed(feed: string, remain: number) {
  const request = new Request(`${BASE_URL}${ENDPOINT_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ feed, remain }),
  });
  const ctx = createExecutionContext();
  const response = await app.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return {
    response,
    json: (await response.json()) as TrimFeedResponse,
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

async function countPosts(feedId: number): Promise<number> {
  const db = env.DB;
  const { results } = await db
    .prepare('SELECT COUNT(*) as count FROM posts WHERE feed_id = ?')
    .bind(feedId)
    .all();
  return Number(results[0].count);
}

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    const db = env.DB;
    await db.prepare('DELETE FROM posts').run();
    await db.prepare('DELETE FROM post_languages').run();
    await db.prepare('DELETE FROM feeds').run();
  });

  it('trims posts keeping specified number of recent posts', async () => {
    const feedId = await insertFeed(dummyFeed);
    const posts = Array.from({ length: 10 }, (_, i) => ({
      id: i,
      uri: `at://did:plc:testuser/app.bsky.post/test-${i}`,
      cid: `cid-${i}`,
      indexedAt: new Date(2024, 0, i + 1).toISOString(),
      langs: ['en'],
    }));

    for (const post of posts) {
      await insertPost(feedId, post);
    }

    const { response, json } = await trimFeed(dummyFeed.uri, 5);
    assertValidResponse(response);
    expect(json).toEqual({
      message: 'Posts trimed successfully',
      feed: dummyFeed.uri,
      deletedCount: 5,
    });

    // Verify only 5 posts remain
    const remainingCount = await countPosts(feedId);
    expect(remainingCount).toBe(5);
  });
  it('trims all posts by remain=0', async () => {
    const feedId = await insertFeed(dummyFeed);
    const posts = Array.from({ length: 10 }, (_, i) => ({
      id: i,
      uri: `at://did:plc:testuser/app.bsky.post/test-${i}`,
      cid: `cid-${i}`,
      indexedAt: new Date(2024, 0, i + 1).toISOString(),
      langs: ['en'],
    }));

    for (const post of posts) {
      await insertPost(feedId, post);
    }

    const { response, json } = await trimFeed(dummyFeed.uri, 0);
    assertValidResponse(response);
    expect(json).toEqual({
      message: 'Posts trimed successfully',
      feed: dummyFeed.uri,
      deletedCount: 10,
    });

    // Verify only 0 posts remain
    const remainingCount = await countPosts(feedId);
    expect(remainingCount).toBe(0);
  });
  it('handles empty feed', async () => {
    await insertFeed(dummyFeed);

    const { response, json } = await trimFeed(dummyFeed.uri, 5);
    assertValidResponse(response);
    expect(json.deletedCount).toBe(0);
  });

  it('handles remain count larger than current posts', async () => {
    const feedId = await insertFeed(dummyFeed);
    const posts = Array.from({ length: 3 }, (_, i) => ({
      id: i,
      uri: `at://did:plc:testuser/app.bsky.post/test-${i}`,
      cid: `cid-test-${i}`,
      indexedAt: new Date(2024, 0, i + 1).toISOString(),
      langs: ['en'],
    }));

    for (const post of posts) {
      await insertPost(feedId, post);
    }

    const { response, json } = await trimFeed(dummyFeed.uri, 5);
    assertValidResponse(response);
    expect(json.deletedCount).toBe(0); // remain all posts

    // Verify all posts remain
    const remainingCount = await countPosts(feedId);
    expect(remainingCount).toBe(3);
  });

  it('handles non-existent feed', async () => {
    const { response } = await trimFeed('at://did:plc:nonexistent/app.bsky.feed.generator/feed', 5);
    expect(response.status).toBe(404);
  });

  it('handles invalid feed URI', async () => {
    const { response } = await trimFeed('invalid-uri', 5);
    expect(response.status).toBe(400);
  });

  it('handles negative remain count', async () => {
    await insertFeed(dummyFeed);
    const { response } = await trimFeed(dummyFeed.uri, -1);
    expect(response.status).toBe(400);
  });

  it('handles database errors gracefully', async () => {
    await insertFeed(dummyFeed);
    const db = env.DB;
    await db.prepare('DROP TABLE posts').run(); // Simulate a database error

    const { response } = await trimFeed(dummyFeed.uri, 5);
    expect(response.status).toBe(500);
  });

  it('handles database query failure when checking feed existence', async () => {
    // Mock a database that will fail on the SELECT query
    const mockDb = {
      prepare: () => ({
        bind: () => ({
          all: async () => ({ success: false, results: [] }),
        }),
      }),
    };

    // Create a custom environment with the mock database
    const mockEnv = { ...env, DB: mockDb };

    const request = new Request(`${BASE_URL}${ENDPOINT_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feed: dummyFeed.uri, remain: 5 }),
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(500);
    const json = (await response.json()) as ErrorResponse;
    expect(json.error).toBe('InternalServerError');
    expect(json.message).toBe('Failed to query the database');
  });

  it('handles developer mode logging', async () => {
    const feedId = await insertFeed(dummyFeed);
    const posts = Array.from({ length: 5 }, (_, i) => ({
      id: i,
      uri: `at://did:plc:testuser/app.bsky.post/test-${i}`,
      cid: `cid-${i}`,
      indexedAt: new Date(2024, 0, i + 1).toISOString(),
      langs: ['en'],
    }));

    for (const post of posts) {
      await insertPost(feedId, post);
    }

    // Create a request with developer mode enabled
    const devModeEnv = {
      ...env,
      DEVELOPER_MODE: 'enabled',
    };

    const request = new Request(`${BASE_URL}${ENDPOINT_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feed: dummyFeed.uri, remain: 3 }),
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, devModeEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const json = (await response.json()) as TrimFeedResponse;
    expect(json.message).toBe('Posts trimed successfully');
    expect(json.deletedCount).toBe(2);
  });

  it('keeps most recent posts when trimming', async () => {
    const feedId = await insertFeed(dummyFeed);
    const now = new Date();
    const posts = [
      {
        id: 1,
        uri: 'at://did:plc:testuser/app.bsky.post/old',
        cid: 'cid-old',
        indexedAt: new Date(now.getTime() - 1000000).toISOString(),
        langs: ['en'],
      },
      {
        id: 2,
        uri: 'at://did:plc:testuser/app.bsky.post/new',
        cid: 'cid-new',
        indexedAt: now.toISOString(),
        langs: ['en'],
      },
    ];

    for (const post of posts) {
      await insertPost(feedId, post);
    }

    const { response } = await trimFeed(dummyFeed.uri, 1);
    assertValidResponse(response);

    // Verify only the newest post remains
    const db = env.DB;
    const { results } = await db
      .prepare('SELECT uri FROM posts WHERE feed_id = ?')
      .bind(feedId)
      .all();
    expect(results).toHaveLength(1);
    expect(results[0].uri).toBe(posts[1].uri);
  });
});
