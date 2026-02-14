import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/index';

const BASE_URL = 'http://localhost:8787';
const ENDPOINT_PATH = '/api/feed/removePostByAuthor';

const dummyFeed = {
  uri: 'at://did:plc:testuser/app.bsky.feed.generator/test-feed',
  is_active: 1,
};

const author1Did = 'did:plc:author1';
const author2Did = 'did:plc:author2';

const dummyPosts = [
  {
    id: 1,
    uri: `at://${author1Did}/app.bsky.feed.post/post1`,
    cid: 'bafyreia3tbsfxe3cc6qxibc2pj4tcmxqyxupz3hajxuepz4g5qkdqxnx6y',
    indexedAt: new Date().toISOString(),
    langs: ['en'],
  },
  {
    id: 2,
    uri: `at://${author1Did}/app.bsky.feed.post/post2`,
    cid: 'bafyreia4ubsfxe3cc6qxibc2pj4tcmxqyxupz3hajxuepz4g5qkdqxnx7z',
    indexedAt: new Date().toISOString(),
    langs: ['ja'],
  },
  {
    id: 3,
    uri: `at://${author2Did}/app.bsky.feed.post/post3`,
    cid: 'bafyreia5vcsfxe3cc6qxibc2pj4tcmxqyxupz3hajxuepz4g5qkdqxnx8a',
    indexedAt: new Date().toISOString(),
    langs: ['en', 'ja'],
  },
];

interface RemovePostByAuthorResponse {
  message: string;
  feed: string;
  author: string;
  deletedCount: number;
}

interface ErrorResponse {
  error: string;
  message: string;
}

// request helper
async function removePostByAuthor(feed: string, author: string) {
  const request = new Request(`${BASE_URL}${ENDPOINT_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ feed, author }),
  });
  const ctx = createExecutionContext();
  const response = await app.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return {
    response,
    json: (await response.json()) as RemovePostByAuthorResponse | ErrorResponse,
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

async function countPostsByAuthor(did: string): Promise<number> {
  const db = env.DB;
  const { results } = await db
    .prepare('SELECT COUNT(*) as count FROM posts WHERE did = ?')
    .bind(did)
    .all();
  return (results[0] as { count: number }).count;
}

async function countTotalPosts(): Promise<number> {
  const db = env.DB;
  const { results } = await db.prepare('SELECT COUNT(*) as count FROM posts').all();
  return (results[0] as { count: number }).count;
}

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    const db = env.DB;
    await db.prepare('DELETE FROM posts').run();
    await db.prepare('DELETE FROM post_languages').run();
    await db.prepare('DELETE FROM feeds').run();
  });

  it('removes all posts by a specific author', async () => {
    const feedId = await insertFeed(dummyFeed);
    await insertPost(feedId, dummyPosts[0]);
    await insertPost(feedId, dummyPosts[1]);
    await insertPost(feedId, dummyPosts[2]);

    const { response, json } = await removePostByAuthor(dummyFeed.uri, author1Did);
    assertValidResponse(response);
    expect(json).toEqual({
      message: 'Posts by author removed successfully',
      feed: dummyFeed.uri,
      author: author1Did,
      deletedCount: 2,
    });

    // Verify author1's posts were removed
    const author1Count = await countPostsByAuthor(author1Did);
    expect(author1Count).toBe(0);

    // Verify author2's posts still exist
    const author2Count = await countPostsByAuthor(author2Did);
    expect(author2Count).toBe(1);

    // Verify total posts count
    const totalCount = await countTotalPosts();
    expect(totalCount).toBe(1);
  });

  it('returns deletedCount of 0 when author has no posts in feed', async () => {
    const feedId = await insertFeed(dummyFeed);
    await insertPost(feedId, dummyPosts[2]); // Only author2's post

    const { response, json } = await removePostByAuthor(dummyFeed.uri, author1Did);
    assertValidResponse(response);
    expect(json).toEqual({
      message: 'Posts by author removed successfully',
      feed: dummyFeed.uri,
      author: author1Did,
      deletedCount: 0,
    });

    // Verify no posts were removed
    const totalCount = await countTotalPosts();
    expect(totalCount).toBe(1);
  });

  it('does not remove posts if author DID matches partially', async () => {
    const feedId = await insertFeed(dummyFeed);
    // Insert a post with a similar but not identical DID
    await insertPost(feedId, {
      ...dummyPosts[0],
      id: 4,
      uri: `at://did:plc:author1extra/app.bsky.feed.post/post4`,
    });

    const { response, json } = await removePostByAuthor(dummyFeed.uri, author1Did);
    assertValidResponse(response);
    expect((json as RemovePostByAuthorResponse).deletedCount).toBe(0);

    // The post should still exist
    const totalCount = await countTotalPosts();
    expect(totalCount).toBe(1);
  });

  it('removes posts only from the specified feed even if author has posts in other feeds', async () => {
    const feed1Id = await insertFeed(dummyFeed);
    const feed2Uri = 'at://did:plc:testuser/app.bsky.feed.generator/other-feed';
    const feed2Id = await insertFeed({ uri: feed2Uri, is_active: 1 });

    // Insert author1's post in both feeds
    await insertPost(feed1Id, { ...dummyPosts[0], id: 5 });
    await insertPost(feed2Id, { ...dummyPosts[0], id: 6 });

    const { response, json } = await removePostByAuthor(dummyFeed.uri, author1Did);
    assertValidResponse(response);
    expect((json as RemovePostByAuthorResponse).deletedCount).toBe(1);

    // Only the post in feed2 should remain
    const author1Count = await countPostsByAuthor(author1Did);
    expect(author1Count).toBe(1);
  });

  it('handles non-existent feed', async () => {
    const { response, json } = await removePostByAuthor(
      'at://did:plc:nonexistent/app.bsky.feed.generator/feed',
      author1Did
    );
    expect(response.status).toBe(404);
    expect((json as ErrorResponse).error).toBe('UnknownFeed');
  });

  it('handles invalid feed URI', async () => {
    const { response, json } = await removePostByAuthor('invalid-uri', author1Did);
    expect(response.status).toBe(400);
    expect((json as ErrorResponse).error).toBe('BadRequest');
  });

  it('handles invalid author DID', async () => {
    await insertFeed(dummyFeed);

    const { response, json } = await removePostByAuthor(dummyFeed.uri, 'invalid-did');
    expect(response.status).toBe(400);
    expect((json as ErrorResponse).error).toBe('BadRequest');
  });

  it('only removes posts from the specified feed', async () => {
    // Create two feeds
    const feed1Id = await insertFeed(dummyFeed);
    const feed2Uri = 'at://did:plc:testuser/app.bsky.feed.generator/test-feed-2';
    const feed2Id = await insertFeed({ uri: feed2Uri, is_active: 1 });

    // Add author1's posts to both feeds
    await insertPost(feed1Id, dummyPosts[0]);
    await insertPost(feed2Id, {
      ...dummyPosts[0],
      id: 10,
    });

    const { response, json } = await removePostByAuthor(dummyFeed.uri, author1Did);
    assertValidResponse(response);
    expect((json as RemovePostByAuthorResponse).deletedCount).toBe(1);

    // Verify posts still exist in feed2
    const totalCount = await countTotalPosts();
    expect(totalCount).toBe(1);
  });

  it('handles database errors gracefully', async () => {
    await insertFeed(dummyFeed);
    const db = env.DB;
    await db.prepare('DROP TABLE posts').run(); // Simulate a database error

    const { response } = await removePostByAuthor(dummyFeed.uri, author1Did);
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
            run: async () => ({ success: true, meta: { changes: 0 } }),
          }),
        };
      },
    };

    // Create a custom environment with the mock database
    const mockEnv = { ...env, DB: mockDb };

    const request = new Request(`${BASE_URL}${ENDPOINT_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feed: dummyFeed.uri, author: author1Did }),
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
      body: JSON.stringify({ feed: dummyFeed.uri, author: author1Did }),
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(500);
    const json = (await response.json()) as ErrorResponse;
    expect(json.error).toBe('InternalServerError');
    expect(json.message).toBe('Failed to remove posts from the database');
  });

  it('removes posts with different languages and timestamps', async () => {
    const feedId = await insertFeed(dummyFeed);
    // Add multiple posts from author1 with different characteristics
    const post1 = { ...dummyPosts[0], id: 1, langs: ['en'] };
    const post2 = {
      ...dummyPosts[1],
      id: 2,
      langs: ['ja', 'ko'],
      indexedAt: new Date(Date.now() - 86400000).toISOString(),
    };
    const post3 = {
      ...dummyPosts[0],
      id: 3,
      uri: `at://${author1Did}/app.bsky.feed.post/post3`,
      indexedAt: new Date(Date.now() - 172800000).toISOString(),
    };

    await insertPost(feedId, post1);
    await insertPost(feedId, post2);
    await insertPost(feedId, post3);

    const { response, json } = await removePostByAuthor(dummyFeed.uri, author1Did);
    assertValidResponse(response);
    expect((json as RemovePostByAuthorResponse).deletedCount).toBe(3);

    // Verify all author1's posts were removed
    const author1Count = await countPostsByAuthor(author1Did);
    expect(author1Count).toBe(0);
  });
});
