import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { All_LANGS } from 'shared/src/constants';
import { clearTables, expectJsonResponse, requestJson } from './testUtils';

const ENDPOINT_PATH = '/api/feed/batchAddPosts';

const dummyFeed1 = {
  uri: 'at://did:plc:testuser1/app.bsky.feed.generator/test-feed-1',
  is_active: 1,
};

const dummyFeed2 = {
  uri: 'at://did:plc:testuser2/app.bsky.feed.generator/test-feed-2',
  is_active: 1,
};

const dummyPost1 = {
  uri: 'at://did:plc:author1/app.bsky.feed.post/test-post-1',
  cid: 'bafyreia3tbsfxe3cc6qxibc2pj4tcmxqyxupz3hajxuepz4g5qkdqxnx6y',
  languages: ['en'],
  indexedAt: new Date('2024-01-15T12:00:00Z').toISOString(),
};

const dummyPost2 = {
  uri: 'at://did:plc:author2/app.bsky.feed.post/test-post-2',
  cid: 'bafyreibcd456example789cid012xyz123456789012345678901234567890',
  languages: ['ja'],
  indexedAt: new Date('2024-01-15T13:00:00Z').toISOString(),
};

const dummyPost3 = {
  uri: 'at://did:plc:author3/app.bsky.feed.post/test-post-3',
  cid: 'bafyreicde789example012cid345xyz123456789012345678901234567890',
  languages: ['en', 'ja'],
  indexedAt: new Date('2024-01-15T14:00:00Z').toISOString(),
};

type BatchAddPostsResultItem = {
  status: 'added' | 'error';
  uri?: string;
  error?: string;
};

type BatchAddPostsResult = {
  feed: string;
  results: BatchAddPostsResultItem[];
};

type BatchAddPostsResponse = {
  results?: BatchAddPostsResult[];
  error?: string;
  message?: string;
};

// request helper
async function batchAddPosts(entries: any[], envOverrides?: Partial<Env>) {
  return requestJson<BatchAddPostsResponse>({
    path: ENDPOINT_PATH,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ entries }),
    },
    envOverrides,
  });
}

// response validation helper
function assertValidResponse(response: Response) {
  expectJsonResponse(response);
}

// database helper
async function insertFeed(feed: { uri: string; is_active: number }) {
  const db = env.DB;
  await db
    .prepare('INSERT INTO feeds (feed_uri, is_active) VALUES (?, ?)')
    .bind(feed.uri, feed.is_active)
    .run();
}

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await clearTables(['posts', 'post_languages', 'feeds']);
  });

  it('adds multiple posts to multiple feeds successfully', async () => {
    await insertFeed(dummyFeed1);
    await insertFeed(dummyFeed2);

    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [dummyPost1, dummyPost2],
      },
      {
        feed: dummyFeed2.uri,
        posts: [dummyPost3],
      },
    ];

    const { response, json } = await batchAddPosts(entries);
    assertValidResponse(response);

    expect(json.results).toHaveLength(2);
    expect(json.results[0].feed).toBe(dummyFeed1.uri);
    expect(json.results[0].results).toHaveLength(2);
    expect(json.results[0].results[0].status).toBe('added');
    expect(json.results[0].results[0].uri).toBe(dummyPost1.uri);
    expect(json.results[0].results[1].status).toBe('added');
    expect(json.results[0].results[1].uri).toBe(dummyPost2.uri);

    expect(json.results[1].feed).toBe(dummyFeed2.uri);
    expect(json.results[1].results).toHaveLength(1);
    expect(json.results[1].results[0].status).toBe('added');
    expect(json.results[1].results[0].uri).toBe(dummyPost3.uri);

    // Verify database state
    const db = env.DB;
    const { results: posts } = await db.prepare('SELECT * FROM posts').all();
    expect(posts.length).toBe(3);
  });

  it('groups entries by feed and reduces database queries', async () => {
    await insertFeed(dummyFeed1);

    // Same feed appears multiple times
    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [dummyPost1],
      },
      {
        feed: dummyFeed1.uri,
        posts: [dummyPost2],
      },
      {
        feed: dummyFeed1.uri,
        posts: [dummyPost3],
      },
    ];

    const { response, json } = await batchAddPosts(entries);
    assertValidResponse(response);

    // All entries should be returned in the same order
    expect(json.results).toHaveLength(3);
    expect(json.results[0].feed).toBe(dummyFeed1.uri);
    expect(json.results[1].feed).toBe(dummyFeed1.uri);
    expect(json.results[2].feed).toBe(dummyFeed1.uri);

    // All posts should be added
    const db = env.DB;
    const { results: posts } = await db.prepare('SELECT * FROM posts').all();
    expect(posts.length).toBe(3);
  });

  it('handles exceeding max batch posts limit', async () => {
    await insertFeed(dummyFeed1);
    await insertFeed(dummyFeed2);

    // Create 2 entries with 12 + 13 = 25 posts (at the limit)
    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: Array.from({ length: 12 }, (_, i) => ({
          uri: `at://did:plc:author${i}/app.bsky.feed.post/test-post-${i}`,
          cid: `bafyreia${i.toString().padStart(50, '0')}`,
          indexedAt: new Date(Date.UTC(2024, 0, 15, 12 + i, 0, 0)).toISOString(),
        })),
      },
      {
        feed: dummyFeed2.uri,
        posts: Array.from({ length: 13 }, (_, i) => ({
          uri: `at://did:plc:author${i + 12}/app.bsky.feed.post/test-post-${i + 12}`,
          cid: `bafyreia${(i + 12).toString().padStart(50, '0')}`,
          indexedAt: new Date(Date.UTC(2024, 0, 15, 12 + i + 12, 0, 0)).toISOString(),
        })),
      },
    ];

    // Add one more post to exceed the limit (26 total posts)
    entries[1].posts.push({
      uri: 'at://did:plc:author25/app.bsky.feed.post/test-post-25',
      cid: 'bafyreia' + '25'.padStart(50, '0'),
      indexedAt: new Date(Date.UTC(2024, 0, 15, 12 + 25, 0, 0)).toISOString(),
    });

    const { response, json } = await batchAddPosts(entries);
    expect(response.status).toBe(400);
    expect(json.error).toBe('BadRequest');
    expect(json.message).toContain('Maximum 25 posts allowed per request. Received 26 posts.');
  });

  it('returns error when an entry has no posts', async () => {
    await insertFeed(dummyFeed1);

    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [], // No posts in this entry
      },
    ];

    const { response, json } = await batchAddPosts(entries);
    expect(response.status).toBe(400);
    expect(json.error).toBe('BadRequest');
    expect(json.message).toContain(
      `[{"message":"Too small: expected array to have >=1 items","path":["body","entries",0,"posts"]}]`
    );
  });

  it('handles partial success when some feeds do not exist', async () => {
    await insertFeed(dummyFeed1);
    // dummyFeed2 is not inserted

    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [dummyPost1],
      },
      {
        feed: dummyFeed2.uri,
        posts: [dummyPost2],
      },
    ];

    const { response, json } = await batchAddPosts(entries);
    assertValidResponse(response);

    expect(json.results).toHaveLength(2);
    expect(json.results[0].feed).toBe(dummyFeed1.uri);
    expect(json.results[0].results[0].status).toBe('added');

    expect(json.results[1].feed).toBe(dummyFeed2.uri);
    expect(json.results[1].results[0].status).toBe('error');
    expect(json.results[1].results[0].error).toContain('does not exist');

    // Only post from feed1 should be in database
    const db = env.DB;
    const { results: posts } = await db.prepare('SELECT * FROM posts').all();
    expect(posts.length).toBe(1);
  });

  it('handles partial success when some posts are invalid', async () => {
    await insertFeed(dummyFeed1);

    const invalidPost = {
      uri: 'at://did:plc:author4/app.bsky.feed.post/test-post-4',
      cid: 'bafyreicde789example012cid345xyz123456789012345678901234567890',
      languages: ['invalid123'], // Invalid language code
      indexedAt: new Date('2024-01-15T15:00:00Z').toISOString(),
    };

    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [dummyPost1, invalidPost, dummyPost2],
      },
    ];

    const { response, json } = await batchAddPosts(entries);
    assertValidResponse(response);

    expect(json.results).toHaveLength(1);
    expect(json.results[0].results).toHaveLength(3);
    expect(json.results[0].results[0].status).toBe('added');
    expect(json.results[0].results[0].uri).toBe(dummyPost1.uri);
    expect(json.results[0].results[1].status).toBe('error');
    expect(json.results[0].results[1].uri).toBe(invalidPost.uri);
    expect(json.results[0].results[1].error).toContain('lowercase alphabetic characters');
    expect(json.results[0].results[2].status).toBe('added');
    expect(json.results[0].results[2].uri).toBe(dummyPost2.uri);

    // Only valid posts should be in database
    const db = env.DB;
    const { results: posts } = await db.prepare('SELECT * FROM posts').all();
    expect(posts.length).toBe(2);
  });

  it('handles all posts failing when all feeds do not exist', async () => {
    const nonExistentFeed = 'at://did:plc:nonexistent/app.bsky.feed.generator/fake';

    const entries = [
      {
        feed: nonExistentFeed,
        posts: [dummyPost1, dummyPost2],
      },
    ];

    const { response, json } = await batchAddPosts(entries);
    assertValidResponse(response);

    expect(json.results).toHaveLength(1);
    expect(json.results[0].results).toHaveLength(2);
    expect(json.results[0].results[0].status).toBe('error');
    expect(json.results[0].results[1].status).toBe('error');

    // No posts should be in database
    const db = env.DB;
    const { results: posts } = await db.prepare('SELECT * FROM posts').all();
    expect(posts.length).toBe(0);
  });

  it('normalizes language codes in batch', async () => {
    await insertFeed(dummyFeed1);

    const postWithMixedLangs = {
      ...dummyPost1,
      languages: ['en-US', 'JA-JP', 'EN', 'JA'], // Should normalize to ['en', 'ja']
    };

    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [postWithMixedLangs],
      },
    ];

    const { response, json } = await batchAddPosts(entries);
    assertValidResponse(response);

    expect(json.results[0].results[0].status).toBe('added');

    // Verify normalized languages in database
    const db = env.DB;
    const { results: posts } = await db
      .prepare('SELECT * FROM posts WHERE uri = ?')
      .bind(dummyPost1.uri)
      .all();
    expect(posts.length).toBe(1);

    const { results: languages } = await db
      .prepare('SELECT DISTINCT language FROM post_languages WHERE post_id = ?')
      .bind(posts[0].post_id)
      .all();
    expect(languages.length).toBe(2);
    expect(languages.map((l) => l.language).sort()).toEqual(['en', 'ja']);
  });

  it('handles duplicate posts across entries', async () => {
    await insertFeed(dummyFeed1);

    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [dummyPost1],
      },
      {
        feed: dummyFeed1.uri,
        posts: [dummyPost1], // Duplicate
      },
    ];

    const { response, json } = await batchAddPosts(entries);
    assertValidResponse(response);

    // Both entries should be processed
    expect(json.results[0].results[0].status).toBe('added');
    expect(json.results[1].results[0].status).toBe('added');
  });

  it('adds posts with minimum required fields', async () => {
    await insertFeed(dummyFeed1);

    const minimalPost = {
      uri: dummyPost1.uri,
      cid: dummyPost1.cid,
    };

    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [minimalPost],
      },
    ];

    const { response, json } = await batchAddPosts(entries);
    assertValidResponse(response);

    expect(json.results[0].results[0].status).toBe('added');

    // Verify default language is ALL_LANGS
    const db = env.DB;
    const { results: posts } = await db
      .prepare('SELECT * FROM posts WHERE uri = ?')
      .bind(dummyPost1.uri)
      .all();
    expect(posts.length).toBe(1);

    const { results: languages } = await db
      .prepare('SELECT * FROM post_languages WHERE post_id = ?')
      .bind(posts[0].post_id)
      .all();
    expect(languages.length).toBe(1);
    expect(languages[0].language).toBe(All_LANGS);
  });

  it('adds posts with feedContext', async () => {
    await insertFeed(dummyFeed1);

    const postWithContext = {
      ...dummyPost1,
      feedContext: 'Test context',
    };

    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [postWithContext],
      },
    ];

    const { response, json } = await batchAddPosts(entries);
    assertValidResponse(response);

    expect(json.results[0].results[0].status).toBe('added');

    // Verify database state
    const db = env.DB;
    const { results: posts } = await db
      .prepare('SELECT * FROM posts WHERE uri = ?')
      .bind(dummyPost1.uri)
      .all();
    expect(posts.length).toBe(1);
    expect(posts[0].feed_context).toBe('Test context');
  });

  it('adds posts with reason', async () => {
    await insertFeed(dummyFeed1);

    const postWithReason = {
      ...dummyPost1,
      reason: {
        $type: 'app.bsky.feed.defs#skeletonReasonRepost',
        repost: 'at://did:plc:testuser/app.bsky.feed.repost/repostkey',
      },
    };

    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [postWithReason],
      },
    ];

    const { response, json } = await batchAddPosts(entries);
    assertValidResponse(response);

    expect(json.results[0].results[0].status).toBe('added');

    // Verify database state
    const db = env.DB;
    const { results: posts } = await db
      .prepare('SELECT * FROM posts WHERE uri = ?')
      .bind(dummyPost1.uri)
      .all();
    expect(posts.length).toBe(1);
    expect(JSON.parse(posts[0].reason as string)).toEqual({
      $type: 'app.bsky.feed.defs#skeletonReasonRepost',
      repost: 'at://did:plc:testuser/app.bsky.feed.repost/repostkey',
    });
  });

  it('validates reason field when repost type is missing repost', async () => {
    await insertFeed(dummyFeed1);

    const postWithInvalidReason = {
      ...dummyPost1,
      reason: {
        $type: 'app.bsky.feed.defs#skeletonReasonRepost',
        // Missing repost field
      },
    };

    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [postWithInvalidReason],
      },
    ];

    const { response, json } = await batchAddPosts(entries);
    assertValidResponse(response);

    expect(json.results[0].results[0].status).toBe('error');
    expect(json.results[0].results[0].error).toContain('needs repost field');
  });

  it('adds posts with pin reason', async () => {
    await insertFeed(dummyFeed1);

    const postWithPinReason = {
      ...dummyPost1,
      reason: {
        $type: 'app.bsky.feed.defs#skeletonReasonPin',
      },
    };

    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [postWithPinReason],
      },
    ];

    const { response, json } = await batchAddPosts(entries);
    assertValidResponse(response);

    expect(json.results[0].results[0].status).toBe('added');

    const db = env.DB;
    const { results: posts } = await db
      .prepare('SELECT * FROM posts WHERE uri = ?')
      .bind(dummyPost1.uri)
      .all();
    expect(posts.length).toBe(1);
    expect(JSON.parse(posts[0].reason as string)).toEqual({
      $type: 'app.bsky.feed.defs#skeletonReasonPin',
    });
  });

  it('returns validation error when language list becomes empty after normalization', async () => {
    await insertFeed(dummyFeed1);

    const postWithEmptyLanguage = {
      ...dummyPost1,
      languages: [''],
    };

    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [postWithEmptyLanguage],
      },
    ];

    const { response, json } = await batchAddPosts(entries);
    assertValidResponse(response);

    expect(json.results[0].results[0].status).toBe('error');
    expect(json.results[0].results[0].error).toBe('At least one valid language code is required');
  });

  it('handles empty posts array', async () => {
    await insertFeed(dummyFeed1);

    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [],
      },
    ];

    const { response } = await batchAddPosts(entries);
    expect(response.status).toBe(400); // Validation should fail due to min(1) constraint
  });

  it('handles invalid feed URI format', async () => {
    const entries = [
      {
        feed: 'invalid-uri',
        posts: [dummyPost1],
      },
    ];

    const { response } = await batchAddPosts(entries);
    expect(response.status).toBe(400);
  });

  it('handles invalid post URI format in batch', async () => {
    await insertFeed(dummyFeed1);

    const invalidPost = {
      uri: 'invalid-uri',
      cid: dummyPost1.cid,
    };

    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [invalidPost],
      },
    ];

    const { response } = await batchAddPosts(entries);
    expect(response.status).toBe(400); // Should fail validation
  });

  it('processes large batch within limits', async () => {
    await insertFeed(dummyFeed1);
    await insertFeed(dummyFeed2);

    // Create 25 entries (at the limit)
    const entries = Array.from({ length: 25 }, (_, i) => ({
      feed: i % 2 === 0 ? dummyFeed1.uri : dummyFeed2.uri,
      posts: [
        {
          uri: `at://did:plc:author${i}/app.bsky.feed.post/test-post-${i}`,
          cid: `bafyreia${i.toString().padStart(50, '0')}`,
          indexedAt: new Date(Date.UTC(2024, 0, 15, 12 + i, 0, 0)).toISOString(),
        },
      ],
    }));

    const { response, json } = await batchAddPosts(entries);
    assertValidResponse(response);

    expect(json.results).toHaveLength(25);
    expect(json.results.every((r: any) => r.results[0].status === 'added')).toBe(true);

    const db = env.DB;
    const { results: posts } = await db.prepare('SELECT * FROM posts').all();
    expect(posts.length).toBe(25);
  });

  it('handles db errors gracefully', async () => {
    // Mock a database that will fail on feed query
    const mockDb = {
      prepare: (query: string) => {
        if (query.includes('SELECT')) {
          return {
            bind: (...args: any[]) => ({
              all: async () => {
                throw new Error('Database connection failed');
              },
            }),
          };
        }
        return {
          bind: (...args: any[]) => ({
            run: async () => ({ success: true, meta: { changes: 0 } }),
            all: async () => ({ success: true, results: [] }),
          }),
        };
      },
      batch: async () => {
        throw new Error('Batch operation failed');
      },
    };

    const mockEnv: Partial<Env> = { DB: mockDb as unknown as D1Database };

    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [dummyPost1],
      },
    ];

    const { response, json } = await batchAddPosts(entries, mockEnv);

    expect(response.status).toBe(500);
    expect(json.error).toBe('InternalServerError');
    expect(json.message).toBe('Failed to query feeds');
  });

  it('returns internal error when feed query result is unsuccessful', async () => {
    const mockDb = {
      prepare: (_query: string) => ({
        bind: (..._args: any[]) => ({
          all: async () => ({
            success: false,
            results: [],
          }),
          run: async () => ({ success: true, meta: { changes: 0 } }),
        }),
      }),
      batch: async () => [],
    };

    const mockEnv: Partial<Env> = { DB: mockDb as unknown as D1Database };

    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [dummyPost1],
      },
    ];

    const { response, json } = await batchAddPosts(entries, mockEnv);

    expect(response.status).toBe(500);
    expect(json.error).toBe('InternalServerError');
    expect(json.message).toBe('Failed to query feeds');
  });

  it('marks post as error when batch result contains unsuccessful statements', async () => {
    const mockDb = {
      prepare: (query: string) => ({
        bind: (..._args: any[]) => ({
          all: async () => {
            if (query.includes('SELECT feed_id, feed_uri FROM feeds')) {
              return {
                success: true,
                results: [{ feed_id: 1, feed_uri: dummyFeed1.uri }],
              };
            }
            return { success: true, results: [] };
          },
          run: async () => ({ success: true, meta: { changes: 1 } }),
        }),
      }),
      batch: async () => [
        { success: true },
        { success: false },
      ],
    };

    const mockEnv: Partial<Env> = { DB: mockDb as unknown as D1Database };

    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [dummyPost1],
      },
    ];

    const { response, json } = await batchAddPosts(entries, mockEnv);

    expect(response.status).toBe(200);
    expect(json.results[0].results[0].status).toBe('error');
    expect(json.results[0].results[0].error).toBe('Failed to add post to DB');
  });

  it('handles db batch insert errors gracefully', async () => {
    // First query succeeds (feed lookup), batch insert fails
    const mockDb = {
      prepare: (query: string) => ({
        bind: (...args: any[]) => ({
          all: async () => {
            if (query.includes('SELECT')) {
              return {
                success: true,
                results: [{ feed_id: 1, feed_uri: dummyFeed1.uri }],
              };
            }
            return { success: true, results: [] };
          },
          run: async () => ({ success: true, meta: { changes: 1 } }),
        }),
      }),
      batch: async () => {
        throw new Error('Batch insert failed');
      },
    };

    const mockEnv: Partial<Env> = { DB: mockDb as unknown as D1Database };

    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [dummyPost1],
      },
    ];

    const { response, json } = await batchAddPosts(entries, mockEnv);

    expect(response.status).toBe(200);
    console.log(json.results[0].results[0]);
    expect(json.results[0].results[0].status).toBe('error');
    expect(json.results[0].results[0].error).toBe('Failed to add post to DB'); //D1 error message is not propagated
  });

  it('returns duplicate-specific error when batch insert hits unique constraint', async () => {
    const mockDb = {
      prepare: (query: string) => ({
        bind: (..._args: any[]) => ({
          all: async () => {
            if (query.includes('SELECT')) {
              return {
                success: true,
                results: [{ feed_id: 1, feed_uri: dummyFeed1.uri }],
              };
            }
            return { success: true, results: [] };
          },
          run: async () => ({ success: true, meta: { changes: 1 } }),
        }),
      }),
      batch: async () => {
        throw new Error('UNIQUE constraint failed: posts.feed_id, posts.cid, posts.indexed_at');
      },
    };

    const mockEnv: Partial<Env> = { DB: mockDb as unknown as D1Database };

    const entries = [
      {
        feed: dummyFeed1.uri,
        posts: [dummyPost1],
      },
    ];

    const { response, json } = await batchAddPosts(entries, mockEnv);

    expect(response.status).toBe(200);
    expect(json.results[0].results[0].status).toBe('error');
    expect(json.results[0].results[0].error).toContain('Post already exists. uri:');
    expect(json.results[0].results[0].error).toContain(`uri:${dummyPost1.uri}`);
    expect(json.results[0].results[0].error).toContain(`indexedAt:${dummyPost1.indexedAt}`);
  });
});
