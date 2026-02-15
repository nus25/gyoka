import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ErrorResponse } from 'shared/src/types';
import { assertErrorResponse, clearTables, expectJsonResponse, requestJson } from './testUtils';

const ENDPOINT_PATH = '/api/feed/getPosts';

const dummyFeed = {
  uri: 'at://did:plc:testuser/app.bsky.feed.generator/test-feed',
  is_active: 1,
};

// request helper
interface GetPostsResponse {
  posts: Array<{
    uri: string;
    cid: string;
    langs: string[];
    indexedAt: string;
  }>;
  cursor?: string;
}

function assertGetPostsResponse(
  response: GetPostsResponse | ErrorResponse
): asserts response is GetPostsResponse {
  expect(response).toHaveProperty('posts');
}

async function getPosts(
  feed: string,
  limit?: number,
  cursor?: string,
  envOverrides?: Partial<Env>
) {
  const params = new URLSearchParams({ feed });
  if (limit) params.set('limit', limit.toString());
  if (cursor) params.set('cursor', cursor);

  return requestJson<GetPostsResponse | ErrorResponse>({
    path: `${ENDPOINT_PATH}?${params.toString()}`,
    envOverrides,
  });
}

// response validation helper
function assertValidResponse(response: Response) {
  expectJsonResponse(response);
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

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await clearTables(['posts', 'post_languages', 'feeds']);
  });

  it('returns posts with default limit', async () => {
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

    const { response, json } = await getPosts(dummyFeed.uri);
    assertValidResponse(response);
    assertGetPostsResponse(json);
    expect(json.posts).toHaveLength(5);
    expect(json.posts[0].uri).toBe(posts[4].uri); // Latest post first
  });

  it('handles pagination with cursor', async () => {
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

    // Get first page
    const { json: firstPage } = await getPosts(dummyFeed.uri, 5);
    assertGetPostsResponse(firstPage);
    expect(firstPage.posts).toHaveLength(5);
    expect(firstPage.cursor).toBeDefined();

    // Get second page
    const { json: secondPage } = await getPosts(dummyFeed.uri, 6, firstPage.cursor);
    assertGetPostsResponse(secondPage);
    expect(secondPage.posts).toHaveLength(5);
    expect(secondPage.cursor).toBeUndefined(); // No more pages

    // Verify order
    const allPosts = [...firstPage.posts, ...secondPage.posts];
    expect(allPosts.map((p) => p.uri)).toEqual(posts.reverse().map((p) => p.uri));
  });

  it('respects custom limit', async () => {
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

    const { json } = await getPosts(dummyFeed.uri, 3);
    assertGetPostsResponse(json);
    expect(json.posts).toHaveLength(3);
  });

  it('returns empty array for feed with no posts', async () => {
    await insertFeed(dummyFeed);
    const { response, json } = await getPosts(dummyFeed.uri);
    assertValidResponse(response);
    assertGetPostsResponse(json);
    expect(json.posts).toEqual([]);
    expect(json.cursor).toBeUndefined();
  });

  it('handles invalid feed URI', async () => {
    const { response, json } = await getPosts('invalid-uri');
    expect(response.status).toBe(400);
    assertErrorResponse(json);
    expect(json.error).toBe('BadRequest');
    expect(json.message).toContain('Invalid AT Protocol URI format');
  });

  it('handles non-existent feed', async () => {
    const feedUri = 'at://did:plc:nonexistent/app.bsky.feed.generator/feed';
    const { response, json } = await getPosts(feedUri);
    expect(response.status).toBe(404);
    assertErrorResponse(json);
    expect(json.error).toBe('UnknownFeed');
    expect(json.message).toContain('does not exist');
    expect(json.message).toContain(feedUri);
  });

  it('handles malformed cursor', async () => {
    await insertFeed(dummyFeed);
    const { response } = await getPosts(dummyFeed.uri, undefined, 'invalid-cursor');
    expect(response.status).toBe(400);
  });

  it('returns posts with correct language grouping', async () => {
    const feedId = await insertFeed(dummyFeed);
    const post = {
      id: 1,
      uri: 'at://did:plc:testuser/app.bsky.post/test',
      cid: 'test-cid',
      indexedAt: new Date().toISOString(),
      langs: ['en', 'ja', 'fr'],
    };

    await insertPost(feedId, post);

    const { json } = await getPosts(dummyFeed.uri);
    assertGetPostsResponse(json);
    expect(json.posts).toHaveLength(1);
    expect(json.posts[0].langs).toEqual(expect.arrayContaining(['en', 'ja', 'fr']));
  });

  it('handles database errors gracefully', async () => {
    await insertFeed(dummyFeed);
    const db = env.DB;
    await db.prepare('DROP TABLE posts').run(); // Simulate a database error

    const { response } = await getPosts(dummyFeed.uri);
    expect(response.status).toBe(500);
  });

  it('returns InternalServerError when feed existence query fails', async () => {
    const failingFeedCheckEnv: Partial<Env> = {
      DB: {
        prepare: () => ({
          bind: () => ({
            all: async () => ({ success: false, results: [] }),
          }),
        }),
      } as unknown as D1Database,
    };

    const { response, json } = await getPosts(dummyFeed.uri, undefined, undefined, failingFeedCheckEnv);

    expect(response.status).toBe(500);
    assertErrorResponse(json);
    expect(json.error).toBe('InternalServerError');
    expect(json.message).toContain('Failed to query the database');
  });

  it('returns InternalServerError when posts query fails', async () => {
    let queryCount = 0;
    const failingPostsQueryEnv: Partial<Env> = {
      DB: {
        prepare: () => ({
          bind: () => ({
            all: async () => {
              queryCount += 1;
              if (queryCount === 1) {
                return {
                  success: true,
                  results: [{ feed_id: 1 }],
                };
              }
              return { success: false, results: [] };
            },
          }),
        }),
      } as unknown as D1Database,
    };

    const { response, json } = await getPosts(dummyFeed.uri, undefined, undefined, failingPostsQueryEnv);

    expect(response.status).toBe(500);
    assertErrorResponse(json);
    expect(json.error).toBe('InternalServerError');
    expect(json.message).toContain('Failed to fetch posts');
  });

  it('handles developer mode logging', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await insertFeed(dummyFeed);

    const { response: disabledResponse } = await getPosts(dummyFeed.uri, 10, undefined, {
      DEVELOPER_MODE: undefined,
    });
    expect(disabledResponse.status).toBe(200);
    expect(logSpy).not.toHaveBeenCalled();

    logSpy.mockClear();

    const { response: enabledResponse } = await getPosts(dummyFeed.uri, 10, undefined, {
      DEVELOPER_MODE: 'enabled',
    });
    expect(enabledResponse.status).toBe(200);
    expect(logSpy).toHaveBeenCalledWith('Generated query:', expect.any(String));
    expect(logSpy).toHaveBeenCalledWith('Bindings:', expect.any(Array));

    logSpy.mockRestore();
  });
});
