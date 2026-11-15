import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { extractLanguageCodes, getFeedSkeleton } from '../src/endpoints/getFeedSkeleton';
import {
  ACTIVE_FEED_URI,
  dummyCID,
  FeedSkeletonResponse,
  getFeedId,
  insertPost,
  RANKED_FEED_URI,
  requestFeedSkeleton,
  resetAndSeedFeeds,
} from './getFeedSkeleton.shared';

describe('Success cases', () => {
  beforeEach(async () => {
    await resetAndSeedFeeds();
  });

  it('Given an empty feed When fetching a skeleton Then the debug summary includes counts without cursor contents', async () => {
    const debug = vi.fn();
    const context: Record<string, unknown> = { operation: 'getFeedSkeleton', hasCursor: false };
    const response = await getFeedSkeleton({
      env,
      request: new Request('http://localhost', { headers: { 'Accept-Language': 'ja,en' } }),
      feed: ACTIVE_FEED_URI,
      limit: 10,
      context,
      logger: { debug, info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });
    expect(response.status).toBe(200);
    expect(debug).toHaveBeenCalledWith(
      'feed.get.skeleton.success',
      expect.objectContaining({
        resultCount: 0,
        languageCount: 2,
        hasNextCursor: false,
      })
    );
  });

  it('Given valid feed only When requesting skeleton Then default limit is applied', async () => {
    const response = await requestFeedSkeleton(`feed=${ACTIVE_FEED_URI}`);

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    const data: FeedSkeletonResponse = await response.json();
    expect(Array.isArray(data.feed)).toBe(true);
    expect(data.feed.length).toBeLessThanOrEqual(50);
  });

  it('Given custom limit When requesting skeleton Then response respects custom limit', async () => {
    const response = await requestFeedSkeleton(`feed=${ACTIVE_FEED_URI}&limit=10`);

    expect(response.status).toBe(200);
    const data: FeedSkeletonResponse = await response.json();
    expect(Array.isArray(data.feed)).toBe(true);
    expect(data.feed.length).toBeLessThanOrEqual(10);
  });

  it('Given ranked posts When requesting skeleton Then it returns a v3 cursor and paginates', async () => {
    const feedId = await getFeedId(ACTIVE_FEED_URI);
    const indexedAt = new Date();

    await insertPost(feedId, {
      id: 1,
      uri: 'at://did:plc:testuser/app.bsky.feed.post/getfeedskeleton/post1',
      cid: dummyCID('test-001'),
      indexedAt: indexedAt.toISOString(),
      langs: ['en'],
    });

    indexedAt.setSeconds(indexedAt.getSeconds() + 1);
    await insertPost(feedId, {
      id: 2,
      uri: 'at://did:plc:testuser/app.bsky.feed.post/getfeedskeleton/post2',
      cid: dummyCID('test-002'),
      indexedAt: indexedAt.toISOString(),
      langs: ['fr'],
    });

    indexedAt.setSeconds(indexedAt.getSeconds() + 1);
    await insertPost(feedId, {
      id: 3,
      uri: 'at://did:plc:testuser/app.bsky.feed.post/getfeedskeleton/post3',
      cid: dummyCID('test-003'),
      indexedAt: indexedAt.toISOString(),
      langs: ['en'],
    });

    const firstResponse = await requestFeedSkeleton(`feed=${ACTIVE_FEED_URI}&limit=2`);
    const firstPage: FeedSkeletonResponse = await firstResponse.json();
    expect(JSON.parse(atob(firstPage.cursor!))).toMatchObject({
      version: 3,
      feed: ACTIVE_FEED_URI,
      orderRank: 'a2',
    });
    console.log(firstPage.cursor);
    const response = await requestFeedSkeleton(
      `feed=${ACTIVE_FEED_URI}&cursor=${firstPage.cursor as string}`
    );

    expect(response.status).toBe(200);
    const data: FeedSkeletonResponse = await response.json();
    expect(data.feed.length).toBe(1);
  });

  it('Given a ranked feed with ranked posts When requesting skeleton with a cursor Then posts are returned from the greatest rank', async () => {
    const feedId = await getFeedId(RANKED_FEED_URI);
    await insertPost(feedId, {
      id: 1,
      uri: 'at://did:plc:testuser/app.bsky.feed.post/ordered/low',
      cid: dummyCID('test-004'),
      indexedAt: '2026-10-02T00:00:00.000Z',
      langs: ['en'],
      orderRank: 'a0',
    });
    await insertPost(feedId, {
      id: 2,
      uri: 'at://did:plc:testuser/app.bsky.feed.post/ordered/high',
      cid: dummyCID('test-005'),
      indexedAt: '2026-10-01T00:00:00.000Z',
      langs: ['en'],
      orderRank: 'a1',
    });

    const firstResponse = await requestFeedSkeleton(`feed=${RANKED_FEED_URI}&limit=1`);
    const firstPage: FeedSkeletonResponse = await firstResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(firstPage.feed.map((item) => item.post)).toEqual([
      'at://did:plc:testuser/app.bsky.feed.post/ordered/high',
    ]);
    expect(firstPage.cursor).toEqual(expect.any(String));
    expect(JSON.parse(atob(firstPage.cursor!))).toMatchObject({
      version: 3,
      feed: RANKED_FEED_URI,
      orderRank: 'a1',
    });

    const secondResponse = await requestFeedSkeleton(
      `feed=${RANKED_FEED_URI}&cursor=${firstPage.cursor as string}`
    );
    const secondPage: FeedSkeletonResponse = await secondResponse.json();
    expect(secondResponse.status).toBe(200);
    expect(secondPage.feed.map((item) => item.post)).toEqual([
      'at://did:plc:testuser/app.bsky.feed.post/ordered/low',
    ]);
  });

  it('Given lang_filter enabled feed and Accept-Language When requesting skeleton Then matching languages are returned', async () => {
    const feedId = await getFeedId(ACTIVE_FEED_URI);
    const indexedAt = new Date();

    await insertPost(feedId, {
      id: 1,
      uri: 'at://did:plc:testuser/app.bsky.feed.post/getfeedskeleton/post1',
      cid: dummyCID('test-001'),
      indexedAt: indexedAt.toISOString(),
      langs: ['en'],
    });

    indexedAt.setSeconds(indexedAt.getSeconds() + 1);
    await insertPost(feedId, {
      id: 2,
      uri: 'at://did:plc:testuser/app.bsky.feed.post/getfeedskeleton/post2',
      cid: dummyCID('test-002'),
      indexedAt: indexedAt.toISOString(),
      langs: ['fr'],
    });

    indexedAt.setSeconds(indexedAt.getSeconds() + 1);
    await insertPost(feedId, {
      id: 3,
      uri: 'at://did:plc:testuser/app.bsky.feed.post/getfeedskeleton/post3',
      cid: dummyCID('test-003'),
      indexedAt: indexedAt.toISOString(),
      langs: ['*'],
    });

    const response = await requestFeedSkeleton(`feed=${ACTIVE_FEED_URI}&limit=2`, {
      'Accept-Language': 'fr',
    });

    expect(response.status).toBe(200);
    const data: FeedSkeletonResponse = await response.json();
    expect(data.feed.length).toBe(2);
    expect(data.cursor).toEqual(expect.any(String));
    expect(data.feed[0].post).toBe(
      'at://did:plc:testuser/app.bsky.feed.post/getfeedskeleton/post3'
    );
    expect(data.feed[1].post).toBe(
      'at://did:plc:testuser/app.bsky.feed.post/getfeedskeleton/post2'
    );
  });

  it('Given DEVELOPER_MODE enabled When requesting skeleton Then debug logs are emitted', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const response = await requestFeedSkeleton(`feed=${ACTIVE_FEED_URI}`, {}, {
      ...env,
      DEVELOPER_MODE: 'enabled',
    } as typeof env);

    expect(response.status).toBe(200);
    const data: FeedSkeletonResponse = await response.json();
    expect(Array.isArray(data.feed)).toBe(true);
    expect(logSpy).toHaveBeenCalled();

    const firstPayloads = logSpy.mock.calls.map(
      ([line]) => JSON.parse(line as string) as Record<string, unknown>
    );
    const queryPayload = firstPayloads.find(
      (payload) => payload.event === 'db.query.skeleton.start'
    );
    expect(queryPayload?.level).toBe('debug');
    expect(queryPayload).toMatchObject({ languageCount: 0, hasCursor: false, limit: 50 });
    expect(queryPayload).not.toHaveProperty('query');
    expect(queryPayload).not.toHaveProperty('bindings');

    logSpy.mockClear();
    await requestFeedSkeleton(`feed=${ACTIVE_FEED_URI}`, {}, {
      ...env,
      DEVELOPER_MODE: 'enabled',
    } as typeof env);

    const repeatedQueryPayload = logSpy.mock.calls
      .map(([line]) => JSON.parse(line as string) as Record<string, unknown>)
      .find((payload) => payload.event === 'db.query.skeleton.start');
    expect(repeatedQueryPayload).toMatchObject({ level: 'debug' });

    logSpy.mockRestore();
  });

  it('Given mixed locales and q-values When extracting Then primary language codes are normalized and deduplicated', () => {
    const result = extractLanguageCodes('en-US;q=0.9, fr-FR, en-GB,  ja-JP;q=0.8, fr');

    expect(result).toEqual(['en', 'fr', 'ja']);
  });

  it('Given empty and invalid tokens mixed with valid languages When extracting Then empty tokens are ignored', () => {
    const result = extractLanguageCodes(' , ;q=0.1, de-DE,   , es');

    expect(result).toEqual(['de', 'es']);
  });

  it('Given over 10 language tags When extracting Then result is capped at 10', () => {
    const result = extractLanguageCodes('en,fr,de,es,it,pt,ru,ja,ko,zh,ar');

    expect(result).toEqual(['en', 'fr', 'de', 'es', 'it', 'pt', 'ru', 'ja', 'ko', 'zh']);
  });

  it('Given D1_USE_SESSION enabled When requesting skeleton Then D1 session is used for queries', async () => {
    const feedId = await getFeedId(ACTIVE_FEED_URI);
    const indexedAt = new Date();

    await insertPost(feedId, {
      id: 1,
      uri: 'at://did:plc:testuser/app.bsky.feed.post/3jzfcijpj2z2a',
      cid: dummyCID('test-001'),
      indexedAt: indexedAt.toISOString(),
      langs: ['en'],
    });

    const response = await requestFeedSkeleton(`feed=${ACTIVE_FEED_URI}`, {}, {
      ...env,
      D1_USE_SESSION: 'enabled',
    } as typeof env);

    expect(response.status).toBe(200);
    const data: FeedSkeletonResponse = await response.json();
    expect(data.feed.length).toBe(1);
  });

  it('Given repeated skeleton requests When requesting posts Then each request performs one D1 query', async () => {
    const prepare = vi.fn(() => ({
      bind: () => ({
        all: async () => ({
          success: true,
          results: [{ uri: 'at://did:plc:testuser/app.bsky.feed.post/post', reason: null }],
        }),
      }),
    }));
    const args = {
      env: { DB: { prepare } } as unknown as Env,
      request: new Request('http://localhost'),
      feed: ACTIVE_FEED_URI,
      limit: 50,
    };

    await getFeedSkeleton(args);
    await getFeedSkeleton(args);

    expect(prepare).toHaveBeenCalledTimes(2);
  });
});
