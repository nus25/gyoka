import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { All_LANGS } from 'shared/src/constants';
import { clearTables, expectJsonResponse, requestJson } from './testUtils';

const ENDPOINT_PATH = '/api/feed/addPost';

const dummyFeed = {
  uri: 'at://did:plc:testuser/app.bsky.feed.generator/test-feed',
  is_active: 1,
};

const dummyPost = {
  uri: 'at://did:plc:testuser/app.bsky.feed.post/test-post',
  cid: 'bafyreia3tbsfxe3cc6qxibc2pj4tcmxqyxupz3hajxuepz4g5qkdqxnx6y',
  languages: ['en', 'ja'],
  indexedAt: new Date().toISOString(),
};

// request helper
async function addPost(
  feed: string,
  post: {
    uri: string;
    cid: string;
    languages?: string[];
    indexedAt?: string | Date;
    reason?:
      | {
          $type: 'app.bsky.feed.defs#skeletonReasonRepost';
          repost: string;
        }
      | {
          $type: 'app.bsky.feed.defs#skeletonReasonPin';
        };
    feedContext?: string;
  },
  envOverrides?: Partial<Env>
) {
  return requestJson<{
    message?: string;
    feed?: string;
    post?: {
      uri: string;
      cid: string;
      languages?: string[];
      indexedAt: string;
      feedContext?: string;
    };
    error?: string;
  }>({
    path: ENDPOINT_PATH,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ feed, post }),
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

  it('adds a post with all fields specified', async () => {
    console.log(dummyPost);
    await insertFeed(dummyFeed);
    const { response, json } = await addPost(dummyFeed.uri, dummyPost);
    console.log(json);
    assertValidResponse(response);
    expect(json).toEqual({
      message: 'Post added successfully',
      feed: dummyFeed.uri,
      post: {
        uri: dummyPost.uri,
        cid: dummyPost.cid,
        languages: dummyPost.languages,
        indexedAt: expect.any(String),
      },
    });

    // Verify database state
    const db = env.DB;
    const { results: posts } = await db
      .prepare('SELECT * FROM posts WHERE uri = ?')
      .bind(dummyPost.uri)
      .all();
    expect(posts.length).toBe(1);
    console.log(posts[0].post_id);
    const { results: languages } = await db
      .prepare('SELECT * FROM post_languages WHERE post_id = ?')
      .bind(posts[0].post_id)
      .all();
    expect(languages.length).toBe(2); // en and ja
  });

  it('adds a post with minimum required fields', async () => {
    await insertFeed(dummyFeed);

    const minimalPost = {
      uri: dummyPost.uri,
      cid: dummyPost.cid,
    };

    const { response, json } = await addPost(dummyFeed.uri, minimalPost);
    assertValidResponse(response);
    expect(json).toEqual({
      message: 'Post added successfully',
      feed: dummyFeed.uri,
      post: {
        uri: minimalPost.uri,
        cid: minimalPost.cid,
        indexedAt: expect.any(String),
      },
    });

    // Verify default language is ALL_LANGS
    const db = env.DB;
    const { results: posts } = await db
      .prepare('SELECT * FROM posts WHERE uri = ?')
      .bind(dummyPost.uri)
      .all();
    expect(posts.length).toBe(1);
    console.log(posts[0].post_id);
    const { results: languages } = await db
      .prepare('SELECT * FROM post_languages WHERE post_id = ?')
      .bind(posts[0].post_id)
      .all();
    expect(languages.length).toBe(1);
    expect(languages[0].language).toBe(All_LANGS);
  });

  it('handles invalid feed URI', async () => {
    const { response } = await addPost('invalid-uri', dummyPost);
    expect(response.status).toBe(400);
  });

  it('handles non-existent feed', async () => {
    const { response, json } = await addPost(
      'at://did:plc:nonexistent/app.bsky.feed.generator/feed',
      dummyPost
    );
    expect(response.status).toBe(404);
    expect(json).toEqual({
      error: 'UnknownFeed',
      message:
        'Feed with URI at://did:plc:nonexistent/app.bsky.feed.generator/feed does not exist.',
    });
  });

  it('handles invalid post URI', async () => {
    await insertFeed(dummyFeed);

    const invalidPost = {
      ...dummyPost,
      uri: 'invalid-uri',
    };

    const { response } = await addPost(dummyFeed.uri, invalidPost);
    expect(response.status).toBe(400);
  });

  it('normalizes language codes', async () => {
    await insertFeed(dummyFeed);

    const postWithMixedLangs = {
      ...dummyPost,
      languages: ['en-US', 'JA-JP', 'EN', 'JA', 'tlh'], // Should normalize to ['en', 'ja', 'tlh]
    };

    const { response } = await addPost(dummyFeed.uri, postWithMixedLangs);
    assertValidResponse(response);

    // Verify normalized languages in database
    const db = env.DB;
    const { results: posts } = await db
      .prepare('SELECT * FROM posts WHERE uri = ?')
      .bind(dummyPost.uri)
      .all();
    expect(posts.length).toBe(1);
    console.log(posts[0].post_id);
    const { results: languages } = await db
      .prepare('SELECT DISTINCT language FROM post_languages WHERE post_id = ?')
      .bind(posts[0].post_id)
      .all();
    expect(languages.length).toBe(3);
    expect(languages.map((l) => l.language).sort()).toEqual(['en', 'ja', 'tlh']);
  });

  it('handles invalid language codes', async () => {
    await insertFeed(dummyFeed);

    const postWithInvalidLangs = {
      ...dummyPost,
      languages: ['invalid', '11'],
    };

    const { response, json } = await addPost(dummyFeed.uri, postWithInvalidLangs);
    expect(response.status).toBe(400);
    expect(json).toEqual({
      error: 'BadRequest',
      message:
        'All primary language tags must be exactly two or three lowercase alphabetic characters (e.g., "en", "jp").',
    });
  });

  it('handles database errors gracefully', async () => {
    await insertFeed(dummyFeed);
    const db = env.DB;
    await db.prepare('DROP TABLE posts').run(); // Simulate a database error

    const { response } = await addPost(dummyFeed.uri, dummyPost);
    expect(response.status).toBe(500);
  });

  it('returns InternalServerError when post insert reports failure', async () => {
    const mockEnv: Partial<Env> = {
      DB: {
        prepare: () => ({
          bind: (...bindArgs: unknown[]) => {
            if (bindArgs.length === 7) {
              return {
                all: async () => ({ success: false, results: [] }),
              };
            }
            return {};
          },
        }),
        batch: async () => [{ success: true }],
      } as unknown as D1Database,
    };

    const { response, json } = await addPost(dummyFeed.uri, dummyPost, mockEnv);
    expect(response.status).toBe(500);
    expect(json).toEqual({
      error: 'InternalServerError',
      message: 'Failed to insert post to the database',
    });
  });

  it('returns InternalServerError when adding post languages batch fails', async () => {
    const mockEnv: Partial<Env> = {
      DB: {
        prepare: () => ({
          bind: (...bindArgs: unknown[]) => {
            if (bindArgs.length === 7) {
              return {
                all: async () => ({ success: true, results: [{ post_id: 1 }] }),
              };
            }
            return {};
          },
        }),
        batch: async () => [{ success: false }],
      } as unknown as D1Database,
    };

    const { response, json } = await addPost(dummyFeed.uri, dummyPost, mockEnv);
    expect(response.status).toBe(500);
    expect(json).toEqual({
      error: 'InternalServerError',
      message: 'Failed to add post languages to DB',
    });
  });

  //todo: reason feedContext same uri and indexed at
  it('adds a post with feedContext', async () => {
    await insertFeed(dummyFeed);

    const postWithContext = {
      ...dummyPost,
      feedContext: 'Test context',
    };

    const { response, json } = await addPost(dummyFeed.uri, postWithContext);
    assertValidResponse(response);
    expect(json).toEqual({
      message: 'Post added successfully',
      feed: dummyFeed.uri,
      post: {
        uri: dummyPost.uri,
        cid: dummyPost.cid,
        languages: dummyPost.languages,
        indexedAt: expect.any(String),
        feedContext: 'Test context',
      },
    });

    // Verify database state
    const db = env.DB;
    const { results: posts } = await db
      .prepare('SELECT * FROM posts WHERE uri = ?')
      .bind(dummyPost.uri)
      .all();
    expect(posts.length).toBe(1);
    expect(posts[0].feed_context).toBe('Test context');
  });

  it('adds a post with reason', async () => {
    await insertFeed(dummyFeed);

    // respot reason
    const postWithReasonRepost = {
      ...dummyPost,
      reason: {
        $type: 'app.bsky.feed.defs#skeletonReasonRepost' as const,
        repost: 'at://did:plc:testuser/app.bsky.feed.repost/repostkey',
        invalid: 'extra invalid value should be removed',
      },
    };

    const { response, json } = await addPost(dummyFeed.uri, postWithReasonRepost);
    console.log(json);
    assertValidResponse(response);
    expect(json).toEqual({
      message: 'Post added successfully',
      feed: dummyFeed.uri,
      post: {
        uri: dummyPost.uri,
        cid: dummyPost.cid,
        languages: dummyPost.languages,
        indexedAt: expect.any(String),
        reason: {
          $type: 'app.bsky.feed.defs#skeletonReasonRepost',
          repost: 'at://did:plc:testuser/app.bsky.feed.repost/repostkey',
        },
      },
    });
    // pin reason
    const postWithReasonPin = {
      ...dummyPost,
      reason: {
        $type: 'app.bsky.feed.defs#skeletonReasonPin' as const,
      },
    };

    const { response: pinResponse, json: pinJson } = await addPost(
      dummyFeed.uri,
      postWithReasonPin
    );
    console.log(pinJson);
    assertValidResponse(pinResponse);
    expect(pinJson).toEqual({
      message: 'Post added successfully',
      feed: dummyFeed.uri,
      post: {
        uri: dummyPost.uri,
        cid: dummyPost.cid,
        languages: dummyPost.languages,
        indexedAt: expect.any(String),
        reason: {
          $type: 'app.bsky.feed.defs#skeletonReasonPin',
        },
      },
    });

    // Verify database state
    const db = env.DB;
    const { results: posts } = await db
      .prepare('SELECT * FROM posts WHERE uri = ?')
      .bind(dummyPost.uri)
      .all();
    expect(posts.length).toBe(2);
    const parsedReasons = posts.map((p) => JSON.parse(p.reason as string));
    expect(parsedReasons).toContainEqual({
      $type: 'app.bsky.feed.defs#skeletonReasonRepost',
      repost: 'at://did:plc:testuser/app.bsky.feed.repost/repostkey',
    });
    expect(parsedReasons).toContainEqual({
      $type: 'app.bsky.feed.defs#skeletonReasonPin',
    });
  });

  it('handles invalid reason structure', async () => {
    await insertFeed(dummyFeed);

    const postWithInvalidReason = {
      ...dummyPost,
      reason: {
        $type: 'app.bsky.feed.defs#skeletonReasonRepost' as const,
        // missing repost field
      },
    } as any;
    const { response, json } = await addPost(dummyFeed.uri, postWithInvalidReason);
    expect(response.status).toBe(400);
    expect(json).toEqual({
      error: 'BadRequest',
      message: 'Reason type app.bsky.feed.defs#skeletonReasonRepost needs repost field',
    });
  });

  it('passes duplicate posts with same uri and indexedAt', async () => {
    await insertFeed(dummyFeed);

    // Add first post
    await addPost(dummyFeed.uri, dummyPost);

    // Try to add same post again
    const { response } = await addPost(dummyFeed.uri, dummyPost);

    const db = env.DB;
    const { results: posts } = await db
      .prepare('SELECT * FROM posts WHERE uri = ?')
      .bind(dummyPost.uri)
      .all();
    console.log(posts);

    expect(response.status).toBe(200);
  });
});
