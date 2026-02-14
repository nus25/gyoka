import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/index';

const BASE_URL = 'http://localhost:8787';
const ENDPOINT_PATH = '/api/feed/batchRemovePosts';

const dummyFeed1 = {
  uri: 'at://did:plc:testuser1/app.bsky.feed.generator/test-feed-1',
  is_active: 1,
};

const dummyFeed2 = {
  uri: 'at://did:plc:testuser2/app.bsky.feed.generator/test-feed-2',
  is_active: 1,
};

const dummyPost1 = {
  id: 1,
  uri: 'at://did:plc:author1/app.bsky.feed.post/test-post-1',
  cid: 'bafyreia3tbsfxe3cc6qxibc2pj4tcmxqyxupz3hajxuepz4g5qkdqxnx6y',
  indexedAt: new Date('2024-01-15T12:00:00Z').toISOString(),
  langs: ['en'],
};

const dummyPost2 = {
  id: 2,
  uri: 'at://did:plc:author2/app.bsky.feed.post/test-post-2',
  cid: 'bafyreibcd456example789cid012xyz123456789012345678901234567890',
  indexedAt: new Date('2024-01-15T13:00:00Z').toISOString(),
  langs: ['ja'],
};

const dummyPost3 = {
  id: 3,
  uri: 'at://did:plc:author3/app.bsky.feed.post/test-post-3',
  cid: 'bafyreicde789example012cid345xyz123456789012345678901234567890',
  indexedAt: new Date('2024-01-15T14:00:00Z').toISOString(),
  langs: ['en', 'ja'],
};

interface BatchRemovePostsResultItem {
  uri: string;
  status: 'removed' | 'error';
  error?: string;
}

interface BatchRemovePostsResult {
  feed: string;
  results: BatchRemovePostsResultItem[];
}

interface BatchRemovePostsResponse {
  results?: BatchRemovePostsResult[];
  error?: string;
  message?: string;
}

// request helper
async function batchRemovePosts(entries: any[]) {
  const request = new Request(`${BASE_URL}${ENDPOINT_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ entries }),
  });
  const ctx = createExecutionContext();
  const response = await app.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  const json = (await response.json()) as BatchRemovePostsResponse;
  return { response, json };
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

async function verifyPostExists(uri: string, indexedAt?: string): Promise<boolean> {
  const db = env.DB;
  let query = 'SELECT 1 FROM posts WHERE uri = ?';
  const bindings: any[] = [uri];

  if (indexedAt) {
    query += ' AND indexed_at = ?';
    bindings.push(indexedAt);
  }

  const { results } = await db
    .prepare(query)
    .bind(...bindings)
    .all();
  return results.length > 0;
}

async function verifyPostLanguagesExist(postId: number): Promise<boolean> {
  const db = env.DB;
  const { results } = await db
    .prepare('SELECT 1 FROM post_languages WHERE post_id = ?')
    .bind(postId)
    .all();
  return results.length > 0;
}

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    const db = env.DB;
    await db.prepare('DELETE FROM posts').run();
    await db.prepare('DELETE FROM post_languages').run();
    await db.prepare('DELETE FROM feeds').run();
  });

  it('removes multiple posts from multiple feeds successfully', async () => {
    const feedId1 = await insertFeed(dummyFeed1);
    const feedId2 = await insertFeed(dummyFeed2);
    await insertPost(feedId1, dummyPost1);
    await insertPost(feedId1, dummyPost2);
    await insertPost(feedId2, dummyPost3);

    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [
          { uri: dummyPost1.uri, indexedAt: dummyPost1.indexedAt },
          { uri: dummyPost2.uri, indexedAt: dummyPost2.indexedAt },
        ],
      },
      {
        feed: dummyFeed2.uri,
        posts: [{ uri: dummyPost3.uri, indexedAt: dummyPost3.indexedAt }],
      },
    ];

    const { response, json } = await batchRemovePosts(entries);
    assertValidResponse(response);

    expect(json.results).toHaveLength(2);
    expect(json.results![0].feed).toBe(dummyFeed1.uri);
    expect(json.results![0].results).toHaveLength(2);
    expect(json.results![0].results[0].status).toBe('removed');
    expect(json.results![0].results[0].uri).toBe(dummyPost1.uri);
    expect(json.results![0].results[1].status).toBe('removed');
    expect(json.results![0].results[1].uri).toBe(dummyPost2.uri);

    expect(json.results![1].feed).toBe(dummyFeed2.uri);
    expect(json.results![1].results).toHaveLength(1);
    expect(json.results![1].results[0].status).toBe('removed');
    expect(json.results![1].results[0].uri).toBe(dummyPost3.uri);

    // Verify posts were removed from database
    expect(await verifyPostExists(dummyPost1.uri)).toBe(false);
    expect(await verifyPostExists(dummyPost2.uri)).toBe(false);
    expect(await verifyPostExists(dummyPost3.uri)).toBe(false);
  });

  it('groups entries by feed and reduces database queries', async () => {
    const feedId1 = await insertFeed(dummyFeed1);
    await insertPost(feedId1, dummyPost1);
    await insertPost(feedId1, dummyPost2);
    await insertPost(feedId1, dummyPost3);

    // Same feed appears multiple times
    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [{ uri: dummyPost1.uri, indexedAt: dummyPost1.indexedAt }],
      },
      {
        feed: dummyFeed1.uri,
        posts: [{ uri: dummyPost2.uri, indexedAt: dummyPost2.indexedAt }],
      },
      {
        feed: dummyFeed1.uri,
        posts: [{ uri: dummyPost3.uri, indexedAt: dummyPost3.indexedAt }],
      },
    ];

    const { response, json } = await batchRemovePosts(entries);
    assertValidResponse(response);

    // All entries should be returned in the same order
    expect(json.results).toHaveLength(3);
    expect(json.results![0].feed).toBe(dummyFeed1.uri);
    expect(json.results![1].feed).toBe(dummyFeed1.uri);
    expect(json.results![2].feed).toBe(dummyFeed1.uri);

    // Each entry should only contain its corresponding post result
    expect(json.results![0].results).toHaveLength(1);
    expect(json.results![0].results[0].uri).toBe(dummyPost1.uri);
    expect(json.results![0].results[0].status).toBe('removed');

    expect(json.results![1].results).toHaveLength(1);
    expect(json.results![1].results[0].uri).toBe(dummyPost2.uri);
    expect(json.results![1].results[0].status).toBe('removed');

    expect(json.results![2].results).toHaveLength(1);
    expect(json.results![2].results[0].uri).toBe(dummyPost3.uri);
    expect(json.results![2].results[0].status).toBe('removed');

    // All posts should be removed
    expect(await verifyPostExists(dummyPost1.uri)).toBe(false);
    expect(await verifyPostExists(dummyPost2.uri)).toBe(false);
    expect(await verifyPostExists(dummyPost3.uri)).toBe(false);
  });

  it('handles exceeding max batch posts limit', async () => {
    await insertFeed(dummyFeed1);
    await insertFeed(dummyFeed2);

    // Create 26 posts to exceed the limit (default is 25)
    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: Array.from({ length: 13 }, (_, i) => ({
          uri: `at://did:plc:author${i}/app.bsky.feed.post/test-post-${i}`,
          indexedAt: new Date(Date.UTC(2024, 0, 15, 12 + i, 0, 0)).toISOString(),
        })),
      },
      {
        feed: dummyFeed2.uri,
        posts: Array.from({ length: 13 }, (_, i) => ({
          uri: `at://did:plc:author${i + 13}/app.bsky.feed.post/test-post-${i + 13}`,
          indexedAt: new Date(Date.UTC(2024, 0, 15, 12 + i + 13, 0, 0)).toISOString(),
        })),
      },
    ];

    const { response, json } = await batchRemovePosts(entries);
    expect(response.status).toBe(400);
    expect(json.error).toBe('BadRequest');
    expect(json.message).toContain('Maximum 25 posts allowed per request. Received 26 posts.');
  });

  it('returns error when an entry has no posts', async () => {
    await insertFeed(dummyFeed1);

    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [],
      },
    ];

    const { response, json } = await batchRemovePosts(entries);
    expect(response.status).toBe(400);
    expect(json.error).toBe('BadRequest');
    expect(json.message).toContain(
      `[{"message":"Too small: expected array to have >=1 items","path":["body","entries",0,"posts"]}]`
    );
  });

  it('handles partial success when some feeds do not exist', async () => {
    const feedId1 = await insertFeed(dummyFeed1);
    await insertPost(feedId1, dummyPost1);
    // dummyFeed2 is not inserted

    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [{ uri: dummyPost1.uri, indexedAt: dummyPost1.indexedAt }],
      },
      {
        feed: dummyFeed2.uri,
        posts: [{ uri: dummyPost2.uri, indexedAt: dummyPost2.indexedAt }],
      },
    ];

    const { response, json } = await batchRemovePosts(entries);
    assertValidResponse(response);

    expect(json.results).toHaveLength(2);
    expect(json.results![0].feed).toBe(dummyFeed1.uri);
    expect(json.results![0].results[0].status).toBe('removed');

    expect(json.results![1].feed).toBe(dummyFeed2.uri);
    expect(json.results![1].results[0].status).toBe('error');
    expect(json.results![1].results[0].error).toContain('does not exist');

    // Only post from feed1 should be removed
    expect(await verifyPostExists(dummyPost1.uri)).toBe(false);
  });

  it('handles partial success when some posts do not exist', async () => {
    const feedId1 = await insertFeed(dummyFeed1);
    await insertPost(feedId1, dummyPost1);
    await insertPost(feedId1, dummyPost3);
    // dummyPost2 is not inserted

    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [
          { uri: dummyPost1.uri, indexedAt: dummyPost1.indexedAt },
          { uri: dummyPost2.uri, indexedAt: dummyPost2.indexedAt },
          { uri: dummyPost3.uri, indexedAt: dummyPost3.indexedAt },
        ],
      },
    ];

    const { response, json } = await batchRemovePosts(entries);
    assertValidResponse(response);

    expect(json.results).toHaveLength(1);
    expect(json.results![0].results).toHaveLength(3);
    expect(json.results![0].results[0].status).toBe('removed');
    expect(json.results![0].results[0].uri).toBe(dummyPost1.uri);
    expect(json.results![0].results[1].status).toBe('error');
    expect(json.results![0].results[1].uri).toBe(dummyPost2.uri);
    expect(json.results![0].results[1].error).toBe('Post not found in feed');
    expect(json.results![0].results[2].status).toBe('removed');
    expect(json.results![0].results[2].uri).toBe(dummyPost3.uri);

    // Only existing posts should be removed
    expect(await verifyPostExists(dummyPost1.uri)).toBe(false);
    expect(await verifyPostExists(dummyPost3.uri)).toBe(false);
  });

  it('handles all posts failing when all feeds do not exist', async () => {
    const nonExistentFeed = 'at://did:plc:nonexistent/app.bsky.feed.generator/fake';

    const entries = [
      {
        feed: nonExistentFeed,
        posts: [
          { uri: dummyPost1.uri, indexedAt: dummyPost1.indexedAt },
          { uri: dummyPost2.uri, indexedAt: dummyPost2.indexedAt },
        ],
      },
    ];

    const { response, json } = await batchRemovePosts(entries);
    assertValidResponse(response);

    expect(json.results).toHaveLength(1);
    expect(json.results![0].results).toHaveLength(2);
    expect(json.results![0].results[0].status).toBe('error');
    expect(json.results![0].results[1].status).toBe('error');
  });

  it('removes posts without indexedAt (wildcard deletion)', async () => {
    const feedId1 = await insertFeed(dummyFeed1);
    await insertPost(feedId1, dummyPost1);

    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [{ uri: dummyPost1.uri }], // No indexedAt specified
      },
    ];

    const { response, json } = await batchRemovePosts(entries);
    assertValidResponse(response);

    expect(json.results![0].results[0].status).toBe('removed');
    expect(await verifyPostExists(dummyPost1.uri)).toBe(false);
  });

  it('removes posts with specific indexedAt', async () => {
    const feedId1 = await insertFeed(dummyFeed1);
    await insertPost(feedId1, dummyPost1);

    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [{ uri: dummyPost1.uri, indexedAt: dummyPost1.indexedAt }],
      },
    ];

    const { response, json } = await batchRemovePosts(entries);
    assertValidResponse(response);

    expect(json.results![0].results[0].status).toBe('removed');
    expect(await verifyPostExists(dummyPost1.uri, dummyPost1.indexedAt)).toBe(false);
  });

  it('handles post not found with wrong indexedAt', async () => {
    const feedId1 = await insertFeed(dummyFeed1);
    await insertPost(feedId1, dummyPost1);

    const wrongDate = new Date();
    wrongDate.setFullYear(wrongDate.getFullYear() - 1);

    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [{ uri: dummyPost1.uri, indexedAt: wrongDate.toISOString() }],
      },
    ];

    const { response, json } = await batchRemovePosts(entries);
    assertValidResponse(response);

    expect(json.results![0].results[0].status).toBe('error');
    expect(json.results![0].results[0].error).toBe('Post not found in feed');

    // Post should still exist
    expect(await verifyPostExists(dummyPost1.uri, dummyPost1.indexedAt)).toBe(true);
  });

  it('handles duplicate removal requests', async () => {
    const feedId1 = await insertFeed(dummyFeed1);
    await insertPost(feedId1, dummyPost1);

    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [
          { uri: dummyPost1.uri, indexedAt: dummyPost1.indexedAt },
          { uri: dummyPost1.uri, indexedAt: dummyPost1.indexedAt }, // Duplicate
        ],
      },
    ];

    const { response, json } = await batchRemovePosts(entries);
    assertValidResponse(response);

    // First should succeed, second should fail (post already removed)
    expect(json.results![0].results).toHaveLength(2);
    expect(json.results![0].results[0].status).toBe('removed');
    expect(json.results![0].results[1].status).toBe('removed'); // Both marked as removed since existence check passes
  });

  it('verifies cascade deletion of post_languages', async () => {
    const feedId1 = await insertFeed(dummyFeed1);
    await insertPost(feedId1, dummyPost1);

    // Verify post_languages exist before deletion
    expect(await verifyPostLanguagesExist(dummyPost1.id)).toBe(true);

    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [{ uri: dummyPost1.uri, indexedAt: dummyPost1.indexedAt }],
      },
    ];

    const { response, json } = await batchRemovePosts(entries);
    assertValidResponse(response);

    expect(json.results![0].results[0].status).toBe('removed');

    // Verify post_languages were cascade deleted
    expect(await verifyPostLanguagesExist(dummyPost1.id)).toBe(false);
  });

  it('maintains order of results', async () => {
    const feedId1 = await insertFeed(dummyFeed1);
    await insertPost(feedId1, dummyPost1);
    await insertPost(feedId1, dummyPost3);

    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [
          { uri: dummyPost3.uri, indexedAt: dummyPost3.indexedAt },
          { uri: dummyPost2.uri, indexedAt: dummyPost2.indexedAt }, // Doesn't exist
          { uri: dummyPost1.uri, indexedAt: dummyPost1.indexedAt },
        ],
      },
    ];

    const { response, json } = await batchRemovePosts(entries);
    assertValidResponse(response);

    // Results should maintain input order
    expect(json.results![0].results).toHaveLength(3);
    expect(json.results![0].results[0].uri).toBe(dummyPost3.uri);
    expect(json.results![0].results[0].status).toBe('removed');
    expect(json.results![0].results[1].uri).toBe(dummyPost2.uri);
    expect(json.results![0].results[1].status).toBe('error');
    expect(json.results![0].results[2].uri).toBe(dummyPost1.uri);
    expect(json.results![0].results[2].status).toBe('removed');
  });

  it('processes large batch within limits', async () => {
    const feedId1 = await insertFeed(dummyFeed1);

    // Create 25 posts (at the limit)
    const posts = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      uri: `at://did:plc:author${i}/app.bsky.feed.post/test-post-${i}`,
      cid: `bafyreia${i.toString().padStart(50, '0')}`,
      indexedAt: new Date(Date.UTC(2024, 0, 15, 12 + i, 0, 0)).toISOString(),
      langs: ['en'],
    }));

    for (const post of posts) {
      await insertPost(feedId1, post);
    }

    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: posts.map((p) => ({ uri: p.uri, indexedAt: p.indexedAt })),
      },
    ];

    const { response, json } = await batchRemovePosts(entries);
    assertValidResponse(response);

    expect(json.results![0].results).toHaveLength(25);
    expect(json.results![0].results.every((r) => r.status === 'removed')).toBe(true);

    // Verify all posts removed
    const db = env.DB;
    const { results } = await db
      .prepare('SELECT * FROM posts WHERE feed_id = ?')
      .bind(feedId1)
      .all();
    expect(results.length).toBe(0);
  });

  it('handles invalid feed URI format', async () => {
    const entries = [
      {
        feed: 'invalid-uri',
        posts: [{ uri: dummyPost1.uri }],
      },
    ];

    const { response, json } = await batchRemovePosts(entries);
    expect(response.status).toBe(400);
    expect(json.error).toBe('BadRequest');
  });

  it('handles invalid post URI format', async () => {
    await insertFeed(dummyFeed1);

    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [{ uri: 'invalid-uri' }],
      },
    ];

    const { response, json } = await batchRemovePosts(entries);
    expect(response.status).toBe(400);
    expect(json.error).toBe('BadRequest');
  });

  it('handles db batch insert errors gracefully', async () => {
    const mockDb = {
      prepare: (query: string) => ({
        bind: (...args: any[]) => ({
          all: async () => {
            if (query.includes('SELECT feed_id, feed_uri FROM feeds')) {
              return {
                success: true,
                results: [{ feed_id: 1, feed_uri: dummyFeed1.uri }],
              };
            }
            if (query.includes('SELECT uri, indexed_at FROM posts')) {
              return {
                success: true,
                results: [{ uri: dummyPost1.uri, indexed_at: dummyPost1.indexedAt }],
              };
            }
            return { success: true, results: [] };
          },
          run: async () => ({ success: true, meta: { changed_db: 1 } }),
        }),
      }),
      batch: async () => {
        throw new Error('Batch delete failed');
      },
    };

    const mockEnv = { ...env, DB: mockDb };

    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [{ uri: dummyPost1.uri, indexedAt: dummyPost1.indexedAt }],
      },
    ];

    const request = new Request(`${BASE_URL}${ENDPOINT_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries }),
    });

    const ctx = createExecutionContext();
    const response = await app.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const json = (await response.json()) as BatchRemovePostsResponse;
    expect(json.results).toBeDefined();
    expect(json.results![0].results[0].status).toBe('error');
    expect(json.results![0].results[0].error).toBe('Failed to remove post from DB'); // D1 error message is not propagated
  });
});
