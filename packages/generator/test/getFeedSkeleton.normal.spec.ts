import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { extractLanguageCodes } from '../src/endpoints/app/bsky/feed/getFeedSkeleton';
import {
  ACTIVE_FEED_URI,
  FeedSkeletonResponse,
  getFeedId,
  insertPost,
  requestFeedSkeleton,
  resetAndSeedFeeds,
} from './getFeedSkeleton.shared';

describe('Success cases', () => {
  beforeEach(async () => {
    await resetAndSeedFeeds();
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

  it('Given posts and cursor When requesting skeleton Then pagination works', async () => {
    const feedId = await getFeedId(ACTIVE_FEED_URI);
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

    const previousCursor = `${indexedAt.getTime()}::cid2`;

    indexedAt.setSeconds(indexedAt.getSeconds() + 1);
    await insertPost(feedId, {
      id: 3,
      uri: 'at://did:plc:testuser/app.bsky.feed.post/getfeedskeleton/post3',
      cid: 'cid3',
      indexedAt: indexedAt.toISOString(),
      langs: ['en'],
    });

    const response = await requestFeedSkeleton(`feed=${ACTIVE_FEED_URI}&cursor=${previousCursor}`);

    expect(response.status).toBe(200);
    const data: FeedSkeletonResponse = await response.json();
    expect(data.feed.length).toBe(1);
  });

  it('Given lang_filter enabled feed and Accept-Language When requesting skeleton Then matching languages are returned', async () => {
    const feedId = await getFeedId(ACTIVE_FEED_URI);
    const indexedAt = new Date();

    await insertPost(feedId, {
      id: 1,
      uri: 'at://did:plc:testuser/app.bsky.feed.post/getfeedskeleton/post1',
      cid: 'cid1',
      indexedAt: indexedAt.toISOString(),
      langs: ['en'],
    });

    indexedAt.setSeconds(indexedAt.getSeconds() + 1);
    const cursorTime = indexedAt.getTime();
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

    const response = await requestFeedSkeleton(`feed=${ACTIVE_FEED_URI}&limit=2`, {
      'Accept-Language': 'fr',
    });

    expect(response.status).toBe(200);
    const data: FeedSkeletonResponse = await response.json();
    expect(data.feed.length).toBe(2);
    expect(data.cursor).toBe(`${cursorTime}::cid2`);
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
    const logLine = logSpy.mock.calls[0][0] as string;
    const payload = JSON.parse(logLine) as Record<string, unknown>;
    expect(payload.level).toBe('debug');
    expect(payload.event).toBe('db.query.feed_skeleton.start');
    expect(payload.query).toBeTypeOf('string');
    expect(Array.isArray(payload.bindings)).toBe(true);

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
      cid: 'cid1',
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
});
