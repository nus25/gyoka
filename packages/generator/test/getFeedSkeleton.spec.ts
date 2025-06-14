import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/index';

const BASE_URL = 'http://localhost:8787';
const ENDPOINT_PATH = '/xrpc/app.bsky.feed.getFeedSkeleton';

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
describe('GetFeedSkeleton Endpoint', () => {
  const sendRequest = async (queryParams: string, headers: Record<string, string> = {}) => {
    const request = new Request(`${BASE_URL}${ENDPOINT_PATH}?${queryParams}`, { headers });
    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    return response;
  };

  beforeEach(async () => {
    const db = env.DB;
    await db.prepare('DELETE FROM feeds').run();
    await db
      .prepare('INSERT INTO feeds (feed_uri, is_active) VALUES (?, ?)')
      .bind('at://did:plc:testuser/app.bsky.feed.generator/getfeedskeleton', 1)
      .run();
    await db
      .prepare('INSERT INTO feeds (feed_uri, is_active) VALUES (?, ?)')
      .bind('at://did:plc:testuser/app.bsky.feed.generator/inactivefeed', 0)
      .run();
    await db
      .prepare('INSERT INTO feeds (feed_uri, lang_filter, is_active) VALUES (?, ?, ?)')
      .bind('at://did:plc:testuser/app.bsky.feed.generator/nolangfilter', 0, 1)
      .run();
  });

  type expectedResponseType = {
    feed: Array<{
      post: string;
      reason?: {
        repost?: string;
      };
      feedContext?: string;
    }>;
    cursor?: string;
  };
  type expectedErrorResponseType = {
    error: string;
    message?: string;
  };

  it('should return a valid feed skeleton with default limit', async () => {
    const response = await sendRequest(
      'feed=at://did:plc:testuser/app.bsky.feed.generator/getfeedskeleton'
    );
    const data: expectedResponseType = await response.json();
    console.log(data);
    expect(data).toHaveProperty('feed');
    expect(Array.isArray(data.feed)).toBe(true);
    expect(data.feed.length).toBeLessThanOrEqual(50);
  });

  it('should return a feed skeleton with a custom limit', async () => {
    const response = await sendRequest(
      'feed=at://did:plc:testuser/app.bsky.feed.generator/getfeedskeleton&limit=10'
    );
    expect(response.status).toBe(200);
    const data: expectedResponseType = await response.json();
    expect(data).toHaveProperty('feed');
    expect(Array.isArray(data.feed)).toBe(true);
    expect(data.feed.length).toBeLessThanOrEqual(10);
  });

  it('should return a 404 error if the feed does not exist', async () => {
    const response = await sendRequest(
      'feed=at://did:plc:testuser/app.bsky.feed.generator/non_feed'
    );
    expect(response.status).toBe(404);
    const data: expectedErrorResponseType = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('UnknownFeed');
  });
  it('should return a 404 error if the feed is not active', async () => {
    const response = await sendRequest(
      'feed=at://did:plc:testuser/app.bsky.feed.generator/inactivefeed'
    );
    expect(response.status).toBe(404);
    const data: expectedErrorResponseType = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('UnknownFeed');
  });
  it('should handle pagination with a cursor', async () => {
    const feedUri = 'at://did:plc:testuser/app.bsky.feed.generator/getfeedskeleton';
    const db = env.DB;
    const { results } = await db
      .prepare('SELECT feed_id FROM feeds WHERE feed_uri = ? AND is_active = 1')
      .bind(feedUri)
      .all();
    const feedId = parseInt(results[0].feed_id as string);

    const indexedAt = new Date();

    await insertPost(feedId, {
      id: 1,
      uri: 'at://did:plc:testuser/app.bsky.feed.post/getfeedskeleton/post1',
      cid: 'cid1',
      indexedAt: indexedAt.toISOString(),
      langs: ['en'],
    });

    indexedAt.setSeconds(indexedAt.getSeconds() + 1);
    await insertPost(feedId, {
      id: 2,
      uri: 'at://did:plc:testuser/app.bsky.feed.post/getfeedskeleton/post2',
      cid: 'cid2',
      indexedAt: indexedAt.toISOString(),
      langs: ['fr'],
    });
    const previousCursor = indexedAt.getTime() + '::cid2';

    indexedAt.setSeconds(indexedAt.getSeconds() + 1);
    await insertPost(feedId, {
      id: 3,
      uri: 'at://did:plc:testuser/app.bsky.feed.post/getfeedskeleton/post3',
      cid: 'cid3',
      indexedAt: indexedAt.toISOString(),
      langs: ['en'],
    });

    const response = await sendRequest(`feed=${feedUri}&cursor=${previousCursor}`);
    expect(response.status).toBe(200);
    const data: expectedResponseType = await response.json();
    expect(data).toHaveProperty('feed');
    expect(data.feed.length).toBe(1);
    expect(Array.isArray(data.feed)).toBe(true);
  });

  it('should return a 400 error for invalid query parameters', async () => {
    const response = await sendRequest('feed=invalid-feed-uri');
    expect(response.status).toBe(400);
    const data: expectedErrorResponseType = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('BadRequest');
  });

  it('should return a feed skeleton with language filtering:lang_filter=true', async () => {
    const feedUri = 'at://did:plc:testuser/app.bsky.feed.generator/getfeedskeleton';
    const db = env.DB;
    const { results } = await db
      .prepare('SELECT feed_id FROM feeds WHERE feed_uri = ? AND is_active = 1')
      .bind(feedUri)
      .all();
    const feedId = parseInt(results[0].feed_id as string);

    const indexedAt = new Date();

    await insertPost(feedId, {
      id: 1,
      uri: 'at://did:plc:testuser/app.bsky.feed.post/getfeedskeleton/post1',
      cid: 'cid1',
      indexedAt: indexedAt.toISOString(),
      langs: ['en'],
    });

    indexedAt.setSeconds(indexedAt.getSeconds() + 1);
    const cursortime = indexedAt.getTime();
    await insertPost(feedId, {
      id: 2,
      uri: 'at://did:plc:testuser/app.bsky.feed.post/getfeedskeleton/post2',
      cid: 'cid2',
      indexedAt: indexedAt.toISOString(),
      langs: ['fr'],
    });

    indexedAt.setSeconds(indexedAt.getSeconds() + 1);
    await insertPost(feedId, {
      id: 3,
      uri: 'at://did:plc:testuser/app.bsky.feed.post/getfeedskeleton/post3',
      cid: 'cid3',
      indexedAt: indexedAt.toISOString(),
      langs: ['*'],
    });

    const response = await sendRequest(
      'feed=at://did:plc:testuser/app.bsky.feed.generator/getfeedskeleton&limit=2',
      { 'Accept-Language': 'fr' }
    );
    expect(response.status).toBe(200);
    const data: expectedResponseType = await response.json();
    expect(data).toHaveProperty('feed');
    expect(Array.isArray(data.feed)).toBe(true);
    expect(data.feed.length).equal(2);
    expect(data.cursor).equal(`${cursortime}::cid2`);
    expect(data.feed[0].post).equal(
      'at://did:plc:testuser/app.bsky.feed.post/getfeedskeleton/post3'
    );
    expect(data.feed[1].post).equal(
      'at://did:plc:testuser/app.bsky.feed.post/getfeedskeleton/post2'
    );
  });
  it('should return a feed skeleton without language filtering :lang_filter=false', async () => {
    const feedUri = 'at://did:plc:testuser/app.bsky.feed.generator/nolangfilter';
    const db = env.DB;
    const { results } = await db
      .prepare('SELECT feed_id FROM feeds WHERE feed_uri = ? AND is_active = 1')
      .bind(feedUri)
      .all();
    const feedId = parseInt(results[0].feed_id as string);

    const indexedAt = new Date();

    await insertPost(feedId, {
      id: 1,
      uri: 'at://did:plc:testuser/app.bsky.feed.post/getfeedskeleton/post1',
      cid: 'cid1',
      indexedAt: indexedAt.toISOString(),
      langs: ['en'],
    });

    indexedAt.setSeconds(indexedAt.getSeconds() + 1);
    await insertPost(feedId, {
      id: 2,
      uri: 'at://did:plc:testuser/app.bsky.feed.post/getfeedskeleton/post2',
      cid: 'cid2',
      indexedAt: indexedAt.toISOString(),
      langs: ['fr'],
    });

    indexedAt.setSeconds(indexedAt.getSeconds() + 1);
    await insertPost(feedId, {
      id: 3,
      uri: 'at://did:plc:testuser/app.bsky.feed.post/getfeedskeleton/post3',
      cid: 'cid3',
      indexedAt: indexedAt.toISOString(),
      langs: ['*'],
    });

    const response = await sendRequest(
      'feed=at://did:plc:testuser/app.bsky.feed.generator/nolangfilter',
      { 'Accept-Language': 'fr' }
    );
    expect(response.status).toBe(200);
    const data: expectedResponseType = await response.json();
    expect(data).toHaveProperty('feed');
    expect(Array.isArray(data.feed)).toBe(true);
    expect(data.feed.length).equal(3);
    expect(data.feed[0].post).equal(
      'at://did:plc:testuser/app.bsky.feed.post/getfeedskeleton/post3'
    );
    expect(data.feed[1].post).equal(
      'at://did:plc:testuser/app.bsky.feed.post/getfeedskeleton/post2'
    );
    expect(data.feed[2].post).equal(
      'at://did:plc:testuser/app.bsky.feed.post/getfeedskeleton/post1'
    );
  });
  it('should set Content-Language header in response', async () => {
    const feedUri = 'at://did:plc:testuser/app.bsky.feed.generator/getfeedskeleton';

    // request français
    const frResponse = await sendRequest(`feed=${feedUri}`, { 'Accept-Language': 'fr' });
    expect(frResponse.status).toBe(200);
    expect(frResponse.headers.get('Content-Language')).toBe('fr');

    // request english with fallback to Japanese
    const enResponse = await sendRequest(`feed=${feedUri}`, { 'Accept-Language': 'en-US, jp' });
    expect(enResponse.status).toBe(200);
    expect(enResponse.headers.get('Content-Language')).toBe('en, jp');

    // Accept-Language header not set, should return null
    const defaultResponse = await sendRequest(`feed=${feedUri}`);
    expect(defaultResponse.status).toBe(200);
    expect(defaultResponse.headers.get('Content-Language')).toBe(null); 
  });
  it('should return feedcontext', async () => {
    const feedUri = 'at://did:plc:testuser/app.bsky.feed.generator/getfeedskeleton';
    const db = env.DB;
    const { results } = await db
      .prepare('SELECT feed_id FROM feeds WHERE feed_uri = ? AND is_active = 1')
      .bind(feedUri)
      .all();
    const feedId = parseInt(results[0].feed_id as string);

    const indexedAt = new Date();
    const testFeedContext = 'context test';

    await insertPost(feedId, {
      id: 1,
      uri: 'at://did:plc:testuser/app.bsky.feed.post/getfeedskeleton/post1',
      cid: 'cid1',
      indexedAt: indexedAt.toISOString(),
      langs: ['en'],
    });
    const updateResults = await db
      .prepare('UPDATE posts SET feed_context = ? WHERE post_id = ?')
      .bind(testFeedContext, 1)
      .run();
    if (!updateResults.success) {
      console.log(updateResults);
    }

    const response = await sendRequest(`feed=${feedUri}`);
    expect(response.status).toBe(200);
    const data: expectedResponseType = await response.json();
    expect(data).toHaveProperty('feed');
    expect(data.feed.length).toBe(1);
    expect(data.feed[0].feedContext).toBe(testFeedContext);
  });

  it('should return reason', async () => {
    const feedUri = 'at://did:plc:testuser/app.bsky.feed.generator/getfeedskeleton';
    const db = env.DB;
    const { results } = await db
      .prepare('SELECT feed_id FROM feeds WHERE feed_uri = ? AND is_active = 1')
      .bind(feedUri)
      .all();
    const feedId = parseInt(results[0].feed_id as string);

    const indexedAt = new Date();
    const testReason = {
      repost: 'at://did:plc:testuser/app.bsky.feed.repost/getfeedskeleton/repostkey',
    };

    await insertPost(feedId, {
      id: 1,
      uri: 'at://did:plc:testuser/app.bsky.feed.post/getfeedskeleton/post1',
      cid: 'cid1',
      indexedAt: indexedAt.toISOString(),
      langs: ['en'],
    });
    const updateResults = await db
      .prepare('UPDATE posts SET reason = ? WHERE post_id = ?')
      .bind(JSON.stringify(testReason), 1)
      .run();
    if (!updateResults.success) {
      console.log(updateResults);
    }

    const response = await sendRequest(`feed=${feedUri}`);
    expect(response.status).toBe(200);
    const data: expectedResponseType = await response.json();
    expect(data).toHaveProperty('feed');
    expect(data.feed.length).toBe(1);
    expect(JSON.stringify(data.feed[0].reason)).toBe(JSON.stringify(testReason));
  });
  it('should handle developer mode logging', async () => {
    // Create a request with developer mode enabled
    const feedUri = 'at://did:plc:testuser/app.bsky.feed.generator/getfeedskeleton';
    const devModeEnv = {
      ...env,
      DEVELOPER_MODE: 'enabled',
    };

    const request = new Request(`${BASE_URL}${ENDPOINT_PATH}?feed=${feedUri}`);
    const ctx = createExecutionContext();
    const response = await app.fetch(request, devModeEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const data: expectedResponseType = await response.json();
    expect(data).toHaveProperty('feed');
  });

  it('should set nextCursor when results length equals limit', async () => {
    const feedUri = 'at://did:plc:testuser/app.bsky.feed.generator/getfeedskeleton';
    const db = env.DB;
    const { results } = await db
      .prepare('SELECT feed_id FROM feeds WHERE feed_uri = ? AND is_active = 1')
      .bind(feedUri)
      .all();
    const feedId = parseInt(results[0].feed_id as string);

    // Insert exactly 5 posts
    const indexedAt = new Date();
    for (let i = 1; i <= 5; i++) {
      indexedAt.setSeconds(indexedAt.getSeconds() + 1);
      await insertPost(feedId, {
        id: i,
        uri: `at://did:plc:testuser/app.bsky.feed.post/getfeedskeleton/post${i}`,
        cid: `cid${i}`,
        indexedAt: indexedAt.toISOString(),
        langs: ['en'],
      });
    }

    // Request exactly 5 posts
    const response = await sendRequest(`feed=${feedUri}&limit=5`);
    expect(response.status).toBe(200);
    const data: expectedResponseType = await response.json();

    expect(data).toHaveProperty('feed');
    expect(data.feed.length).toBe(5);
    expect(data).toHaveProperty('cursor');
    // The cursor should be set since results.length equals limit
    expect(data.cursor).toBeDefined();
  });

  it('should check feed existence when no results are found', async () => {
    const feedUri = 'at://did:plc:testuser/app.bsky.feed.generator/getfeedskeleton';
    const db = env.DB;

    // Make sure the feed exists but has no posts
    await db.prepare('DELETE FROM posts').run();

    // Request the feed
    const response = await sendRequest(`feed=${feedUri}`);
    expect(response.status).toBe(200);
    const data: expectedResponseType = await response.json();

    expect(data).toHaveProperty('feed');
    expect(data.feed.length).toBe(0);

    // Now deactivate the feed and try again
    await db.prepare('UPDATE feeds SET is_active = 0 WHERE feed_uri = ?').bind(feedUri).run();

    const response2 = await sendRequest(`feed=${feedUri}`);
    expect(response2.status).toBe(404);
    const errorData: expectedErrorResponseType = await response2.json();
    expect(errorData.error).toBe('UnknownFeed');
  });

  it('should limit Accept-Language to maximum 10 primary language tags', async () => {
    const feedUri = 'at://did:plc:testuser/app.bsky.feed.generator/getfeedskeleton';
    const db = env.DB;
    const { results } = await db
      .prepare('SELECT feed_id FROM feeds WHERE feed_uri = ? AND is_active = 1')
      .bind(feedUri)
      .all();
    const feedId = parseInt(results[0].feed_id as string);

    const indexedAt = new Date();

    // Create posts with different languages
    const languages = ['en', 'fr', 'de', 'es', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'nl', 'sv', 'da'];
    
    for (let i = 0; i < languages.length; i++) {
      indexedAt.setSeconds(indexedAt.getSeconds() + 1);
      await insertPost(feedId, {
        id: i + 1,
        uri: `at://did:plc:testuser/app.bsky.feed.post/getfeedskeleton/post${i + 1}`,
        cid: `cid${i + 1}`,
        indexedAt: indexedAt.toISOString(),
        langs: [languages[i]],
      });
    }

    // Create Accept-Language header with 15 language tags (more than the 10 limit)
    // Using realistic language-country combinations
    const acceptLanguageHeader = 'en-us,fr-fr,de-de,es-es,it-it,pt-br,ru-ru,ja-jp,ko-kr,zh-cn,ar-sa,hi-in,nl-nl,sv-se,da-dk';
    
    const response = await sendRequest(`feed=${feedUri}&limit=50`, { 
      'Accept-Language': acceptLanguageHeader 
    });
    
    expect(response.status).toBe(200);
    const data: expectedResponseType = await response.json();
    
    // Should return posts, but only for the first 10 languages due to the limit
    expect(data).toHaveProperty('feed');
    expect(Array.isArray(data.feed)).toBe(true);
    
    // Verify Content-Language header contains only first 10 primary language codes
    const contentLanguage = response.headers.get('Content-Language');
    expect(contentLanguage).toBe('en, fr, de, es, it, pt, ru, ja, ko, zh');
    
    // Should have 10 posts (one for each of the first 10 languages)
    expect(data.feed.length).toBe(10);
  });
});
