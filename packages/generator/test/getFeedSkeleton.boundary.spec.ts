import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACTIVE_FEED_URI,
  ErrorResponse,
  FeedSkeletonResponse,
  NO_LANG_FILTER_FEED_URI,
  getFeedId,
  insertPost,
  requestFeedSkeleton,
  resetAndSeedFeeds,
} from './getFeedSkeleton.shared';

describe('Boundary cases', () => {
  beforeEach(async () => {
    await resetAndSeedFeeds();
  });

  it('Given no language filter feed When requesting with Accept-Language Then all posts are returned', async () => {
    const feedId = await getFeedId(NO_LANG_FILTER_FEED_URI);
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

    const response = await requestFeedSkeleton(`feed=${NO_LANG_FILTER_FEED_URI}`, {
      'Accept-Language': 'fr',
    });

    expect(response.status).toBe(200);
    const data: FeedSkeletonResponse = await response.json();
    expect(data.feed.length).toBe(3);
  });

  it('Given language preferences When requesting skeleton Then Content-Language is normalized', async () => {
    const frResponse = await requestFeedSkeleton(`feed=${ACTIVE_FEED_URI}`, {
      'Accept-Language': 'fr',
    });
    expect(frResponse.status).toBe(200);
    expect(frResponse.headers.get('Content-Language')).toBe('fr');

    const enResponse = await requestFeedSkeleton(`feed=${ACTIVE_FEED_URI}`, {
      'Accept-Language': 'en-US, jp',
    });
    expect(enResponse.status).toBe(200);
    expect(enResponse.headers.get('Content-Language')).toBe('en, jp');

    const defaultResponse = await requestFeedSkeleton(`feed=${ACTIVE_FEED_URI}`);
    expect(defaultResponse.status).toBe(200);
    expect(defaultResponse.headers.get('Content-Language')).toBe(null);
  });

  it('Given q-values and empty tokens When requesting skeleton Then only primary non-empty codes are kept', async () => {
    const response = await requestFeedSkeleton(`feed=${ACTIVE_FEED_URI}`, {
      'Accept-Language': 'en-US;q=0.9,   , fr-FR',
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Language')).toBe('en, fr');
  });

  it('Given exactly limit number of results When requesting skeleton Then cursor is returned', async () => {
    const feedId = await getFeedId(ACTIVE_FEED_URI);
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

    const response = await requestFeedSkeleton(`feed=${ACTIVE_FEED_URI}&limit=5`);

    expect(response.status).toBe(200);
    const data: FeedSkeletonResponse = await response.json();
    expect(data.feed.length).toBe(5);
    expect(data.cursor).toBeDefined();
  });

  it('Given feed with no posts Then active feed returns empty and inactive feed returns UnknownFeed', async () => {
    await env.DB.prepare('DELETE FROM posts').run();

    const activeResponse = await requestFeedSkeleton(`feed=${ACTIVE_FEED_URI}`);
    expect(activeResponse.status).toBe(200);
    const activeData: FeedSkeletonResponse = await activeResponse.json();
    expect(activeData.feed).toHaveLength(0);

    await env.DB.prepare('UPDATE feeds SET is_active = 0 WHERE feed_uri = ?')
      .bind(ACTIVE_FEED_URI)
      .run();

    const inactiveResponse = await requestFeedSkeleton(`feed=${ACTIVE_FEED_URI}`);
    expect(inactiveResponse.status).toBe(404);
    const inactiveData: ErrorResponse = await inactiveResponse.json();
    expect(inactiveData.error).toBe('UnknownFeed');
  });

  it('Given more than 10 language tags When requesting skeleton Then only first 10 primary tags are used', async () => {
    const feedId = await getFeedId(ACTIVE_FEED_URI);
    const indexedAt = new Date();
    const languages = ['en', 'fr', 'de', 'es', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar'];

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

    const response = await requestFeedSkeleton(`feed=${ACTIVE_FEED_URI}&limit=50`, {
      'Accept-Language':
        'en-us,fr-fr,de-de,es-es,it-it,pt-br,ru-ru,ja-jp,ko-kr,zh-cn,ar-sa,hi-in,nl-nl,sv-se,da-dk',
    });

    expect(response.status).toBe(200);
    const data: FeedSkeletonResponse = await response.json();
    expect(response.headers.get('Content-Language')).toBe('en, fr, de, es, it, pt, ru, ja, ko, zh');
    expect(data.feed.length).toBe(10);
  });

  it('Given post with feed_context and reason When requesting skeleton Then both fields are returned', async () => {
    const feedId = await getFeedId(ACTIVE_FEED_URI);
    const indexedAt = new Date();
    const testFeedContext = 'context test';
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

    await env.DB.prepare('UPDATE posts SET feed_context = ?, reason = ? WHERE post_id = ?')
      .bind(testFeedContext, JSON.stringify(testReason), 1)
      .run();

    const response = await requestFeedSkeleton(`feed=${ACTIVE_FEED_URI}`);

    expect(response.status).toBe(200);
    const data: FeedSkeletonResponse = await response.json();
    expect(data.feed).toHaveLength(1);
    expect(data.feed[0].feedContext).toBe(testFeedContext);
    expect(data.feed[0].reason).toEqual(testReason);
  });

  it('Given DEVELOPER_MODE disabled When requesting skeleton Then debug logs are not emitted', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const response = await requestFeedSkeleton(`feed=${ACTIVE_FEED_URI}`, {}, {
      ...env,
      DEVELOPER_MODE: undefined,
    } as typeof env);

    expect(response.status).toBe(200);
    const data: FeedSkeletonResponse = await response.json();
    expect(Array.isArray(data.feed)).toBe(true);
    expect(logSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });
});
